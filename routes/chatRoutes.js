const express = require('express');
const router = express.Router();
const { getConversations, getMessages, deleteMessage } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: 'Message rate limit exceeded.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
  },
});

router.get('/conversations', protect, getConversations);
router.get('/conversations/:id/messages', protect, getMessages);
router.delete('/messages/:id', protect, messageLimiter, deleteMessage);

module.exports = router;
