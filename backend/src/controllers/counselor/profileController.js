const Counselor = require('../../models/counselor/Counselor');
const CounselorProfile = require('../../models/counselor/CounselorProfile');
const CounselorAppointment = require('../../models/counselor/CounselorAppointment');
const CounselorStudent = require('../../models/counselor/CounselorStudent');

const counselorIdFor = (req) => String(req.user?.id || '');

const serializeProfile = (counselor, profile = null) => ({
  ...(profile?.toObject ? profile.toObject() : profile || {}),
  _id: String(counselor._id),
  id: String(counselor._id),
  name: counselor.fullName,
  title: counselor.role === 'counselor' ? 'University Counselor' : counselor.role,
  qualification: counselor.qualification,
  specialization: counselor.specialization,
  clinicalFocus: Array.isArray(profile?.clinicalFocus) && profile.clinicalFocus.length
    ? profile.clinicalFocus
    : counselor.specialization ? [counselor.specialization] : [],
  officeLocation: counselor.officeLocation || '',
  email: counselor.email,
  phone: counselor.phone,
  status: counselor.status || 'Available',
  role: counselor.role || 'counselor',
  profileImage: counselor.profileImage || '',
  bio: counselor.bio || '',
  avatarInitials: `${counselor.firstName?.[0] || ''}${counselor.lastName?.[0] || ''}`.toUpperCase(),
});

// GET /api/counselor/profile. Identity and contact data always come from the
// authenticated Counselor document; the presentation document is optional.
exports.getProfile = async (req, res) => {
  try {
    const id = counselorIdFor(req);
    const counselor = await Counselor.findById(id);
    if (!counselor) return res.status(404).json({ success: false, message: 'Counselor account not found' });
    const profile = await CounselorProfile.findById(id);
    return res.status(200).json(serializeProfile(counselor, profile));
  } catch (error) {
    console.error('Counselor getProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch counselor profile' });
  }
};

// PUT /api/counselor/profile. The route is protected and updates only req.user.id.
exports.updateProfile = async (req, res) => {
  try {
    const id = counselorIdFor(req);
    const counselor = await Counselor.findById(id);
    if (!counselor) return res.status(404).json({ success: false, message: 'Counselor account not found' });

    const updates = {};
    const allowed = ['email', 'phone', 'qualification', 'specialization', 'profileImage', 'bio', 'officeLocation'];
    allowed.forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });

    if (req.body.name !== undefined) {
      const parts = String(req.body.name).trim().split(/\s+/).filter(Boolean);
      if (parts.length < 2) return res.status(400).json({ success: false, message: 'Enter your first and last name.' });
      updates.firstName = parts.shift();
      updates.lastName = parts.join(' ');
    }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'No profile fields were provided.' });

    if (updates.email !== undefined) updates.email = String(updates.email).trim().toLowerCase();
    if (updates.phone !== undefined) updates.phone = String(updates.phone).trim();
    for (const field of ['qualification', 'specialization']) {
      if (updates[field] !== undefined) updates[field] = String(updates[field]).trim();
    }
    if (updates.bio !== undefined) updates.bio = String(updates.bio).trim();
    if (updates.officeLocation !== undefined) updates.officeLocation = String(updates.officeLocation).trim();
    if (req.body.clinicalFocus !== undefined) {
      if (!Array.isArray(req.body.clinicalFocus) || req.body.clinicalFocus.length > 20 || req.body.clinicalFocus.some((item) => typeof item !== 'string' || item.length > 100)) {
        return res.status(400).json({ success: false, message: 'Clinical focus areas must be a list of up to 20 short text values.' });
      }
    }

    if (updates.email && !/^\S+@\S+\.\S+$/.test(updates.email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (updates.phone !== undefined && !updates.phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    if (updates.phone !== undefined && (updates.phone.length < 7 || updates.phone.length > 25)) {
      return res.status(400).json({ success: false, message: 'Phone number must be 7 to 25 characters.' });
    }
    if (updates.profileImage !== undefined && updates.profileImage !== '') {
      const image = String(updates.profileImage);
      if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image) || image.length > 7 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: 'Upload a JPG, PNG, or WebP profile photo smaller than 4 MB.' });
      }
    }

    Object.assign(counselor, updates);
    await counselor.save();

    const profileUpdates = {};
    if (updates.firstName || updates.lastName) profileUpdates.name = counselor.fullName;
    for (const field of ['email', 'qualification', 'specialization', 'profileImage', 'bio', 'officeLocation']) {
      if (updates[field] !== undefined) profileUpdates[field] = updates[field];
    }
    if (req.body.clinicalFocus !== undefined) profileUpdates.clinicalFocus = req.body.clinicalFocus.map((item) => item.trim()).filter(Boolean);
    if (Object.keys(profileUpdates).length) {
      await CounselorProfile.findOneAndUpdate(
        { _id: id },
        { $set: profileUpdates },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    const profile = await CounselorProfile.findById(id);
    return res.status(200).json({ success: true, message: 'Profile updated successfully.', data: serializeProfile(counselor, profile) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'That email address is already in use.' });
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map((item) => item.message).join(' ') });
    }
    console.error('Counselor updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update counselor profile' });
  }
};

// PUT /api/counselor/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    if (String(newPassword).length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
    if (currentPassword === newPassword) return res.status(400).json({ success: false, message: 'Choose a new password different from your current password.' });

    const counselor = await Counselor.findById(counselorIdFor(req)).select('+password');
    if (!counselor) return res.status(404).json({ success: false, message: 'Counselor account not found.' });
    if (!(await counselor.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    counselor.password = newPassword;
    await counselor.save();
    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Counselor changePassword error:', error);
    return res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
};

// GET /api/counselor/stats
exports.getStats = async (req, res) => {
  try {
    const key = counselorIdFor(req);
    const [activeCases, thisWeekSessions, pendingRequests] = await Promise.all([
      CounselorStudent.countDocuments({ counselorId: key, status: { $ne: 'Archived' } }),
      CounselorAppointment.countDocuments({ counselorId: key, status: { $in: ['Confirmed', 'Completed'] }, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      CounselorAppointment.countDocuments({ counselorId: key, status: 'Pending' }),
    ]);
    return res.status(200).json({ activeCases, thisWeekSessions, pendingRequests });
  } catch (error) {
    console.error('Counselor getStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch counselor statistics' });
  }
};
