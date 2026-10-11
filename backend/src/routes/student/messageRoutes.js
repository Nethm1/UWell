const express = require('express');
const { protect, authorise } = require('../../middleware/auth');
const messageController = require('../../controllers/counselor/messageController');

const router = express.Router();
router.use(protect, authorise('student'));
router.get('/:counselorId', messageController.getStudentConversation);
router.post('/:counselorId', messageController.sendStudentMessage);

module.exports = router;
