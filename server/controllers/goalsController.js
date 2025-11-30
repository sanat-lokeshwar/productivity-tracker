// server/controllers/goalsController.js
const Goal = require('../models/Goal');

exports.getGoals = async (req, res) => {
  try {
    const goals = await Goal.find().sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createGoal = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const g = new Goal({ title, description });
    await g.save();
    res.status(201).json(g);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.completeGoal = async (req, res) => {
  try {
    const { id } = req.params;

    const goal = await Goal.findById(id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    if (goal.completed) return res.status(400).json({ error: 'Goal already completed' });

    goal.completed = true;
    goal.completedAt = new Date();
    await goal.save();

    // ----------------------------------------------
    // CREATE ACTIVITY (idempotent)
    // ----------------------------------------------
    try {
      const Activity = require('../models/Activity');

      const now = new Date();
      const dateString = now.toISOString().split('T')[0];

      // Check if an activity already exists for this goal today
      const existing = await Activity.findOne({
        type: 'goal',
        refId: goal._id.toString(),
        dateString
      });

      if (!existing) {
        await Activity.create({
          type: 'goal',
          refId: goal._id.toString(),
          title: goal.title || goal.name || 'Goal',
          completedAt: now,
          dateString
        });
      }
    } catch (err) {
      console.error('Activity creation failed (non-fatal):', err);
      // DO NOT return error — main response must still succeed
    }
    // ----------------------------------------------

    res.json(goal);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};


// NEW: delete a goal
exports.deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const goal = await Goal.findById(id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    await Goal.findByIdAndDelete(id);
    res.json({ success: true, message: 'Goal deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
// Update (edit) a goal
exports.updateGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed } = req.body;

    const goal = await Goal.findById(id);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    if (title !== undefined) goal.title = title;
    if (description !== undefined) goal.description = description;
    // optional: allow updating completed flag from frontend
    if (completed !== undefined) {
      goal.completed = !!completed;
      goal.completedAt = goal.completed ? (goal.completedAt || new Date()) : null;
    }

    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
