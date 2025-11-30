// client/src/pages/Consistency/Consistency.jsx
import React, { useEffect, useMemo, useState } from 'react';
import API from '../../api';
import { useToast } from '../../components/Toast';

// local keys
const ACTIVITIES_KEY = 'pt_activities_v1';

function loadActivitiesLocal() {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveActivitiesLocal(list) {
  try {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed saving activities locally', err);
  }
}

export default function Consistency() {
  const { show } = useToast();

  const [merged, setMerged] = useState([]); // merged activities
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  useEffect(() => {
    refresh();
    // listen to storage so UI updates if other tab/page modifies activities
    const onStorage = (e) => {
      if (e.key === ACTIVITIES_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line
  }, []);

  // refresh: fetch server activities and merge with local
  const refresh = async () => {
    setLoading(true);
    try {
      let server = [];
      try {
        const res = await API.get('/activities');
        server = Array.isArray(res.data) ? res.data : [];
      } catch (err) {
        console.warn('Failed to fetch activities from server, using local only', err);
        server = [];
      }
      const local = loadActivitiesLocal() || [];

      // merge with server preference
      const map = new Map();
      server.forEach(a => {
        const key = `${a.type}|${a.refId || ''}|${a.dateString}`;
        map.set(key, a);
      });
      local.forEach(a => {
        const key = `${a.type}|${a.refId || ''}|${a.dateString}`;
        if (!map.has(key)) map.set(key, a);
      });

      const mergedList = Array.from(map.values())
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

      setMerged(mergedList);
    } finally {
      setLoading(false);
    }
  };

  // grouped by date (descending)
  const grouped = useMemo(() => {
    const groups = {};
    merged.forEach(a => {
      const d = a.dateString || (new Date(a.completedAt)).toISOString().split('T')[0];
      if (!groups[d]) groups[d] = [];
      groups[d].push(a);
    });
    // sort keys descending
    const sortedKeys = Object.keys(groups).sort((x, y) => (x < y ? 1 : -1));
    return sortedKeys.map(k => ({ date: k, items: groups[k] }));
  }, [merged]);

  // counts summary
  const summary = useMemo(() => {
    const total = merged.length;
    const goals = merged.filter(a => a.type === 'goal').length;
    const routines = merged.filter(a => a.type === 'routine').length;
    return { total, goals, routines };
  }, [merged]);

  // Clear history action: remove local and try to delete server ones (best-effort)
  const clearHistory = async () => {
    setClearing(true);
    try {
      // 1) Remove local activities immediately
      saveActivitiesLocal([]);
      // 2) Attempt to delete server activities
      let deleted = 0;
      let failed = 0;
      try {
        const res = await API.get('/activities');
        const all = Array.isArray(res.data) ? res.data : [];
        for (const a of all) {
          try {
            await API.delete(`/activities/${a._id}`);
            deleted++;
          } catch (errDel) {
            failed++;
            console.warn('Failed to delete server activity', a._id, errDel);
          }
        }
      } catch (errFetch) {
        // cannot fetch — mark as failed but do not block
        console.warn('Could not fetch server activities for cleanup', errFetch);
      }

      // refresh merged list (local empty + server may have reduced items)
      await refresh();

      show(`Cleared local history. Server removed: ${deleted}. Failed: ${failed}.`, 'success');
    } catch (err) {
      console.error('Clear history failed', err);
      show('Failed to clear history', 'error');
    } finally {
      setClearing(false);
      setShowClearModal(false);
    }
  };

  return (
    <div>
      <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Consistency</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Your activity history and progress</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            Total: <strong>{summary.total}</strong> · Goals: <strong>{summary.goals}</strong> · Routines: <strong>{summary.routines}</strong>
          </div>

          <button
            className="button"
            onClick={() => refresh()}
            disabled={loading}
            title="Refresh history"
          >
            Refresh
          </button>

          <button
            className="button btn-danger"
            onClick={() => setShowClearModal(true)}
            disabled={merged.length === 0 || clearing}
            title="Clear all activity history (local + server best-effort)"
          >
            {clearing ? 'Clearing…' : 'Clear History'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="card">
          <h3 style={{ margin: 0 }}>Activity timeline</h3>

          <div style={{ marginTop: 12 }}>
            {loading ? (
              <div style={{ color: 'var(--muted)' }}>Loading…</div>
            ) : merged.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>No activities yet. Complete routines or goals to create history.</div>
            ) : (
              grouped.map(group => (
                <div key={group.date} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{ fontWeight: 700 }}>{group.date}</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{group.items.length} activity{group.items.length !== 1 ? 'ies' : ''}</div>
                  </div>

                  <ul style={{ paddingLeft: 18 }}>
                    {group.items.map(item => (
                      <li key={(item._id || item.refId) + item.dateString + item.type} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                              {item.type === 'goal' ? 'Goal' : 'Routine'} · {new Date(item.completedAt).toLocaleTimeString()}
                              {item.refId ? ` · ref: ${item.refId}` : ''}
                            </div>
                          </div>

                          <div style={{ color: '#6b7280', fontSize: 13 }}>
                            {/* No delete button here — clear only via Clear History */}
                            {String(item._id).startsWith('a_') ? <span style={{ color: '#9ca3af' }}>Local</span> : <span>Server</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Clear History modal */}
      {showClearModal && (
        <div className="modal-overlay">
          <div className="modal-card" role="dialog" aria-modal="true">
            <h3>Clear all activity history?</h3>
            <p>This will remove all locally stored activities immediately and will attempt to remove server-side activity records (best-effort). This action cannot be undone.</p>

            <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="button btn-ghost" onClick={() => setShowClearModal(false)} disabled={clearing}>Cancel</button>
              <button className="button btn-danger" onClick={clearHistory} disabled={clearing}>
                {clearing ? 'Clearing…' : 'Clear History'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
