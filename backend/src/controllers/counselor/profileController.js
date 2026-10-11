const CounselorProfile = require('../../models/counselor/CounselorProfile');
const Counselor = require('../../models/counselor/Counselor');
const CounselorAppointment = require('../../models/counselor/CounselorAppointment');
const CounselorStudent = require('../../models/counselor/CounselorStudent');
const { SEED_COUNSELOR_ID, counselorKey } = require('./_scope');

const DEFAULT_PROFILE = {
  _id: 'c1',
  name: 'Dr. Evelyn Martinez, PhD',
  title: 'Senior Student Cognitive Psychologist',
  role: 'CLINICAL STAFF',
  rating: 4.9,
  sessionsReviewed: 148,
  qualification: 'PhD in Clinical Psychology, Stanford',
  specialization: 'Cognitive Behavioral Therapy (CBT)',
  clinicalFocus: ['Academic Burnout', 'ADHD Management', 'Anxiety Disorder', 'Social Adjustment'],
  officeLocation: 'Clinic Hall B, Room 302',
  email: 'e.martinez@university.edu',
  avatarInitials: 'EM',
  profileImage: '',
  bio: 'Dedicated senior psychologist with over 10 years of experience supporting university students through academic, emotional, and social challenges.',
};

const deriveInitials = (counselor) => {
  const initials = `${(counselor.firstName || '')[0] || ''}${(counselor.lastName || '')[0] || ''}`;
  return initials.toUpperCase() || DEFAULT_PROFILE.avatarInitials;
};

// Build a per-counselor profile from the authenticated Counselor account,
// filling the counselor-module presentation fields from the seeded defaults.
const buildDerivedProfile = (key, counselor) => ({
  _id: key,
  name: `${counselor.firstName || ''} ${counselor.lastName || ''}`.trim() || DEFAULT_PROFILE.name,
  title: DEFAULT_PROFILE.title,
  role: DEFAULT_PROFILE.role,
  rating: DEFAULT_PROFILE.rating,
  sessionsReviewed: DEFAULT_PROFILE.sessionsReviewed,
  qualification: counselor.qualification || DEFAULT_PROFILE.qualification,
  specialization: counselor.specialization || DEFAULT_PROFILE.specialization,
  clinicalFocus:
    Array.isArray(counselor.clinicalFocus) && counselor.clinicalFocus.length
      ? counselor.clinicalFocus
      : counselor.specialization
        ? [counselor.specialization]
        : DEFAULT_PROFILE.clinicalFocus,
  officeLocation: counselor.officeLocation || DEFAULT_PROFILE.officeLocation,
  email: counselor.email || DEFAULT_PROFILE.email,
  avatarInitials: deriveInitials(counselor),
  profileImage: counselor.profileImage || '',
  bio: counselor.bio || DEFAULT_PROFILE.bio,
});

// Resolve the profile document for the authenticated counselor, deriving one
// from their account on first access and falling back to the seeded profile
// only when no matching Counselor account exists (e.g. dev tokens).
const resolveProfile = async (key) => {
  const existing = await CounselorProfile.findById(key);
  if (existing) return existing;

  const counselor = await Counselor.findById(key).catch(() => null);
  if (counselor) {
    return CounselorProfile.create(buildDerivedProfile(key, counselor));
  }

  let seeded = await CounselorProfile.findById(SEED_COUNSELOR_ID);
  if (!seeded) {
    seeded = await CounselorProfile.create(DEFAULT_PROFILE);
  }
  return seeded;
};

// GET /api/counselor/profile
exports.getProfile = async (req, res) => {
  try {
    const profile = await resolveProfile(counselorKey(req));
    return res.status(200).json(profile);
  } catch (error) {
    console.error('❌ counselor getProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch counselor profile' });
  }
};

// PUT /api/counselor/profile
exports.updateProfile = async (req, res) => {
  try {
    const allowed = [
      'name',
      'title',
      'qualification',
      'specialization',
      'clinicalFocus',
      'officeLocation',
      'email',
      'avatarInitials',
      'profileImage',
      'bio',
      'rating',
      'sessionsReviewed',
    ];

    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (updates.profileImage !== undefined && updates.profileImage !== '') {
      const imageData = String(updates.profileImage);
      const isImageDataUri = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageData);
      if (!isImageDataUri || imageData.length > 7 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Upload a JPG, PNG, or WebP profile photo smaller than 4 MB',
        });
      }
    }

    const key = counselorKey(req);
    let profile = await resolveProfile(key);
    if (String(profile._id) !== key) {
      profile = await CounselorProfile.create({ ...profile.toJSON(), _id: key });
    }

    profile.set(updates);
    await profile.save();
    if (updates.profileImage !== undefined) {
      await Counselor.findByIdAndUpdate(key, { $set: { profileImage: updates.profileImage } }).catch(() => null);
    }
    return res.status(200).json(profile);
  } catch (error) {
    console.error('❌ counselor updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update counselor profile' });
  }
};

// GET /api/counselor/stats
exports.getStats = async (req, res) => {
  try {
    const key = counselorKey(req);
    const [activeCases, thisWeekSessions, pendingRequests] = await Promise.all([
      CounselorStudent.countDocuments({ counselorId: key, status: { $ne: 'Archived' } }),
      CounselorAppointment.countDocuments({
        counselorId: key,
        status: { $in: ['Confirmed', 'Completed'] },
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      CounselorAppointment.countDocuments({ counselorId: key, status: 'Pending' }),
    ]);
    const stats = {
      activeCases,
      thisWeekSessions,
      pendingRequests,
      summary: pendingRequests
        ? `You have ${pendingRequests} booking request${pendingRequests === 1 ? '' : 's'} to review.`
        : activeCases
          ? `You are supporting ${activeCases} active student${activeCases === 1 ? '' : 's'}.`
          : 'New student bookings will appear here.',
    };
    return res.status(200).json(stats);
  } catch (error) {
    console.error('❌ counselor getStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};
