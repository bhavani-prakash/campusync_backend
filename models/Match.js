const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    user1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isSecretCrushMatch: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index
matchSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

/**
 * Static method to check if a match already exists between two users regardless of order
 */
matchSchema.statics.findExistingMatch = async function (idA, idB) {
  return await this.findOne({
    $or: [
      { user1Id: idA, user2Id: idB },
      { user1Id: idB, user2Id: idA },
    ],
  });
};

const Match = mongoose.model('Match', matchSchema);
module.exports = Match;
