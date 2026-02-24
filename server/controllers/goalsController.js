// server/controllers/goalsController.js
const Goal = require('../models/Goal');
const Activity = require('../models/Activity');

// @desc    Get goals
// @route   GET /api/goals

const getGoals = async (req, res) => {
  try {
    // 1. Safety Check
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    // 2. STRICT LOGIC: Everyone (even admins) only sees their OWN personal goals
    const goals = await Goal.find({ user: req.user.uid }).sort({ createdAt: -1 });
    
    res.status(200).json(goals);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ message: error.message });
  }
};

const createGoal = async (req, res) => {
  if (!req.body.title) {
    return res.status(400).json({ message: 'Please add a text field' });
  }

  try {
    const goal = await Goal.create({
      title: req.body.title,
      description: req.body.description || '',
      user: req.user.uid, 
    });
    res.status(200).json(goal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    
    // Allow if Owner OR Admin
    if (goal.user !== req.user.uid && !req.user.isAdmin) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const updatedGoal = await Goal.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedGoal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    // Allow if Owner OR Admin
    if (goal.user !== req.user.uid && !req.user.isAdmin) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await goal.deleteOne();
    res.status(200).json({ id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const completeGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    // Allow if Owner OR Admin
    if (goal.user !== req.user.uid && !req.user.isAdmin) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    // Toggle completed status
    goal.completed = !goal.completed;

    // FIX: Update the timestamp!
    if (goal.completed) {
        goal.completedAt = new Date(); // <--- This saves the date
    } else {
        goal.completedAt = null; // Clear date if un-checking
    }
    
    // Create Activity Log (for Dashboard & Consistency Page)
    if (goal.completed) {
        try {
            await Activity.create({
                user: req.user.uid,
                type: 'goal',
                title: goal.title,
                refId: goal._id,
                dateString: new Date().toISOString().split('T')[0]
            });
        } catch(e) { 
            console.log("Activity create skipped (non-fatal)"); 
        }
    }

    await goal.save();
    res.status(200).json(goal);
  } catch (error) {
    console.error('Complete Goal Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  completeGoal,
};