const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const Message = require('../models/Message');
const Report = require('../models/Report');
const Block = require('../models/Block');

/**
 * @desc    Get aggregated platform admin metrics
 * @route   GET /api/admin/dashboard
 * @access  Private/Admin
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'STUDENT' });
    const activeUsers = await User.countDocuments({
      role: 'STUDENT',
      isSuspended: false,
      isBanned: false,
    });
    const totalMatches = await Match.countDocuments();
    const totalMessages = await Message.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'PENDING' });
    const blockedCount = await Block.countDocuments();
    const bannedUsers = await User.countDocuments({ isBanned: true });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalMatches,
        totalMessages,
        pendingReports,
        blockedCount,
        bannedUsers,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all filed reports for moderation
 * @route   GET /api/admin/reports
 * @access  Private/Admin
 */
const getAdminReports = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const reports = await Report.find(query).sort({ createdAt: -1 });

    const populatedReports = await Promise.all(
      reports.map(async (r) => {
        const reporterProfile = await Profile.findOne({ userId: r.reporterId }).select('-__v');
        const reportedProfile = await Profile.findOne({ userId: r.reportedUserId }).select('-__v');
        const reportedUser = await User.findById(r.reportedUserId).select('isSuspended isBanned banReason email role');

        return {
          _id: r._id,
          reason: r.reason,
          description: r.description,
          status: r.status,
          adminNotes: r.adminNotes,
          createdAt: r.createdAt,
          reporter: reporterProfile,
          reportedStudent: {
            user: reportedUser,
            profile: reportedProfile,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: populatedReports,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update report status or admin notes
 * @route   PUT /api/admin/reports/:id
 * @access  Private/Admin
 */
const updateReportStatus = async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    const reportId = req.params.id;

    const report = await Report.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
        errorCode: 'REPORT_NOT_FOUND',
      });
    }

    if (status) report.status = status;
    if (adminNotes !== undefined) report.adminNotes = adminNotes;

    await report.save();

    res.status(200).json({
      success: true,
      message: 'Report status updated',
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Suspend or unsuspend student account
 * @route   PUT /api/admin/users/:id/suspend
 * @access  Private/Admin
 */
const suspendUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const { suspend = true } = req.body;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND',
      });
    }

    user.isSuspended = Boolean(suspend);
    await user.save();

    res.status(200).json({
      success: true,
      message: `Account ${suspend ? 'suspended' : 'unsuspended'} successfully`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Ban student account
 * @route   PUT /api/admin/users/:id/ban
 * @access  Private/Admin
 */
const banUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const { banReason = 'Violation of community guidelines' } = req.body;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND',
      });
    }

    user.isBanned = true;
    user.banReason = banReason;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account banned successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unban student account
 * @route   PUT /api/admin/users/:id/unban
 * @access  Private/Admin
 */
const unbanUser = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        errorCode: 'USER_NOT_FOUND',
      });
    }

    user.isBanned = false;
    user.banReason = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account unbanned successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete inappropriate chat message by admin
 * @route   DELETE /api/admin/messages/:id
 * @access  Private/Admin
 */
const deleteInappropriateMessage = async (req, res, next) => {
  try {
    const messageId = req.params.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        errorCode: 'MESSAGE_NOT_FOUND',
      });
    }

    message.deletedAt = Date.now();
    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message deleted by administrator',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getAdminReports,
  updateReportStatus,
  suspendUser,
  banUser,
  unbanUser,
  deleteInappropriateMessage,
};
