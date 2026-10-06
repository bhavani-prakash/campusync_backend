const express = require('express');
const router = express.Router();
const { getMyProfile, updateMyProfile, suggestNames } = require('../controllers/profileController');
const { protect } = require('../middleware/auth');

router.get('/suggest-names', suggestNames);
router.get('/', protect, getMyProfile);
router.put('/', protect, updateMyProfile);

module.exports = router;
