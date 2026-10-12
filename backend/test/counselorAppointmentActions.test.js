const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const CounselorAppointment = require('../src/models/counselor/CounselorAppointment');
const CounselorAvailability = require('../src/models/counselor/CounselorAvailability');
const CounselorStudent = require('../src/models/counselor/CounselorStudent');
const Appointment = require('../src/models/student/Appointment');
const Notification = require('../src/models/Notification');
const controller = require('../src/controllers/counselor/appointmentController');

const id = 'stu-appt-66a111111111111111111111';
const counselorId = 'counselor-456';
const original = {
  findOne: CounselorAppointment.findOne,
  findOneAndUpdate: CounselorAppointment.findOneAndUpdate,
  countDocuments: CounselorAppointment.countDocuments,
  exists: CounselorAppointment.exists,
  availabilityFind: CounselorAvailability.find,
  studentUpdate: CounselorStudent.updateOne,
  appointmentFindById: Appointment.findById,
  appointmentFindOneAndUpdate: Appointment.findOneAndUpdate,
  notificationCreate: Notification.create,
};

let mirror;
let source;
let notifications;

function mockModels({ conflicting = false } = {}) {
  CounselorAppointment.findOne = async () => mirror;
  CounselorAppointment.findOneAndUpdate = async (_filter, update) => {
    Object.assign(mirror, update.$set);
    return { ...mirror };
  };
  CounselorAppointment.exists = async () => conflicting ? { _id: 'other' } : null;
  CounselorAppointment.countDocuments = async () => 1;
  CounselorAvailability.find = () => ({ lean: async () => [{ day: 'Tuesday', date: '', active: true, slots: ['10:00 AM'] }] });
  CounselorStudent.updateOne = async () => ({ modifiedCount: 1 });
  Appointment.findById = () => ({ populate: () => ({ lean: async () => source }) });
  Appointment.findOneAndUpdate = async (_filter, update) => {
    Object.assign(source, update.$set);
    return source;
  };
  Notification.create = async (notification) => { notifications.push(notification); };
}

function reset() {
  mirror = { _id: id, counselorId, studentId: 'client-1', counselorName: 'Counselor', studentName: 'Student', date: '2026-10-12', time: '09:00 AM', status: 'Pending' };
  source = { _id: '66a111111111111111111111', counselorId, status: 'upcoming', date: '2026-10-12', time: '09:00 AM', student: { _id: '66b111111111111111111111' } };
  notifications = [];
}

function makeResponse() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function act(body) {
  const res = makeResponse();
  await controller.updateAppointmentStatus({ user: { id: counselorId, role: 'counselor' }, params: { id }, body }, res);
  return res;
}

afterEach(() => {
  CounselorAppointment.findOne = original.findOne;
  CounselorAppointment.findOneAndUpdate = original.findOneAndUpdate;
  CounselorAppointment.countDocuments = original.countDocuments;
  CounselorAppointment.exists = original.exists;
  CounselorAvailability.find = original.availabilityFind;
  CounselorStudent.updateOne = original.studentUpdate;
  Appointment.findById = original.appointmentFindById;
  Appointment.findOneAndUpdate = original.appointmentFindOneAndUpdate;
  Notification.create = original.notificationCreate;
  reset();
});

reset();

test('accept confirms both appointment records and notifies the student', async () => {
  mockModels();
  const res = await act({ status: 'Confirmed' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'Confirmed');
  assert.equal(source.status, 'confirmed');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].recipientType, 'student');
});

test('decline records the optional reason and notifies the student', async () => {
  mockModels();
  const res = await act({ status: 'Declined', reason: 'Please choose another day.' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'Declined');
  assert.equal(res.body.declineReason, 'Please choose another day.');
  assert.equal(source.status, 'cancelled');
  assert.match(notifications[0].message, /Please choose another day/);
});

test('reschedule requires an available unbooked slot and updates the student notification', async () => {
  mockModels();
  const res = await act({ date: '2026-10-13', time: '10:00 AM' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.date, '2026-10-13');
  assert.equal(res.body.time, '10:00 AM');
  assert.equal(source.date, '2026-10-13');
  assert.equal(notifications[0].type, 'appointment_rescheduled');
});

test('reschedule rejects a slot that has already been booked', async () => {
  mockModels({ conflicting: true });
  const res = await act({ date: '2026-10-13', time: '10:00 AM' });
  assert.equal(res.statusCode, 409);
  assert.equal(source.date, '2026-10-12');
  assert.equal(notifications.length, 0);
});

test('a confirmed appointment can be rescheduled while retaining its confirmed status', async () => {
  mockModels();
  mirror.status = 'Confirmed';
  source.status = 'confirmed';
  const res = await act({ date: '2026-10-13', time: '10:00 AM' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'Confirmed');
  assert.equal(source.date, '2026-10-13');
  assert.equal(notifications[0].type, 'appointment_rescheduled');
});

test('a pending or confirmed appointment can be cancelled with student notification', async () => {
  mockModels();
  mirror.status = 'Confirmed';
  source.status = 'confirmed';
  const res = await act({ status: 'Cancelled', reason: 'Counselor unavailable.' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'Cancelled');
  assert.equal(source.status, 'cancelled');
  assert.equal(notifications[0].type, 'appointment_cancelled');
});

test('a duplicate action is rejected after the request is handled', async () => {
  mockModels();
  mirror.status = 'Confirmed';
  const res = await act({ status: 'Declined' });
  assert.equal(res.statusCode, 409);
});

test('an unavailable notification store does not leave the appointment pending', async () => {
  mockModels();
  Notification.create = async () => { throw new Error('notification storage unavailable'); };
  const res = await act({ status: 'Confirmed' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'Confirmed');
  assert.match(res.body.notificationWarning, /notification could not be saved/);
});
