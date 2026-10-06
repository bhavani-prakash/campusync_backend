const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isSecretCrush: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate likes between same user pair
likeSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

const Like = mongoose.model('Like', likeSchema);
module.exports = Like;
