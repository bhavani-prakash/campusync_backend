const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    anonymousName: {
      type: String,
      required: [true, 'Anonymous handle is required'],
      unique: true,
      trim: true,
      index: true,
    },
    avatar: {
      type: String,
      default: 'avatar_default_1',
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: '',
    },
    department: {
      type: String,
      default: 'General Student',
      trim: true,
    },
    year: {
      type: String,
      enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate', 'Other'],
      default: '1st Year',
    },
    interests: {
      type: [String],
      default: [],
    },
    lookingFor: {
      type: [String],
      default: [],
    },
    genderPreference: {
      type: String,
      enum: ['Any', 'Male', 'Female', 'Non-Binary'],
      default: 'Any',
    },
    ageRange: {
      type: String,
      default: '18-25',
    },
    profileVisibility: {
      type: Boolean,
      default: true,
    },
    showOnlineStatus: {
      type: Boolean,
      default: true,
    },
    allowDiscovery: {
      type: Boolean,
      default: true,
    },
    allowMessages: {
      type: Boolean,
      default: true,
    },
    showDepartment: {
      type: Boolean,
      default: true,
    },
    showYear: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

profileSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Profile = mongoose.model('Profile', profileSchema);
module.exports = Profile;
