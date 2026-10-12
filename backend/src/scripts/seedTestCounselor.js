/**
 * Creates (or repairs) the counselor account used by the Postman smoke suite.
 *
 * Idempotent - safe to run repeatedly. Only this one counselor document is
 * touched; appointments, students and messages are never modified.
 *
 *   node src/scripts/seedTestCounselor.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Counselor = require('../models/counselor/Counselor');

// Targets the counselor that owns the seeded demo dataset (students,
// appointments, availability and messages), so the Postman suite exercises
// real records rather than an empty account.
const EMAIL = 'rachel.green@university.edu';
const STAFF_ID = 'CNS2024001';
const PASSWORD = 'Password123!';

const PROFILE = {
  firstName: 'Elena',
  lastName: 'Martinez',
  email: EMAIL,
  qualification: 'PhD Clinical Psychology',
  specialization: 'Mental Health',
  yearsOfExperience: 8,
  phone: '+15550100',
  officeLocation: 'Campus Centre 204',
  approvalStatus: 'approved',
  isApproved: true,
  isActive: true,
};

const run = async () => {
  await connectDB();

  const existing = await Counselor.findOne({ email: EMAIL });
  let counselor;

  if (existing) {
    // Re-hash and persist so the pre-save hook applies.
    Object.keys(PROFILE).forEach((key) => existing.set(key, PROFILE[key]));
    existing.set('password', PASSWORD);
    await existing.save();
    counselor = existing;
  } else {
    counselor = await Counselor.create({
      ...PROFILE,
      staffId: STAFF_ID,
      password: PASSWORD,
    });
  }

  const fresh = await Counselor.findOne({ email: EMAIL }).select('+password');
  const passwordMatches = await fresh.comparePassword(PASSWORD);

  console.log('Test counselor ready');
  console.log('  email:             ' + EMAIL);
  console.log('  staffId:           ' + fresh.staffId);
  console.log('  approved:          ' + fresh.isApproved + ' / ' + fresh.approvalStatus);
  console.log('  password verifies: ' + passwordMatches);

  if (!passwordMatches) {
    throw new Error('Password did not verify after seeding');
  }

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});