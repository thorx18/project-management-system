import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectsAPI, tasksAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import ChatPanel from '../components/ChatPanel';
import VideoCall from '../components/VideoCall';
import IncomingCallOverlay from '../components/IncomingCallOverlay';
import { Plus, X, Circle, Clock, Eye, CheckCircle2, MessageSquare, Calendar, UserPlus, Trash2, Video, Send, MoreHorizontal, Filter } from 'lucide-react';
import io from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);
const priorityColors = { urgent: '#f87171', high: '#fb923c', medium: '#facc15', low: '#4ade80' };
const statusConfig = {
    todo: { label: 'To Do', icon: Circle, color: 'var(--text-muted)', gradient: 'linear-gradient(135deg, #64748b, #475569)' },
    in_progress: { label: 'In Progress', icon: Clock, color: 'var(--accent-blue)', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
    review: { label: 'In Review', icon: Eye, color: '#a855f7', gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)' },
    done: { label: 'Done', icon: CheckCircle2, color: 'var(--accent-green)', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
};

export default function ProjectView() {
    const { id } = useParams();
    const { user } = useAuth();
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [users, setUsers] = useState([]);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showVideo, setShowVideo] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [activeCall, setActiveCall] = useState(null); // Agora call data when callee accepts
    const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'todo', priority: 'medium', assigned_to: '', due_date: '' });
    const [memberEmail, setMemberEmail] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
        socket.emit('join_project', {
            projectId: id,
            userId: user?.id,
            userName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
        });
        socket.on('task_created', t => setTasks(prev => [...prev, t]));
        socket.on('task_updated', t => setTasks(prev => prev.map(x => x.id === t.id ? t : x)));
        socket.on('task_deleted', tid => setTasks(prev => prev.filter(x => x.id !== tid)));
        socket.on('online_users', users => setOnlineUsers(users));
        return () => {
            socket.off('task_created');
            socket.off('task_updated');
            socket.off('task_deleted');
            socket.off('online_users');
        };
    }, [id]);

    const load = async () => {
        try {
            const [p, t, u] = await Promise.all([projectsAPI.getOne(id), tasksAPI.getAll(id), authAPI.getUsers()]);
            setProject(p.data); setTasks(t.data); setMembers(p.data.members || []); setUsers(u.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...taskForm, assigned_to: taskForm.assigned_to || null };
            const r = await tasksAPI.create(id, payload);
            socket.emit('new_task', { projectId: id, task: r.data });
            setTasks(prev => [...prev, r.data]);
            setShowTaskModal(false);
            setTaskForm({ title: '', description: '', status: 'todo', priority: 'medium', assigned_to: '', due_date: '' });
        } catch (e) { console.error(e); }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            const r = await tasksAPI.update(taskId, { status: newStatus });
            socket.emit('update_task', { projectId: id, task: r.data });
            setTasks(prev => prev.map(t => t.id === taskId ? r.data : t));
        } catch (e) { console.error(e); }
    };

    const handleDeleteTask = async (taskId) => {
        try {
            await tasksAPI.delete(taskId);
            socket.emit('delete_task', { projectId: id, taskId });
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (e) { console.error(e); }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        try {
            await projectsAPI.addMember(id, { email: memberEmail });
            setMemberEmail('');
            setShowMemberModal(false);
            load();
        } catch (e) { alert(e.response?.data?.message || 'Error'); }
    };

    // ─── Call handling ───
    const handleAcceptIncomingCall = useCallback((callData) => {
        console.log('✅ Accepting call, opening VideoCall panel:', callData);
        setActiveCall(callData);
        setShowVideo(true);  // Auto-open the video panel
    }, []);

    const handleRejectIncomingCall = useCallback(() => {
        console.log('❌ Rejected incoming call');
    }, []);

    const handleCallStateChange = useCallback((isActive) => {
        if (!isActive) {
            setActiveCall(null);
        }
    }, []);

    const getInitials = (f, l) => `${(f || '')[0] || ''}${(l || '')[0] || ''}`.toUpperCase() || '?';

    if (loading) return <Layout><div className="loading-screen"><div className="spinner spinner-lg" /><p>Loading project...</p></div></Layout>;
    if (!project) return <Layout><div className="empty-state"><h3>Project not found</h3></div></Layout>;

    const grouped = { todo: [], in_progress: [], review: [], done: [] };
    tasks.forEach(t => { if (grouped[t.status]) grouped[t.status].push(t); });

    const totalTasks = tasks.length;
    const doneTasks = grouped.done.length;
    const progress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const breadcrumbs = (<>
        <Link to="/projects">Projects</Link><span>/</span><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{project.name}</span>
    </>);

    return (
        <Layout breadcrumbs={breadcrumbs}>
            {/* ═══ ALWAYS MOUNTED: Incoming Call Overlay ═══ */}
            {/* This is the KEY fix — it listens for incoming calls globally */}
            <IncomingCallOverlay
                socket={socket}
                onAcceptCall={handleAcceptIncomingCall}
                onRejectCall={handleRejectIncomingCall}
            />

            {/* Project Header */}
            <div className="project-view-header">
                <div className="project-view-info">
                    <div className="project-view-title-row">
                        <div className="project-view-color" style={{ background: project.color }} />
                        <h2 className="project-view-name">{project.name}</h2>
                        <span className={`badge badge-${project.status === 'active' ? 'in_progress' : 'done'}`}>{project.status}</span>
                    </div>
                    <p className="project-view-desc">{project.description || 'No description'}</p>
                    {/* Progress bar */}
                    <div className="project-progress-section">
                        <div className="project-progress-info">
                            <span>Progress</span>
                            <span className="project-progress-pct">{progress}%</span>
                        </div>
                        <div className="progress-bar" style={{ height: 6 }}>
                            <div className="progress-fill" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${project.color}, ${project.color}aa)` }} />
                        </div>
                    </div>
                </div>
                <div className="project-view-actions">
                    {/* Online indicator */}
                    <div className="online-indicator">
                        <div className="online-dot" />
                        <span>{onlineUsers.length} online</span>
                    </div>
                    {/* Members avatars */}
                    <div className="avatar-stack">
                        {members.slice(0, 4).map((m, i) => (
                            <div key={m.id} className="avatar" title={`${m.first_name} ${m.last_name}`}
                                style={{ background: ['#7c3aed', '#ec4899', '#14b8a6', '#f97316'][i % 4], zIndex: 10 - i }}>
                                {getInitials(m.first_name, m.last_name)}
                            </div>
                        ))}
                        {members.length > 4 && <div className="avatar" style={{ background: 'var(--glass-strong)', fontSize: 11 }}>+{members.length - 4}</div>}
                    </div>
                    <button className="btn btn-glass btn-sm" onClick={() => setShowMemberModal(true)}><UserPlus size={16} /> Add</button>
                    <button className="btn btn-glass btn-sm" onClick={() => setShowChat(!showChat)}><MessageSquare size={16} /> Chat</button>
                    <button className="btn btn-glass btn-sm" onClick={() => setShowVideo(!showVideo)}><Video size={16} /> Call</button>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowTaskModal(true)}><Plus size={16} /> Add Task</button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="kanban-stats">
                {Object.entries(grouped).map(([status, items]) => {
                    const cfg = statusConfig[status];
                    const Icon = cfg.icon;
                    return (
                        <div key={status} className="kanban-stat-item" style={{ '--stat-line': cfg.color }}>
                            <Icon size={15} style={{ color: cfg.color }} />
                            <span>{cfg.label}</span>
                            <strong>{items.length}</strong>
                        </div>
                    );
                })}
            </div>

            {/* Main Content Area */}
            <div className="project-content-wrapper">
                {/* Kanban Board */}
                <div className={`kanban ${showChat || showVideo ? 'kanban-with-panel' : ''}`}>
                    {Object.entries(grouped).map(([status, items]) => {
                        const cfg = statusConfig[status];
                        const Icon = cfg.icon;
                        return (
                            <div key={status} className="kanban-column">
                                <div className="kanban-column-header">
                                    <div className="kanban-column-title">
                                        <div className="kanban-column-dot" style={{ background: cfg.color }} />
                                        {cfg.label}
                                    </div>
                                    <span className="kanban-column-count">{items.length}</span>
                                </div>
                                <div className="kanban-cards">
                                    {items.map((task, i) => (
                                        <div key={task.id} className="task-card" style={{ animationDelay: `${i * 0.04}s` }}>
                                            <div className="task-card-top">
                                                <h4 className="task-card-title">{task.title}</h4>
                                                <button className="btn-ghost" style={{ padding: 2, marginLeft: 4 }} onClick={() => handleDeleteTask(task.id)}>
                                                    <Trash2 size={13} style={{ color: 'var(--text-muted)' }} />
                                                </button>
                                            </div>
                                            {task.description && <p className="task-card-desc">{task.description}</p>}
                                            <div className="task-card-footer">
                                                <div className="task-card-meta">
                                                    <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                                                    {task.comment_count > 0 && <span className="task-card-comments"><MessageSquare size={12} />{task.comment_count}</span>}
                                                </div>
                                                <select className="task-status-select" value={task.status} onChange={e => handleStatusChange(task.id, e.target.value)}>
                                                    <option value="todo">To Do</option>
                                                    <option value="in_progress">In Progress</option>
                                                    <option value="review">Review</option>
                                                    <option value="done">Done</option>
                                                </select>
                                            </div>
                                            {task.assigned_first_name && (
                                                <div className="task-assignee">
                                                    <div className="avatar avatar-sm" style={{ background: '#3b82f6' }}>{getInitials(task.assigned_first_name, task.assigned_last_name)}</div>
                                                    {task.assigned_first_name} {task.assigned_last_name}
                                                </div>
                                            )}
                                            {task.due_date && (
                                                <div className={`task-due ${new Date(task.due_date) < new Date() && task.status !== 'done' ? 'overdue' : ''}`}>
                                                    <Calendar size={11} /> {new Date(task.due_date).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {items.length === 0 && <div className="kanban-empty">No tasks</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Chat Panel */}
                <ChatPanel
                    projectId={id}
                    socket={socket}
                    isOpen={showChat}
                    onClose={() => setShowChat(false)}
                />

                {/* Video Call Panel */}
                {showVideo && (
                    <VideoCall
                        socket={socket}
                        user={user}
                        onlineUsers={onlineUsers}
                        projectId={id}
                        onClose={() => { setShowVideo(false); setActiveCall(null); }}
                        activeCall={activeCall}
                        onCallStateChange={handleCallStateChange}
                    />
                )}
            </div>

            {/* Create Task Modal */}
            {showTaskModal && (
                <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3 className="modal-title">Create Task</h3><button className="modal-close" onClick={() => setShowTaskModal(false)}><X size={18} /></button></div>
                        <form onSubmit={handleCreateTask}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Title *</label>
                                    <input className="form-input" placeholder="Task title" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} required /></div>
                                <div className="form-group"><label className="form-label">Description</label>
                                    <textarea className="form-textarea" placeholder="Describe the task..." value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} /></div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group"><label className="form-label">Priority</label>
                                        <select className="form-select" value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                                            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                                        </select></div>
                                    <div className="form-group"><label className="form-label">Status</label>
                                        <select className="form-select" value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>
                                            <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="review">Review</option><option value="done">Done</option>
                                        </select></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group"><label className="form-label">Assign To</label>
                                        <select className="form-select" value={taskForm.assigned_to} onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })}>
                                            <option value="">Unassigned</option>{members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                                        </select></div>
                                    <div className="form-group"><label className="form-label">Due Date</label>
                                        <input className="form-input" type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} /></div>
                                </div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Task</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Member Modal */}
            {showMemberModal && (
                <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header"><h3 className="modal-title">Add Member</h3><button className="modal-close" onClick={() => setShowMemberModal(false)}><X size={18} /></button></div>
                        <form onSubmit={handleAddMember}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Member Email</label>
                                    <input className="form-input" type="email" placeholder="user@example.com" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} required /></div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowMemberModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add Member</button></div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}
