const db = require('../config/database');

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
    try {
        // Get user's projects
        const [projects] = await db.query(`
      SELECT COUNT(DISTINCT p.id) as total_projects,
             SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active_projects,
             SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed_projects
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE p.owner_id = ? OR pm.user_id = ?
    `, [req.userId, req.userId]);

        // Get task stats
        const [tasks] = await db.query(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(status = 'todo') as todo,
        SUM(status = 'in_progress') as in_progress,
        SUM(status = 'review') as review,
        SUM(status = 'done') as done,
        SUM(priority = 'urgent') as urgent_tasks,
        SUM(priority = 'high') as high_tasks
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE (p.owner_id = ? OR pm.user_id = ?)
    `, [req.userId, req.userId]);

        // My assigned tasks
        const [myTasks] = await db.query(`
      SELECT COUNT(*) as total,
             SUM(status != 'done') as pending
      FROM tasks WHERE assigned_to = ?
    `, [req.userId]);

        // Overdue tasks
        const [overdue] = await db.query(`
      SELECT COUNT(*) as count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE t.due_date < NOW() 
        AND t.status != 'done'
        AND (p.owner_id = ? OR pm.user_id = ? OR t.assigned_to = ?)
    `, [req.userId, req.userId, req.userId]);

        // Recent activity
        const [activity] = await db.query(`
      SELECT al.*, u.first_name, u.last_name, u.avatar_url, p.name as project_name, p.color as project_color
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN projects p ON al.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE p.owner_id = ? OR pm.user_id = ?
      ORDER BY al.created_at DESC
      LIMIT 15
    `, [req.userId, req.userId]);

        // Unread notifications
        const [notifications] = await db.query(`
      SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = FALSE
    `, [req.userId]);

        // Upcoming deadlines (next 7 days)
        const [upcoming] = await db.query(`
      SELECT t.id, t.title, t.due_date, t.priority, t.status, p.name as project_name, p.color as project_color
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE t.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
        AND t.status != 'done'
        AND (p.owner_id = ? OR pm.user_id = ? OR t.assigned_to = ?)
      ORDER BY t.due_date ASC
      LIMIT 10
    `, [req.userId, req.userId, req.userId]);

        res.json({
            projects: projects[0],
            tasks: tasks[0],
            myTasks: myTasks[0],
            overdue: overdue[0].count,
            activity,
            unreadNotifications: notifications[0].unread,
            upcoming
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get notifications
exports.getNotifications = async (req, res) => {
    try {
        const [notifications] = await db.query(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [req.userId]);

        res.json(notifications);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark notification as read
exports.markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [id, req.userId]);
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark notification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark all notifications as read
exports.markAllNotificationsRead = async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.userId]);
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all notifications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
