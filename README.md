<<<<<<< HEAD
# 🚀 FlowBoard — Project Management System

A premium, next-generation project management platform with a stunning dark-themed UI, real-time collaboration, and Kanban boards.

## ✨ Features

- 🔐 **Authentication** — Register, login with JWT tokens
- 📊 **Dashboard** — Animated stats, activity feed, upcoming deadlines
- 📁 **Projects** — Create, manage, and color-code projects
- 📋 **Kanban Board** — Visual task management with 4 status columns
- 👥 **Team Collaboration** — Add members, assign tasks
- 🔔 **Notifications** — Real-time notification system
- ⚡ **Real-time Updates** — WebSocket for instant sync
- 🎨 **Premium UI** — Dark glassmorphism theme with animations

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | MySQL |
| Real-time | Socket.io |
| Auth | JWT + bcrypt |
| Styling | Custom CSS (Glassmorphism) |

## 📦 Setup

### 1. Database
```bash
mysql -u root -p
source database/schema.sql
```

### 2. Backend
```bash
cd backend
npm install
# Edit .env with your MySQL password
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open
- Frontend: http://localhost:5173
- API: http://localhost:5000

## ⚠️ Important
Update `backend/.env` with your MySQL root password before running.
=======
# project-management-system
>>>>>>> 548b2ee680e3a99122240c8c05b6e57ffe765c13
