// client/src/pages/Routine/Routine.jsx
import React, { useEffect, useState, useRef } from 'react';
import Timer from '../../components/Timer';
import { useToast } from '../../components/Toast';
import API from '../../api';

// localStorage keys
const ROUTINES_KEY = 'pt_routines_v1';
const ACTIVITIES_KEY = 'pt_activities_v1';

// --- localStorage helpers ---
function loadRoutines() {
  try {
    const raw = localStorage.getItem(ROUTINES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveRoutines(list) {
  try {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save routines locally', err);
  }
}
function loadActivities() {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveActivities(list) {
  try {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save activities locally', err);
  }
}

// small util: YYYY-MM-DD
const isoDate = (d = new Date()) => d.toISOString().split('T')[0];

export default function Routine() {
  const { show } = useToast();

  // data
  const [routines, setRoutines] = useState(loadRoutines());
  const [activities, setActivities] = useState(loadActivities());

  // UI states
  const [running, setRunning] = useState(null);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // modal form fields
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('07:00'); // 24hr string storage for easier parsing
  const [amPm, setAmPm] = useState('AM'); // for display
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(10);
  const descRef = useRef(null);

  // delete modal
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // persist routines when changed
    saveRoutines(routines);
    // refresh activities from localStorage when routines change
    setActivities(loadActivities());
  }, [routines]);

  // Keep activities state up to date with localStorage if other pages modify it
  useEffect(() => {
    const onStorage = () => {
      setActivities(loadActivities());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // --- Helpers ---

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setStartTime('07:00');
    setAmPm('AM');
    setHours(0);
    setMinutes(10);
    setIsModalOpen(true);
    setTimeout(() => descRef.current && descRef.current.focus(), 120);
  };

  const openEdit = (r) => {
    setEditing(r);
    setTitle(r.title || '');
    // if stored startTime exists (we store 24hr 'HH:MM') derive AM/PM
    if (r.startTime) {
      setStartTime(r.startTime);
      const [hhStr] = r.startTime.split(':');
      const hh = Number(hhStr);
      if (hh === 0) {
        setAmPm('AM'); // 00:xx -> 12:xx AM shown later
      } else if (hh >= 12) {
        setAmPm('PM');
      } else setAmPm('AM');
    } else {
      setStartTime('07:00');
      setAmPm('AM');
    }
    // duration
    if (r.durationMinutes != null) {
      const dd = Number(r.durationMinutes);
      setHours(Math.floor(dd / 60));
      setMinutes(dd % 60);
    } else {
      setHours(0);
      setMinutes(10);
    }
    setIsModalOpen(true);
    setTimeout(() => descRef.current && descRef.current.focus(), 120);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  // normalize duration: if minutes >= 60 convert to hours
  const normalizeDuration = (h, m) => {
    let hh = Math.max(0, Number(h) || 0);
    let mm = Math.max(0, Number(m) || 0);
    hh += Math.floor(mm / 60);
    mm = mm % 60;
    return { hh, mm, total: hh * 60 + mm };
  };

  // For display: convert stored 'HH:MM' (24h) to 12-hour friendly string
  const displayTime12 = (time24) => {
    if (!time24) return '';
    const [hhStr, mm] = time24.split(':');
    let hh = Number(hhStr);
    const period = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    return `${hh}:${mm} ${period}`;
  };

  // Save routine (new or edit)
  const saveRoutine = () => {
    const trimmed = (title || '').trim();
    if (!trimmed) {
      show('Please enter routine title', 'warning');
      return;
    }

    const norm = normalizeDuration(hours, minutes);
    // store startTime as 24-hour HH:MM for unambiguous persistence
    // convert amPm + startTime to 24hr string:
    let [sHH, sMM] = startTime.split(':').map(Number);
    if (amPm === 'PM' && sHH < 12) sHH += 12;
    if (amPm === 'AM' && sHH === 12) sHH = 0;
    const storedStart = `${String(sHH).padStart(2, '0')}:${String(sMM).padStart(2, '0')}`;

    if (editing) {
      setRoutines(prev => prev.map(r => r._id === editing._id ? {
        ...r,
        title: trimmed,
        startTime: storedStart,
        durationMinutes: norm.total,
        updatedAt: new Date().toISOString()
      } : r));
      show('Routine updated', 'success');
    } else {
      const r = {
        _id: 'r_' + Date.now(),
        title: trimmed,
        startTime: storedStart,
        durationMinutes: norm.total,
        createdAt: new Date().toISOString()
      };
      setRoutines(prev => [r, ...prev]);
      show('Routine added', 'success');
    }

    closeModal();
  };

  // Delete routine: show modal then perform removal
  const requestDeleteRoutine = (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteRoutine = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);

      // remove routine
      setRoutines(prev => prev.filter(r => r._id !== deleteId));

      // remove related local activities (routine type)
      try {
        const local = loadActivities();
        const filtered = local.filter(a => !(a.type === 'routine' && String(a.refId) === String(deleteId)));
        saveActivities(filtered);
        setActivities(filtered);
      } catch (errLocal) {
        console.warn('Failed to remove local activities for deleted routine', errLocal);
      }

      // best-effort: remove server-side activities referencing this routine
      (async () => {
        try {
          const res = await API.get('/activities');
          const all = Array.isArray(res.data) ? res.data : [];
          const matches = all.filter(a => a.type === 'routine' && String(a.refId) === String(deleteId));
          for (const act of matches) {
            try {
              await API.delete(`/activities/${act._id}`);
            } catch (e) {
              console.warn('Failed deleting server activity', act._id, e);
            }
          }
        } catch (errFetch) {
          console.warn('Could not fetch activities to clean up server-side', errFetch);
        }
      })();

      show('Routine removed and related activities cleaned locally', 'success');
    } catch (err) {
      console.error('Delete routine error', err);
      show('Failed to delete routine', 'error');
    } finally {
      setDeleting(false);
      setDeleteId(null);
      setShowDeleteModal(false);
    }
  };

  // --- Activity helpers for "Done" / "Undo" ---

  // mark done for routine r: local fallback + POST to /activities
  const markDoneLocal = async (r) => {
    const now = new Date();
    const completedAt = now.toISOString();
    const dateString = isoDate(now);

    const refId = r._id || ('r_' + r.title);

    const activity = {
      _id: 'a_' + Date.now(),
      type: 'routine',
      refId,
      title: r.title,
      completedAt,
      dateString
    };

    // local save
    try {
      const local = loadActivities();
      local.unshift(activity);
      saveActivities(local);
      setActivities(local);
    } catch (err) {
      console.warn('Failed saving local activity', err);
    }

    // stop timer
    setRunning(null);
    show(`Marked "${r.title}" done — recorded locally.`, 'success');

    // post to server (idempotent)
    try {
      await API.post('/activities', {
        type: 'routine',
        refId,
        title: r.title,
        completedAt,
        dateString
      });
    } catch (err) {
      console.warn('Failed to post routine activity to server (kept locally)', err);
    }
  };

  // Undo today's completion for a routine (remove today's activity)
  const undoDone = async (r) => {
    const date = isoDate();
    // remove local items for that routine with today's date
    try {
      const local = loadActivities();
      const filtered = local.filter(a => !(a.type === 'routine' && String(a.refId) === String(r._id) && a.dateString === date));
      saveActivities(filtered);
      setActivities(filtered);
    } catch (err) {
      console.warn('Failed to remove local activity', err);
    }

    // best-effort: delete matching server activities for that routine+date
    try {
      const res = await API.get('/activities');
      const all = Array.isArray(res.data) ? res.data : [];
      const matches = all.filter(a => a.type === 'routine' && String(a.refId) === String(r._id) && a.dateString === date);
      for (const act of matches) {
        try {
          await API.delete(`/activities/${act._id}`);
        } catch (errDel) {
          console.warn('Failed to delete server activity', act._id, errDel);
        }
      }
      show('Undone for today', 'success');
    } catch (err) {
      console.warn('Failed to undo server-side activities', err);
      show('Undone locally; server cleanup may be pending', 'info');
    }
  };

  // check if a routine is done today: search activities state
  const isDoneToday = (r) => {
    const today = isoDate();
    return activities.some(a => a.type === 'routine' && String(a.refId) === String(r._id) && a.dateString === today);
  };

  const getCount = (id) => activities.filter(a => a.refId === id).length;

  // start a timer for a routine (or auto-mark done if no duration)
  const startTimer = (id) => {
    const r = routines.find(x => x._id === id);
    if (!r) return;
    if (!r.durationMinutes || r.durationMinutes <= 0) {
      // immediate mark done
      markDoneLocal(r);
      return;
    }
    setRunning(id);
  };

  // search filter
  const filtered = routines.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.title || '').toLowerCase().includes(q);
  });

  // UI helpers for showing duration as human-friendly (e.g., 90 -> 1h 30m)
  const showDuration = (mins) => {
    const m = Number(mins) || 0;
    if (m === 0) return '—';
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0) return `${h}h ${mm}m`;
    return `${mm}m`;
  };

  return (
    <div style={{ paddingBottom: 96 }}>
      <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Routine</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Daily habits to follow</div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="search-input" style={{ display: 'flex', alignItems: 'center' }}>
            <svg style={{ width: 18, height: 18, marginLeft: 10, marginRight: 8 }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <input
              placeholder="Search routines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', padding: '10px 8px', minWidth: 200, background: 'transparent' }}
            />
            {search && (
              <button className="button small" onClick={() => setSearch('')} style={{ marginRight: 8, marginLeft: 6, background: 'transparent', color: 'var(--muted)', border: '1px solid rgba(0,0,0,0.06)' }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ margin: 0 }}>Your routines</h3>
        <div style={{ marginTop: 10, color: 'var(--muted)' }}>
          {filtered.length} routine{filtered.length !== 1 ? 's' : ''} shown
        </div>

        <div style={{ marginTop: 12 }}>
          {filtered.length === 0 && <div style={{ color: 'var(--muted)' }}>No routines yet. Add one using the + button.</div>}

          <ul style={{ paddingLeft: 18, marginTop: 8 }}>
            {filtered.map(r => (
              <li key={r._id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {r.startTime ? displayTime12(r.startTime) : 'No start time'} · {showDuration(r.durationMinutes)}
                      </div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                      Done {getCount(r._id)} time(s)
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {running === r._id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <Timer
                          minutes={r.durationMinutes || 1}
                          onFinish={() => markDoneLocal(r)}
                          onCancel={() => setRunning(null)}
                        />
                      </div>
                    ) : (
                      <>
                        <button className="button small" onClick={() => startTimer(r._id)}>Start</button>

                        {isDoneToday(r) ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <span style={{
                              padding: '8px 10px',
                              borderRadius: 999,
                              background: 'green',
                              color: 'white',
                              fontSize: 13,
                              fontWeight: 600
                            }}>
                              Done ✓
                            </span>

                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="button small btn-ghost" onClick={() => undoDone(r)}>Undo</button>
                            </div>
                          </div>
                        ) : (
                          <button className="button small" onClick={() => markDoneLocal(r)}>Mark Done</button>
                        )}

                        <button className="button small btn-ghost" onClick={() => openEdit(r)}>Edit</button>
                        <button className="button small btn-danger" onClick={() => requestDeleteRoutine(r._id)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Floating Add button */}
      <div style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 1200,
        display: 'flex',
        gap: 10,
        alignItems: 'center'
      }}>
        <button
          className="button"
          onClick={openNew}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999 }}
        >
          <span style={{
            display: 'inline-flex',
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            boxShadow: 'var(--card-shadow)'
          }}>+</span>
          Add Routine
        </button>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" role="dialog" aria-modal="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{editing ? 'Edit Routine' : 'Add Routine'}</h3>
              <button className="button small btn-ghost" onClick={closeModal}>Close</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--muted)' }}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Routine name" style={{ width: '100%', padding: 10, marginTop: 6, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }} />

              <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, color: 'var(--muted)' }}>Start time (12-hour)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    {/* time input for HH:MM (we store in startTime as 24-hr) */}
                    <input type="time" value={startTime} onChange={(e) => {
                      const val = e.target.value;
                      setStartTime(val);
                      // set AM/PM for friendly display
                      const hh = Number(val.split(':')[0]);
                      setAmPm(hh >= 12 ? 'PM' : 'AM');
                    }} style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }} />

                    <select value={amPm} onChange={(e) => setAmPm(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}>
                      <option>AM</option>
                      <option>PM</option>
                    </select>
                  </div>
                </div>

                <div style={{ width: 220 }}>
                  <label style={{ fontSize: 13, color: 'var(--muted)' }}>Duration</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours" style={{ width: 100, padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }} />
                    <input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Minutes" style={{ width: 100, padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                    Preview: {(() => {
                      const n = normalizeDuration(hours, minutes);
                      return n.total === 0 ? 'No duration' : `${n.hh > 0 ? n.hh + 'h ' : ''}${n.mm}m (${n.total} minutes)`;
                    })()}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="button btn-ghost" onClick={closeModal}>Cancel</button>
                <button className="button" onClick={saveRoutine}>{editing ? 'Save' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-card" role="dialog" aria-modal="true">
            <h3>Delete routine?</h3>
            <p>This will remove the routine and its local activity records. Server-side cleanup will be attempted but may be pending.</p>

            <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="button btn-ghost" onClick={() => { setShowDeleteModal(false); setDeleteId(null); }} disabled={deleting}>Cancel</button>
              <button className="button btn-danger" onClick={confirmDeleteRoutine} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
