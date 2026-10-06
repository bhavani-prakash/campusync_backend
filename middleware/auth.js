const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = verifyToken(token);

      const user = await User.findById(decoded.id).select('-passwordHash');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists',
          errorCode: 'AUTH_USER_NOT_FOUND',
        });
      }

      if (user.isBanned) {
        return res.status(403).json({
          success: false,
          message: `Account is banned: ${user.banReason || 'Violation of community guidelines'}`,
          errorCode: 'ACCOUNT_BANNED',
        });
      }

      if (user.isSuspended) {
        return res.status(403).json({
          success: false,
          message: 'Account is temporarily suspended',
          errorCode: 'ACCOUNT_SUSPENDED',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed or expired',
        errorCode: 'INVALID_TOKEN',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Token missing.',
      errorCode: 'TOKEN_REQUIRED',
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Forbidden. Admin privileges required.',
      errorCode: 'ADMIN_ACCESS_REQUIRED',
    });
  }
};

module.exports = {
  protect,
  requireAdmin,
};
