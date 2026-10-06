const Block = require('../models/Block');
const Report = require('../models/Report');
const Profile = require('../models/Profile');
const User = require('../models/User');
const Like = require('../models/Like');
const Pass = require('../models/Pass');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * @desc    Block another student profile
 * @route   POST /api/blocks
 * @access  Private
 */
const blockUser = async (req, res, next) => {
  try {
    const blockerId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required',
        errorCode: 'MISSING_TARGET_USER',
      });
    }

    if (targetUserId.toString() === blockerId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself',
        errorCode: 'CANNOT_BLOCK_SELF',
      });
    }

    const existingBlock = await Block.findOne({
      blockerId,
      blockedUserId: targetUserId,
    });

    if (existingBlock) {
      return res.status(409).json({
        success: false,
        message: 'Student is already blocked',
        errorCode: 'ALREADY_BLOCKED',
      });
    }

    await Block.create({
      blockerId,
      blockedUserId: targetUserId,
    });

    res.status(200).json({
      success: true,
      message: 'Student profile blocked successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get list of profiles blocked by current user
 * @route   GET /api/blocks
 * @access  Private
 */
const getBlockedUsers = async (req, res, next) => {
  try {
    const blockerId = req.user._id;

    const blocks = await Block.find({ blockerId }).select('blockedUserId createdAt');

    const blockedProfiles = await Promise.all(
      blocks.map(async (b) => {
        const profile = await Profile.findOne({ userId: b.blockedUserId }).select('-__v');
        return {
          blockId: b._id,
          blockedUserId: b.blockedUserId,
          blockedAt: b.createdAt,
          profile,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: blockedProfiles.filter((p) => p.profile !== null),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unblock a student profile
 * @route   DELETE /api/blocks/:id
 * @access  Private
 */
const unblockUser = async (req, res, next) => {
  try {
    const blockerId = req.user._id;
    const targetUserId = req.params.id;

    await Block.findOneAndDelete({
      blockerId,
      $or: [{ _id: targetUserId }, { blockedUserId: targetUserId }],
    });

    res.status(200).json({
      success: true,
      message: 'Student unblocked successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    File a moderation report against a student
 * @route   POST /api/reports
 * @access  Private
 */
const reportUser = async (req, res, next) => {
  try {
    const reporterId = req.user._id;
    const { reportedUserId, reason, description } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Reported user ID and reason are required',
        errorCode: 'MISSING_REPORT_FIELDS',
      });
    }

    if (reportedUserId.toString() === reporterId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot report yourself',
        errorCode: 'CANNOT_REPORT_SELF',
      });
    }

    const report = await Report.create({
      reporterId,
      reportedUserId,
      reason,
      description: description ? description.substring(0, 1000) : '',
      status: 'PENDING',
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted to moderation team successfully',
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete student account and purge/anonymize personal data
 * @route   DELETE /api/profile/account
 * @access  Private
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Delete User & Profile
    await User.findByIdAndDelete(userId);
    await Profile.findOneAndDelete({ userId });

    // Clean up associated activity
    await Like.deleteMany({ $or: [{ fromUserId: userId }, { toUserId: userId }] });
    await Pass.deleteMany({ $or: [{ fromUserId: userId }, { toUserId: userId }] });
    await Match.deleteMany({ $or: [{ user1Id: userId }, { user2Id: userId }] });
    await Block.deleteMany({ $or: [{ blockerId: userId }, { blockedUserId: userId }] });
    await Conversation.deleteMany({ participants: userId });
    await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });

    res.status(200).json({
      success: true,
      message: 'Your account and personal data have been completely deleted.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  blockUser,
  getBlockedUsers,
  unblockUser,
  reportUser,
  deleteAccount,
};
