const express = require('express');
const router = express.Router();
const {
  blockUser,
  getBlockedUsers,
  unblockUser,
  reportUser,
  deleteAccount,
} = require('../controllers/safetyController');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Report submission rate limit reached.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
  },
});

router.post('/blocks', protect, blockUser);
router.get('/blocks', protect, getBlockedUsers);
router.delete('/blocks/:id', protect, unblockUser);
router.post('/reports', protect, reportLimiter, reportUser);
router.delete('/profile/account', protect, deleteAccount);

module.exports = router;
