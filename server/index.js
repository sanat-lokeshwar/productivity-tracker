// server/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const activitiesRouter = require('./routes/activities');

const connectDB = require('./config/db');
const goalsRoutes = require('./routes/goals');

const app = express();
app.use(cors());
app.use(express.json());

// connect to mongo
connectDB();

// mount API routes
app.use('/api/goals', goalsRoutes);
app.use('/api/activities', activitiesRouter);
// tiny test route
app.get('/', (req, res) => {
  res.json({ ok: true, msg: 'Server is up. Backend minimal setup works.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
