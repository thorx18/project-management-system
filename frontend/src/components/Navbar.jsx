import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Moon } from 'lucide-react';
import { dashboardAPI } from '../services/api';

export default function Navbar({ title, breadcrumbs }) {
    const [notifications, setNotifications] = useState([]);
    const [showNotifs, setShowNotifs] = useState(false);
    const [unread, setUnread] = useState(0);
    const ref = useRef();

    useEffect(() => {
        fetchNotifs();
        const interval = setInterval(fetchNotifs, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowNotifs(false); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchNotifs = async () => {
        try {
            const res = await dashboardAPI.getNotifications();
            setNotifications(res.data);
            setUnread(res.data.filter(n => !n.is_read).length);
        } catch { }
    };

    const markAllRead = async () => {
        try {
            await dashboardAPI.markAllRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnread(0);
        } catch { }
    };

    const timeAgo = (date) => {
        const s = Math.floor((Date.now() - new Date(date)) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
        if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
        return `${Math.floor(s / 86400)}d ago`;
    };

    return (
        <header className="navbar">
            <div className="navbar-left">
                {breadcrumbs ? (
                    <div className="navbar-breadcrumb">{breadcrumbs}</div>
                ) : (
                    <h1 className="navbar-title">{title || 'Dashboard'}</h1>
                )}
            </div>
            <div className="navbar-right">
                <div className="navbar-search">
                    <Search size={18} />
                    <input placeholder="Search anything..." />
                </div>
                <div ref={ref} style={{ position: 'relative' }}>
                    <button className="navbar-icon-btn" onClick={() => setShowNotifs(!showNotifs)}>
                        <Bell size={20} />
                        {unread > 0 && <span className="notif-dot" />}
                    </button>
                    {showNotifs && (
                        <div className="notif-dropdown">
                            <div className="notif-header">
                                <h3>Notifications</h3>
                                {unread > 0 && <button className="btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>}
                            </div>
                            {notifications.length === 0 ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No notifications</div>
                            ) : (
                                notifications.slice(0, 10).map(n => (
                                    <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                                        <div className="notif-item-title">{n.title}</div>
                                        <div className="notif-item-msg">{n.message}</div>
                                        <div className="notif-item-time">{timeAgo(n.created_at)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
