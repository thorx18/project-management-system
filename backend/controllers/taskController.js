const db = require('../config/database');

// Get all tasks for a project
exports.getTasks = async (req, res) => {
    try {
        const { projectId } = req.params;

        const [access] = await db.query(`
      SELECT 1 FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
    `, [projectId, req.userId, req.userId]);

        if (access.length === 0) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const [tasks] = await db.query(`
      SELECT t.*, 
             u1.first_name as assigned_first_name, u1.last_name as assigned_last_name, u1.avatar_url as assigned_avatar,
             u2.first_name as creator_first_name, u2.last_name as creator_last_name,
             (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.project_id = ?
      ORDER BY 
        FIELD(t.priority, 'urgent', 'high', 'medium', 'low'),
        t.created_at DESC
    `, [projectId]);

        res.json(tasks);
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create task
exports.createTask = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { title, description, status, priority, assigned_to, due_date } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Task title required' });
        }

        const [result] = await db.query(
            'INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [projectId, title, description, status || 'todo', priority || 'medium', assigned_to || null, due_date || null, req.userId]
        );

        // Notify assigned user
        if (assigned_to) {
            await db.query(
                'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
                [assigned_to, 'task_assigned', 'New task assigned', `You have been assigned: "${title}"`, `/projects/${projectId}`]
            );
        }

        // Log activity
        await db.query(
            'INSERT INTO activity_log (user_id, project_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?, ?)',
            [req.userId, projectId, 'created', 'task', result.insertId, `Created task "${title}"`]
        );

        const [task] = await db.query(`
      SELECT t.*, 
             u1.first_name as assigned_first_name, u1.last_name as assigned_last_name, u1.avatar_url as assigned_avatar,
             u2.first_name as creator_first_name, u2.last_name as creator_last_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `, [result.insertId]);

        res.status(201).json(task[0]);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update task
exports.updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, priority, assigned_to, due_date } = req.body;

        const [existingTask] = await db.query('SELECT * FROM tasks WHERE id = ?', [id]);
        if (existingTask.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const updates = {
            title: title !== undefined ? title : existingTask[0].title,
            description: description !== undefined ? description : existingTask[0].description,
            status: status !== undefined ? status : existingTask[0].status,
            priority: priority !== undefined ? priority : existingTask[0].priority,
            assigned_to: assigned_to !== undefined ? assigned_to : existingTask[0].assigned_to,
            due_date: due_date !== undefined ? due_date : existingTask[0].due_date,
        };

        await db.query(
            'UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ?, due_date = ? WHERE id = ?',
            [updates.title, updates.description, updates.status, updates.priority, updates.assigned_to, updates.due_date, id]
        );

        // Set completed_at if done
        if (updates.status === 'done' && existingTask[0].status !== 'done') {
            await db.query('UPDATE tasks SET completed_at = NOW() WHERE id = ?', [id]);
        } else if (updates.status !== 'done') {
            await db.query('UPDATE tasks SET completed_at = NULL WHERE id = ?', [id]);
        }

        // Log activity
        let actionDesc = `Updated task "${updates.title}"`;
        if (status && status !== existingTask[0].status) {
            actionDesc = `Moved "${updates.title}" to ${status.replace('_', ' ')}`;
        }

        await db.query(
            'INSERT INTO activity_log (user_id, project_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?, ?)',
            [req.userId, existingTask[0].project_id, 'updated', 'task', id, actionDesc]
        );

        const [task] = await db.query(`
      SELECT t.*, 
             u1.first_name as assigned_first_name, u1.last_name as assigned_last_name, u1.avatar_url as assigned_avatar,
             u2.first_name as creator_first_name, u2.last_name as creator_last_name,
             (SELECT COUNT(*) FROM comments WHERE task_id = t.id) as comment_count
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `, [id]);

        res.json(task[0]);
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete task
exports.deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        const [task] = await db.query('SELECT project_id, title FROM tasks WHERE id = ?', [id]);
        if (task.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        await db.query('DELETE FROM tasks WHERE id = ?', [id]);

        // Log activity
        await db.query(
            'INSERT INTO activity_log (user_id, project_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?, ?)',
            [req.userId, task[0].project_id, 'deleted', 'task', id, `Deleted task "${task[0].title}"`]
        );

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get task with comments
exports.getTask = async (req, res) => {
    try {
        const { id } = req.params;

        const [task] = await db.query(`
      SELECT t.*, 
             u1.first_name as assigned_first_name, u1.last_name as assigned_last_name, u1.avatar_url as assigned_avatar,
             u2.first_name as creator_first_name, u2.last_name as creator_last_name
      FROM tasks t
      LEFT JOIN users u1 ON t.assigned_to = u1.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.id = ?
    `, [id]);

        if (task.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const [comments] = await db.query(`
      SELECT c.*, u.first_name, u.last_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.task_id = ?
      ORDER BY c.created_at ASC
    `, [id]);

        res.json({ ...task[0], comments });
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add comment
exports.addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({ message: 'Comment content required' });
        }

        const [result] = await db.query(
            'INSERT INTO comments (task_id, author_id, content) VALUES (?, ?, ?)',
            [id, req.userId, content]
        );

        const [comment] = await db.query(`
      SELECT c.*, u.first_name, u.last_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);

        // Log activity
        const [task] = await db.query('SELECT project_id, title FROM tasks WHERE id = ?', [id]);
        if (task.length > 0) {
            await db.query(
                'INSERT INTO activity_log (user_id, project_id, action, entity_type, entity_id, description) VALUES (?, ?, ?, ?, ?, ?)',
                [req.userId, task[0].project_id, 'commented', 'task', id, `Commented on "${task[0].title}"`]
            );
        }

        res.status(201).json(comment[0]);
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
