const Block = require('../models/Block');

/**
 * Returns array of UserIds that are blocked by current user OR have blocked current user
 */
const getBlockedUserIds = async (userId) => {
  const blocksSent = await Block.find({ blockerId: userId }).select('blockedUserId');
  const blocksReceived = await Block.find({ blockedUserId: userId }).select('blockerId');

  const set = new Set([
    ...blocksSent.map((b) => b.blockedUserId.toString()),
    ...blocksReceived.map((b) => b.blockerId.toString()),
  ]);

  return Array.from(set);
};

/**
 * Checks if a block relationship exists between userA and userB in either direction
 */
const isBlockedBetween = async (userAId, userBId) => {
  const block = await Block.findOne({
    $or: [
      { blockerId: userAId, blockedUserId: userBId },
      { blockerId: userBId, blockedUserId: userAId },
    ],
  });
  return !!block;
};

module.exports = {
  getBlockedUserIds,
  isBlockedBetween,
};
