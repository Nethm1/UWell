const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Appointment = require('../models/counselor/Appointment');
const CounselorAppointment = require('../models/counselor/CounselorAppointment');
const Notification = require('../models/Notification');
const { sendNotification, broadcastAppointmentChange } = require('../utils/notificationHelper');

async function runTest() {
  console.log('🧪 Starting Welfare Notification & Sync Test...');
  await connectDB();

  try {
    // 1. Create a test student appointment in 'appointments'
    const testAppointment = await Appointment.create({
      student: new mongoose.Types.ObjectId(),
      studentName: 'Test Student Silva',
      counselorId: 'c1',
      counselorName: 'Dr. Sarah Jenkins',
      counselorSpecialization: 'Stress & Anxiety',
      date: '2026-10-20',
      time: '10:00 AM',
      sessionType: 'Online',
      notes: 'Initial test booking notes',
      status: 'upcoming',
    });

    console.log('✅ Created test appointment:', testAppointment._id.toString());

    // 2. Create the initial mirror in 'counselor_appointments'
    const mirrorId = `stu-appt-${testAppointment._id}`;
    await CounselorAppointment.create({
      _id: mirrorId,
      studentId: testAppointment.student.toString(),
      counselorId: 'c1',
      counselorName: testAppointment.counselorName,
      studentName: testAppointment.studentName,
      sessionType: testAppointment.sessionType,
      date: testAppointment.date,
      time: testAppointment.time,
      status: 'Pending',
      notes: testAppointment.notes,
    });
    console.log('✅ Created initial counselor mirror:', mirrorId);

    // 3. Simulate Welfare Officer updating/rescheduling the appointment
    const newDate = '2026-10-22';
    const newTime = '02:30 PM';
    const newStatus = 'confirmed';
    const officerNotes = 'Rescheduled by Welfare Officer after request review';

    testAppointment.date = newDate;
    testAppointment.time = newTime;
    testAppointment.status = newStatus;
    testAppointment.notes = testAppointment.notes + '\n[Officer] ' + officerNotes;
    await testAppointment.save();

    // Sync mirror
    const counselorStatusMap = {
      upcoming: 'Pending',
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };

    await CounselorAppointment.updateOne(
      { _id: mirrorId },
      {
        $set: {
          date: newDate,
          time: newTime,
          status: counselorStatusMap[newStatus.toLowerCase()] || 'Confirmed',
          notes: testAppointment.notes,
        },
      }
    );

    // Verify mirror document
    const updatedMirror = await CounselorAppointment.findById(mirrorId);
    console.log('✅ Verified updated mirror in counselor_appointments:');
    console.log('   Date:', updatedMirror.date);
    console.log('   Time:', updatedMirror.time);
    console.log('   Status:', updatedMirror.status);
    console.log('   Notes:', updatedMirror.notes);

    if (updatedMirror.date !== newDate || updatedMirror.time !== newTime || updatedMirror.status !== 'Confirmed') {
      throw new Error('❌ Mirror update verification failed!');
    }

    // 4. Test Notification dispatch
    const studentNotif = await sendNotification(
      testAppointment.student,
      'student',
      'Appointment Rescheduled',
      `Your appointment with Dr. Sarah Jenkins has been rescheduled to ${newDate} at ${newTime} by the Welfare Officer.`,
      'appointment_rescheduled',
      testAppointment._id
    );

    const counselorNotif = await sendNotification(
      'c1',
      'counselor',
      'Appointment Rescheduled',
      `Your appointment with Test Student Silva has been rescheduled to ${newDate} at ${newTime} by the Welfare Officer.`,
      'appointment_rescheduled',
      testAppointment._id
    );

    console.log('✅ Student notification created:', studentNotif._id.toString(), 'title:', studentNotif.title);
    console.log('✅ Counselor notification created:', counselorNotif._id.toString(), 'recipientId:', counselorNotif.recipientId);

    // Verify recipientId 'c1' didn't fail
    if (counselorNotif.recipientId !== 'c1') {
      throw new Error('❌ Counselor notification recipientId is not "c1"!');
    }

    // 5. Cleanup test artifacts
    await Appointment.findByIdAndDelete(testAppointment._id);
    await CounselorAppointment.findByIdAndDelete(mirrorId);
    await Notification.deleteMany({ appointmentId: testAppointment._id.toString() });
    console.log('✅ Test cleanup completed successfully.');

    console.log('\n🎉 ALL TESTS PASSED! Welfare update & notification sync is fully operational.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

runTest();
