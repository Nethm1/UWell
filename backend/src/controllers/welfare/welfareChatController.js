const mongoose = require('mongoose');
const WelfareMessage = require('../../models/welfare/WelfareMessage');
const Welfare = require('../../models/welfare/Welfare');
const Student = require('../../models/student/Student');
const { sendNotification } = require('../../utils/notificationHelper');

/**
 * Helper to safely sanitize attachment payload
 */
const sanitizeAttachment = (attachment) => {
  if (!attachment || typeof attachment !== 'object') return null;
  return {
    name: String(attachment.name || 'attachment').slice(0, 255),
    url: String(attachment.url || ''),
    type: String(attachment.type || 'document'),
    size: Number(attachment.size || 0),
  };
};

/**
 * GET /api/welfare-chat/officers
 * For students: returns list of all approved welfare officers with availability,
 * emergency status, and conversation preview if exists.
 */
exports.getAvailableOfficers = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const officers = await Welfare.find({ isApproved: true }).sort({ availabilityStatus: -1, firstName: 1 });

    // Fetch student's existing conversations with officers
    let existingConvs = [];
    if (studentId) {
      existingConvs = await WelfareMessage.find({ studentId }).lean();
    }
    const convMap = new Map();
    existingConvs.forEach((c) => {
      convMap.set(c.welfareId, c);
    });

    const list = officers.map((o) => {
      const oId = o._id.toString();
      const conv = convMap.get(oId) || convMap.get(o.staffId);
      const fullName = o.fullName || `${o.firstName || ''} ${o.lastName || ''}`.trim() || 'Welfare Officer';

      return {
        id: oId,
        _id: oId,
        staffId: o.staffId,
        name: fullName,
        firstName: o.firstName,
        lastName: o.lastName,
        department: o.department,
        position: o.position,
        phone: o.phone,
        email: o.email,
        officeLocation: o.officeLocation || 'Main Student Welfare Centre',
        profilePicture: o.profilePicture,
        bio: o.bio,
        specializations: o.specializations || [],
        officeHours: o.officeHours || 'Monday – Friday, 8:30 AM – 4:30 PM',
        qualifications: o.qualifications,
        yearsOfExperience: o.yearsOfExperience,
        languages: o.languages || ['English'],
        emergencyContactPhone: o.emergencyContactPhone || o.phone,
        emergencyAvailable: Boolean(o.emergencyAvailable),
        workingSchedule: o.workingSchedule || 'Full-time On Campus',
        availabilityStatus: o.availabilityStatus || 'Available Today',
        consultationMode: o.consultationMode || 'In-Person & Online',
        workingDays: o.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        availabilityNote: o.availabilityNote || '',
        conversationId: conv?._id?.toString() || null,
        lastMessage: conv?.lastMessage || '',
        lastMessageAt: conv?.lastMessageAt || null,
        unreadCount: conv?.unreadForStudent || 0,
        isEmergencyActive: Boolean(conv?.isEmergency && conv?.emergencyAlert?.active),
      };
    });

    res.status(200).json({
      success: true,
      count: list.length,
      officers: list,
    });
  } catch (error) {
    console.error('❌ getAvailableOfficers error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching welfare officers' });
  }
};

/**
 * GET /api/welfare-chat/officer/:officerId
 * For students: returns single officer full details
 */
exports.getOfficerProfile = async (req, res) => {
  try {
    const { officerId } = req.params;
    let officer = null;
    if (mongoose.Types.ObjectId.isValid(officerId)) {
      officer = await Welfare.findById(officerId);
    }
    if (!officer) {
      officer = await Welfare.findOne({ staffId: String(officerId).toUpperCase() });
    }

    if (!officer) {
      return res.status(404).json({ success: false, message: 'Welfare officer not found' });
    }

    res.status(200).json({
      success: true,
      officer: {
        id: officer._id.toString(),
        _id: officer._id.toString(),
        staffId: officer.staffId,
        name: officer.fullName || `${officer.firstName} ${officer.lastName}`.trim(),
        firstName: officer.firstName,
        lastName: officer.lastName,
        department: officer.department,
        position: officer.position,
        phone: officer.phone,
        email: officer.email,
        officeLocation: officer.officeLocation || 'Main Welfare Centre',
        profilePicture: officer.profilePicture,
        bio: officer.bio,
        specializations: officer.specializations || [],
        officeHours: officer.officeHours,
        qualifications: officer.qualifications,
        yearsOfExperience: officer.yearsOfExperience,
        languages: officer.languages,
        emergencyContactPhone: officer.emergencyContactPhone || officer.phone,
        emergencyAvailable: Boolean(officer.emergencyAvailable),
        workingSchedule: officer.workingSchedule,
        availabilityStatus: officer.availabilityStatus,
        consultationMode: officer.consultationMode,
        workingDays: officer.workingDays,
        availabilityNote: officer.availabilityNote,
      },
    });
  } catch (error) {
    console.error('❌ getOfficerProfile error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching officer profile' });
  }
};

/**
 * GET /api/welfare-chat/conversation/:targetId
 * If student calls: targetId is officerId
 * If officer calls: targetId is studentId
 */
exports.getConversation = async (req, res) => {
  try {
    const currentUserId = req.user?.id ? req.user.id.toString() : '';
    const userRole = req.user?.role;
    const { targetId } = req.params;

    if (!currentUserId || !targetId) {
      return res.status(400).json({ success: false, message: 'User IDs are required' });
    }

    let studentId = '';
    let officerId = '';

    // Check if targetId is an existing WelfareMessage conversation ID
    let conv = null;
    if (mongoose.Types.ObjectId.isValid(targetId)) {
      conv = await WelfareMessage.findById(targetId);
      if (conv) {
        studentId = conv.studentId;
        officerId = conv.welfareId;
      }
    }

    if (!conv) {
      if (userRole === 'student') {
        studentId = currentUserId;
        officerId = targetId;
      } else {
        studentId = targetId;
        officerId = currentUserId;
      }
    }

    // Resolve officer
    let officerDoc = null;
    if (mongoose.Types.ObjectId.isValid(officerId)) {
      officerDoc = await Welfare.findById(officerId);
    }
    if (!officerDoc) {
      officerDoc = await Welfare.findOne({ staffId: String(officerId).toUpperCase() });
    }

    // Resolve student
    let studentDoc = null;
    if (mongoose.Types.ObjectId.isValid(studentId)) {
      studentDoc = await Student.findById(studentId);
    }
    if (!studentDoc) {
      studentDoc = await Student.findOne({ studentId: String(studentId).toUpperCase() });
    }

    const officialOfficerId = officerDoc ? officerDoc._id.toString() : officerId;
    const officialStudentId = studentDoc ? studentDoc._id.toString() : studentId;

    // Find conversation if not already resolved by ID
    if (!conv) {
      conv = await WelfareMessage.findOne({
        studentId: officialStudentId,
        $or: [{ welfareId: officialOfficerId }, { welfareId: officerDoc?.staffId || '' }],
      });
    }

    if (!conv) {
      // Create fresh conversation container
      const studentName = studentDoc ? `${studentDoc.firstName} ${studentDoc.lastName}`.trim() : 'Student';
      const officerName = officerDoc ? `${officerDoc.firstName} ${officerDoc.lastName}`.trim() : 'Welfare Officer';

      conv = await WelfareMessage.create({
        studentId: officialStudentId,
        welfareId: officialOfficerId,
        studentName,
        studentRegNo: studentDoc?.studentId || '',
        studentPhone: studentDoc?.phone || '',
        studentEmail: studentDoc?.email || '',
        studentFaculty: studentDoc?.faculty || '',
        officerName,
        officerStaffId: officerDoc?.staffId || '',
        officerPhone: officerDoc?.phone || '',
        officerOfficeLocation: officerDoc?.officeLocation || '',
        chatHistory: [],
      });
    } else {
      // Reset unread count for current reader
      if (userRole === 'student') {
        conv.unreadForStudent = 0;
      } else {
        conv.unreadForOfficer = 0;
      }
      await conv.save();
    }

    res.status(200).json({
      success: true,
      conversation: conv,
      officer: officerDoc ? {
        id: officerDoc._id.toString(),
        name: officerDoc.fullName || `${officerDoc.firstName} ${officerDoc.lastName}`.trim(),
        phone: officerDoc.phone,
        emergencyContactPhone: officerDoc.emergencyContactPhone || officerDoc.phone,
        officeLocation: officerDoc.officeLocation,
        availabilityStatus: officerDoc.availabilityStatus,
        emergencyAvailable: officerDoc.emergencyAvailable,
        profilePicture: officerDoc.profilePicture,
      } : null,
      student: studentDoc ? {
        id: studentDoc._id.toString(),
        name: `${studentDoc.firstName} ${studentDoc.lastName}`.trim(),
        studentId: studentDoc.studentId,
        phone: studentDoc.phone,
        email: studentDoc.email,
        faculty: studentDoc.faculty,
        degreeProgram: studentDoc.degreeProgram,
      } : null,
    });
  } catch (error) {
    console.error('❌ getConversation error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving conversation' });
  }
};

/**
 * POST /api/welfare-chat/message/:targetId
 * Sends a message in the conversation thread.
 * If sender is student, targetId is officerId.
 * If sender is welfare officer, targetId is studentId.
 */
exports.sendMessage = async (req, res) => {
  try {
    const currentUserId = req.user?.id ? req.user.id.toString() : '';
    const userRole = req.user?.role;
    const { targetId } = req.params;
    const { text, isEmergency, attachment } = req.body;

    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (!trimmedText && !attachment) {
      return res.status(400).json({ success: false, message: 'Message text or attachment is required' });
    }

    let studentId = '';
    let officerId = '';

    if (userRole === 'student') {
      studentId = currentUserId;
      officerId = targetId;
    } else {
      studentId = targetId;
      officerId = currentUserId;
    }

    // Resolve records
    let officerDoc = null;
    if (mongoose.Types.ObjectId.isValid(officerId)) officerDoc = await Welfare.findById(officerId);
    if (!officerDoc) officerDoc = await Welfare.findOne({ staffId: String(officerId).toUpperCase() });

    let studentDoc = null;
    if (mongoose.Types.ObjectId.isValid(studentId)) studentDoc = await Student.findById(studentId);
    if (!studentDoc) studentDoc = await Student.findOne({ studentId: String(studentId).toUpperCase() });

    const officialOfficerId = officerDoc ? officerDoc._id.toString() : officerId;
    const officialStudentId = studentDoc ? studentDoc._id.toString() : studentId;

    let conv = await WelfareMessage.findOne({
      studentId: officialStudentId,
      $or: [{ welfareId: officialOfficerId }, { welfareId: officerDoc?.staffId || '' }],
    });

    const studentName = studentDoc ? `${studentDoc.firstName} ${studentDoc.lastName}`.trim() : 'Student';
    const officerName = officerDoc ? `${officerDoc.firstName} ${officerDoc.lastName}`.trim() : 'Welfare Officer';

    if (!conv) {
      conv = new WelfareMessage({
        studentId: officialStudentId,
        welfareId: officialOfficerId,
        studentName,
        studentRegNo: studentDoc?.studentId || '',
        studentPhone: studentDoc?.phone || '',
        studentEmail: studentDoc?.email || '',
        studentFaculty: studentDoc?.faculty || '',
        officerName,
        officerStaffId: officerDoc?.staffId || '',
        officerPhone: officerDoc?.phone || '',
        officerOfficeLocation: officerDoc?.officeLocation || '',
        chatHistory: [],
      });
    }

    const isUrgent = Boolean(isEmergency && userRole === 'student');
    const senderName = userRole === 'student' ? studentName : officerName;

    const newMsgItem = {
      id: `wm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: currentUserId,
      senderRole: userRole,
      senderName,
      text: trimmedText || (attachment ? `Sent attachment: ${attachment.name}` : ''),
      isEmergency: isUrgent,
      attachment: sanitizeAttachment(attachment),
      timestamp: new Date().toISOString(),
      read: false,
    };

    conv.chatHistory.push(newMsgItem);
    conv.lastMessage = (isUrgent ? '🚨 [EMERGENCY] ' : '') + newMsgItem.text;
    conv.lastMessageAt = new Date();

    if (userRole === 'student') {
      conv.unreadForOfficer = (conv.unreadForOfficer || 0) + 1;
      if (isUrgent) {
        conv.isEmergency = true;
        conv.emergencyAlert = {
          active: true,
          triggeredAt: new Date(),
          message: trimmedText,
          resolved: false,
          resolvedAt: null,
        };
      }
    } else {
      conv.unreadForStudent = (conv.unreadForStudent || 0) + 1;
    }

    await conv.save();

    // ── Real-Time Sockets & Push Notifications ──────────────────────────────
    const io = req.app.get('io');
    const recipientId = userRole === 'student' ? officialOfficerId : officialStudentId;

    if (io) {
      // 1. Deliver message to recipient's room
      io.to('user:' + recipientId).emit('welfare:new-message', {
        conversationId: conv._id.toString(),
        message: newMsgItem,
        isEmergency: isUrgent,
        unreadCount: userRole === 'student' ? conv.unreadForOfficer : conv.unreadForStudent,
      });

      // If sent to an officer, also send to their staffId room if applicable
      if (userRole === 'student' && officerDoc?.staffId) {
        io.to('user:' + officerDoc.staffId).emit('welfare:new-message', {
          conversationId: conv._id.toString(),
          message: newMsgItem,
          isEmergency: isUrgent,
          unreadCount: conv.unreadForOfficer,
        });
      }

      // 2. Echo back to sender's other tabs/sockets
      io.to('user:' + currentUserId).emit('welfare:message-sent', {
        conversationId: conv._id.toString(),
        message: newMsgItem,
      });

      // 3. If Emergency SOS triggered, fire dedicated emergency broadcast & push
      if (isUrgent) {
        const emergencyPayload = {
          conversationId: conv._id.toString(),
          studentId: officialStudentId,
          studentName,
          studentRegNo: studentDoc?.studentId || 'N/A',
          studentPhone: studentDoc?.phone || 'N/A',
          studentFaculty: studentDoc?.faculty || 'N/A',
          message: trimmedText,
          triggeredAt: new Date().toISOString(),
        };

        io.to('user:' + officialOfficerId).emit('welfare:emergency-sos', emergencyPayload);
        if (officerDoc?.staffId) {
          io.to('user:' + officerDoc.staffId).emit('welfare:emergency-sos', emergencyPayload);
        }

        // Store official system notification for officer
        await sendNotification(
          officialOfficerId,
          'welfare',
          '🚨 EMERGENCY SOS ALERT',
          `Student ${studentName} (${studentDoc?.studentId || ''}) triggered an emergency crisis alert: "${trimmedText}"`,
          'emergency_sos',
          conv._id,
          io,
          {
            studentId: officialStudentId,
            studentName,
            studentPhone: studentDoc?.phone || '',
            studentRegNo: studentDoc?.studentId || '',
            conversationId: conv._id.toString(),
            message: trimmedText,
            isEmergency: true,
          }
        );
      } else if (userRole === 'student') {
        // Normal student message notification for welfare officer
        await sendNotification(
          officialOfficerId,
          'welfare',
          `Message from ${studentName}`,
          trimmedText,
          'student_message',
          conv._id,
          io,
          {
            studentId: officialStudentId,
            studentName,
            studentPhone: studentDoc?.phone || '',
            studentRegNo: studentDoc?.studentId || '',
            studentFaculty: studentDoc?.faculty || '',
            conversationId: conv._id.toString(),
            message: trimmedText,
            isEmergency: false,
          }
        );
      } else if (userRole === 'welfare') {
        // Normal officer reply notification for student
        await sendNotification(
          officialStudentId,
          'student',
          `Message from ${officerName}`,
          trimmedText,
          'welfare_message',
          conv._id,
          io,
          {
            officerId: officialOfficerId,
            officerStaffId: officerDoc?.staffId || '',
            officerName,
            officerPhone: officerDoc?.phone || '',
            emergencyPhone: officerDoc?.emergencyContactPhone || officerDoc?.phone || '',
            conversationId: conv._id.toString(),
            message: trimmedText,
          }
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMsgItem,
      conversationId: conv._id.toString(),
      isEmergency: conv.isEmergency,
    });
  } catch (error) {
    console.error('❌ sendMessage error:', error);
    res.status(500).json({ success: false, message: 'Server error sending message' });
  }
};

/**
 * GET /api/welfare-chat/officer/inbox
 * For Welfare Officer: lists all student conversation threads with filter options
 * Supports ?filter=all | emergency | unread
 */
exports.getOfficerInbox = async (req, res) => {
  try {
    const officerId = req.user?.id ? req.user.id.toString() : '';
    const { filter } = req.query;

    const officer = await Welfare.findById(officerId);
    const searchIds = [officerId];
    if (officer?.staffId) searchIds.push(officer.staffId);

    const query = {
      welfareId: { $in: searchIds },
    };

    if (filter === 'emergency') {
      query.isEmergency = true;
    } else if (filter === 'unread') {
      query.unreadForOfficer = { $gt: 0 };
    }

    const conversations = await WelfareMessage.find(query)
      .sort({ isEmergency: -1, lastMessageAt: -1 })
      .lean();

    const emergencyCount = await WelfareMessage.countDocuments({
      welfareId: { $in: searchIds },
      isEmergency: true,
    });

    const unreadCount = await WelfareMessage.countDocuments({
      welfareId: { $in: searchIds },
      unreadForOfficer: { $gt: 0 },
    });

    res.status(200).json({
      success: true,
      count: conversations.length,
      emergencyCount,
      unreadCount,
      conversations: conversations.map((c) => ({
        id: c._id.toString(),
        studentId: c.studentId,
        studentName: c.studentName,
        studentRegNo: c.studentRegNo,
        studentPhone: c.studentPhone,
        studentFaculty: c.studentFaculty,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unreadCount: c.unreadForOfficer,
        isEmergency: Boolean(c.isEmergency && c.emergencyAlert?.active),
        emergencyAlert: c.emergencyAlert,
      })),
    });
  } catch (error) {
    console.error('❌ getOfficerInbox error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching officer inbox' });
  }
};

/**
 * PUT /api/welfare-chat/emergency/resolve/:conversationId
 * For Welfare Officer: marks an emergency crisis alert as resolved
 */
exports.resolveEmergencyAlert = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { resolutionNotes } = req.body;

    const conv = await WelfareMessage.findById(conversationId);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    conv.isEmergency = false;
    conv.emergencyAlert = {
      active: false,
      triggeredAt: conv.emergencyAlert?.triggeredAt || null,
      message: conv.emergencyAlert?.message || '',
      resolved: true,
      resolvedAt: new Date(),
    };

    if (resolutionNotes) {
      conv.chatHistory.push({
        id: `wm-note-${Date.now()}`,
        senderId: req.user.id,
        senderRole: 'welfare',
        senderName: conv.officerName || 'Welfare Officer',
        text: `[Emergency Status Resolved] ${resolutionNotes}`,
        isEmergency: false,
        timestamp: new Date().toISOString(),
        read: true,
      });
      conv.lastMessage = `[Emergency Resolved] ${resolutionNotes}`;
      conv.lastMessageAt = new Date();
    }

    await conv.save();

    const io = req.app.get('io');
    if (io) {
      io.to('user:' + conv.studentId).emit('welfare:emergency-resolved', {
        conversationId: conv._id.toString(),
        resolvedAt: conv.emergencyAlert.resolvedAt,
      });
      io.to('user:' + conv.welfareId).emit('welfare:emergency-resolved', {
        conversationId: conv._id.toString(),
        resolvedAt: conv.emergencyAlert.resolvedAt,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Emergency alert marked as resolved',
      conversation: conv,
    });
  } catch (error) {
    console.error('❌ resolveEmergencyAlert error:', error);
    res.status(500).json({ success: false, message: 'Server error resolving emergency' });
  }
};

/**
 * PUT /api/welfare-chat/conversation/read/:conversationId
 * Marks conversation as read
 */
exports.markConversationRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userRole = req.user?.role;

    const conv = await WelfareMessage.findById(conversationId);
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (userRole === 'student') {
      conv.unreadForStudent = 0;
    } else {
      conv.unreadForOfficer = 0;
    }

    await conv.save();

    res.status(200).json({ success: true, message: 'Conversation marked as read' });
  } catch (error) {
    console.error('❌ markConversationRead error:', error);
    res.status(500).json({ success: false, message: 'Server error marking conversation as read' });
  }
};
