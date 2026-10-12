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
    // Only expose an allow-listed student profile when this counselor owns the
    // linked client record. Never return credentials or account security data.
    const profileFields = 'studentId firstName lastName faculty degreeProgram yearOfStudy email phone profilePicture bio';
    let sourceProfile = student.sourceStudentId
      ? await Student.findById(student.sourceStudentId).select(profileFields)
      : null;
    // Older counselor records may have been linked by email before sourceStudentId
    // was stored. The email lookup is still scoped by the counselor-owned record.
    if (!sourceProfile && student.email) {
      sourceProfile = await Student.findOne({ email: student.email.trim().toLowerCase() }).select(profileFields);
    }
    if (sourceProfile) {
      payload.name = [sourceProfile.firstName, sourceProfile.lastName].filter(Boolean).join(' ') || payload.name;
      payload.studentNumber = sourceProfile.studentId || '';
      payload.faculty = sourceProfile.faculty || '';
      payload.degreeProgram = sourceProfile.degreeProgram || '';
      payload.yearOfStudy = sourceProfile.yearOfStudy || '';
      payload.profilePicture = sourceProfile.profilePicture || '';
      payload.bio = sourceProfile.bio || '';
      payload.email = sourceProfile.email || payload.email || '';
      payload.phone = sourceProfile.phone || payload.phone || '';
    }
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
