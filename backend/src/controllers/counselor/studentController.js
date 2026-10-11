const CounselorStudent = require('../../models/counselor/CounselorStudent');
const Student = require('../../models/student/Student');
const { counselorKey } = require('./_scope');

const normaliseEmail = (email) => (email || '').trim().toLowerCase();

const withPhoneNumber = async (counselorStudents) => {
  const emails = [...new Set(counselorStudents.map((s) => normaliseEmail(s.email)).filter(Boolean))];
  const phoneByEmail = {};
  if (emails.length) {
    const students = await Student.find({ email: { $in: emails } }).select('email phone');
    students.forEach((s) => { phoneByEmail[normaliseEmail(s.email)] = s.phone || ''; });
  }

  return counselorStudents.map((student) => ({
    ...student.toJSON(),
    phone: phoneByEmail[normaliseEmail(student.email)] || '',
  }));
};

// GET /api/counselor/students — only students who booked this counselor.
exports.getStudents = async (req, res) => {
  try {
    const students = await CounselorStudent.find({ counselorId: counselorKey(req) }).sort({ createdAt: -1 });
    return res.status(200).json(await withPhoneNumber(students));
  } catch (error) {
    console.error('counselor getStudents error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
};

// GET /api/counselor/students/:id
exports.getStudentById = async (req, res) => {
  try {
    const student = await CounselorStudent.findOne({
      _id: req.params.id,
      counselorId: counselorKey(req),
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const [payload] = await withPhoneNumber([student]);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('counselor getStudentById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch student' });
  }
};

// POST /api/counselor/students/:id/notes — notes stay on this counselor's client record.
exports.saveSessionNotes = async (req, res) => {
  try {
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    const student = await CounselorStudent.findOneAndUpdate(
      { _id: req.params.id, counselorId: counselorKey(req) },
      { $set: { sessionNotesHistory: notes } },
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    return res.status(200).json(student);
  } catch (error) {
    console.error('counselor saveSessionNotes error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save notes' });
  }
};

// PATCH /api/counselor/students/:id/status — archive records without deleting clinical history.
exports.updateStudentStatus = async (req, res) => {
  try {
    const status = String(req.body.status || '').trim();
    if (!['New', 'Active', 'Archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be New, Active, or Archived' });
    }
    const student = await CounselorStudent.findOneAndUpdate(
      { _id: req.params.id, counselorId: counselorKey(req) },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    return res.status(200).json(student);
  } catch (error) {
    console.error('counselor updateStudentStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update student status' });
  }
};
