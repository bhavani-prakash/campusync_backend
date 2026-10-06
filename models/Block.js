const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema(
  {
    blockerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blockedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate blocks
blockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });

const Block = mongoose.model('Block', blockSchema);
module.exports = Block;
