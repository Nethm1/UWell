const CounselorMessage = require('../../models/counselor/CounselorMessage');
const CounselorStudent = require('../../models/counselor/CounselorStudent');
const Counselor = require('../../models/counselor/Counselor');
const Student = require('../../models/student/Student');
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
    const attachment = req.body.attachment;
    if (!studentId || (!text && !attachment)) {
      return res.status(400).json({ success: false, message: 'A message or attachment is required' });
    }
    if (text.length > 4000) {
      return res.status(400).json({ success: false, message: 'Message must be 4,000 characters or fewer' });
    }
    if (attachment && !isAllowedAttachment(attachment)) {
      return res.status(400).json({ success: false, message: 'Unsupported or oversized attachment. Use an image or document up to 5 MB.' });
    }

    const student = await CounselorStudent.findOne({ _id: studentId, counselorId: key });
    if (!student) return res.status(404).json({ success: false, message: 'Booked student not found' });

    const newMsg = {
      id: `c-${Date.now()}`,
      sender: 'counselor',
      text,
      attachment: attachment ? safeAttachment(attachment) : undefined,
      timestamp: new Date().toISOString(),
    };
    const preview = text || `Attachment: ${attachment.name}`;
    const conversation = await CounselorMessage.findOne({ studentId, counselorId: key });

    if (conversation) {
      conversation.chatHistory = [...(conversation.chatHistory || []), newMsg];
      conversation.lastMessage = preview;
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
        lastMessage: preview,
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

// Student-side access is limited to the student's own counselor-specific booked client record.
exports.getStudentConversation = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('_id firstName lastName');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const client = await CounselorStudent.findOne({
      sourceStudentId: String(student._id),
      counselorId: String(req.params.counselorId),
    });
    if (!client) return res.status(404).json({ success: false, message: 'Book a session with this counselor to start a private chat.' });

    const [conversation, counselor] = await Promise.all([
      CounselorMessage.findOne({ studentId: client.id, counselorId: client.counselorId }),
      Counselor.findById(client.counselorId).select('firstName lastName'),
    ]);
    const data = toConversationSummary(client.toJSON(), conversation?.toJSON());
    data.counselorName = counselor ? `${counselor.firstName} ${counselor.lastName}` : 'Counselor';
    data.counselorAvatarInitials = counselor ? `${counselor.firstName?.[0] || ''}${counselor.lastName?.[0] || ''}` : 'CC';
    return res.status(200).json(data);
  } catch (error) {
    console.error('student get conversation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch conversation' });
  }
};

exports.sendStudentMessage = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('_id firstName lastName');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const client = await CounselorStudent.findOne({
      sourceStudentId: String(student._id),
      counselorId: String(req.params.counselorId),
    });
    if (!client) return res.status(404).json({ success: false, message: 'Book a session with this counselor to start a private chat.' });

    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const attachment = req.body.attachment;
    if ((!text && !attachment) || text.length > 4000) {
      return res.status(400).json({ success: false, message: 'Add a message or attachment (messages can be up to 4,000 characters).' });
    }
    if (attachment && !isAllowedAttachment(attachment)) {
      return res.status(400).json({ success: false, message: 'Unsupported or oversized attachment. Use an image or document up to 5 MB.' });
    }

    const timestamp = new Date().toISOString();
    const newMsg = {
      id: `s-${Date.now()}`,
      sender: 'student',
      text,
      ...(attachment ? { attachment: safeAttachment(attachment) } : {}),
      timestamp,
    };
    const preview = text || `Attachment: ${attachment.name}`;
    const conversation = await CounselorMessage.findOne({ studentId: client.id, counselorId: client.counselorId });
    if (conversation) {
      conversation.chatHistory = [...(conversation.chatHistory || []), newMsg];
      conversation.lastMessage = preview;
      conversation.timestamp = timestamp;
      conversation.unread = true;
      await conversation.save();
    } else {
      await CounselorMessage.create({
        _id: `chat-${client.counselorId}-${client.id}`,
        studentId: client.id,
        counselorId: client.counselorId,
        studentName: client.name,
        avatarInitials: client.avatarInitials,
        lastMessage: preview,
        timestamp,
        unread: true,
        chatHistory: [newMsg],
      });
    }
    return res.status(201).json(newMsg);
  } catch (error) {
    console.error('student send message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function isAllowedAttachment(file) {
  if (!file || typeof file.name !== 'string' || typeof file.mimeType !== 'string' || typeof file.data !== 'string') return false;
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.mimeType.toLowerCase())) return false;
  const bytes = Buffer.byteLength(file.data, 'base64');
  return bytes > 0 && bytes <= MAX_ATTACHMENT_BYTES && /^[A-Za-z0-9+/]*={0,2}$/.test(file.data);
}

function safeAttachment(file) {
  return {
    name: file.name.slice(0, 180),
    mimeType: file.mimeType.toLowerCase(),
    size: Buffer.byteLength(file.data, 'base64'),
    data: file.data,
  };
}
