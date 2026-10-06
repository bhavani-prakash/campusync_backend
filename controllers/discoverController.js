const Profile = require('../models/Profile');
const Like = require('../models/Like');
const Pass = require('../models/Pass');
const Match = require('../models/Match');
const User = require('../models/User');
const { calculateCompatibility } = require('../utils/compatibility');

/**
 * @desc    Get anonymous student discovery feed
 * @route   GET /api/discover
 * @access  Private
 */
const getDiscoveryFeed = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    // Fetch current user's profile for compatibility scoring
    const currentProfile = await Profile.findOne({ userId: currentUserId });

    // Fetch block list (users current user blocked OR users who blocked current user)
    const { getBlockedUserIds } = require('../utils/blockHelper');
    const blockedUserIds = await getBlockedUserIds(currentUserId);

    // Find all users current user has already liked
    const existingLikes = await Like.find({ fromUserId: currentUserId }).select('toUserId');

    // Passed users are kept in discovery feed so users can review them anytime
    const excludedUserIds = [
      currentUserId,
      ...blockedUserIds,
      ...existingLikes.map((l) => l.toUserId),
    ];

    // Build filter criteria
    const query = {
      userId: { $nin: excludedUserIds },
      allowDiscovery: true,
      profileVisibility: true,
    };

    const { department, year, interest, lookingFor, page = 1, limit = 10 } = req.query;

    if (department) {
      query.department = department;
    }

    if (year) {
      query.year = year;
    }

    if (interest) {
      query.interests = interest;
    }

    if (lookingFor) {
      query.lookingFor = lookingFor;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch candidates
    const profiles = await Profile.find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .select('-__v');

    const totalCount = await Profile.countDocuments(query);

    // Calculate compatibility score for each candidate card
    const candidatesWithScore = profiles.map((p) => {
      const obj = p.toObject();
      obj.compatibilityScore = calculateCompatibility(currentProfile, p);
      return obj;
    });

    // Sort candidates by highest compatibility score
    candidatesWithScore.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    res.status(200).json({
      success: true,
      message: 'Discovery feed fetched',
      data: candidatesWithScore,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Like an anonymous student profile
 * @route   POST /api/likes
 * @access  Private
 */
const likeUser = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { targetUserId, isSecretCrush = false } = req.body;

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
        message: 'You cannot like your own profile',
        errorCode: 'CANNOT_LIKE_SELF',
      });
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Student profile no longer exists',
        errorCode: 'USER_NOT_FOUND',
      });
    }

    // Check existing like
    const existingLike = await Like.findOne({
      fromUserId: currentUserId,
      toUserId: targetUserId,
    });

    if (existingLike) {
      return res.status(409).json({
        success: false,
        message: 'You have already liked this profile',
        errorCode: 'DUPLICATE_LIKE',
      });
    }

    // Create Like document
    const newLike = await Like.create({
      fromUserId: currentUserId,
      toUserId: targetUserId,
      isSecretCrush: Boolean(isSecretCrush),
    });

    // Check if target user has also liked current user (Mutual Match!)
    const reciprocalLike = await Like.findOne({
      fromUserId: targetUserId,
      toUserId: currentUserId,
    });

    let isMatch = false;
    let matchDoc = null;

    if (reciprocalLike) {
      isMatch = true;
      // Check if existing match document exists
      matchDoc = await Match.findExistingMatch(currentUserId, targetUserId);
      if (!matchDoc) {
        matchDoc = await Match.create({
          user1Id: currentUserId,
          user2Id: targetUserId,
          isSecretCrushMatch: newLike.isSecretCrush && reciprocalLike.isSecretCrush,
        });
      }

      // Automatically create or fetch Conversation document so it appears in chat list
      const Conversation = require('../models/Conversation');
      await Conversation.findOrCreateConversation(currentUserId, targetUserId);

      // Create notification records for both matched users
      const { createNotification } = require('./notificationController');
      const currentProfile = await Profile.findOne({ userId: currentUserId });
      const targetProfile = await Profile.findOne({ userId: targetUserId });
      await createNotification({
        userId: currentUserId,
        type: 'MATCH',
        title: "It's a Match!",
        message: `You matched with ${targetProfile?.anonymousName || 'a student'}!`,
        link: '/matches',
      });
      await createNotification({
        userId: targetUserId,
        type: 'MATCH',
        title: "It's a Match!",
        message: `You matched with ${currentProfile?.anonymousName || 'a student'}!`,
        link: '/matches',
      });
    }

    const targetProfile = await Profile.findOne({ userId: targetUserId });

    res.status(200).json({
      success: true,
      message: isMatch ? "It's a Match!" : 'Profile liked successfully',
      data: {
        isMatch,
        match: matchDoc,
        targetProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Pass an anonymous student profile
 * @route   POST /api/passes
 * @access  Private
 */
const passUser = async (req, res, next) => {
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

    // Prevent duplicate pass record errors silently
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
      message: 'Passed profile',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDiscoveryFeed,
  likeUser,
  passUser,
};
