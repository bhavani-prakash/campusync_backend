const mongoose = require('mongoose');

const passSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
  }
);

passSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

const Pass = mongoose.model('Pass', passSchema);
module.exports = Pass;
