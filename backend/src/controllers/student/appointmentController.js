const mongoose = require('mongoose');
const Appointment = require('../../models/student/Appointment');
const Student = require('../../models/student/Student');
const CounselorAppointment = require('../../models/counselor/CounselorAppointment');
const CounselorStudent = require('../../models/counselor/CounselorStudent');
const Counselor = require('../../models/counselor/Counselor');

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE  POST /api/student/appointments
// ─────────────────────────────────────────────────────────────────────────────
exports.createAppointment = async (req, res) => {
  try {
    const { counselorId, counselorName, counselorSpecialization, date, time, sessionType, notes } = req.body;
    const requestedDuration = Number(req.body.duration || 30);

    if (!counselorName || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Counselor name, date, and time are required',
      });
    }
    if (!Number.isInteger(requestedDuration) || requestedDuration < 5 || requestedDuration > 240) {
      return res.status(400).json({ success: false, message: 'Appointment duration must be between 5 and 240 minutes.' });
    }

    // Create student-side appointment
    const appointment = await Appointment.create({
      student: req.user.id,
      counselorId:              counselorId || null,
      counselorName,
      counselorSpecialization:  counselorSpecialization || 'Student Counselling',
      date,
      time,
      duration: requestedDuration,
      sessionType:  sessionType || 'Online',
      notes:        notes || '',
      status:       'upcoming',
    });

    // Mirror to counselor_appointments so counselor can see this booking.
    // Uses upsert on the stable key so retries never create duplicates.
    try {
      let student = null;
      if (req.user && req.user.id) {
        try {
          if (mongoose.Types.ObjectId.isValid(req.user.id)) {
            student = await Student.findById(req.user.id).lean();
          } else {
            student = await Student.findOne({
              $or: [{ studentId: String(req.user.id) }, { email: String(req.user.id) }],
            }).lean();
          }
        } catch (lookupErr) {
          console.warn('[Booking] Could not load student document:', lookupErr.message);
        }
      }

      const studentName = student
        ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student'
        : (req.user?.name || 'Student');
      const studentCourse = student
        ? `${student.yearOfStudy || ''} · ${student.degreeProgram || ''}`.trim()
        : '';
      const initials = student
        ? `${(student.firstName || 'S')[0]}${(student.lastName || 'T')[0]}`.toUpperCase()
        : 'ST';

      // Resolve a reliable counselorId
      let targetCounselorId = counselorId ? String(counselorId).trim() : '';
      if (!targetCounselorId && counselorName) {
        try {
          const parts = counselorName.split(' ').filter(Boolean);
          const matched = await Counselor.findOne({
            $or: [
              { name: counselorName },
              { firstName: new RegExp(parts[0] || '', 'i') },
              { lastName: new RegExp(parts[parts.length - 1] || '', 'i') },
            ],
          }).select('_id staffId').lean();
          if (matched) {
            targetCounselorId = String(matched._id);
          }
        } catch {}
      }
      if (!targetCounselorId) {
        targetCounselorId = 'c1'; // Default seeded counselor so screen is never blank
      }

      // Keep counselor-specific client record
      const studentRefId = student?._id ? String(student._id) : String(req.user?.id || 'student');
      const counselorClientId = `client-${targetCounselorId}-${studentRefId}`;

      try {
        await CounselorStudent.findOneAndUpdate(
          { _id: counselorClientId },
          {
            $set: {
              sourceStudentId: studentRefId,
              counselorId: targetCounselorId,
              name: studentName,
              yearCourse: studentCourse,
              email: student?.email || req.user?.email || '',
              avatarInitials: initials,
              status: 'New',
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (csErr) {
        console.warn('[Booking] CounselorStudent upsert warning:', csErr.message);
      }

      const mirrorId = `stu-appt-${appointment._id}`;

      // Look up counselor's actual office location for In Person appointments
      let officeLocation = 'Online Session';
      if (sessionType === 'In Person') {
        officeLocation = 'In-Person Session';
        if (targetCounselorId && mongoose.Types.ObjectId.isValid(targetCounselorId)) {
          try {
            const counselorDoc = await Counselor.findById(targetCounselorId).select('officeLocation').lean();
            if (counselorDoc?.officeLocation) {
              officeLocation = counselorDoc.officeLocation;
            }
          } catch {}
        }
      }

      await CounselorAppointment.findOneAndUpdate(
        { _id: mirrorId },
        {
          $set: {
            _id: mirrorId,
            studentId: counselorClientId,
            counselorId: targetCounselorId,
            counselorName: counselorName || '',
            studentName,
            studentRegistrationId: student?.studentId || '',
            studentCourse,
            duration: requestedDuration,
            sessionType: sessionType || 'Online',
            date,
            time,
            location: officeLocation,
            status: 'Pending',
            notes: notes || '',
            avatarInitials: initials,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log(`[Booking] Mirror created in counselor_appointments for appointment ${appointment._id} (counselor: ${targetCounselorId})`);
    } catch (mirrorErr) {
      console.error(`[Booking] Counselor mirror failed:`, mirrorErr);
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: appointment,
    });
  } catch (error) {
    console.error('❌ createAppointment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  READ ALL  GET /api/student/appointments
// ─────────────────────────────────────────────────────────────────────────────
exports.getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ student: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    console.error('❌ getAppointments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  READ ONE  GET /api/student/appointments/:id
// ─────────────────────────────────────────────────────────────────────────────
exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      student: req.user.id,
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    console.error('❌ getAppointmentById error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE  PUT /api/student/appointments/:id
//  Used for reschedule (date/time) or status update
// ─────────────────────────────────────────────────────────────────────────────
exports.updateAppointment = async (req, res) => {
  try {
    const { date, time, sessionType, notes, status } = req.body;

    const allowedUpdates = {};
    if (date)        allowedUpdates.date        = date;
    if (time)        allowedUpdates.time        = time;
    if (sessionType) allowedUpdates.sessionType = sessionType;
    if (notes !== undefined) allowedUpdates.notes = notes;
    if (status)      allowedUpdates.status      = status;

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, student: req.user.id },
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    );

    // Sync status or date/time changes with CounselorAppointment mirror
    try {
      const mirrorId = `stu-appt-${appointment._id}`;
      const counselorUpdates = {};
      if (date) counselorUpdates.date = date;
      if (time) counselorUpdates.time = time;
      if (sessionType) counselorUpdates.sessionType = sessionType;
      if (notes !== undefined) counselorUpdates.notes = notes;
      if (status) {
        counselorUpdates.status = status === 'upcoming' ? 'Pending' : (status === 'cancelled' ? 'Cancelled' : 'Confirmed');
      }
      if (Object.keys(counselorUpdates).length > 0) {
        await CounselorAppointment.updateOne({ _id: mirrorId }, { $set: counselorUpdates });
      }
    } catch (syncErr) {
      console.warn('[Booking] CounselorAppointment update sync warning:', syncErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      data: appointment,
    });
  } catch (error) {
    console.error('❌ updateAppointment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE  DELETE /api/student/appointments/:id
//  Cancel appointment (sets status to 'cancelled', does not hard-delete)
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, student: req.user.id, status: 'upcoming' },
      { $set: { status: 'cancelled' } },
      { new: true }
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found or already cancelled',
      });
    }

    // Sync cancellation with CounselorAppointment mirror
    try {
      await CounselorAppointment.updateOne(
        { _id: `stu-appt-${appointment._id}` },
        { $set: { status: 'Cancelled' } }
      );
    } catch (syncErr) {
      console.warn('[Booking] CounselorAppointment cancel sync warning:', syncErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment,
    });
  } catch (error) {
    console.error('❌ cancelAppointment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
