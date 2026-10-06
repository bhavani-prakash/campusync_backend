const User = require('../models/User');
const Profile = require('../models/Profile');
const { generateToken } = require('../utils/jwt');
const { generateAnonymousName } = require('../utils/nameGenerator');

/**
 * @desc    Register a new student account
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { email, password, confirmPassword, anonymousName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
        errorCode: 'MISSING_FIELDS',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
        errorCode: 'PASSWORD_MISMATCH',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
        errorCode: 'PASSWORD_TOO_SHORT',
      });
    }

    // Optional college email verification check
    const isCollegeVerificationEnabled = process.env.COLLEGE_EMAIL_VERIFICATION === 'true';
    const collegeDomain = (process.env.COLLEGE_EMAIL_DOMAIN || 'mits.ac.in').toLowerCase();

    const normalizedEmail = email.toLowerCase().trim();

    if (isCollegeVerificationEnabled && !normalizedEmail.endsWith(`@${collegeDomain}`)) {
      return res.status(400).json({
        success: false,
        message: `Registration requires an official @${collegeDomain} email address`,
        errorCode: 'INVALID_COLLEGE_EMAIL',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists',
        errorCode: 'EMAIL_ALREADY_EXISTS',
      });
    }

    // Generate unique anonymous handle
    let handle = anonymousName?.trim() || generateAnonymousName();
    let isHandleUnique = false;
    let handleAttempts = 0;

    while (!isHandleUnique && handleAttempts < 10) {
      const existingProfile = await Profile.findOne({ anonymousName: handle });
      if (!existingProfile) {
        isHandleUnique = true;
      } else {
        handle = generateAnonymousName();
        handleAttempts++;
      }
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      role: 'STUDENT',
      isVerified: !isCollegeVerificationEnabled,
      isOnboarded: false,
    });

    // Create profile
    const profile = await Profile.create({
      userId: user._id,
      anonymousName: handle,
      avatar: 'avatar_preset_1',
    });

    // Generate token
    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          isOnboarded: user.isOnboarded,
          createdAt: user.createdAt,
        },
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
        errorCode: 'MISSING_FIELDS',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email and select passwordHash explicitly
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        errorCode: 'INVALID_CREDENTIALS',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `Account is banned: ${user.banReason || 'Community guideline violation'}`,
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

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Fetch profile
    const profile = await Profile.findOne({ userId: user._id });

    // Generate JWT
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          isOnboarded: user.isOnboarded,
          createdAt: user.createdAt,
        },
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current authenticated user info
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ userId: req.user._id });

    res.status(200).json({
      success: true,
      message: 'Authenticated user details fetched',
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role,
          isVerified: req.user.isVerified,
          isOnboarded: req.user.isOnboarded,
          createdAt: req.user.createdAt,
        },
        profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Public
 */
const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * @desc    Promote user to admin role (Development / Setup helper)
 * @route   POST /api/auth/make-admin
 * @access  Public (Development only)
 */
const makeAdmin = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.role = 'ADMIN';
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.email} promoted to ADMIN role`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  makeAdmin,
};
