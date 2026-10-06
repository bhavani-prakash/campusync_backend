const Profile = require('../models/Profile');
const User = require('../models/User');
const { generateAnonymousName } = require('../utils/nameGenerator');

/**
 * @desc    Get authenticated user's profile
 * @route   GET /api/profile
 * @access  Private
 */
const getMyProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
        errorCode: 'PROFILE_NOT_FOUND',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile fetched successfully',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update authenticated user's profile
 * @route   PUT /api/profile
 * @access  Private
 */
const updateMyProfile = async (req, res, next) => {
  try {
    const {
      anonymousName,
      avatar,
      bio,
      department,
      year,
      interests,
      lookingFor,
      genderPreference,
      ageRange,
      profileVisibility,
      showOnlineStatus,
      allowDiscovery,
      allowMessages,
      showDepartment,
      showYear,
    } = req.body;

    const profile = await Profile.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
        errorCode: 'PROFILE_NOT_FOUND',
      });
    }

    // Check anonymous handle uniqueness if changed
    if (anonymousName && anonymousName.trim() !== profile.anonymousName) {
      const nameExists = await Profile.findOne({
        anonymousName: anonymousName.trim(),
        userId: { $ne: req.user._id },
      });

      if (nameExists) {
        return res.status(409).json({
          success: false,
          message: 'That anonymous handle is already taken by another student',
          errorCode: 'HANDLE_TAKEN',
        });
      }
      profile.anonymousName = anonymousName.trim();
    }

    if (avatar !== undefined) profile.avatar = avatar;
    if (bio !== undefined) profile.bio = bio.substring(0, 500);
    if (department !== undefined) profile.department = department;
    if (year !== undefined) profile.year = year;
    if (Array.isArray(interests)) profile.interests = interests;
    if (Array.isArray(lookingFor)) profile.lookingFor = lookingFor;
    if (genderPreference !== undefined) profile.genderPreference = genderPreference;
    if (ageRange !== undefined) profile.ageRange = ageRange;

    // Visibility toggles
    if (profileVisibility !== undefined) profile.profileVisibility = Boolean(profileVisibility);
    if (showOnlineStatus !== undefined) profile.showOnlineStatus = Boolean(showOnlineStatus);
    if (allowDiscovery !== undefined) profile.allowDiscovery = Boolean(allowDiscovery);
    if (allowMessages !== undefined) profile.allowMessages = Boolean(allowMessages);
    if (showDepartment !== undefined) profile.showDepartment = Boolean(showDepartment);
    if (showYear !== undefined) profile.showYear = Boolean(showYear);

    await profile.save();

    // Mark user as onboarded if not already
    if (!req.user.isOnboarded) {
      await User.findByIdAndUpdate(req.user._id, { isOnboarded: true });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Suggest random unique handles
 * @route   GET /api/profile/suggest-names
 * @access  Public
 */
const suggestNames = async (req, res) => {
  const suggestions = [];
  for (let i = 0; i < 5; i++) {
    suggestions.push(generateAnonymousName());
  }

  res.status(200).json({
    success: true,
    data: suggestions,
  });
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  suggestNames,
};
