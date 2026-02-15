const express = require('express');
const router = express.Router();
const { getMessages, sendMessage } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/project/:projectId', getMessages);
router.post('/project/:projectId', sendMessage);

module.exports = router;
