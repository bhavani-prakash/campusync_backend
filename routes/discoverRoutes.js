const express = require('express');
const router = express.Router();
const { getDiscoveryFeed, likeUser, passUser } = require('../controllers/discoverController');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limit for likes to prevent spamming
const likeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 likes per 15 mins
  message: {
    success: false,
    message: 'Like rate limit reached. Please slow down.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
  },
});

router.get('/discover', protect, getDiscoveryFeed);
router.post('/likes', protect, likeLimiter, likeUser);
router.post('/passes', protect, passUser);

module.exports = router;
