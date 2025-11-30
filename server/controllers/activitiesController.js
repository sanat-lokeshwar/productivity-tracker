// server/controllers/activitiesController.js
const Activity = require('../models/Activity');

exports.createActivity = async (req, res) => {
  try {
    const { type, refId, title, completedAt, dateString } = req.body;
    if (!type || !title || !completedAt || !dateString) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Idempotency check: avoid duplicates for same type+refId+dateString
    if (refId) {
      const exists = await Activity.findOne({ type, refId: String(refId), dateString });
      if (exists) {
        return res.status(200).json(exists); // return existing
      }
    }

    const act = await Activity.create({
      type,
      refId: refId ? String(refId) : undefined,
      title,
      completedAt: new Date(completedAt),
      dateString
    });

    return res.status(201).json(act);
  } catch (err) {
    console.error('createActivity error', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getActivities = async (req, res) => {
  try {
    // optional filters can be added: ?from=YYYY-MM-DD&to=YYYY-MM-DD
    const activities = await Activity.find().sort({ completedAt: -1 }).limit(2000);
    return res.json(activities);
  } catch (err) {
    console.error('getActivities error', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    await Activity.findByIdAndDelete(req.params.id);
    return res.status(204).end();
  } catch (err) {
    console.error('deleteActivity error', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
