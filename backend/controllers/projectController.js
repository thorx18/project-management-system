const db = require('../config/database');

// Get all projects for current user
exports.getProjects = async (req, res) => {
    try {
        const [projects] = await db.query(`
      SELECT DISTINCT p.*, u.first_name as owner_name, u.last_name as owner_lastname,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_tasks,
             (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
      WHERE p.owner_id = ? OR pm.user_id = ?
      ORDER BY p.updated_at DESC
    `, [req.userId, req.userId, req.userId]);

        res.json(projects);
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create new project
exports.createProject = async (req, res) => {
    try {
        const { name, description, color, due_date } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Project name required' });
        }

        const [result] = await db.query(
            'INSERT INTO projects (name, description, color, due_date, owner_id) VALUES (?, ?, ?, ?, ?)',
            [name, description, color || '#7c3aed', due_date, req.userId]
        );

        // Add creator as owner member
        await db.query(
            'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
            [result.insertId, req.userId, 'owner']
        );

        // Log activity
        await db.query(
            'INSERT INTO activity_log (user_id, project_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?, ?)',
            [req.userId, result.insertId, 'created', 'project', result.insertId, `Created project "${name}"`]
        );

        const [project] = await db.query('SELECT * FROM projects WHERE id = ?', [result.insertId]);

        res.status(201).json(project[0]);
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get single project with members
exports.getProject = async (req, res) => {
    try {
        const { id } = req.params;

        // Check access
        const [access] = await db.query(`
      SELECT 1 FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
    `, [id, req.userId, req.userId]);

        if (access.length === 0) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const [project] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
        if (project.length === 0) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Get members
        const [members] = await db.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, pm.role
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `, [id]);

        // Get task stats
        const [stats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(status = 'todo') as todo,
        SUM(status = 'in_progress') as in_progress,
        SUM(status = 'review') as review,
        SUM(status = 'done') as done
      FROM tasks WHERE project_id = ?
    `, [id]);

        // Get recent activity
        const [activity] = await db.query(`
      SELECT al.*, u.first_name, u.last_name
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.project_id = ?
      ORDER BY al.created_at DESC
      LIMIT 20
    `, [id]);

        res.json({
            ...project[0],
            members,
            stats: stats[0],
            activity
        });
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update project
exports.updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, color, status, due_date } = req.body;

        const [access] = await db.query(`
      SELECT pm.role FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
      WHERE p.id = ? AND (p.owner_id = ? OR pm.role IN ('owner', 'admin'))
    `, [req.userId, id, req.userId]);

        if (access.length === 0) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await db.query(
            'UPDATE projects SET name = ?, description = ?, color = ?, status = ?, due_date = ? WHERE id = ?',
            [name, description, color, status, due_date, id]
        );

        // Log activity
        await db.query(
            'INSERT INTO activity_log (user_id, project_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?, ?)',
            [req.userId, id, 'updated', 'project', id, `Updated project "${name}"`]
        );

        const [project] = await db.query('SELECT * FROM projects WHERE id = ?', [id]);
        res.json(project[0]);
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete project
exports.deleteProject = async (req, res) => {
    try {
        const { id } = req.params;

        const [project] = await db.query('SELECT owner_id, name FROM projects WHERE id = ?', [id]);
        if (project.length === 0) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (project[0].owner_id !== req.userId) {
            return res.status(403).json({ message: 'Only owner can delete project' });
        }

        await db.query('DELETE FROM projects WHERE id = ?', [id]);

        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add member
exports.addMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, role } = req.body;

        const [users] = await db.query('SELECT id, first_name, last_name FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found with that email' });
        }

        const userId = users[0].id;

        await db.query(
            'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = ?',
            [id, userId, role || 'member', role || 'member']
        );

        // Notify user
        const [project] = await db.query('SELECT name FROM projects WHERE id = ?', [id]);
        await db.query(
            'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
            [userId, 'project_invite', 'Added to project', `You have been added to "${project[0].name}"`, `/projects/${id}`]
        );

        // Log activity
        await db.query(
            'INSERT INTO activity_log (user_id, project_id, action, entity_type, description) VALUES (?, ?, ?, ?, ?)',
            [req.userId, id, 'added_member', 'project', `Added ${users[0].first_name} ${users[0].last_name} to project`]
        );

        res.json({ message: 'Member added successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'User is already a member' });
        }
        console.error('Add member error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Remove member
exports.removeMember = async (req, res) => {
    try {
        const { id, userId } = req.params;

        const [project] = await db.query('SELECT owner_id FROM projects WHERE id = ?', [id]);
        if (project[0].owner_id === parseInt(userId)) {
            return res.status(400).json({ message: 'Cannot remove project owner' });
        }

        await db.query('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [id, userId]);

        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
