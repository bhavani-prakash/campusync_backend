const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const { isUserOnline } = require('../sockets/chatSocket');

/**
 * @desc    Get user's active conversations list
 * @route   GET /api/conversations
 * @access  Private
 */
const getConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    // Fetch conversations where current user is a participant
    const conversations = await Conversation.find({
      participants: currentUserId,
    }).sort({ lastMessageAt: -1 });

    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const partnerId = conv.participants.find(
          (p) => p.toString() !== currentUserId.toString()
        );

        if (!partnerId) return null;

        // Verify mutual match still exists
        const existingMatch = await Match.findExistingMatch(currentUserId, partnerId);
        if (!existingMatch) return null;

        const partnerProfile = await Profile.findOne({ userId: partnerId }).select('-__v');

        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          receiverId: currentUserId,
          isRead: false,
        });

        return {
          _id: conv._id,
          lastMessage: conv.lastMessage,
          lastMessageSenderId: conv.lastMessageSenderId,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
          partner: partnerProfile
            ? {
                ...partnerProfile.toObject(),
                isOnline: isUserOnline(partnerId),
              }
            : null,
        };
      })
    );

    const validConversations = populatedConversations.filter((c) => c !== null && c.partner !== null);

    res.status(200).json({
      success: true,
      message: 'Conversations fetched successfully',
      data: validConversations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get paginated messages for a conversation
 * @route   GET /api/conversations/:id/messages
 * @access  Private
 */
const getMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const conversationId = req.params.id;

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
        errorCode: 'CONVERSATION_NOT_FOUND',
      });
    }

    // STRICT SECURITY CHECK: User MUST be a participant in the conversation!
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === currentUserId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You are not allowed to view this conversation.',
        errorCode: 'CONVERSATION_ACCESS_DENIED',
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      conversationId,
    })
      .sort({ createdAt: 1 }) // Chronological order
      .skip(skip)
      .limit(limit);

    // Format soft-deleted messages
    const formattedMessages = messages.map((m) => {
      const msgObj = m.toObject();
      if (m.deletedAt) {
        msgObj.content = 'This message was deleted';
        msgObj.isDeleted = true;
      }
      return msgObj;
    });

    // Automatically mark unread messages as read for receiver
    await Message.updateMany(
      { conversationId, receiverId: currentUserId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      data: formattedMessages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Soft delete a message owned by current user
 * @route   DELETE /api/messages/:id
 * @access  Private
 */
const deleteMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const messageId = req.params.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        errorCode: 'MESSAGE_NOT_FOUND',
      });
    }

    // STRICT SECURITY CHECK: Only message owner can delete their message!
    if (message.senderId.toString() !== currentUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are only allowed to delete your own sent messages.',
        errorCode: 'DELETE_ACCESS_DENIED',
      });
    }

    message.deletedAt = Date.now();
    await message.save();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      data: {
        _id: message._id,
        conversationId: message.conversationId,
        isDeleted: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getMessages,
  deleteMessage,
};
