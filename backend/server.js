const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ─── CORS: Support multiple origins for remote deployment ───
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server, nginx proxy)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
            return callback(null, true);
        }
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

const io = socketIo(server, {
    cors: corsOptions,
    // ─── Stable WebSocket over remote networks ───
    pingTimeout: 60000,       // Wait 60s before considering connection dead
    pingInterval: 25000,      // Ping every 25s to keep connection alive
    transports: ['websocket', 'polling'],  // Prefer WebSocket, fallback to polling
    allowUpgrades: true
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/messages', require('./routes/messages'));

// ─── Agora Token Generation ───
const { RtcTokenBuilder, RtcRole } = require('agora-token');

app.get('/api/agora/token', (req, res) => {
    const { channelName, uid } = req.query;

    if (!channelName) {
        return res.status(400).json({ error: 'channelName is required' });
    }

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate || appCertificate === 'PASTE_YOUR_CERTIFICATE_HERE') {
        return res.status(500).json({ error: 'Agora credentials not configured on server' });
    }

    // Token expires in 1 hour
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const role = RtcRole.PUBLISHER;
    const uidNum = parseInt(uid) || 0;

    try {
        const token = RtcTokenBuilder.buildTokenWithUid(
            appId, appCertificate, channelName, uidNum, role, privilegeExpiredTs
        );
        console.log(`🎫 Generated Agora token for channel: ${channelName}, uid: ${uidNum}`);
        return res.json({ token, appId });
    } catch (err) {
        console.error('Token generation error:', err);
        return res.status(500).json({ error: 'Failed to generate token' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Track online users per project
const projectUsers = {};

// WebSocket
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    socket.on('join_project', (data) => {
        const projectId = typeof data === 'object' ? data.projectId : data;
        const userId = typeof data === 'object' ? data.userId : null;
        const userName = typeof data === 'object' ? data.userName : null;

        socket.join(`project_${projectId}`);
        socket.projectId = projectId;
        socket.userId = userId;
        socket.userName = userName;

        // Track online users
        if (userId) {
            if (!projectUsers[projectId]) projectUsers[projectId] = {};
            projectUsers[projectId][userId] = { socketId: socket.id, userName, userId };
            // Broadcast online users
            io.to(`project_${projectId}`).emit('online_users', Object.values(projectUsers[projectId]));
        }
    });

    // Task events
    socket.on('new_task', (data) => {
        io.to(`project_${data.projectId}`).emit('task_created', data.task);
    });

    socket.on('update_task', (data) => {
        io.to(`project_${data.projectId}`).emit('task_updated', data.task);
    });

    socket.on('delete_task', (data) => {
        io.to(`project_${data.projectId}`).emit('task_deleted', data.taskId);
    });

    // Chat events
    socket.on('new_message', (data) => {
        io.to(`project_${data.projectId}`).emit('message_received', data.message);
    });

    socket.on('typing', (data) => {
        socket.to(`project_${data.projectId}`).emit('user_typing', {
            userId: data.userId,
            userName: data.userName,
            isTyping: data.isTyping
        });
    });

    // ─── Video call signaling (Agora-based) ───
    // Socket.io handles notifications only; Agora handles the media.
    socket.on('call_user', (data) => {
        const { projectId, targetUserId, callerName, callerId, channelName } = data;
        // Find target user's socket
        const targetUser = projectUsers[projectId]?.[targetUserId];
        if (targetUser) {
            console.log(`📞 Call: ${callerName} → ${targetUser.userName} (channel: ${channelName})`);
            io.to(targetUser.socketId).emit('incoming_call', {
                callerName,
                callerId,
                callerSocketId: socket.id,
                channelName
            });
        } else {
            // Target user is offline — notify caller
            socket.emit('call_rejected', { reason: 'User is offline' });
        }
    });

    socket.on('answer_call', (data) => {
        const { callerSocketId, channelName } = data;
        console.log(`📞 Call answered → channel: ${channelName}`);
        io.to(callerSocketId).emit('call_answered', { channelName });
    });

    socket.on('end_call', (data) => {
        const { targetSocketId } = data;
        if (targetSocketId) {
            io.to(targetSocketId).emit('call_ended');
        }
    });

    socket.on('reject_call', (data) => {
        const { callerSocketId } = data;
        if (callerSocketId) {
            io.to(callerSocketId).emit('call_rejected');
        }
    });

    // Caller cancels before callee answers
    socket.on('call_cancelled_by_caller', (data) => {
        const { targetSocketId } = data;
        if (targetSocketId) {
            io.to(targetSocketId).emit('call_cancelled');
        }
    });

    socket.on('disconnect', () => {
        console.log('🔌 User disconnected:', socket.id);
        // Remove from online users
        if (socket.projectId && socket.userId && projectUsers[socket.projectId]) {
            delete projectUsers[socket.projectId][socket.userId];
            io.to(`project_${socket.projectId}`).emit('online_users', Object.values(projectUsers[socket.projectId]));
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// 404
app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

// Bind to 0.0.0.0 so the server accepts connections from outside the container
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`   CORS origins: ${allowedOrigins.join(', ')}`);
    console.log(`   Agora: ${process.env.AGORA_APP_ID ? '✅ configured' : '❌ not set'}`);
});

module.exports = { app, io };
