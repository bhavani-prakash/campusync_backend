const Match = require('../models/Match');
const Like = require('../models/Like');
const Pass = require('../models/Pass');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { calculateCompatibility } = require('../utils/compatibility');

// Predefined icebreaker questions catalog based on interest categories
const ICEBREAKER_TEMPLATES = {
  Coding: [
    "What's your absolute favorite programming language and why?",
    "Tabs or spaces? Choose wisely! 💻",
    "What was the first project or hackathon app you ever built?",
  ],
  Gaming: [
    "PC, Console, or Mobile gaming — where do you spend most hours?",
    "What's your all-time favorite game storyline?",
    "What game are you currently grinding through?",
  ],
  Anime: [
    "Top 3 anime of all time — go!",
    "Subbed or dubbed? Let's settle this!",
    "Which anime world would you live in for a week?",
  ],
  Sports: [
    "Cricket or Football — which match makes you stay up late?",
    "What's your favorite sport to play on campus?",
  ],
  General: [
    "Tea or coffee to get through 8 AM lectures?",
    "What's your favorite spot on campus to relax?",
    "What's one place in the world you want to visit before graduating?",
    "What music playlist is on loop during study sessions?",
    "What's your favorite college activity or festival memory?",
  ],
};

/**
 * @desc    Get user's mutual matches
 * @route   GET /api/matches
 * @access  Private
 */
const getMyMatches = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    const matches = await Match.find({
      $or: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
    }).sort({ createdAt: -1 });

    const currentProfile = await Profile.findOne({ userId: currentUserId });

    // Populate partner profile for each match
    const populatedMatches = await Promise.all(
      matches.map(async (m) => {
        const partnerId = m.user1Id.toString() === currentUserId.toString() ? m.user2Id : m.user1Id;
        const partnerProfile = await Profile.findOne({ userId: partnerId }).select('-__v');

        const compatibilityScore = calculateCompatibility(currentProfile, partnerProfile);

        return {
          matchId: m._id,
          isSecretCrushMatch: m.isSecretCrushMatch,
          matchedAt: m.createdAt,
          partner: partnerProfile
            ? {
                ...partnerProfile.toObject(),
                compatibilityScore,
              }
            : null,
        };
      })
    );

    // Filter out null profiles if partner was deleted
    const validMatches = populatedMatches.filter((m) => m.partner !== null);

    res.status(200).json({
      success: true,
      message: 'Matches fetched successfully',
      data: validMatches,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Secret Crush registration (only notifies if MUTUAL)
 * @route   POST /api/crush
 * @access  Private
 */
const sendSecretCrush = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required',
        errorCode: 'MISSING_TARGET_USER',
      });
    }

    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot crush on yourself',
        errorCode: 'CANNOT_CRUSH_SELF',
      });
    }

    // Upsert or create Like document with isSecretCrush: true
    let likeDoc = await Like.findOne({
      fromUserId: currentUserId,
      toUserId: targetUserId,
    });

    if (likeDoc) {
      likeDoc.isSecretCrush = true;
      await likeDoc.save();
    } else {
      likeDoc = await Like.create({
        fromUserId: currentUserId,
        toUserId: targetUserId,
        isSecretCrush: true,
      });
    }

    // Check if target user ALREADY has a secret crush on current user
    const reciprocalLike = await Like.findOne({
      fromUserId: targetUserId,
      toUserId: currentUserId,
      isSecretCrush: true,
    });

    let isMutualSecretMatch = false;
    let matchDoc = null;

    if (reciprocalLike) {
      isMutualSecretMatch = true;
      matchDoc = await Match.findExistingMatch(currentUserId, targetUserId);
      if (!matchDoc) {
        matchDoc = await Match.create({
          user1Id: currentUserId,
          user2Id: targetUserId,
          isSecretCrushMatch: true,
        });
      } else {
        matchDoc.isSecretCrushMatch = true;
        await matchDoc.save();
      }

      // Auto create Conversation document
      const Conversation = require('../models/Conversation');
      await Conversation.findOrCreateConversation(currentUserId, targetUserId);
    }

    const targetProfile = await Profile.findOne({ userId: targetUserId });

    if (isMutualSecretMatch) {
      return res.status(200).json({
        success: true,
        message: 'You both secretly liked each other ❤️',
        data: {
          isMutualSecretMatch: true,
          match: matchDoc,
          targetProfile,
        },
      });
    }

    // NEVER reveal one-sided secret crushes to target user!
    res.status(200).json({
      success: true,
      message: 'Secret crush saved quietly. If they crush on you too, it will become a mutual match!',
      data: {
        isMutualSecretMatch: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get likes sent by authenticated user (Outbound Requests)
 * @route   GET /api/matches/sent-likes
 * @access  Private
 */
const getSentLikes = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    const likesSent = await Like.find({ fromUserId: currentUserId }).sort({ createdAt: -1 });

    const populatedLikes = await Promise.all(
      likesSent.map(async (like) => {
        const targetProfile = await Profile.findOne({ userId: like.toUserId }).select('-__v');
        if (!targetProfile) return null;

        // Check if mutual match exists
        const isMatched = await Match.findExistingMatch(currentUserId, like.toUserId);

        return {
          likeId: like._id,
          likedAt: like.createdAt,
          isSecretCrush: like.isSecretCrush,
          isMatched: Boolean(isMatched),
          targetProfile,
        };
      })
    );

    const validLikes = populatedLikes.filter((l) => l !== null);

    res.status(200).json({
      success: true,
      message: 'Sent likes fetched',
      data: validLikes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get likes received by authenticated user (Inbound Requests)
 * @route   GET /api/matches/received-likes
 * @access  Private
 */
const getReceivedLikes = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    const likesReceived = await Like.find({ toUserId: currentUserId }).sort({ createdAt: -1 });

    const populatedRequests = await Promise.all(
      likesReceived.map(async (like) => {
        const senderProfile = await Profile.findOne({ userId: like.fromUserId }).select('-__v');
        if (!senderProfile) return null;

        // Check if current user already liked them back (already matched)
        const isMatched = await Match.findExistingMatch(currentUserId, like.fromUserId);

        return {
          likeId: like._id,
          likedAt: like.createdAt,
          isSecretCrush: like.isSecretCrush,
          isMatched: Boolean(isMatched),
          senderProfile,
        };
      })
    );

    // Only show pending requests (where mutual match doesn't exist yet)
    const pendingRequests = populatedRequests.filter((r) => r !== null && !r.isMatched);

    res.status(200).json({
      success: true,
      message: 'Received likes fetched',
      data: pendingRequests,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Accept an incoming like request (relike student & form match)
 * @route   POST /api/matches/accept
 * @access  Private
 */
const acceptLike = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required',
        errorCode: 'MISSING_TARGET_USER',
      });
    }

    // Create or update reciprocal Like document
    let likeDoc = await Like.findOne({
      fromUserId: currentUserId,
      toUserId: targetUserId,
    });

    if (!likeDoc) {
      likeDoc = await Like.create({
        fromUserId: currentUserId,
        toUserId: targetUserId,
      });
    }

    // Create Match document if not exists
    let matchDoc = await Match.findExistingMatch(currentUserId, targetUserId);
    if (!matchDoc) {
      matchDoc = await Match.create({
        user1Id: currentUserId,
        user2Id: targetUserId,
        isSecretCrushMatch: false,
      });
    }

    // Auto-create Conversation document so chat opens immediately
    const Conversation = require('../models/Conversation');
    await Conversation.findOrCreateConversation(currentUserId, targetUserId);

    // Send Match Notifications to both users
    const { createNotification } = require('./notificationController');
    const currentProfile = await Profile.findOne({ userId: currentUserId });
    const targetProfile = await Profile.findOne({ userId: targetUserId });

    await createNotification({
      userId: currentUserId,
      type: 'MATCH',
      title: "It's a Match! 🎉",
      message: `You accepted ${targetProfile?.anonymousName || 'a student'}'s request!`,
      link: '/matches',
    });

    await createNotification({
      userId: targetUserId,
      type: 'MATCH',
      title: "It's a Match! 🎉",
      message: `${currentProfile?.anonymousName || 'A student'} accepted your like request!`,
      link: '/matches',
    });

    res.status(200).json({
      success: true,
      message: "It's a Match!",
      data: {
        match: matchDoc,
        targetProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Decline an incoming like request
 * @route   POST /api/matches/decline
 * @access  Private
 */
const declineLike = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required',
        errorCode: 'MISSING_TARGET_USER',
      });
    }

    // Remove Like document from target user to current user
    await Like.deleteMany({
      fromUserId: targetUserId,
      toUserId: currentUserId,
    });

    // Record Pass
    const existingPass = await Pass.findOne({
      fromUserId: currentUserId,
      toUserId: targetUserId,
    });

    if (!existingPass) {
      await Pass.create({
        fromUserId: currentUserId,
        toUserId: targetUserId,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Like request declined',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Icebreaker Questions based on shared interests
 * @route   GET /api/matches/icebreakers/:targetUserId
 * @access  Private
 */
const getIcebreakers = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { targetUserId } = req.params;

    const currentProfile = await Profile.findOne({ userId: currentUserId });
    const targetProfile = await Profile.findOne({ userId: targetUserId });

    if (!targetProfile) {
      return res.status(404).json({
        success: false,
        message: 'Match profile not found',
        errorCode: 'PROFILE_NOT_FOUND',
      });
    }

    const interestsA = currentProfile?.interests || [];
    const interestsB = targetProfile?.interests || [];

    const sharedInterests = interestsA.filter((tag) => interestsB.includes(tag));

    const icebreakers = [];

    // Select icebreakers matching shared interests
    sharedInterests.forEach((interest) => {
      if (interest.includes('Coding') || interest.includes('AI')) {
        icebreakers.push(...ICEBREAKER_TEMPLATES.Coding);
      }
      if (interest.includes('Gaming') || interest.includes('Esports')) {
        icebreakers.push(...ICEBREAKER_TEMPLATES.Gaming);
      }
      if (interest.includes('Anime')) {
        icebreakers.push(...ICEBREAKER_TEMPLATES.Anime);
      }
      if (interest.includes('Cricket') || interest.includes('Football')) {
        icebreakers.push(...ICEBREAKER_TEMPLATES.Sports);
      }
    });

    // Fallback to general icebreakers if insufficient tailored prompts
    if (icebreakers.length < 3) {
      icebreakers.push(...ICEBREAKER_TEMPLATES.General);
    }

    // Return unique 4 random icebreakers
    const uniqueQuestions = [...new Set(icebreakers)].slice(0, 4);

    res.status(200).json({
      success: true,
      data: {
        sharedInterests,
        icebreakers: uniqueQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyMatches,
  getSentLikes,
  getReceivedLikes,
  acceptLike,
  declineLike,
  sendSecretCrush,
  getIcebreakers,
};
