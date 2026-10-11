const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const Appointment = require('../src/models/student/Appointment');
const CounselorAppointment = require('../src/models/counselor/CounselorAppointment');
const { createAppointmentVideoLink } = require('../src/controllers/appointmentVideoController');

const appointmentId = '66a111111111111111111111';
const studentId = 'student-123';
const counselorId = 'counselor-456';
const originalAppointmentFindById = Appointment.findById;
const originalAppointmentUpdateOne = Appointment.updateOne;
const originalCounselorFindById = CounselorAppointment.findById;

let appointment;
let counselorMirror;

function mockModels() {
  Appointment.findById = () => ({ select: async () => appointment });
  Appointment.updateOne = async (_filter, update) => {
    if (appointment && !appointment.videoRoomName) {
      appointment.videoRoomName = update.$set.videoRoomName;
    }
    return { modifiedCount: 1 };
  };
  CounselorAppointment.findById = () => ({
    select: () => ({ lean: async () => counselorMirror }),
  });
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function request(user, id = appointmentId) {
  const res = makeResponse();
  await createAppointmentVideoLink({ params: { appointmentId: id }, user }, res);
  return res;
}

afterEach(() => {
  Appointment.findById = originalAppointmentFindById;
  Appointment.updateOne = originalAppointmentUpdateOne;
  CounselorAppointment.findById = originalCounselorFindById;
  appointment = {
    _id: appointmentId,
    student: studentId,
    counselorId,
    counselor: null,
    status: 'confirmed',
    sessionType: 'Online',
    videoRoomName: '',
  };
  counselorMirror = { _id: `stu-appt-${appointmentId}`, counselorId, status: 'Confirmed' };
});

// Initialize state before the first test.
appointment = {
  _id: appointmentId,
  student: studentId,
  counselorId,
  counselor: null,
  status: 'confirmed',
  sessionType: 'Online',
  videoRoomName: '',
};
counselorMirror = { _id: `stu-appt-${appointmentId}`, counselorId, status: 'Confirmed' };

test('student and assigned counselor receive the same persisted meeting link', async () => {
  mockModels();
  const studentResult = await request({ id: studentId, role: 'student' });
  const counselorResult = await request({ id: counselorId, role: 'counselor' }, `stu-appt-${appointmentId}`);

  assert.equal(studentResult.statusCode, 200);
  assert.equal(counselorResult.statusCode, 200);
  assert.equal(studentResult.body.meetingUrl, counselorResult.body.meetingUrl);
  assert.match(appointment.videoRoomName, /^uwell-[a-f0-9]{48}$/);
});

test('repeated simultaneous requests settle on one saved room', async () => {
  mockModels();
  const [first, second] = await Promise.all([
    request({ id: studentId, role: 'student' }),
    request({ id: studentId, role: 'student' }),
  ]);

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(first.body.meetingUrl, second.body.meetingUrl);
});

test('an unrelated authenticated user is forbidden', async () => {
  mockModels();
  const result = await request({ id: 'another-user', role: 'student' });
  assert.equal(result.statusCode, 403);
});

test('a missing appointment returns 404', async () => {
  mockModels();
  Appointment.findById = () => ({ select: async () => null });
  const result = await request({ id: studentId, role: 'student' });
  assert.equal(result.statusCode, 404);
});

test('an unconfirmed appointment cannot obtain a meeting link', async () => {
  mockModels();
  appointment.status = 'upcoming';
  const result = await request({ id: studentId, role: 'student' });
  assert.equal(result.statusCode, 409);
});

test('a non-online appointment cannot obtain a meeting link', async () => {
  mockModels();
  appointment.sessionType = 'In Person';
  const result = await request({ id: studentId, role: 'student' });
  assert.equal(result.statusCode, 409);
});

test('an invalid appointment id returns 400', async () => {
  mockModels();
  const result = await request({ id: studentId, role: 'student' }, 'not-an-object-id');
  assert.equal(result.statusCode, 400);
});

test('a counselor cannot use another counselor appointment mirror', async () => {
  mockModels();
  counselorMirror.counselorId = 'different-counselor';
  const result = await request({ id: counselorId, role: 'counselor' }, `stu-appt-${appointmentId}`);
  assert.equal(result.statusCode, 403);
});
