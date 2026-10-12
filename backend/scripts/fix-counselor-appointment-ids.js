/**
 * Script to fix CounselorAppointment documents that have incorrect counselorId
 * 
 * Usage: node scripts/fix-counselor-appointment-ids.js
 * 
 * This script updates all CounselorAppointment documents to use the correct
 * counselorId from the CounselorStudent collection.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/uwell';

async function main() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');

    const db = mongoose.connection.db;
    const counselorAppointmentsCollection = db.collection('counselor_appointments');
    const counselorStudentsCollection = db.collection('counselor_students');

    // Get all CounselorAppointment documents with counselorId: 'c1'
    const appointments = await counselorAppointmentsCollection.find({ counselorId: 'c1' }).toArray();
    console.log(`Found ${appointments.length} CounselorAppointment documents with counselorId: 'c1'`);

    let updatedCount = 0;
    let notFoundCount = 0;
    let alreadyCorrectCount = 0;

    for (const appointment of appointments) {
      const currentStudentId = appointment.studentId;
      
      // Look up the CounselorStudent document with _id = studentId to get actual counselorId
      const counselorStudent = await counselorStudentsCollection.findOne({ _id: currentStudentId });
      
      if (counselorStudent && counselorStudent.counselorId) {
        const newCounselorId = counselorStudent.counselorId;
        
        // Update with the actual counselorId
        await counselorAppointmentsCollection.updateOne(
          { _id: appointment._id },
          { $set: { counselorId: newCounselorId } }
        );
        updatedCount++;
        console.log(`Updated ${appointment._id} (${appointment.counselorName} -> ${appointment.studentName}): counselorId c1 -> ${newCounselorId}`);
      } else {
        console.log(`WARNING: Could not find CounselorStudent for ${appointment._id} with studentId: ${currentStudentId}`);
        notFoundCount++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Updated: ${updatedCount} documents`);
    console.log(`Not found / skipped: ${notFoundCount} documents`);
    console.log(`Total: ${appointments.length} documents processed`);

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
