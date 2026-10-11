const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const Student = require('../models/student/Student');
const Counselor = require('../models/counselor/Counselor');
const CounselorStudent = require('../models/counselor/CounselorStudent');
const CounselorAppointment = require('../models/counselor/CounselorAppointment');
const Appointment = require('../models/student/Appointment');

async function syncAll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const appts = await Appointment.find({}).lean();
    console.log('Total appointments found:', appts.length);

    let synced = 0;
    for (const appt of appts) {
      const mirrorId = 'stu-appt-' + String(appt._id);
      const existing = await CounselorAppointment.findById(mirrorId);
      if (!existing) {
        let student = null;
        if (appt.student && mongoose.Types.ObjectId.isValid(appt.student)) {
          student = await Student.findById(appt.student).lean();
        }

        const studentName = student
          ? (student.firstName + ' ' + student.lastName).trim() || 'Student'
          : (appt.studentName || 'Student');
        const studentCourse = student
          ? (student.yearOfStudy + ' · ' + student.degreeProgram).trim()
          : '';
        const initials = student
          ? ((student.firstName || 'S')[0] + (student.lastName || 'T')[0]).toUpperCase()
          : 'ST';

        let targetCounselorId = appt.counselorId ? String(appt.counselorId).trim() : '';
        if (!targetCounselorId && appt.counselorName) {
          const parts = appt.counselorName.split(' ').filter(Boolean);
          const matched = await Counselor.findOne({
            $or: [
              { name: appt.counselorName },
              { firstName: new RegExp(parts[0] || '', 'i') },
              { lastName: new RegExp(parts[parts.length - 1] || '', 'i') },
            ],
          }).select('_id staffId').lean();
          if (matched) targetCounselorId = String(matched._id);
        }
        if (!targetCounselorId) targetCounselorId = 'c1';

        const studentRefId = student?._id ? String(student._id) : String(appt.student || 'student');
        const counselorClientId = 'client-' + targetCounselorId + '-' + studentRefId;

        await CounselorStudent.findOneAndUpdate(
          { _id: counselorClientId },
          {
            $set: {
              sourceStudentId: studentRefId,
              counselorId: targetCounselorId,
              name: studentName,
              yearCourse: studentCourse,
              email: student?.email || '',
              avatarInitials: initials,
              status: 'New',
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await CounselorAppointment.findOneAndUpdate(
          { _id: mirrorId },
          {
            $set: {
              _id: mirrorId,
              studentId: counselorClientId,
              counselorId: targetCounselorId,
              counselorName: appt.counselorName || '',
              studentName,
              studentCourse,
              sessionType: appt.sessionType || 'Online',
              date: appt.date,
              time: appt.time,
              location: appt.sessionType === 'In Person' ? 'In-Person Session' : 'Online Session',
              status: appt.status === 'upcoming' ? 'Pending' : (appt.status === 'cancelled' ? 'Cancelled' : 'Confirmed'),
              notes: appt.notes || '',
              avatarInitials: initials,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        synced++;
      }
    }

    console.log(`✅ Successfully backfilled ${synced} missing appointments into counselor_appointments.`);
    const totalCounselorAppts = await CounselorAppointment.countDocuments();
    console.log(`📊 Total in counselor_appointments is now: ${totalCounselorAppts}`);

    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
}

syncAll();
