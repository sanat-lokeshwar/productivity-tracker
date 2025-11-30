// server/models/Activity.js
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: { type: String, required: true },            // 'goal' | 'routine' | etc.
  refId: { type: String },                           // id of goal or routine
  title: { type: String, required: true },
  completedAt: { type: Date, required: true },
  dateString: { type: String, required: true },      // YYYY-MM-DD
  createdAt: { type: Date, default: Date.now }
});

// Add helpful indexes
activitySchema.index({ dateString: 1 });
activitySchema.index({ refId: 1 });

module.exports = mongoose.model('Activity', activitySchema);
