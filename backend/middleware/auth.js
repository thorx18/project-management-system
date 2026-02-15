const jwt = require('jsonwebtoken');
const db = require('../config/database');

const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Verify user still exists
        const [users] = await db.query('SELECT id, role FROM users WHERE id = ? AND is_active = TRUE', [decoded.id]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'User no longer exists' });
        }

        req.userId = decoded.id;
        req.userRole = users[0].role;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

// Optional: Admin only middleware
const adminOnly = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

module.exports = { protect, adminOnly };
