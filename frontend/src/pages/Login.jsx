import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, LayoutDashboard, Users, BarChart3 } from 'lucide-react';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login, register } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) await login(form.email, form.password);
            else await register(form);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        }
        setLoading(false);
    };

    const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

    return (
        <div className="auth-page">
            <div className="auth-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
                    <div className="sidebar-brand-icon"><Zap size={20} /></div>
                    <div className="sidebar-brand-text">Flow<span style={{ color: 'var(--primary-light)' }}>Board</span></div>
                </div>
                <h1 className="auth-hero-title">Manage projects<br /><span>like never before.</span></h1>
                <p className="auth-hero-desc">
                    A next-generation project management platform built for modern teams.
                    Organize, collaborate, and ship faster.
                </p>
                <div className="auth-features">
                    <div className="auth-feature">
                        <div className="auth-feature-icon" style={{ background: 'rgba(124,58,237,0.15)', color: '#8b5cf6' }}><LayoutDashboard size={20} /></div>
                        <div className="auth-feature-text"><h4>Visual Kanban Boards</h4><p>Drag and drop tasks across stages</p></div>
                    </div>
                    <div className="auth-feature">
                        <div className="auth-feature-icon" style={{ background: 'rgba(20,184,166,0.15)', color: '#14b8a6' }}><Users size={20} /></div>
                        <div className="auth-feature-text"><h4>Team Collaboration</h4><p>Real-time updates and notifications</p></div>
                    </div>
                    <div className="auth-feature">
                        <div className="auth-feature-icon" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}><BarChart3 size={20} /></div>
                        <div className="auth-feature-text"><h4>Smart Analytics</h4><p>Track progress with insightful dashboards</p></div>
                    </div>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-card">
                    <h2 className="auth-title">{isLogin ? 'Welcome back' : 'Create account'}</h2>
                    <p className="auth-subtitle">{isLogin ? 'Sign in to continue to FlowBoard' : 'Get started with FlowBoard for free'}</p>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={handleSubmit}>
                        {!isLogin && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">First Name</label>
                                    <input className="form-input" placeholder="John" value={form.first_name} onChange={e => set('first_name', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Last Name</label>
                                    <input className="form-input" placeholder="Doe" value={form.last_name} onChange={e => set('last_name', e.target.value)} />
                                </div>
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} required />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                            {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : (isLogin ? 'Sign In' : 'Create Account')}
                        </button>
                    </form>

                    <div className="auth-toggle">
                        {isLogin ? "Don't have an account? " : 'Already have an account? '}
                        <button onClick={() => { setIsLogin(!isLogin); setError(''); }}>
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
