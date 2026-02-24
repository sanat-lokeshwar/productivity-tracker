// server/controllers/activitiesController.js
const Activity = require('../models/Activity');

// @desc    Create an activity
// @route   POST /api/activities
exports.createActivity = async (req, res) => {
  try {
    const { type, refId, title, completedAt, dateString } = req.body;

    if (!type || !title || !dateString) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    // Idempotency check
    if (refId) {
      const exists = await Activity.findOne({ 
        user: req.user.uid, 
        type, 
        refId: String(refId), 
        dateString 
      });
      if (exists) {
        return res.status(200).json(exists);
      }
    }

    const act = await Activity.create({
      user: req.user.uid,
      type,
      refId: refId ? String(refId) : undefined,
      title,
      completedAt: completedAt ? new Date(completedAt) : new Date(),
      dateString
    });

    return res.status(201).json(act);
  } catch (err) {
    console.error('createActivity error', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Get activities (Admin sees ALL, User sees OWN)
// @route   GET /api/activities
exports.getActivities = async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    let query = {};

    // LOGIC: If Admin -> Query Everything. If User -> Query only theirs.
    if (req.user.isAdmin) {
        query = {}; // Empty query = Find All
    } else {
        query = { user: req.user.uid };
    }

    const activities = await Activity.find(query)
      .sort({ completedAt: -1 })
      .limit(2000);
      
    return res.json(activities);
  } catch (err) {
    console.error('getActivities error', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @desc    Delete an activity
// @route   DELETE /api/activities/:id
exports.deleteActivity = async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    // Check ownership (Admin overrides)
    if (activity.user !== req.user.uid && !req.user.isAdmin) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await activity.deleteOne();
    return res.status(200).json({ id: req.params.id });
  } catch (err) {
    console.error('deleteActivity error', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};