// client/src/pages/Dashboard/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useToast } from '../../components/Toast';
import API from '../../api'; // axios instance used elsewhere (adjust path if yours differs)

// localStorage keys
const ACTIVITIES_KEY = 'pt_activities_v1';
const ROUTINES_KEY = 'pt_routines_v1';

// helpers for localStorage
function loadActivitiesLocal() {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveActivitiesLocal(arr) {
  try {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('Failed to save activities locally', err);
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

  const [mergedActivities, setMergedActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line     
  const [syncing, setSyncing] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // canonical lists used to decide whether an activity is "valid" or orphaned
  const [goals, setGoals] = useState([]); // fetched from server
  const routines = loadRoutines();
  const totalRoutines = Array.isArray(routines) ? routines.length : 0;
  const totalGoals = Array.isArray(goals) ? goals.length : 0;

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const theme = localStorage.getItem('pt_theme');
    if (theme === 'dark') applyDark(true);

    // init: load goals + activities then auto-sync if unsynced
    const init = async () => {
      await fetchGoals();
      await refresh();
      const unsynced = countUnsyncedLocal();
      if (unsynced > 0) {
        show(`Auto-syncing ${unsynced} local activity(ies)...`, 'info');
        await syncLocalActivities();
      }
    };
    init();
    // eslint-disable-next-line
  }, []);

  // theme helper
  function applyDark(enable) {
    setIsDark(enable);
    try {
      if (enable) document.body.classList.add('dark');
      else document.body.classList.remove('dark');
      localStorage.setItem('pt_theme', enable ? 'dark' : 'light');
    } catch (err) {
      console.warn('Theme toggle failed', err);
    }
  }

  // Fetch canonical goals from server
  const fetchGoals = async () => {
    try {
      const res = await API.get('/goals');
      setGoals(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('Failed to fetch goals from server', err);
      setGoals([]); // be conservative
    }
  };

  // Fetch server activities and merge with local
  const refresh = async () => {
    setLoading(true);
    try {
      let serverActivities = [];
      try {
        const res = await API.get('/activities');
        serverActivities = Array.isArray(res.data) ? res.data : [];
      } catch (err) {
        console.warn('Failed to fetch server activities — will use local only', err);
        serverActivities = [];
      }

      const local = loadActivitiesLocal();

      // merge preferring server items
      const map = new Map();
      // server first (take priority)
      serverActivities.forEach((act) => {
        const key = `${act.type}|${act.refId || ''}|${act.dateString}`;
        map.set(key, act);
      });
      // then local only if no server item for same type/refId/dateString
      local.forEach((act) => {
        const key = `${act.type}|${act.refId || ''}|${act.dateString}`;
        if (!map.has(key)) {
          map.set(key, act);
        }
      });

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.completedAt) - new Date(a.completedAt)
      );
      setMergedActivities(merged);
    } finally {
      setLoading(false);
    }
  };

  // calculate streak from merged activities
  const calculateStreak = () => {
    const activities = mergedActivities;
    if (!activities.length) return 0;

    const daysSet = new Set(activities.map((a) => a.dateString));
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

  const streak = calculateStreak();

  // Determine routines done today based on canonical routines list
  const doneRoutinesToday = routines && routines.length > 0
    ? routines.filter(r => mergedActivities.some(a => a.type === 'routine' && a.refId === r._id && a.dateString === todayStr)).length
    : 0;

  // Goals: only count goal activities whose refId exists in the canonical goals list
  // build a Set of existing goal ids for quick lookup
  const existingGoalIds = new Set(goals.map(g => String(g._id)));
  const doneGoalsToday = (Array.isArray(goals) && goals.length > 0)
    ? mergedActivities.filter((a) => a.type === 'goal' && a.dateString === todayStr && existingGoalIds.has(String(a.refId))).length
    : 0;

  // Count unsynced local-only activities (we identify temporary ones by _id starting with 'a_'
  // or by items lacking a Mongo-like _id)
  const countUnsyncedLocal = () => {
    const local = loadActivitiesLocal();
    return local.filter((a) => String(a._id).startsWith('a_') || !a._id).length;
  };

  // Sync local-only activities to server (used by auto-sync)
  const syncLocalActivities = async () => {
    setSyncing(true);
    try {
      const local = loadActivitiesLocal();
      const toSync = local.filter((a) => String(a._id).startsWith('a_') || !a._id);

      if (!toSync.length) {
        show('No local activities to sync', 'info');
        return;
      }

      let updatedLocal = local.slice(); // copy

      for (const item of toSync) {
        try {
          const payload = {
            type: item.type,
            refId: item.refId,
            title: item.title,
            completedAt: item.completedAt,
            dateString: item.dateString
          };
          const res = await API.post('/activities', payload);
          // server returns created or existing activity; prefer server version
          if (res && res.data) {
            // remove the temp local item
            updatedLocal = updatedLocal.filter((x) => x._id !== item._id);
            // insert server item at front
            updatedLocal.unshift(res.data);
          }
        } catch (err) {
          console.warn('Failed to sync item', item, err);
          // continue to next item
        }
      }

      // persist updated local storage and refresh merged view
      saveActivitiesLocal(updatedLocal);
      await fetchGoals(); // refresh canonical goals in case deletion occurred meanwhile
      await refresh();
      show('Local activities synced (where possible).', 'success');
    } catch (err) {
      console.error('Sync failed', err);
      show('Sync encountered errors — check console.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // small helper: hide "activities loaded" when zero
  const activitiesLoadedText = () => {
    if (!mergedActivities || mergedActivities.length === 0) return '';
    return `${mergedActivities.length} activities loaded`;
  };

  return (
    <div>
      <div className="header-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Overview of today & progress</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            
          </div>
          <button
            className="button small"
            onClick={() => applyDark(!isDark)}
            aria-pressed={isDark}
            title="Toggle dark mode"
          >
            {isDark ? 'Dark' : 'Light'}
          </button>
        </div>
      </div>

      {/* STREAK CARD */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>🔥 Streak</h3>

        <div style={{ fontSize: 32, fontWeight: 'bold', marginTop: 8 }}>
          {streak} day{streak !== 1 ? 's' : ''}
        </div>

        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
          Complete at least 1 routine or goal per day to keep your streak.
        </div>
      </div>

      {/* TODAY'S SUMMARY */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 style={{ margin: 0 }}>Today</h3>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{todayStr}</div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Routines Completed</div>
            <div style={{ fontSize: 18, fontWeight: '600' }}>{doneRoutinesToday} / {totalRoutines}</div>
          </div>

          <div style={{ padding: 12, borderRadius: 8, background: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Goals Completed</div>
            <div style={{ fontSize: 18, fontWeight: '600' }}>{doneGoalsToday} / {totalGoals}</div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="button"
            onClick={async () => {
              await fetchGoals();
              await refresh();
              show('Dashboard refreshed', 'success');
            }}
            disabled={loading}
          >
            Refresh
          </button>

          <div style={{ marginLeft: 'auto', color: '#6b7280', fontSize: 13 }}>
            {loading ? 'Loading activities…' : activitiesLoadedText()}
          </div>
        </div>
      </div>
    </div>
  );
}
