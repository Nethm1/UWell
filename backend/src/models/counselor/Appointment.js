const mongoose = require('mongoose');

// Canonical Appointment model.
// Both the student booking flow and the welfare/management dashboards read and
// write the shared `appointments` collection, so this single schema merges the
// field sets used by each side. Re-exported by models/student/Appointment.js to
// avoid registering the same model name twice (OverwriteModelError).
const appointmentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    studentName: {
      type: String,
      default: '',
    },
    counselor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Counselor',
      default: null,
    },
    counselorId: {
      type: String,
      default: '',
      trim: true,
    },
    counselorName: {
      type: String,
      required: true,
    },
    counselorSpecialization: {
      type: String,
      default: 'Student Counselling',
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    sessionType: {
      type: String,
      enum: ['Online', 'In Person', 'Phone'],
      default: 'Online',
    },
    videoRoomName: {
      type: String,
      default: '',
      select: false,
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      default: 'upcoming',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema, 'appointments');
