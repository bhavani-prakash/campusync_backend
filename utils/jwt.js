const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_campussync_dev';

/**
 * Generate a JWT containing essential identity info
 */
const generateToken = (userId, role = 'STUDENT') => {
  return jwt.sign(
    { id: userId, role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyToken,
};
