import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FolderKanban, CheckSquare, Bell, Settings, LogOut, Zap } from 'lucide-react';

const avatarColors = ['#7c3aed', '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#22c55e'];
const getAvatarColor = (name) => avatarColors[(name || '').charCodeAt(0) % avatarColors.length];
const getInitials = (first, last) => `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || '?';

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="sidebar-brand-icon"><Zap size={20} /></div>
                <div className="sidebar-brand-text">Flow<span>Board</span></div>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section">
                    <div className="sidebar-section-title">Menu</div>
                    <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} /> Dashboard
                    </NavLink>
                    <NavLink to="/projects" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        <FolderKanban size={20} /> Projects
                    </NavLink>
                    <NavLink to="/my-tasks" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        <CheckSquare size={20} /> My Tasks
                    </NavLink>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">General</div>
                    <NavLink to="/notifications" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        <Bell size={20} /> Notifications
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        <Settings size={20} /> Settings
                    </NavLink>
                </div>
            </nav>

            <div className="sidebar-user">
                <div className="sidebar-user-avatar" style={{ background: getAvatarColor(user?.first_name) }}>
                    {getInitials(user?.first_name, user?.last_name)}
                </div>
                <div className="sidebar-user-info">
                    <div className="sidebar-user-name">{user?.first_name} {user?.last_name}</div>
                    <div className="sidebar-user-role">{user?.role || 'Member'}</div>
                </div>
                <button className="btn-ghost" onClick={handleLogout} title="Logout" style={{ marginLeft: 'auto', padding: '6px' }}>
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    );
}
