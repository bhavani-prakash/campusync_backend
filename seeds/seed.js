require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Like = require('../models/Like');
const Pass = require('../models/Pass');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { FICTIONAL_STUDENTS } = require('./seedData');

const seedDatabase = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campussync';
    console.log(`[Seed] Connecting to MongoDB...`);

    let conn;
    try {
      conn = await mongoose.connect(connStr, { serverSelectionTimeoutMS: 3000 });
    } catch (err) {
      console.warn(`[Seed] Direct Mongo connection failed, starting MongoMemoryServer fallback...`);
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      conn = await mongoose.connect(mongoServer.getUri());
    }

    console.log(`[Seed] Connected to MongoDB host: ${mongoose.connection.host}`);

    // Clear existing seed users
    console.log(`[Seed] Cleaning up existing fictional seed records...`);
    const seedEmails = FICTIONAL_STUDENTS.map((s) => s.email);
    const existingUsers = await User.find({ email: { $in: seedEmails } });
    const existingUserIds = existingUsers.map((u) => u._id);

    await User.deleteMany({ _id: { $in: existingUserIds } });
    await Profile.deleteMany({ userId: { $in: existingUserIds } });
    await Like.deleteMany({ $or: [{ fromUserId: { $in: existingUserIds } }, { toUserId: { $in: existingUserIds } }] });
    await Pass.deleteMany({ $or: [{ fromUserId: { $in: existingUserIds } }, { toUserId: { $in: existingUserIds } }] });
    await Match.deleteMany({ $or: [{ user1Id: { $in: existingUserIds } }, { user2Id: { $in: existingUserIds } }] });
    await Conversation.deleteMany({ participants: { $in: existingUserIds } });
    await Message.deleteMany({ $or: [{ senderId: { $in: existingUserIds } }, { receiverId: { $in: existingUserIds } }] });

    console.log(`[Seed] Seeding ${FICTIONAL_STUDENTS.length} fictional student profiles...`);

    const createdUsers = [];
    for (const student of FICTIONAL_STUDENTS) {
      const user = await User.create({
        email: student.email,
        password: student.password,
        passwordHash: student.password,
        role: 'STUDENT',
        isVerified: true,
        isOnboarded: true,
      });

      const profile = await Profile.create({
        userId: user._id,
        anonymousName: student.anonymousName,
        avatar: student.avatar,
        department: student.department,
        year: student.year,
        bio: student.bio,
        interests: student.interests,
        lookingFor: student.lookingFor,
        profileVisibility: true,
        allowDiscovery: true,
      });

      createdUsers.push({ user, profile });
    }

    console.log(`[Seed] Successfully created ${createdUsers.length} student profiles!`);

    // Create sample mutual match between Student 0 (BluePhoenix42) and Student 1 (SilentMoon18)
    if (createdUsers.length >= 2) {
      const u0 = createdUsers[0].user._id;
      const u1 = createdUsers[1].user._id;

      await Like.create({ fromUserId: u0, toUserId: u1 });
      await Like.create({ fromUserId: u1, toUserId: u0 });

      const match = await Match.create({
        user1Id: u0,
        user2Id: u1,
        isSecretCrushMatch: false,
      });

      const conv = await Conversation.create({
        participants: [u0, u1],
        lastMessage: 'Hey! Ready for the upcoming campus hackathon?',
        lastMessageSenderId: u0,
        lastMessageAt: Date.now(),
      });

      await Message.create({
        conversationId: conv._id,
        senderId: u0,
        receiverId: u1,
        content: 'Hey! Ready for the upcoming campus hackathon?',
      });

      console.log(`[Seed] Created sample mutual match & conversation between ${createdUsers[0].profile.anonymousName} and ${createdUsers[1].profile.anonymousName}!`);
    }

    console.log(`=================================================`);
    console.log(` CampusSync Database Seed Complete!`);
    console.log(` Total Fictional Profiles: ${createdUsers.length}`);
    console.log(` Seed Email Format: seed_*@mits.example`);
    console.log(` Default Password: Password123!`);
    console.log(`=================================================`);

    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error]:`, error);
    process.exit(1);
  }
};

seedDatabase();
