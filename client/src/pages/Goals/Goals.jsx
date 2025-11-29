// client/src/pages/Goals/Goals.jsx
import React, { useEffect, useState } from 'react';
import API from '../../api';
import { useToast } from '../../components/Toast';

export default function Goals() {
    const { show } = useToast();

    const [goals, setGoals] = useState([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [deleteId, setDeleteId] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // editing state
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    // modal
    const [showAddModal, setShowAddModal] = useState(false);

    const fetchGoals = async () => {
        try {
            setLoading(true);
            const res = await API.get('/goals');
            setGoals(res.data || []);
        } catch (err) {
            console.error('Failed to load goals', err);
            show('Failed to load goals. Backend might be offline.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGoals();
        // eslint-disable-next-line
    }, []);

    const addGoal = async () => {
        if (!title.trim()) {
            show('Title is required', 'warning');
            return;
        }

        try {
            const res = await API.post('/goals', {
                title: title.trim(),
                description: description.trim()
            });

            setTitle('');
            setDescription('');
            setGoals(prev => [res.data, ...prev]);
            show('Goal added successfully!', 'success');

        } catch (err) {
            console.error('Add failed', err);
            show('Failed to add goal', 'error');
        }
    };

    const completeGoal = async (id) => {
        try {
            await API.post(`/goals/${id}/complete`);
            // create a local activity so Dashboard sees it immediately
            const activities = JSON.parse(localStorage.getItem('pt_activities_v1') || '[]');
            activities.unshift({
                _id: 'a_' + Date.now(),
                type: 'goal',
                refId: id,
                title: (goals.find(g => g._id === id)?.title) || 'Goal',
                completedAt: new Date().toISOString(),
                dateString: new Date().toISOString().split('T')[0]
            });
            localStorage.setItem('pt_activities_v1', JSON.stringify(activities));

            fetchGoals();
            show('Goal marked as completed!', 'success');
        } catch (err) {
            console.error('Complete failed', err);
            show('Failed to mark complete', 'error');
        }
    };

    const deleteGoal = async (id) => {
        try {
            await API.delete(`/goals/${id}`);
            setGoals(prev => prev.filter(g => g._id !== id));
            show('Goal deleted', 'success');
        } catch (err) {
            console.error('Delete failed', err);
            show('Failed to delete goal', 'error');
        }
    };

    // start editing
    const startEdit = (g) => {
        setEditingId(g._id);
        setEditTitle(g.title || '');
        setEditDescription(g.description || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditTitle('');
        setEditDescription('');
    };

    const saveEdit = async (id) => {
        if (!editTitle.trim()) {
            show('Title is required', 'warning');
            return;
        }

        try {
            setSavingEdit(true);

            const res = await API.put(`/goals/${id}`, {
                title: editTitle.trim(),
                description: editDescription.trim()
            });

            setGoals(prev => prev.map(g => (g._id === id ? res.data : g)));
            cancelEdit();
            show('Changes saved!', 'success');

        } catch (err) {
            console.error('Edit failed', err);
            show('Failed to save changes', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    const visibleGoals = goals.filter(g =>
        g.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="header-row">
                <h2>Goals</h2>
                <span style={{ color: '#6b7280' }}>Manage and track all your goals</span>
            </div>

            {/* Search */}
            <div className="card" style={{ marginBottom: 12 }}>
                <input
                    type="text"
                    placeholder="Search goals by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ marginBottom: 6 }}
                />
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Type to filter your goals
                </div>
            </div>

            {/* Goals List */}
            <div className="card">
                <h3>Your Goals</h3>

                {loading && <div style={{ color: '#6b7280' }}>Loading...</div>}
                {!loading && visibleGoals.length === 0 && (
                    <div style={{ color: '#6b7280' }}>No goals found.</div>
                )}

                <ul style={{ paddingLeft: 18 }}>
                    {visibleGoals.map(g => (
                        <li key={g._id} style={{ marginBottom: 12 }}>

                            {/* EDIT MODE */}
                            {editingId === g._id ? (
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <div style={{ flex: 1 }}>
                                        <input
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            placeholder="Edit title"
                                        />
                                        <textarea
                                            rows={2}
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            placeholder="Edit description"
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <button
                                            className="button small"
                                            onClick={() => saveEdit(g._id)}
                                            disabled={savingEdit}
                                        >
                                            {savingEdit ? 'Saving…' : 'Save'}
                                        </button>
                                        <button
                                            className="button small btn-ghost"
                                            onClick={cancelEdit}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>

                            ) : (
                                // VIEW MODE
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <strong style={{ textDecoration: g.completed ? 'line-through' : 'none' }}>
                                            {g.title}
                                        </strong>

                                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                                            {g.description}
                                        </div>

                                        <div style={{ fontSize: 11, color: '#9ca3af' }}>
                                            {g.completed
                                                ? `Completed at ${new Date(g.completedAt).toLocaleString()}`
                                                : `Created: ${new Date(g.createdAt).toLocaleString()}`}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {!g.completed && (
                                            <button className="button small" onClick={() => completeGoal(g._id)}>
                                                Complete
                                            </button>
                                        )}

                                        <button className="button small" onClick={() => startEdit(g)}>
                                            Edit
                                        </button>

                                        <button
                                            className="button small btn-danger"
                                            onClick={() => {
                                                setDeleteId(g._id);
                                                setShowDeleteModal(true);
                                            }}
                                        >
                                            Delete
                                        </button>

                                    </div>
                                </div>
                            )}

                        </li>
                    ))}
                </ul>
            </div>

            {/* Floating ADD Button */}
            <button
                className="floating-add"
                onClick={() => setShowAddModal(true)}
            >
                +
            </button>

            {/* ADD GOAL MODAL */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-card">

                        <h3>Add New Goal</h3>

                        <input
                            placeholder="Goal title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />

                        <textarea
                            placeholder="Describe your goal (optional)"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />

                        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                            <button
                                className="button"
                                onClick={() => {
                                    addGoal();
                                    setShowAddModal(false);
                                }}
                            >
                                Add Goal
                            </button>

                            <button
                                className="button btn-ghost"
                                onClick={() => setShowAddModal(false)}
                            >
                                Cancel
                            </button>
                        </div>

                    </div>
                </div>
            )}
            {/* DELETE CONFIRM MODAL */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal-card">

                        <h3>Delete Goal?</h3>
                        <p>This action cannot be undone.</p>

                        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                            <button
                                className="button btn-danger"
                                onClick={() => {
                                    deleteGoal(deleteId);
                                    setShowDeleteModal(false);
                                }}
                            >
                                Delete
                            </button>

                            <button
                                className="button btn-ghost"
                                onClick={() => setShowDeleteModal(false)}
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
