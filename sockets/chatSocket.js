const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// Online users map: userId -> Set of socketIds
const onlineUsersMap = new Map();

const initChatSockets = (io) => {
  // Middleware to authenticate socket connection via JWT token
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id).select('-passwordHash');

      if (!user || user.isBanned || user.isSuspended) {
        return next(new Error('User unauthorized or suspended'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Invalid socket connection token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`[Socket] Authenticated user connected: ${userId} (${socket.id})`);

    // Track online user sockets
    if (!onlineUsersMap.has(userId)) {
      onlineUsersMap.set(userId, new Set());
    }
    onlineUsersMap.get(userId).add(socket.id);

    // Broadcast online status update
    io.emit('user_online', { userId });

    // Send active online users list to connected socket
    socket.emit('online_users_list', Array.from(onlineUsersMap.keys()));

    // Join conversation room with strict authorization
    socket.on('join_conversation', async ({ conversationId }) => {
      try {
        const conversation = await Conversation.findById(conversationId);

        if (!conversation) {
          return socket.emit('socket_error', { message: 'Conversation not found' });
        }

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );

        if (!isParticipant) {
          return socket.emit('socket_error', {
            message: 'Forbidden. You are not a participant in this conversation.',
          });
        }

        socket.join(conversationId);
        console.log(`[Socket] User ${userId} joined room ${conversationId}`);
      } catch (err) {
        socket.emit('socket_error', { message: err.message });
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', ({ conversationId }) => {
      socket.leave(conversationId);
    });

    // Handle sending real-time chat messages
    socket.on('send_message', async ({ conversationId, receiverId, content }) => {
      try {
        if (!content || !content.trim()) return;

        // Security check 1: Verify mutual match between sender and receiver
        const existingMatch = await Match.findExistingMatch(userId, receiverId);
        if (!existingMatch) {
          return socket.emit('socket_error', {
            message: 'Messaging allowed only between mutual matches.',
          });
        }

        // Security check 2: Verify conversation participant status
        let conversation;
        if (conversationId) {
          conversation = await Conversation.findById(conversationId);
        } else {
          conversation = await Conversation.findOrCreateConversation(userId, receiverId);
        }

        if (
          !conversation ||
          !conversation.participants.some((p) => p.toString() === userId)
        ) {
          return socket.emit('socket_error', {
            message: 'Unauthorized conversation access.',
          });
        }

        // Create Message document in database
        const message = await Message.create({
          conversationId: conversation._id,
          senderId: userId,
          receiverId,
          content: content.trim(),
        });

        // Update conversation summary
        conversation.lastMessage = content.trim();
        conversation.lastMessageSenderId = userId;
        conversation.lastMessageAt = Date.now();
        await conversation.save();

        const senderProfile = await Profile.findOne({ userId });

        const messageData = {
          _id: message._id,
          conversationId: conversation._id,
          senderId: userId,
          receiverId,
          content: message.content,
          isRead: false,
          createdAt: message.createdAt,
          sender: {
            userId,
            anonymousName: senderProfile?.anonymousName || 'Anonymous Student',
            avatar: senderProfile?.avatar || 'avatar_preset_1',
          },
        };

        // Emit message to all participants in conversation room
        io.to(conversation._id.toString()).emit('receive_message', messageData);

        // Also notify receiver's personal sockets if they are online
        const receiverSockets = onlineUsersMap.get(receiverId);
        if (receiverSockets) {
          receiverSockets.forEach((sId) => {
            io.to(sId).emit('new_message_notification', messageData);
          });
        }
      } catch (err) {
        console.error('[Socket] send_message error:', err);
        socket.emit('socket_error', { message: err.message });
      }
    });

    // Handle typing indicators
    socket.on('typing', ({ conversationId }) => {
      socket.to(conversationId).emit('user_typing', {
        conversationId,
        userId,
      });
    });

    socket.on('stop_typing', ({ conversationId }) => {
      socket.to(conversationId).emit('user_stop_typing', {
        conversationId,
        userId,
      });
    });

    // Handle mark read status
    socket.on('mark_read', async ({ conversationId }) => {
      try {
        await Message.updateMany(
          { conversationId, receiverId: userId, isRead: false },
          { isRead: true }
        );

        socket.to(conversationId).emit('messages_read', {
          conversationId,
          readBy: userId,
        });
      } catch (err) {
        console.error('[Socket] mark_read error:', err);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${userId} (${socket.id})`);
      const userSockets = onlineUsersMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsersMap.delete(userId);
          io.emit('user_offline', { userId });
        }
      }
    });
  });
};

const isUserOnline = (userId) => {
  return onlineUsersMap.has(userId.toString());
};

module.exports = {
  initChatSockets,
  isUserOnline,
};
