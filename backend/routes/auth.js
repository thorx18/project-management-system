const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword, getUsers } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);
router.get('/users', protect, getUsers);

module.exports = router;
