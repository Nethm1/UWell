const mongoose = require('mongoose');
const CounselorAppointment = require('../../models/counselor/CounselorAppointment');
const CounselorAvailability = require('../../models/counselor/CounselorAvailability');
const CounselorStudent = require('../../models/counselor/CounselorStudent');
const Appointment = require('../../models/student/Appointment');
const Notification = require('../../models/Notification');
const { counselorKey } = require('./_scope');

const TERMINAL_STATUSES = ['Declined', 'Cancelled', 'Completed'];

const dateParts = (value) => {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? { date, value: `${match[1]}-${match[2]}-${match[3]}` }
    : null;
};

const isTimeSlot = (value) => /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i.test(String(value || '').trim());

const getStudentAppointment = async (mirror) => {
  const id = String(mirror._id || '');
  if (!id.startsWith('stu-appt-')) return null;
  const sourceId = id.slice('stu-appt-'.length);
  if (!mongoose.Types.ObjectId.isValid(sourceId)) return null;
  return Appointment.findById(sourceId).populate('student', 'firstName lastName studentId email').lean();
};

const addStudentDetails = async (mirrors) => {
  const sourceIds = mirrors
    .map((item) => String(item._id || '').startsWith('stu-appt-') ? String(item._id).slice('stu-appt-'.length) : '')
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!sourceIds.length) return mirrors;
  const sources = await Appointment.find({ _id: { $in: sourceIds } })
    .select('student')
    .populate('student', 'studentId firstName lastName email')
    .lean();
  const byId = new Map(sources.map((source) => [String(source._id), source.student]));
  return mirrors.map((mirror) => {
    const sourceId = String(mirror._id || '').replace(/^stu-appt-/, '');
    const student = byId.get(sourceId);
    const base = typeof mirror.toJSON === 'function' ? mirror.toJSON() : mirror;
    return {
      ...base,
      studentRegistrationId: mirror.studentRegistrationId || student?.studentId || '',
      studentEmail: student?.email || '',
      duration: Number(mirror.duration || 30),
    };
  });
};

// GET /api/counselor/appointments
exports.getAppointments = async (req, res) => {
  try {
    const appointments = await CounselorAppointment.find({ counselorId: counselorKey(req) }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(await addStudentDetails(appointments));
  } catch (error) {
    console.error('counselor getAppointments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch appointments' });
  }
};

// GET /api/counselor/appointments/:id
exports.getAppointmentById = async (req, res) => {
  try {
    const appointmentDoc = await CounselorAppointment.findOne({ _id: req.params.id, counselorId: counselorKey(req) });
    const appointment = appointmentDoc ? (await addStudentDetails([appointmentDoc]))[0] : null;
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    return res.status(200).json(appointment);
  } catch (error) {
    console.error('counselor getAppointmentById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch appointment' });
  }
};

// PUT /api/counselor/appointments/:id. Only pending requests can be acted on.
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const key = counselorKey(req);
    const mirror = await CounselorAppointment.findOne({ _id: req.params.id, counselorId: key });
    if (!mirror) return res.status(404).json({ success: false, message: 'Appointment not found' });
    const { status, date, time, reason } = req.body || {};
    const statusIsPendingAction = ['Confirmed', 'Declined'].includes(status);
    const canReschedule = status === undefined && date && time;
    if (!['Confirmed', 'Declined', 'Completed', 'Cancelled'].includes(status) && !canReschedule) {
      return res.status(400).json({ success: false, message: 'Choose a valid appointment action.' });
    }
    if (statusIsPendingAction && mirror.status !== 'Pending') {
      return res.status(409).json({ success: false, message: 'Only pending requests can be accepted or declined.' });
    }
    if (status === 'Completed' && mirror.status !== 'Confirmed') {
      return res.status(409).json({ success: false, message: 'Only confirmed appointments can be marked complete.' });
    }
    if (status === 'Cancelled' && !['Pending', 'Confirmed'].includes(mirror.status)) {
      return res.status(409).json({ success: false, message: 'Only pending or confirmed appointments can be cancelled.' });
    }
    if (canReschedule && !['Pending', 'Confirmed'].includes(mirror.status)) {
      return res.status(409).json({ success: false, message: 'Only pending or confirmed appointments can be rescheduled.' });
    }

    const source = await getStudentAppointment(mirror);
    if (String(mirror._id).startsWith('stu-appt-') && !source) {
      return res.status(409).json({ success: false, message: 'The original student booking could not be found.' });
    }

    let nextDate = mirror.date;
    let nextTime = mirror.time;
    let nextStatus = status;
    if (canReschedule) {
      const parsedDate = dateParts(date);
      const cleanTime = String(time || '').trim().toUpperCase().replace(/\s+/g, ' ');
      if (!parsedDate || !isTimeSlot(cleanTime)) {
        return res.status(400).json({ success: false, message: 'Enter a valid date (YYYY-MM-DD) and time.' });
      }
      if (parsedDate.date.setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
        return res.status(400).json({ success: false, message: 'Choose a future date.' });
      }
      const weekday = parsedDate.date.toLocaleDateString('en-US', { weekday: 'long' });
      const schedules = await CounselorAvailability.find({ counselorId: key, day: weekday }).lean();
      const dateOverride = schedules.find((item) => item.date === parsedDate.value);
      const matching = dateOverride || schedules.find((item) => !item.date);
      if (!matching?.active || !matching.slots?.some((slot) => String(slot).trim().toUpperCase().replace(/\s+/g, ' ') === cleanTime)) {
        return res.status(409).json({ success: false, message: 'That time is not in your availability for the selected date.' });
      }
      const conflict = await CounselorAppointment.exists({
        counselorId: key,
        date: parsedDate.value,
        time: cleanTime,
        status: { $nin: TERMINAL_STATUSES },
        _id: { $ne: mirror._id },
      });
      if (conflict) return res.status(409).json({ success: false, message: 'That time has already been booked. Choose another available time.' });
      nextDate = parsedDate.value;
      nextTime = cleanTime;
      nextStatus = 'Pending';
    }

    let studentNotification = null;
    if (source) {
      const expectedStatus = source.status;
      const sourceUpdate = status === 'Confirmed'
        ? { status: 'confirmed' }
        : status === 'Declined' || status === 'Cancelled'
          ? { status: 'cancelled' }
          : status === 'Completed'
            ? { status: 'completed' }
          : { date: nextDate, time: nextTime };
      const canonicalFilter = { _id: source._id, counselorId: key, status: expectedStatus };
      if (canReschedule) Object.assign(canonicalFilter, { date: source.date, time: source.time });
      const canonical = await Appointment.findOneAndUpdate(
        canonicalFilter,
        { $set: sourceUpdate },
        { new: true, runValidators: true }
      );
      if (!canonical) return res.status(409).json({ success: false, message: 'The student appointment changed. Refresh the list before trying again.' });

      if (source.student?._id && (status === 'Confirmed' || status === 'Declined' || status === 'Cancelled')) {
        studentNotification = {
          recipientId: source.student._id,
          recipientType: 'student',
          title: status === 'Confirmed' ? 'Appointment accepted' : status === 'Declined' ? 'Appointment declined' : 'Appointment cancelled',
          message: status === 'Confirmed'
            ? `Your appointment with ${mirror.counselorName || 'your counselor'} on ${mirror.date} at ${mirror.time} has been confirmed.`
            : status === 'Declined'
              ? `Your appointment request with ${mirror.counselorName || 'your counselor'} was declined.${reason ? ` Reason: ${String(reason).trim().slice(0, 500)}` : ''}`
              : `Your appointment with ${mirror.counselorName || 'your counselor'} was cancelled.${reason ? ` Reason: ${String(reason).trim().slice(0, 500)}` : ''}`,
          type: status === 'Declined' || status === 'Cancelled' ? 'appointment_cancelled' : 'appointment_updated',
          appointmentId: source._id,
        };
      } else if (source.student?._id && canReschedule) {
        studentNotification = {
          recipientId: source.student._id,
          recipientType: 'student',
          title: 'Appointment rescheduled',
          message: `Your appointment with ${mirror.counselorName || 'your counselor'} has been rescheduled to ${nextDate} at ${nextTime}.`,
          type: 'appointment_rescheduled',
          appointmentId: source._id,
        };
      }
    }

    const terminalStatus = status === 'Confirmed' || status === 'Declined' || status === 'Completed' || status === 'Cancelled';
    const updates = terminalStatus
      ? { status: nextStatus, declineReason: ['Declined', 'Cancelled'].includes(status) ? String(reason || '').trim().slice(0, 500) : '' }
      : { date: nextDate, time: nextTime };
    const mirrorFilter = { _id: mirror._id, counselorId: key, status: mirror.status };
    if (canReschedule) Object.assign(mirrorFilter, { date: mirror.date, time: mirror.time });
    const appointment = await CounselorAppointment.findOneAndUpdate(
      mirrorFilter,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!appointment) return res.status(409).json({ success: false, message: 'The appointment was already updated. Refresh the list.' });

    if (status === 'Confirmed' && mirror.studentId) {
      await CounselorStudent.updateOne({ _id: mirror.studentId, counselorId: key, status: 'New' }, { $set: { status: 'Active' } });
    }
    if (status === 'Completed' && mirror.studentId) {
      const completedCount = await CounselorAppointment.countDocuments({ counselorId: key, studentId: mirror.studentId, status: 'Completed' });
      await CounselorStudent.updateOne({ _id: mirror.studentId, counselorId: key }, { $set: { sessionsCompleted: completedCount, status: 'Active' } });
    }
    let notificationWarning = '';
    if (studentNotification) {
      try {
        await Notification.create(studentNotification);
      } catch (notificationError) {
        notificationWarning = 'Appointment saved, but the student notification could not be saved. Please retry or contact support.';
        console.error('counselor appointment notification error:', notificationError.message);
      }
    } else if (status !== 'Completed') {
      notificationWarning = 'Appointment saved, but this booking is not linked to a student account, so no notification was sent.';
    }
    const response = typeof appointment.toObject === 'function' ? appointment.toObject() : { ...appointment };
    if (notificationWarning) response.notificationWarning = notificationWarning;
    return res.status(200).json(response);
  } catch (error) {
    console.error('counselor updateAppointmentStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update appointment' });
  }
};
