// server/routes/activities.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/activitiesController');

router.post('/', ctrl.createActivity);
router.get('/', ctrl.getActivities);
router.delete('/:id', ctrl.deleteActivity);

module.exports = router;
