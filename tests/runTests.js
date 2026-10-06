const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const { calculateCompatibility } = require('../utils/compatibility');

let mongoServer;

const runTestSuite = async () => {
  console.log(`=================================================`);
  console.log(` CampusSync Automated Backend Test Suite`);
  console.log(`=================================================`);

  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    console.log(`[Test] In-memory MongoDB initialized successfully.\n`);

    let passed = 0;
    let failed = 0;

    const assert = (condition, testName) => {
      if (condition) {
        console.log(`  ✅ PASSED: ${testName}`);
        passed++;
      } else {
        console.error(`  ❌ FAILED: ${testName}`);
        failed++;
      }
    };

    // TEST 1: Registration & Password Hashing
    console.log(`--- SECTION 1: AUTHENTICATION & SECURITY ---`);
    const regRes1 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test_student1@mits.ac.in',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        anonymousName: 'CyberPanda100',
      });

    assert(regRes1.status === 201 && regRes1.body.success, 'User Registration succeeds with 201 Created');
    assert(regRes1.body.data.token && regRes1.body.data.user.id, 'JWT Token and User ID returned');
    assert(!regRes1.body.data.user.passwordHash, 'PasswordHash is never exposed in response');

    const user1Token = regRes1.body.data.token;
    const user1Id = regRes1.body.data.user.id;

    // TEST 2: Password Mismatch Validation
    const regResFail = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test_fail@mits.ac.in',
        password: 'Password123!',
        confirmPassword: 'WrongPassword!',
      });

    assert(regResFail.status === 400 && !regResFail.body.success, 'Registration rejects password mismatch with 400');

    // TEST 3: Login Authentication
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test_student1@mits.ac.in',
        password: 'Password123!',
      });

    assert(loginRes.status === 200 && loginRes.body.data.token, 'Login succeeds with valid credentials');

    // TEST 4: Get Current Authenticated User (GET /api/auth/me)
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user1Token}`);

    assert(meRes.status === 200 && meRes.body.data.user.email === 'test_student1@mits.ac.in', 'GET /api/auth/me returns authenticated identity');

    // TEST 5: Profile Updates & Handle Uniqueness
    console.log(`\n--- SECTION 2: PROFILE & ONBOARDING ---`);
    const profUpdate = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        department: 'Computer Science & Engineering',
        year: '3rd Year',
        interests: ['Coding & Web Dev', 'AI & Machine Learning'],
        lookingFor: ['Project Collaborator'],
      });

    assert(profUpdate.status === 200 && profUpdate.body.data.department === 'Computer Science & Engineering', 'PUT /api/profile updates profile fields');

    // Register User 2
    const regRes2 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test_student2@mits.ac.in',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        anonymousName: 'StarlightFox200',
      });

    const user2Token = regRes2.body.data.token;
    const user2Id = regRes2.body.data.user.id;

    // Update User 2 Profile
    await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        department: 'Computer Science & Engineering',
        year: '3rd Year',
        interests: ['Coding & Web Dev', 'AI & Machine Learning'],
      });

    // TEST 6: Compatibility Scoring
    console.log(`\n--- SECTION 3: DISCOVERY & COMPATIBILITY ---`);
    const p1 = await Profile.findOne({ userId: user1Id });
    const p2 = await Profile.findOne({ userId: user2Id });

    const score = calculateCompatibility(p1, p2);
    assert(score >= 80, `Compatibility calculation returns score >= 80 for matching interests (${score}%)`);

    // Discovery Feed Test
    const discRes = await request(app)
      .get('/api/discover')
      .set('Authorization', `Bearer ${user1Token}`);

    assert(discRes.status === 200 && discRes.body.data.length === 1, 'Discovery feed returns eligible candidates excluding self');

    // TEST 7: Liking & Mutual Match Creation
    console.log(`\n--- SECTION 4: LIKES & MUTUAL MATCHING ---`);
    const likeRes1 = await request(app)
      .post('/api/likes')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ targetUserId: user2Id });

    assert(likeRes1.status === 200 && !likeRes1.body.data.isMatch, 'User 1 likes User 2 -> single like (isMatch: false)');

    const likeRes2 = await request(app)
      .post('/api/likes')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ targetUserId: user1Id });

    assert(likeRes2.status === 200 && likeRes2.body.data.isMatch, "User 2 likes User 1 back -> Mutual Match formed! (isMatch: true)");

    // TEST 8: Chat Authorization & Conversation Privacy
    console.log(`\n--- SECTION 5: CHAT SECURITY & AUTHORIZATION ---`);
    // Register unauthorized User 3
    const regRes3 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'unauth_spy@mits.ac.in',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        anonymousName: 'UnauthSpy300',
      });

    const user3Token = regRes3.body.data.token;

    const conv = await Conversation.findOne({ participants: { $all: [user1Id, user2Id] } });
    assert(conv !== null, 'Conversation document automatically created upon mutual match');

    const unauthChatRes = await request(app)
      .get(`/api/conversations/${conv._id}/messages`)
      .set('Authorization', `Bearer ${user3Token}`);

    assert(unauthChatRes.status === 403, 'Unauthorized User 3 blocked from accessing User 1 & 2 conversation (403 Forbidden)');

    // TEST 9: Admin RBAC Protection
    console.log(`\n--- SECTION 6: ADMIN ACCESS CONTROLS ---`);
    const adminFailRes = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${user1Token}`);

    assert(adminFailRes.status === 403, 'Non-admin user blocked from /api/admin/dashboard (403 Forbidden)');

    // Promote User 1 to ADMIN and generate fresh admin JWT token
    const { generateToken } = require('../utils/jwt');
    await User.findByIdAndUpdate(user1Id, { role: 'ADMIN' });
    const adminToken = generateToken(user1Id, 'ADMIN');

    const adminSuccessRes = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    if (adminSuccessRes.status !== 200) {
      console.log('Admin test failed response:', adminSuccessRes.status, adminSuccessRes.body);
    }

    assert(adminSuccessRes.status === 200 && adminSuccessRes.body.data?.totalUsers >= 0, 'Admin user successfully accesses /api/admin/dashboard metrics');

    console.log(`\n=================================================`);
    console.log(` Test Execution Summary`);
    console.log(` Total Passed: ${passed}`);
    console.log(` Total Failed: ${failed}`);
    console.log(` Status: ${failed === 0 ? 'ALL TESTS PASSED ✅' : 'TEST FAILURES DETECTED ❌'}`);
    console.log(`=================================================`);

    process.exit(failed === 0 ? 0 : 1);
  } catch (error) {
    console.error(`[Test Runner Error]:`, error);
    process.exit(1);
  } finally {
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
};

runTestSuite();
