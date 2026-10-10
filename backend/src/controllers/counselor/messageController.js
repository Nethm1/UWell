const CounselorMessage = require('../../models/counselor/CounselorMessage');
const CounselorStudent = require('../../models/counselor/CounselorStudent');
const { counselorKey } = require('./_scope');

const toConversationSummary = (student, conversation) => ({
  id: conversation?.id || `chat-${student.id}`,
  studentId: student.id,
  counselorId: student.counselorId,
  studentName: student.name,
  avatarInitials: student.avatarInitials,
  lastMessage: conversation?.lastMessage || 'Start a conversation',
  timestamp: conversation?.timestamp || '',
  unread: conversation?.unread || false,
  chatHistory: conversation?.chatHistory || [],
});

// GET /api/counselor/messages — include an empty conversation for every booked student.
exports.getMessages = async (req, res) => {
  try {
    const key = counselorKey(req);
    const [students, conversations] = await Promise.all([
      CounselorStudent.find({ counselorId: key }).sort({ createdAt: -1 }),
      CounselorMessage.find({ counselorId: key }).sort({ updatedAt: -1 }),
    ]);
    const conversationByStudent = new Map(conversations.map((item) => [item.studentId, item.toJSON()]));
    return res.status(200).json(students.map((student) => {
      const client = student.toJSON();
      return toConversationSummary(client, conversationByStudent.get(client.id));
    }));
  } catch (error) {
    console.error('counselor getMessages error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

// GET /api/counselor/messages/:studentId — a booked student may have no messages yet.
exports.getMessageByStudentId = async (req, res) => {
  try {
    const key = counselorKey(req);
    const student = await CounselorStudent.findOne({ _id: req.params.studentId, counselorId: key });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const client = student.toJSON();
    const conversation = await CounselorMessage.findOne({
      studentId: client.id,
      counselorId: key,
    });
    return res.status(200).json(toConversationSummary(client, conversation?.toJSON()));
  } catch (error) {
    console.error('counselor getMessageByStudentId error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch conversation' });
  }
};

// POST /api/counselor/messages — only message students booked with this counselor.
exports.sendMessage = async (req, res) => {
  try {
    const key = counselorKey(req);
    const studentId = String(req.body.studentId || '');
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!studentId || !text) {
      return res.status(400).json({ success: false, message: 'studentId and text are required' });
    }
    if (text.length > 4000) {
      return res.status(400).json({ success: false, message: 'Message must be 4,000 characters or fewer' });
    }

    const student = await CounselorStudent.findOne({ _id: studentId, counselorId: key });
    if (!student) return res.status(404).json({ success: false, message: 'Booked student not found' });

    const newMsg = {
      id: `c-${Date.now()}`,
      sender: 'counselor',
      text,
      timestamp: new Date().toISOString(),
    };
    const conversation = await CounselorMessage.findOne({ studentId, counselorId: key });

    if (conversation) {
      conversation.chatHistory = [...(conversation.chatHistory || []), newMsg];
      conversation.lastMessage = text;
      conversation.timestamp = newMsg.timestamp;
      conversation.unread = false;
      await conversation.save();
    } else {
      await CounselorMessage.create({
        _id: `chat-${key}-${studentId}`,
        studentId,
        counselorId: key,
        studentName: student.name,
        avatarInitials: student.avatarInitials,
        lastMessage: text,
        timestamp: newMsg.timestamp,
        unread: false,
        chatHistory: [newMsg],
      });
    }

    return res.status(201).json(newMsg);
  } catch (error) {
    console.error('counselor sendMessage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};
