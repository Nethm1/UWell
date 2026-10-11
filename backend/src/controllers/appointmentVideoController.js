const crypto = require('crypto');
const mongoose = require('mongoose');
const Appointment = require('../models/student/Appointment');
const CounselorAppointment = require('../models/counselor/CounselorAppointment');

const isOnline = (appointment) => String(appointment.sessionType || '').toLowerCase() === 'online';
const isConfirmed = (appointment) => String(appointment.status || '').toLowerCase() === 'confirmed';

const isAssignedParticipant = (appointment, user) => {
  const userId = String(user.id);
  if (user.role === 'student') return String(appointment.student) === userId;
  if (user.role === 'counselor') {
    return String(appointment.counselorId || '') === userId
      || String(appointment.counselor || '') === userId;
  }
  return false;
};

const jitsiDomain = () => {
  const domain = String(process.env.JITSI_DOMAIN || 'meet.jit.si')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(domain)) {
    throw new Error('Invalid Jitsi domain configuration');
  }
  return domain;
};

exports.createAppointmentVideoLink = async (req, res) => {
  try {
    const requestedId = String(req.params.appointmentId || '').trim();
    let appointmentId = requestedId;

    // Counselor appointment cards use a mirror id (`stu-appt-<ObjectId>`).
    // Resolve that id only after verifying the mirror belongs to this counselor.
    if (req.user.role === 'counselor' && requestedId.startsWith('stu-appt-')) {
      const sourceId = requestedId.slice('stu-appt-'.length);
      if (!mongoose.Types.ObjectId.isValid(sourceId)) {
        return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
      }

      const mirror = await CounselorAppointment.findById(requestedId).select('counselorId status').lean();
      if (!mirror) {
        return res.status(404).json({ success: false, message: 'Appointment not found' });
      }
      if (String(mirror.counselorId || '') !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this appointment' });
      }
      if (String(mirror.status || '').toLowerCase() !== 'confirmed') {
        return res.status(409).json({ success: false, message: 'The appointment must be confirmed before joining' });
      }
      appointmentId = sourceId;
    }

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
    }

    let appointment = await Appointment.findById(appointmentId).select('+videoRoomName');
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (!isAssignedParticipant(appointment, req.user)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this appointment' });
    }
    if (!isConfirmed(appointment)) {
      return res.status(409).json({ success: false, message: 'The appointment must be confirmed before joining' });
    }
    if (!isOnline(appointment)) {
      return res.status(409).json({ success: false, message: 'Video calls are only available for online appointments' });
    }

    if (!appointment.videoRoomName) {
      const roomName = `uwell-${crypto.randomBytes(24).toString('hex')}`;
      await Appointment.updateOne(
        {
          _id: appointment._id,
          status: appointment.status,
          sessionType: appointment.sessionType,
          $or: [
            { videoRoomName: { $exists: false } },
            { videoRoomName: null },
            { videoRoomName: '' },
          ],
        },
        { $set: { videoRoomName: roomName } },
      );

      // Read after the atomic update so simultaneous requests return the same room.
      appointment = await Appointment.findById(appointment._id).select('+videoRoomName');
      if (!appointment?.videoRoomName) {
        return res.status(409).json({ success: false, message: 'The appointment is no longer eligible for a video call' });
      }
      if (!isAssignedParticipant(appointment, req.user) || !isConfirmed(appointment) || !isOnline(appointment)) {
        return res.status(409).json({ success: false, message: 'The appointment is no longer eligible for a video call' });
      }
    }

    if (!isAssignedParticipant(appointment, req.user) || !isConfirmed(appointment) || !isOnline(appointment)) {
      return res.status(409).json({ success: false, message: 'The appointment is no longer eligible for a video call' });
    }

    const meetingUrl = `https://${jitsiDomain()}/${appointment.videoRoomName}`;
    return res.status(200).json({ message: 'Video meeting ready', meetingUrl });
  } catch (error) {
    // Avoid logging appointment details or returning database/configuration data.
    console.error('Appointment video link request failed:', error?.name || 'UnknownError');
    return res.status(500).json({ success: false, message: 'Could not prepare the video meeting' });
  }
};
