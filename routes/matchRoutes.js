const express = require('express');
const router = express.Router();
const {
  getMyMatches,
  getSentLikes,
  getReceivedLikes,
  acceptLike,
  declineLike,
  sendSecretCrush,
  getIcebreakers,
} = require('../controllers/matchController');
const { protect } = require('../middleware/auth');

router.get('/matches', protect, getMyMatches);
router.get('/matches/sent-likes', protect, getSentLikes);
router.get('/matches/received-likes', protect, getReceivedLikes);
router.post('/matches/accept', protect, acceptLike);
router.post('/matches/decline', protect, declineLike);
router.post('/crush', protect, sendSecretCrush);
router.get('/matches/icebreakers/:targetUserId', protect, getIcebreakers);

module.exports = router;
