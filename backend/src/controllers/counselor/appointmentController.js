const CounselorAppointment = require('../../models/counselor/CounselorAppointment');
const CounselorStudent = require('../../models/counselor/CounselorStudent');
const Appointment = require('../../models/student/Appointment');
const { counselorKey } = require('./_scope');

const STUDENT_STATUS_BY_COUNSELOR_STATUS = {
  confirmed: 'confirmed',  // Changed from 'upcoming' to 'confirmed'
  completed: 'completed',
  cancelled: 'cancelled',
};

// GET /api/counselor/appointments
exports.getAppointments = async (req, res) => {
  try {
    const appointments = await CounselorAppointment.find({ counselorId: counselorKey(req) })
      .sort({ createdAt: -1 });
    return res.status(200).json(appointments);
  } catch (error) {
    console.error('counselor getAppointments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
};

// GET /api/counselor/appointments/:id
exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await CounselorAppointment.findOne({
      _id: req.params.id,
      counselorId: counselorKey(req),
    });
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    return res.status(200).json(appointment);
  } catch (error) {
    console.error('counselor getAppointmentById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch appointment' });
  }
};

// PUT /api/counselor/appointments/:id
// Keep student and counselor appointment status in sync without deleting history.
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const status = String(req.body.status || '').trim();
    const allowed = ['Pending', 'Confirmed', 'Cancelled', 'Completed'];
    const nextStatus = allowed.find((item) => item.toLowerCase() === status.toLowerCase());
    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(', ')}`,
      });
    }

    const key = counselorKey(req);
    const filter = { _id: req.params.id, counselorId: key };
    const previous = await CounselorAppointment.findOne(filter);
    if (!previous) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const appointment = await CounselorAppointment.findOneAndUpdate(
      filter,
      { $set: { status: nextStatus } },
      { new: true, runValidators: true }
    );

    if (nextStatus === 'Confirmed') {
      await CounselorStudent.updateOne(
        { _id: appointment.studentId, counselorId: key, status: 'New' },
        { $set: { status: 'Active' } }
      );
    }
    if (nextStatus === 'Completed' && previous.status !== 'Completed') {
      const completedCount = await CounselorAppointment.countDocuments({
        counselorId: key,
        studentId: appointment.studentId,
        status: 'Completed',
      });
      await CounselorStudent.updateOne(
        { _id: appointment.studentId, counselorId: key },
        { $set: { sessionsCompleted: completedCount, status: 'Active' } }
      );
    }

    const canonicalStatus = STUDENT_STATUS_BY_COUNSELOR_STATUS[nextStatus.toLowerCase()];
    if (canonicalStatus && String(appointment._id).startsWith('stu-appt-')) {
      const sourceAppointmentId = String(appointment._id).slice('stu-appt-'.length);
      await Appointment.findByIdAndUpdate(sourceAppointmentId, { $set: { status: canonicalStatus } });
    }

    return res.status(200).json(appointment);
  } catch (error) {
    console.error('counselor updateAppointmentStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update appointment' });
  }
};
