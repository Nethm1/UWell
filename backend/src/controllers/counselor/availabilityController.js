const CounselorAvailability = require('../../models/counselor/CounselorAvailability');
const { counselorKey } = require('./_scope');

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const sortByDay = (items) => [...items].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
const allowedDays = new Set(DAY_ORDER);
const isCalendarDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

// GET /api/counselor/availability
exports.getAvailability = async (req, res) => {
  try {
    const availability = await CounselorAvailability.find({ counselorId: counselorKey(req) });
    return res.status(200).json(sortByDay(availability));
  } catch (error) {
    console.error('counselor getAvailability error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch availability' });
  }
};

// POST /api/counselor/availability
exports.createAvailability = async (req, res) => {
  try {
    const { day, date = '', slots, startTime, endTime, active = true } = req.body;
    if (!allowedDays.has(day)) {
      return res.status(400).json({ success: false, message: 'Choose a valid day of the week' });
    }
    if (!Array.isArray(slots)) {
      return res.status(400).json({ success: false, message: 'Availability slots must be a list' });
    }
    if (date && !isCalendarDate(date)) {
      return res.status(400).json({ success: false, message: 'Date must use YYYY-MM-DD format' });
    }

    const counselorId = counselorKey(req);
    const existing = await CounselorAvailability.findOne({ counselorId, day, date: String(date || '') });
    if (existing) {
      return res.status(409).json({ success: false, message: `${day} already has an availability schedule. Edit it instead.` });
    }
    const result = await CounselorAvailability.create({
      _id: `av-${counselorId}-${day.toLowerCase()}-${Date.now()}`,
      counselorId,
      day,
      date: String(date || ''),
      active: Boolean(active),
      startTime,
      endTime,
      slots: slots.map((slot) => String(slot).trim()).filter(Boolean),
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error('counselor createAvailability error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create availability' });
  }
};

// PUT /api/counselor/availability
// Save the counselor's weekly schedule as one operation. This is used by the
// screen's Save Availability button after several local edits.
exports.saveWeeklyAvailability = async (req, res) => {
  try {
    if (!Array.isArray(req.body?.schedule) || req.body.schedule.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide at least one day of availability' });
    }

    const byDay = new Map();
    for (const item of req.body.schedule) {
      if (!item || !allowedDays.has(item.day)) {
        return res.status(400).json({ success: false, message: 'Each schedule entry must use a valid day of the week' });
      }
      if (!Array.isArray(item.slots)) {
        return res.status(400).json({ success: false, message: 'Availability slots must be a list' });
      }
      byDay.set(item.day, item);
    }

    const counselorId = counselorKey(req);
    const operations = [...byDay.values()].map((item) => ({
      updateOne: {
        filter: { counselorId, day: item.day, $or: [{ date: '' }, { date: { $exists: false } }] },
        update: {
          $set: {
            active: Boolean(item.active),
            startTime: String(item.startTime || '09:00 AM').trim(),
            endTime: String(item.endTime || '05:00 PM').trim(),
            slots: item.slots.map((slot) => String(slot).trim()).filter(Boolean),
          },
          $setOnInsert: { _id: `av-${counselorId}-${item.day.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
        },
        upsert: true,
      },
    }));

    await CounselorAvailability.bulkWrite(operations, { ordered: true });
    const availability = await CounselorAvailability.find({ counselorId });
    return res.status(200).json(sortByDay(availability));
  } catch (error) {
    console.error('counselor saveWeeklyAvailability error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save availability' });
  }
};

// PUT /api/counselor/availability/:id
exports.updateAvailability = async (req, res) => {
  try {
    const { day, date, slots, startTime, endTime, active } = req.body;
    const updates = {};
    if (day !== undefined) {
      if (!allowedDays.has(day)) return res.status(400).json({ success: false, message: 'Choose a valid day of the week' });
      updates.day = day;
    }
    if (date !== undefined) {
      if (date && !isCalendarDate(date)) return res.status(400).json({ success: false, message: 'Date must use YYYY-MM-DD format' });
      updates.date = String(date || '');
    }
    if (slots !== undefined) {
      if (!Array.isArray(slots)) return res.status(400).json({ success: false, message: 'Availability slots must be a list' });
      updates.slots = slots.map((slot) => String(slot).trim()).filter(Boolean);
    }
    if (startTime !== undefined) updates.startTime = String(startTime).trim();
    if (endTime !== undefined) updates.endTime = String(endTime).trim();
    if (active !== undefined) updates.active = Boolean(active);

    const result = await CounselorAvailability.findOneAndUpdate(
      { _id: req.params.id, counselorId: counselorKey(req) },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!result) return res.status(404).json({ success: false, message: 'Availability not found' });
    return res.status(200).json(result);
  } catch (error) {
    console.error('counselor updateAvailability error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update availability' });
  }
};

// DELETE /api/counselor/availability/:id — scoped to the signed-in counselor.
exports.deleteAvailability = async (req, res) => {
  try {
    const result = await CounselorAvailability.findOneAndDelete({
      _id: req.params.id,
      counselorId: counselorKey(req),
    });
    if (!result) return res.status(404).json({ success: false, message: 'Availability not found' });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('counselor deleteAvailability error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete availability' });
  }
};
