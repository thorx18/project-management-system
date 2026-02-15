const db = require('../config/database');

// Get messages for a project
exports.getMessages = async (req, res) => {
    try {
        const { projectId } = req.params;

        const [messages] = await db.query(`
            SELECT m.*, u.first_name, u.last_name, u.avatar_url, u.email
            FROM messages m
            JOIN users u ON m.author_id = u.id
            WHERE m.project_id = ?
            ORDER BY m.created_at ASC
            LIMIT 200
        `, [projectId]);

        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Send a message
exports.sendMessage = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content required' });
        }

        const [result] = await db.query(
            'INSERT INTO messages (project_id, author_id, content) VALUES (?, ?, ?)',
            [projectId, req.userId, content.trim()]
        );

        const [message] = await db.query(`
            SELECT m.*, u.first_name, u.last_name, u.avatar_url, u.email
            FROM messages m
            JOIN users u ON m.author_id = u.id
            WHERE m.id = ?
        `, [result.insertId]);

        res.status(201).json(message[0]);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
