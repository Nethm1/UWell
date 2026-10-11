/**
 * Script to fix CounselorStudent documents that have incorrect counselorId
 * 
 * Usage: node scripts/fix-counselor-student-ids.js
 * 
 * This script updates all CounselorStudent documents to use the correct
 * counselorId from the Counselor collection.
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
    const counselorStudentsCollection = db.collection('counselor_students');
    const counselorsCollection = db.collection('counselors');

    // Get all counselors with their IDs
    const counselors = await counselorsCollection.find({}, { projection: { _id: 1, staffId: 1, email: 1 } }).toArray();
    console.log(`Found ${counselors.length} counselors`);

    // Create a map of counselor identifiers to their _id
    const counselorIdMap = {};
    counselors.forEach(c => {
      counselorIdMap[c._id.toString()] = c._id.toString();
      if (c.staffId) counselorIdMap[c.staffId] = c._id.toString();
      if (c.email) counselorIdMap[c.email.toLowerCase()] = c._id.toString();
    });

    // Get all CounselorStudent documents
    const students = await counselorStudentsCollection.find({}).toArray();
    console.log(`Found ${students.length} CounselorStudent documents`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const student of students) {
      const currentCounselorId = student.counselorId;
      
      // Skip if already using a valid ObjectId format (24 hex chars)
      if (currentCounselorId && currentCounselorId.length === 24) {
        console.log(`Skipping ${student._id}: counselorId ${currentCounselorId} is already a valid ObjectId`);
        skippedCount++;
        continue;
      }

      // Try to find the correct counselor ID
      let newCounselorId = null;
      
      // Check if it's the seeded "c1" ID
      if (currentCounselorId === 'c1') {
        // Look for the first approved counselor in the database
        const approvedCounselor = counselors.find(c => 
          c.isApproved === true || 
          c.approvalStatus === 'approved' || 
          c.approvalStatus === 'active'
        );
        if (approvedCounselor) {
          newCounselorId = approvedCounselor._id.toString();
          console.log(`Updating ${student._id}: c1 -> ${newCounselorId} (${approvedCounselor.staffId})`);
        } else {
          // Fallback to first counselor if no approved one found
          const firstCounselor = counselors[0];
          if (firstCounselor) {
            newCounselorId = firstCounselor._id.toString();
            console.log(`Updating ${student._id}: c1 -> ${newCounselorId} (fallback to first counselor ${firstCounselor.staffId})`);
          }
        }
      } else {
        // Try to match by staffId or email
        const matchedCounselor = counselors.find(c => 
          c.staffId?.toLowerCase() === currentCounselorId.toLowerCase() ||
          c.email?.toLowerCase() === currentCounselorId.toLowerCase()
        );
        if (matchedCounselor) {
          newCounselorId = matchedCounselor._id.toString();
          console.log(`Updating ${student._id}: ${currentCounselorId} -> ${newCounselorId}`);
        }
      }

      if (newCounselorId) {
        await counselorStudentsCollection.updateOne(
          { _id: student._id },
          { $set: { counselorId: newCounselorId } }
        );
        updatedCount++;
      } else {
        console.log(`WARNING: Could not find counselor for ${student._id} with counselorId ${currentCounselorId}`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Updated: ${updatedCount} documents`);
    console.log(`Skipped: ${skippedCount} documents (already valid)`);
    console.log(`Total: ${students.length} documents processed`);

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
