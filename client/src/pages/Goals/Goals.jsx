// client/src/pages/Goals/Goals.jsx
import React, { useEffect, useState, useRef } from 'react';
import API from '../../api';
import { useToast } from '../../components/Toast';

// localStorage key for fallback activities
const ACTIVITIES_KEY = 'pt_activities_v1';

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

export default function Goals() {
  const { show } = useToast();

  const [goals, setGoals] = useState([]);           // all goals from server
  const [loading, setLoading] = useState(false);

  // modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  // delete modal
  const [deleteId, setDeleteId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const descRef = useRef(null);

  // search
  const [query, setQuery] = useState('');

  // UI small states
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGoals();
    // eslint-disable-next-line
  }, []);

  // Fetch goals from server
  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await API.get('/goals');
      setGoals(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load goals', err);
      show('Failed to load goals', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open modal for new goal
  const openNew = () => {
    setEditingGoal(null);
    setTitle('');
    setDescription('');
    setIsModalOpen(true);
    setTimeout(() => descRef.current && descRef.current.focus(), 120);
  };

  // Open modal to edit existing goal
  const openEdit = (g) => {
    setEditingGoal(g);
    setTitle(g.title || '');
    setDescription(g.description || '');
    setIsModalOpen(true);
    setTimeout(() => descRef.current && descRef.current.focus(), 120);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGoal(null);
    setTitle('');
    setDescription('');
  };

  const saveGoal = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      show('Please provide a title', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (editingGoal) {
        // update
        const res = await API.put(`/goals/${editingGoal._id}`, {
          title: trimmed,
          description: description.trim()
        });
        // update local state
        setGoals(prev => prev.map(x => x._id === editingGoal._id ? res.data : x));
        show('Goal updated', 'success');
      } else {
        // create
        const res = await API.post('/goals', {
          title: trimmed,
          description: description.trim()
        });
        setGoals(prev => [res.data, ...prev]);
        show('Goal added', 'success');
      }
      closeModal();
    } catch (err) {
      console.error('Save goal failed', err);
      show('Failed to save goal', 'error');
    } finally {
      setSaving(false);
    }
  };

  // show delete confirmation modal (no browser confirm)
  const requestDeleteGoal = (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  // replace confirmDeleteGoal in client/src/pages/Goals/Goals.jsx
  const confirmDeleteGoal = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);

      // 1) Delete the goal on server
      await API.delete(`/goals/${deleteId}`);

      // 2) Remove related local activities (immediate Dashboard fix)
      try {
        const local = loadActivitiesLocal(); // uses same helper above
        const filtered = local.filter(a => !(a.type === 'goal' && String(a.refId) === String(deleteId)));
        saveActivitiesLocal(filtered);
      } catch (errLocal) {
        console.warn('Failed to remove local activities for deleted goal', errLocal);
      }

      // 3) Best-effort: remove server-side activities referencing this goal
      //    We don't fail the deletion flow if this part errors.
      (async () => {
        try {
          const res = await API.get('/activities');
          const activities = Array.isArray(res.data) ? res.data : [];
          const matches = activities.filter(a => a.type === 'goal' && String(a.refId) === String(deleteId));
          for (const act of matches) {
            try {
              await API.delete(`/activities/${act._id}`);
            } catch (delErr) {
              console.warn('Failed to delete server activity', act._id, delErr);
              // continue deleting other matches
            }
          }
        } catch (errFetch) {
          console.warn('Could not fetch activities to clean up server-side', errFetch);
        }
      })();

      // 4) Update local goals state and UI
      setGoals(prev => prev.filter(g => g._id !== deleteId));
      show('Goal deleted and related activities removed', 'success');
    } catch (err) {
      console.error('Delete failed', err);
      show('Failed to delete', 'error');
    } finally {
      setDeleting(false);
      setDeleteId(null);
      setShowDeleteModal(false);
    }
  };


  // Complete goal: call server, create local fallback activity, attempt to POST /activities
  const completeGoal = async (id) => {
    try {
      await API.post(`/goals/${id}/complete`);
      // produce local activity fallback
      const now = new Date();
      const completedAt = now.toISOString();
      const dateString = completedAt.split('T')[0];
      const goalTitle = (goals.find(g => g._id === id)?.title) || 'Goal';

      const localActivity = {
        _id: 'a_' + Date.now(),
        type: 'goal',
        refId: id,
        title: goalTitle,
        completedAt,
        dateString
      };

      const local = loadActivitiesLocal();
      local.unshift(localActivity);
      saveActivitiesLocal(local);

      // try to POST activity to server (idempotent)
      try {
        await API.post('/activities', {
          type: 'goal',
          refId: id,
          title: goalTitle,
          completedAt,
          dateString
        });
      } catch (err) {
        console.warn('Failed to sync activity to server', err);
      }

      // refresh goals list from server so completed flag updates
      await fetchGoals();
      show('Goal marked as completed', 'success');
    } catch (err) {
      console.error('Complete failed', err);
      show('Failed to mark goal complete', 'error');
    }
  };
  
  // Undo complete: mark incomplete AND remove the activity record
  // eslint-disable-next-line
  const undoGoal = async (g) => {
    try {
      // 1. Mark goal as active again
      await API.put(`/goals/${g._id}`, { completed: false });

      // 2. Remove the local activity fallback for today
      const todayString = new Date().toISOString().split('T')[0];
      try {
        const local = loadActivitiesLocal();
        const filtered = local.filter(a => !(a.type === 'goal' && String(a.refId) === String(g._id) && a.dateString === todayString));
        saveActivitiesLocal(filtered);
      } catch (errLocal) {
        console.warn('Failed to remove local activity on undo', errLocal);
      }

      // 3. Best-effort: remove the activity from the server
      try {
        const res = await API.get('/activities');
        const activities = Array.isArray(res.data) ? res.data : [];
        const matches = activities.filter(a => a.type === 'goal' && String(a.refId) === String(g._id) && a.dateString === todayString);
        for (const act of matches) {
          try {
            await API.delete(`/activities/${act._id}`);
          } catch (delErr) {
            console.warn('Failed to delete server activity on undo', delErr);
          }
        }
      } catch (errServer) {
        console.warn('Could not fetch activities to clean up server-side', errServer);
      }

      // 4. Refresh the goals list
      await fetchGoals();
      show('Moved back to Active', 'success');
    } catch (err) {
      console.error('Undo failed', err);
      show('Failed to move back', 'error');
    }
  };

  // Search/filter helpers
  const filteredActive = goals
    .filter(g => !g.completed)
    .filter(g => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (g.title || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q);
    });

  const filteredCompleted = goals
    .filter(g => g.completed)
    .filter(g => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (g.title || '').toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q);
    });

  // autosize description textarea
  const handleDescChange = (e) => {
    setDescription(e.target.value);
    const el = descRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(300, el.scrollHeight)}px`;
  };

  return (
    <div style={{ paddingBottom: 80 }}>
      <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Goals</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Add and manage your goals</div>
        </div>

        {/* search */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="search-input" style={{ display: 'flex', alignItems: 'center' }}>
            <svg style={{ width: 18, height: 18, marginLeft: 10, marginRight: 8 }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <input
              placeholder="Search goals or descriptions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                padding: '10px 8px',
                minWidth: 260,
                background: 'transparent'
              }}
            />
            {query && (
              <button
                className="button small"
                onClick={() => setQuery('')}
                style={{ marginRight: 8, marginLeft: 6, background: 'transparent', color: 'var(--muted)', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active goals */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Active Goals</h3>
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>{filteredActive.length} shown</div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <div style={{ color: 'var(--muted)' }}>Loading…</div>
          ) : filteredActive.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>No active goals. Add one using the button below.</div>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {filteredActive.map(g => (
                <li key={g._id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{g.title}</div>
                      </div>
                      {g.description && <div style={{ marginTop: 6, color: 'var(--muted)' }}>{g.description}</div>}
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                        Created: {new Date(g.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="button small" onClick={() => openEdit(g)}>Edit</button>
                      <button className="button small" onClick={() => completeGoal(g._id)}>Complete</button>
                      <button className="button small btn-danger" onClick={() => requestDeleteGoal(g._id)}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Completed goals */}
      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ margin: 0 }}>Completed</h3>
        <div style={{ marginTop: 10 }}>
          {filteredCompleted.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>No completed goals yet.</div>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {filteredCompleted.map(g => (
                <li key={g._id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{g.title}</div>
                      {g.description && <div style={{ marginTop: 6, color: 'var(--muted)' }}>{g.description}</div>}
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                        Completed: {g.completedAt ? new Date(g.completedAt).toLocaleString() : '—'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button className="button small" onClick={() => openEdit(g)}>Edit</button>
                     <button className="button small green btn-ghost" onClick={() => undoGoal(g)}>
  Undo
</button>

                      {/* Delete on completed */}
                      <button className="button small btn-danger" onClick={() => requestDeleteGoal(g._id)}>Delete</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Floating Add button (with text) */}
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
          Add Goal
        </button>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card" role="dialog" aria-modal="true">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{editingGoal ? 'Edit Goal' : 'Add Goal'}</h3>
              <button className="button small btn-ghost" onClick={closeModal}>Close</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--muted)' }}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short goal title"
                style={{ width: '100%', padding: '10px', marginTop: 6, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}
              />

              <label style={{ display: 'block', marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>Description</label>
              <textarea
                ref={descRef}
                value={description}
                onChange={handleDescChange}
                placeholder="More details (optional). This textarea expands as you type."
                style={{
                  width: '100%',
                  padding: 12,
                  marginTop: 6,
                  borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.06)',
                  minHeight: 80,
                  resize: 'none',
                  overflow: 'auto'
                }}
              />

              <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="button btn-ghost" onClick={closeModal}>Cancel</button>
                <button className="button" onClick={saveGoal} disabled={saving}>
                  {saving ? 'Saving…' : (editingGoal ? 'Save Changes' : 'Add Goal')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
  {/* ... inside Goals.jsx return (...)*/}

      <div
        className="floating-fab" // <--- ADD THIS CLASS
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20, // Desktop position
          zIndex: 100
          // ...
        }}
      >
        {/* Your button code */}
      </div>
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-card" role="dialog" aria-modal="true">
            <h3>Delete goal?</h3>
            <p>This will permanently remove the goal and its related local activity entries. This action cannot be undone.</p>

            <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="button btn-ghost"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteId(null);
                }}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                className="button btn-danger"
                onClick={confirmDeleteGoal}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
