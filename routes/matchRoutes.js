const express = require('express');
const router = express.Router();
const {
  getMyMatches,
  sendSecretCrush,
  getMysteryMatch,
  getIcebreakers,
} = require('../controllers/matchController');
const { protect } = require('../middleware/auth');

router.get('/matches', protect, getMyMatches);
router.post('/crush', protect, sendSecretCrush);
router.get('/matches/mystery', protect, getMysteryMatch);
router.get('/matches/icebreakers/:targetUserId', protect, getIcebreakers);

module.exports = router;
