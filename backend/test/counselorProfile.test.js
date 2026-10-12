const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const Counselor = require('../src/models/counselor/Counselor');
const CounselorProfile = require('../src/models/counselor/CounselorProfile');
const controller = require('../src/controllers/counselor/profileController');

const original = {
  counselorFindById: Counselor.findById,
  profileFindById: CounselorProfile.findById,
  profileFindOneAndUpdate: CounselorProfile.findOneAndUpdate,
};
let account;
let readId;
let profileWrites;

function reset() {
  readId = null;
  profileWrites = [];
  account = {
    _id: 'own-counselor-id', firstName: 'Taylor', lastName: 'Lee', email: 'taylor@example.edu',
    phone: '+94112223333', qualification: 'MSc', specialization: 'Counseling',
    officeLocation: '', profileImage: '', bio: '',
    get fullName() { return `${this.firstName} ${this.lastName}`; },
    save: async function save() { return this; },
    comparePassword: async (password) => password === 'current-password',
  };
  Counselor.findById = (id) => {
    readId = String(id);
    const query = Promise.resolve(account);
    query.select = async () => account;
    return query;
  };
  CounselorProfile.findById = async (id) => ({ _id: id, clinicalFocus: ['Study stress'] });
  CounselorProfile.findOneAndUpdate = async (...args) => { profileWrites.push(args); return {}; };
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

afterEach(() => {
  Counselor.findById = original.counselorFindById;
  CounselorProfile.findById = original.profileFindById;
  CounselorProfile.findOneAndUpdate = original.profileFindOneAndUpdate;
  reset();
});

reset();

test('profile read returns the authenticated counselor record and scopes by JWT id', async () => {
  const res = response();
  await controller.getProfile({ user: { id: 'own-counselor-id', role: 'counselor' } }, res);
  assert.equal(readId, 'own-counselor-id');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.name, 'Taylor Lee');
  assert.equal(res.body.phone, '+94112223333');
});

test('profile update writes only the authenticated account and returns persisted profile fields', async () => {
  const res = response();
  await controller.updateProfile({
    user: { id: 'own-counselor-id', role: 'counselor' },
    body: { name: 'Taylor J Lee', email: 'TAYLOR.J@example.edu', phone: '+94119998888', bio: 'Here to help.' },
  }, res);
  assert.equal(readId, 'own-counselor-id');
  assert.equal(account.name, undefined);
  assert.equal(account.firstName, 'Taylor');
  assert.equal(account.lastName, 'J Lee');
  assert.equal(account.email, 'taylor.j@example.edu');
  assert.equal(account.phone, '+94119998888');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.name, 'Taylor J Lee');
  assert.equal(profileWrites.length, 1);
});

test('profile update validates names and rejects invalid email', async () => {
  const badName = response();
  await controller.updateProfile({ user: { id: 'own-counselor-id' }, body: { name: 'Taylor' } }, badName);
  assert.equal(badName.statusCode, 400);
  const badEmail = response();
  await controller.updateProfile({ user: { id: 'own-counselor-id' }, body: { email: 'bad-address' } }, badEmail);
  assert.equal(badEmail.statusCode, 400);
});

test('password change verifies the current password and updates the counselor account', async () => {
  const res = response();
  await controller.changePassword({ user: { id: 'own-counselor-id' }, body: { currentPassword: 'current-password', newPassword: 'new-password-123' } }, res);
  assert.equal(readId, 'own-counselor-id');
  assert.equal(account.password, 'new-password-123');
  assert.equal(res.statusCode, 200);
});

test('password change rejects an incorrect current password', async () => {
  const res = response();
  await controller.changePassword({ user: { id: 'own-counselor-id' }, body: { currentPassword: 'wrong', newPassword: 'new-password-123' } }, res);
  assert.equal(res.statusCode, 401);
});
