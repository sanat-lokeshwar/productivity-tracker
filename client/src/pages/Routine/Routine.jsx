// client/src/pages/Routine/Routine.jsx
import React, { useEffect, useState } from 'react';
import Timer from '../../components/Timer';
import { useToast } from '../../components/Toast';
import TimePicker from '../../components/TimePicker';

// localStorage keys
const ROUTINES_KEY = 'pt_routines_v1';
const ACTIVITIES_KEY = 'pt_activities_v1';

function loadRoutines() {
    try {
        const raw = localStorage.getItem(ROUTINES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}
function saveRoutines(list) {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(list));
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
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(list));
}

export default function Routine() {
    const { show } = useToast();

    const [routines, setRoutines] = useState(loadRoutines());
    const [title, setTitle] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');

    // duration fields: hours + minutes (both numbers)
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(10);

    // which routine id is currently running (shows timer)
    const [running, setRunning] = useState(null);

    // delete modal state
    const [deleteId, setDeleteId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    
    useEffect(() => {
        // persist when routines change
        saveRoutines(routines);
    }, [routines]);

    // helper: compute total minutes from hours+minutes
    const computeTotalMinutes = (h, m) => {
        const hh = Math.max(0, Number(h) || 0);
        const mm = Math.max(0, Number(m) || 0);
        return hh * 60 + mm;
    };

    // Add a new routine
    const addRoutine = () => {
        if (!title.trim()) {
            show('Please enter a title for the routine', 'warning');
            return;
        }
        const totalMins = computeTotalMinutes(hours, minutes);
        const r = {
            _id: 'r_' + Date.now(),
            title: title.trim(),
            scheduledTime: scheduledTime || '',
            durationMinutes: totalMins,
            createdAt: new Date().toISOString()
        };
        setRoutines(prev => [r, ...prev]);
        setTitle('');
        setScheduledTime('');
        setHours(0);
        setMinutes(10);
        show('Routine saved', 'success');
    };

    // Delete routine (called from modal)
    const deleteRoutine = async (id) => {
        try {
            setDeleting(true);
            setRoutines(prev => prev.filter(r => r._id !== id));
            // also remove its activities
            const activities = loadActivities().filter(a => a.refId !== id);
            saveActivities(activities);
            show('Routine deleted', 'success');
        } catch (err) {
            console.error('Delete routine failed', err);
            show('Failed to delete routine', 'error');
        } finally {
            setDeleting(false);
            setDeleteId(null);
            setShowDeleteModal(false);
            if (running === id) setRunning(null);
        }
    };

    // Called when timer finishes or user marks done
    const markDoneLocal = (r) => {
        // record activity entry
        const activities = loadActivities();
        const activity = {
            _id: 'a_' + Date.now(),
            type: 'routine',
            refId: r._id,
            title: r.title,
            completedAt: new Date().toISOString(),
            dateString: new Date().toISOString().split('T')[0]
        };
        activities.unshift(activity);
        saveActivities(activities);

        // stop timer UI
        setRunning(null);
        show(`Marked "${r.title}" done — recorded locally.`, 'success');
    };

    const startTimer = (id) => {
        const r = routines.find(x => x._id === id);
        if (!r) return;

        if (!r.durationMinutes || r.durationMinutes <= 0) {
            // No duration: auto-mark done with toast (no confirm popups)
            markDoneLocal(r);
            return;
        }
        setRunning(id);
    };

    // UI helpers: get activities count per routine
    const activities = loadActivities();
    const getCount = (id) => activities.filter(a => a.refId === id).length;

    return (
        <div>
            <div className="header-row">
                <h2>Routine</h2>
                <span style={{ color: '#6b7280' }}>Daily habits to follow</span>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
                <h4>Add / Edit Routine</h4>
                <label style={{ marginBottom: 4, color: '#0f1011ff' }}>What's on your mind:</label>
                <input
                    placeholder="Routine"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ marginBottom: 8 }}
                />

                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <label style={{ alignSelf: 'center', color: '#0f1011ff', minWidth: 80 }}>Start Time:</label>

                    <TimePicker
                        value={scheduledTime}
                        onChange={(v) => setScheduledTime(v)}
                        minuteStep={1}   /* or 5 for 5-min steps */
                    />

                    <label style={{ alignSelf: 'center', color: '#0d0d0dff' }}>Duration:</label>
                    {/* HOURS input */}
                    <input
                        type="number"
                        min={0}
                        placeholder="Hours"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        style={{ width: 150 }}
                    />

                    {/* MINUTES input */}
                    <input
                        type="number"
                        min={0}
                        max={59}
                        placeholder="Minutes"
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                        style={{ width: 120 }}
                    />
                </div>

                <div>
                    <button className="button" onClick={addRoutine}>Save Routine</button>
                </div>
            </div>

            <div className="card">
                <h3>Your routines</h3>

                {routines.length === 0 && <div style={{ color: '#6b7280' }}>No routines yet. Add one above.</div>}

                <ul style={{ paddingLeft: 18 }}>
                    {routines.map(r => (
                        <li key={r._id} style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                <div>
                                    <strong>{r.title}</strong>
                                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                                        {r.scheduledTime ? `At ${r.scheduledTime}` : 'No time set'}
                                        {r.durationMinutes ? ` · ${Math.floor(r.durationMinutes / 60)}h ${r.durationMinutes % 60}m` : ''}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9ca3af' }}>
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
                                            <button
                                                className="button small btn-danger"
                                                onClick={() => {
                                                    setDeleteId(r._id);
                                                    setShowDeleteModal(true);
                                                }}
                                            >
                                                Delete
                                            </button>

                                            {getCount(r._id) === 0 ? (
                                                <button
                                                    className="button small"
                                                    onClick={() => {
                                                        // quick mark done
                                                        markDoneLocal(r);
                                                    }}
                                                >
                                                    Mark Done
                                                </button>
                                            ) : (
                                                <span
                                                    style={{
                                                        padding: '6px 10px',
                                                        fontSize: 13,
                                                        color: '#e9f3f0ff',
                                                        background: 'green',
                                                        borderRadius: 6,
                                                        display: 'inline-block'
                                                    }}
                                                >
                                                    Done
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>

                <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
                    Note: routines are saved locally (browser). When we add backend activity endpoints later, we will sync these.
                </div>
            </div>

            {/* DELETE CONFIRM MODAL */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <h3>Delete Routine?</h3>
                        <p>This action will remove the routine and its local activities.</p>

                        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                            <button
                                className="button btn-danger"
                                onClick={() => deleteRoutine(deleteId)}
                                disabled={deleting}
                            >
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>

                            <button
                                className="button btn-ghost"
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setDeleteId(null);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
