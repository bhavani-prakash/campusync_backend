const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageSenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index participants array for fast lookup
conversationSchema.index({ participants: 1 });

/**
 * Helper to find or create conversation between two users
 */
conversationSchema.statics.findOrCreateConversation = async function (user1Id, user2Id) {
  let conversation = await this.findOne({
    participants: { $all: [user1Id, user2Id] },
  });

  if (!conversation) {
    conversation = await this.create({
      participants: [user1Id, user2Id],
    });
  }

  return conversation;
};

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
