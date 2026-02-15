import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../services/api';
import Layout from '../components/Layout';
import { Plus, FolderKanban, CheckSquare, Users, X, Trash2 } from 'lucide-react';

export default function Projects() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', color: '#7c3aed', due_date: '' });
    const navigate = useNavigate();

    useEffect(() => { fetchProjects(); }, []);

    const fetchProjects = async () => {
        try { const r = await projectsAPI.getAll(); setProjects(r.data); } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await projectsAPI.create(form);
            setShowModal(false);
            setForm({ name: '', description: '', color: '#7c3aed', due_date: '' });
            fetchProjects();
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!confirm('Delete this project and all its data?')) return;
        try { await projectsAPI.delete(id); fetchProjects(); } catch (e) { console.error(e); }
    };

    if (loading) return <Layout title="Projects"><div className="loading-screen"><div className="spinner spinner-lg" /></div></Layout>;

    return (
        <Layout title="Projects">
            <div className="section-header">
                <div><h2 className="section-title">All Projects</h2><p className="section-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''}</p></div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> New Project</button>
            </div>

            <div className="projects-grid">
                {projects.map((p, i) => {
                    const done = p.completed_tasks || 0, total = p.task_count || 0;
                    const pct = total ? Math.round((done / total) * 100) : 0;
                    return (
                        <div key={p.id} className="project-card" style={{ '--project-color': p.color, animationDelay: `${i * 0.06}s` }}
                            onClick={() => navigate(`/projects/${p.id}`)}>
                            <div className="project-card-header">
                                <div className="project-card-icon" style={{ background: `${p.color}22`, color: p.color }}><FolderKanban size={22} /></div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span className={`badge badge-${p.status === 'active' ? 'in_progress' : 'done'}`}>{p.status}</span>
                                    <button className="btn-ghost" style={{ padding: 4 }} onClick={(e) => handleDelete(e, p.id)}><Trash2 size={14} style={{ color: 'var(--text-muted)' }} /></button>
                                </div>
                            </div>
                            <h4 className="project-card-name">{p.name}</h4>
                            <p className="project-card-desc">{p.description || 'No description added'}</p>
                            <div className="project-card-progress">
                                <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: p.color }} /></div>
                                <div className="progress-text">{pct}% complete · {done}/{total} tasks</div>
                            </div>
                            <div className="project-card-footer">
                                <div className="project-card-stats">
                                    <span><CheckSquare size={13} /> {total}</span>
                                    <span><Users size={13} /> {p.member_count || 1}</span>
                                </div>
                                {p.due_date && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Due {new Date(p.due_date).toLocaleDateString()}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {projects.length === 0 && (
                <div className="empty-state"><div className="empty-state-icon">📁</div><h3>No projects yet</h3><p>Create your first project to get started</p>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={18} /> Create Project</button></div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Create New Project</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Project Name *</label>
                                    <input className="form-input" placeholder="e.g. Website Redesign" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                <div className="form-group"><label className="form-label">Description</label>
                                    <textarea className="form-textarea" placeholder="What's this project about?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group"><label className="form-label">Color</label>
                                        <div className="form-color-wrapper"><input className="form-color" type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{form.color}</span></div></div>
                                    <div className="form-group"><label className="form-label">Due Date</label>
                                        <input className="form-input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Project</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
}
