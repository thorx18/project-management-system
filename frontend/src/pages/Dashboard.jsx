import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, projectsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { FolderKanban, CheckSquare, AlertTriangle, TrendingUp, Clock, ArrowRight } from 'lucide-react';

const avatarColors = ['#7c3aed', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#22c55e'];
const timeAgo = (d) => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`;
};

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const [s, p] = await Promise.all([dashboardAPI.getStats(), projectsAPI.getAll()]);
            setStats(s.data);
            setProjects(p.data.slice(0, 4));
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    if (loading) return <Layout title="Dashboard"><div className="loading-screen"><div className="spinner spinner-lg" /><p>Loading dashboard...</p></div></Layout>;

    const tasksDone = stats?.tasks?.done || 0;
    const totalTasks = stats?.tasks?.total_tasks || 0;
    const completionPct = totalTasks ? Math.round((tasksDone / totalTasks) * 100) : 0;

    return (
        <Layout title="Dashboard">
            <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
                    Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.first_name || 'there'}! 👋
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Here&apos;s what&apos;s happening across your projects</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card" style={{ '--stat-color': 'var(--primary)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(124,58,237,0.15)', color: '#8b5cf6' }}><FolderKanban size={22} /></div>
                    <div className="stat-value">{stats?.projects?.total_projects || 0}</div>
                    <div className="stat-label">Total Projects</div>
                </div>
                <div className="stat-card" style={{ '--stat-color': 'var(--accent-blue)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}><CheckSquare size={22} /></div>
                    <div className="stat-value">{totalTasks}</div>
                    <div className="stat-label">Total Tasks</div>
                </div>
                <div className="stat-card" style={{ '--stat-color': 'var(--accent-green)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}><TrendingUp size={22} /></div>
                    <div className="stat-value">{completionPct}%</div>
                    <div className="stat-label">Completion Rate</div>
                </div>
                <div className="stat-card" style={{ '--stat-color': 'var(--accent-red)' }}>
                    <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}><AlertTriangle size={22} /></div>
                    <div className="stat-value">{stats?.overdue || 0}</div>
                    <div className="stat-label">Overdue Tasks</div>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-main">
                    {/* Recent Projects */}
                    <div>
                        <div className="section-header">
                            <div><h3 className="section-title">Recent Projects</h3><p className="section-subtitle">Your latest projects</p></div>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>View All <ArrowRight size={14} /></button>
                        </div>
                        <div className="projects-grid">
                            {projects.map((p, i) => {
                                const done = p.completed_tasks || 0;
                                const total = p.task_count || 0;
                                const pct = total ? Math.round((done / total) * 100) : 0;
                                return (
                                    <div key={p.id} className="project-card" style={{ '--project-color': p.color, animationDelay: `${i * 0.08}s` }}
                                        onClick={() => navigate(`/projects/${p.id}`)}>
                                        <div className="project-card-header">
                                            <div className="project-card-icon" style={{ background: `${p.color}22`, color: p.color }}>
                                                <FolderKanban size={22} />
                                            </div>
                                            <span className={`badge badge-${p.status === 'active' ? 'in_progress' : p.status === 'completed' ? 'done' : 'todo'}`}>{p.status}</span>
                                        </div>
                                        <h4 className="project-card-name">{p.name}</h4>
                                        <p className="project-card-desc">{p.description || 'No description'}</p>
                                        <div className="project-card-progress">
                                            <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: p.color }} /></div>
                                            <div className="progress-text">{done}/{total} tasks completed</div>
                                        </div>
                                        <div className="project-card-footer">
                                            <div className="project-card-stats">
                                                <span><CheckSquare size={13} /> {total} tasks</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {projects.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">📂</div>
                                <h3>No projects yet</h3>
                                <p>Create your first project to get started</p>
                                <button className="btn btn-primary" onClick={() => navigate('/projects')}>Create Project</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Activity Sidebar */}
                <div className="dashboard-sidebar">
                    <div className="card">
                        <h3 className="section-title" style={{ marginBottom: 16 }}>Recent Activity</h3>
                        <div className="activity-list">
                            {(stats?.activity || []).slice(0, 8).map((a, i) => (
                                <div key={a.id} className="activity-item" style={{ animationDelay: `${i * 0.05}s` }}>
                                    <div className="activity-dot" style={{ background: a.action === 'created' ? 'var(--accent-green)' : a.action === 'deleted' ? 'var(--accent-red)' : 'var(--primary)' }} />
                                    <div className="activity-content">
                                        <div className="activity-text"><strong>{a.first_name}</strong> {a.description}</div>
                                        <div className="activity-time">{timeAgo(a.created_at)}</div>
                                    </div>
                                </div>
                            ))}
                            {(!stats?.activity || stats.activity.length === 0) && (
                                <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>No recent activity</p>
                            )}
                        </div>
                    </div>

                    {/* Upcoming Deadlines */}
                    {stats?.upcoming?.length > 0 && (
                        <div className="card">
                            <h3 className="section-title" style={{ marginBottom: 16 }}>Upcoming Deadlines</h3>
                            {stats.upcoming.map(t => (
                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                    <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.project_name} · {new Date(t.due_date).toLocaleDateString()}</div>
                                    </div>
                                    <span className={`badge badge-${t.priority}`}>{t.priority}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
