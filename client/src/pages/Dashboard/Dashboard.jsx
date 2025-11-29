// client/src/pages/Dashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';

// localStorage keys
const ACTIVITIES_KEY = 'pt_activities_v1';
const ROUTINES_KEY = 'pt_routines_v1';
// eslint-disable-next-line
const GOALS_KEY = 'pt_goals_dummy'; // future use

function loadActivities() {
  try {
    let raw = localStorage.getItem(ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadRoutines() {
  try {
    const raw = localStorage.getItem(ROUTINES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function Dashboard() {
  const { show } = useToast();

  const [todayActivities, setTodayActivities] = useState([]);
  const [streak, setStreak] = useState(0);

  const activities = loadActivities();

  useEffect(() => {
    refresh();
    // eslint-disable-next-line
  }, []);

  const refresh = () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // filter today's activities
    const today = activities.filter(a => a.dateString === todayStr);
    setTodayActivities(today);

    // calculate streak
    setStreak(calculateStreak());
  };

  // calculate streak from local activities
  const calculateStreak = () => {
    if (!activities.length) return 0;

    const daysSet = new Set(activities.map(a => a.dateString));
    let count = 0;
    let d = new Date();

    while (true) {
      const dayStr = d.toISOString().split('T')[0];
      if (daysSet.has(dayStr)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else break;
    }

    return count;
  };

  const routines = loadRoutines();

  const todayStr = new Date().toISOString().split('T')[0];

  const doneRoutinesToday = todayActivities.filter(a => a.type === 'routine').length;
  const doneGoalsToday = todayActivities.filter(a => a.type === 'goal').length;

  const totalRoutines = routines.length;

  return (
    <div>
      <div className="header-row">
        <h2>Dashboard</h2>
        <span style={{ color: '#6b7280' }}>
          Overview of today & progress
        </span>
      </div>

      {/* STREAK CARD */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          🔥 Streak
        </h3>

        <div style={{ fontSize: 32, fontWeight: 'bold' }}>
          {streak} day{streak !== 1 ? 's' : ''}
        </div>

        <div style={{ fontSize: 12, color: '#6b7280' }}>
          You must complete at least 1 routine or goal per day to keep your streak going.
        </div>
      </div>

      {/* TODAY'S SUMMARY */}
      <div className="card">
        <h3>Today</h3>

        <div style={{ marginBottom: 12, fontSize: 14 }}>
          Date: <strong>{todayStr}</strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          <strong>Routines Completed:</strong> {doneRoutinesToday} / {totalRoutines}
        </div>

        <div style={{ marginBottom: 8 }}>
          <strong>Goals Completed:</strong> {doneGoalsToday}
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="button" onClick={() => {
            refresh();
            
            show("Dashboard refreshed", "success");
          }}>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
