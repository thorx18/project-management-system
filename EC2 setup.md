# 🚀 Docker Deployment Guide - FlowBoard Project Management System
Complete guide for deploying the Project Management System on EC2 using Docker and Docker Compose (HTTP/IP-based deployment).

---

## 📋 Prerequisites

- ✅ EC2 instance running Ubuntu (22.04 or 24.04 recommended)
- ✅ SSH access to the instance
- ✅ EC2 Security Group configured with the following inbound rules:

| Type | Protocol | Port Range | Source | Description |
|------|----------|------------|--------|-------------|
| SSH | TCP | 22 | Your IP / 0.0.0.0/0 | SSH access |
| HTTP | TCP | 80 | 0.0.0.0/0 | Frontend access |
| Custom TCP | TCP | 5000 | 0.0.0.0/0 | Backend API access |
| MySQL | TCP | 3306 | Security Group ID | Database (internal only) |

**Note:** Port 3306 should only be accessible within the security group, not from the internet.

---

## 🐳 Step 1: Install Docker & Docker Compose

### Update System Packages

```bash
sudo apt update -y
sudo apt upgrade -y
```

### Install Docker

```bash
sudo apt install -y docker.io docker-compose-plugin
```

### Enable and Start Docker Service

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

### Add Ubuntu User to Docker Group

```bash
sudo usermod -aG docker ubuntu
```

**Why?** This allows running Docker commands without `sudo`.

---

## 🔄 Step 2: Reconnect SSH Session

**⚠️ IMPORTANT:** After adding the user to the docker group, you **must** reconnect your SSH session for the changes to take effect.

### Exit Current Session

```bash
exit
```

### Reconnect to EC2

```bash
ssh ubuntu@YOUR_EC2_PUBLIC_IP
```

**Or if using PEM key:**

```bash
ssh -i your-key-file.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

**Example:**
```bash
ssh ubuntu@3.110.228.200
```

---

## ✅ Step 3: Verify Docker Installation

### Check Docker Version

```bash
docker --version
```

**Expected Output:**
```
Docker version 24.x.x, build xxxxx
```

### Check Docker Compose Version

```bash
docker compose version
```

**Expected Output:**
```
Docker Compose version v2.x.x
```

### Test Docker Without Sudo

```bash
docker ps
```

**Expected Output:**
```
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

If you see a permission error, you didn't reconnect SSH. Go back to Step 2.

---

## 📦 Step 4: Clone Repository

### Navigate to Home Directory

```bash
cd ~
```

### Clone Your Repository

```bash
git clone https://github.com/YOUR_USERNAME/project-management-system.git
```

**Replace:** `YOUR_USERNAME` with your actual GitHub username.

### Enter Project Directory

```bash
cd project-management-system
```

### Verify Project Structure

```bash
ls -la
```

**Expected Files:**
```
.env
docker-compose.yml
backend/
frontend/
README.md
```

---

## 📁 Step 5: Understand Project Structure

Your project directory structure:

```
project-management-system/
├── .env                      # Environment variables (YOU WILL EDIT THIS)
├── docker-compose.yml        # Docker service configuration
├── backend/
│   ├── Dockerfile           # Backend container setup
│   ├── package.json
│   └── src/                 # Backend source code
├── frontend/
│   ├── Dockerfile           # Frontend container setup
│   ├── nginx.conf           # Nginx web server config
│   ├── package.json
│   └── src/                 # Frontend source code
└── README.md
```

---

## ⚙️ Step 6: Configure Environment Variables

This is the **most critical step**. You need to configure your `.env` file with your EC2 public IP.

### Find Your EC2 Public IP

From AWS Console or run:

```bash
curl http://checkip.amazonaws.com
```

**Example Output:** `3.110.228.200`

### Edit the .env File

```bash
nano .env
```

### Configuration Template

Replace `YOUR_EC2_PUBLIC_IP` with your actual IP address:

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
SERVER_IP=YOUR_EC2_PUBLIC_IP
BACKEND_PORT=5000
FRONTEND_PORT=80
NODE_ENV=production

# ============================================
# DATABASE CONFIGURATION
# ============================================
DB_HOST=mysql
DB_USER=root
DB_PASSWORD=StrongPassword123!
DB_NAME=project_management_db
MYSQL_PORT=3306

# ============================================
# SECURITY
# ============================================
JWT_SECRET=your_super_secret_jwt_key_change_this_now_123456789

# ============================================
# CORS CONFIGURATION (Use HTTP for IP-based)
# ============================================
CORS_ORIGIN=http://YOUR_EC2_PUBLIC_IP

# ============================================
# AGORA VIDEO CALL CONFIGURATION (Optional)
# ============================================
AGORA_APP_ID=your_agora_app_id_here
AGORA_APP_CERTIFICATE=your_agora_certificate_here

# ============================================
# FRONTEND ENVIRONMENT VARIABLES
# ============================================
VITE_API_URL=http://YOUR_EC2_PUBLIC_IP:5000/api
VITE_BACKEND_URL=http://YOUR_EC2_PUBLIC_IP:5000
VITE_AGORA_APP_ID=your_agora_app_id_here
```

### Real Example Configuration

If your EC2 IP is `3.110.228.200`:

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
SERVER_IP=3.110.228.200
BACKEND_PORT=5000
FRONTEND_PORT=80
NODE_ENV=production

# ============================================
# DATABASE CONFIGURATION
# ============================================
DB_HOST=mysql
DB_USER=root
DB_PASSWORD=MySecurePass2024!
DB_NAME=project_management_db
MYSQL_PORT=3306

# ============================================
# SECURITY
# ============================================
JWT_SECRET=a8f7d3b2e9c1f4a7d8e5b3c9f2a6d1e8b7c4f9a2d5e8b1c6f3a9d2e7b5c8f1a4

# ============================================
# CORS CONFIGURATION
# ============================================
CORS_ORIGIN=http://3.110.228.200

# ============================================
# AGORA VIDEO CALL CONFIGURATION
# ============================================
AGORA_APP_ID=e6061be9565b47e0b9705f86de2a42f5
AGORA_APP_CERTIFICATE=8bfbd4ed44254e25be4402e84f40d642

# ============================================
# FRONTEND ENVIRONMENT VARIABLES
# ============================================
VITE_API_URL=http://3.110.228.200:5000/api
VITE_BACKEND_URL=http://3.110.228.200:5000
VITE_AGORA_APP_ID=e6061be9565b47e0b9705f86de2a42f5
```

### Important Notes

- **CORS_ORIGIN:** Must use `http://` (not `https://`) for IP-based deployment
- **JWT_SECRET:** Change this to a long random string for security
- **DB_PASSWORD:** Use a strong password (mix of letters, numbers, symbols)
- **AGORA credentials:** Optional, only needed if using video call features

### Save the File

```bash
# Press CTRL + O to save
# Press ENTER to confirm
# Press CTRL + X to exit
```

---

## 🏗️ Step 7: Build Docker Images

This step compiles your application into Docker containers.

### Build All Services

```bash
docker compose build --no-cache
```

**What this does:**
- Builds the backend (Node.js/Express API)
- Builds the frontend (React/Vite application)
- Downloads MySQL image
- `--no-cache` ensures fresh build without cached layers

**Expected Output:**
```
[+] Building 234.5s (45/45) FINISHED
 => [backend internal] load build definition
 => [frontend internal] load build definition
 => [backend] resolve image config
 => [frontend] resolve image config
...
```

**Time:** First build takes 5-10 minutes depending on your instance type.

**If build fails:** See troubleshooting section at the end.

---

## ▶️ Step 8: Start Application

### Start All Containers in Detached Mode

```bash
docker compose up -d
```

**What `-d` means:** Runs containers in background (detached mode).

**Expected Output:**
```
[+] Running 3/3
 ✔ Container flowboard-db    Started
 ✔ Container flowboard-api   Started
 ✔ Container flowboard-ui    Started
```

### Wait for Containers to Initialize

```bash
sleep 15
```

Give MySQL and backend time to fully start.

---

## 🔍 Step 9: Verify Running Containers

### Check Container Status

```bash
docker ps
```

### Expected Output

```
CONTAINER ID   IMAGE                    STATUS                   PORTS                    NAMES
abc123def456   flowboard-frontend       Up 2 minutes (healthy)   0.0.0.0:80->80/tcp       flowboard-ui
def456abc789   flowboard-backend        Up 2 minutes (healthy)   0.0.0.0:5000->5000/tcp   flowboard-api
ghi789jkl012   mysql:8.0                Up 2 minutes (healthy)   3306/tcp                 flowboard-db
```

### What to Look For

✅ **STATUS:** All containers should show "Up X minutes (healthy)"
❌ **RESTARTING:** If any container shows "Restarting", check logs (see Step 11)

### Check Container Health

```bash
docker inspect --format='{{.State.Health.Status}}' flowboard-ui
docker inspect --format='{{.State.Health.Status}}' flowboard-api
docker inspect --format='{{.State.Health.Status}}' flowboard-db
```

**Expected Output for each:**
```
healthy
```

---

## 🌐 Step 10: Access Your Application

### Frontend (User Interface)

Open in your browser:

```
http://YOUR_EC2_PUBLIC_IP
```

**Example:**
```
http://3.110.228.200
```

**Expected:** You should see the FlowBoard login/registration page.

### Backend API Health Check

Open in your browser or use curl:

```
http://YOUR_EC2_PUBLIC_IP:5000/api/health
```

**Using curl:**

```bash
curl http://YOUR_EC2_PUBLIC_IP:5000/api/health
```

**Expected Response:**
```json
{"status":"ok"}
```

### Test API Endpoints

```bash
# Check if API is responding
curl http://YOUR_EC2_PUBLIC_IP:5000/api/

# Check specific endpoint (may return 401 if auth required)
curl http://YOUR_EC2_PUBLIC_IP:5000/api/users
```

---

## 📋 Step 11: View Container Logs

### View All Logs (Real-time)

```bash
docker compose logs -f
```

**Press CTRL+C to stop viewing logs.**

### View Specific Container Logs

```bash
# Backend API logs
docker compose logs -f flowboard-api

# Frontend logs
docker compose logs -f flowboard-ui

# Database logs
docker compose logs -f flowboard-db
```

### View Last 100 Lines

```bash
docker compose logs --tail=100 flowboard-api
```

---

## 🔧 Common Management Commands

### Restart All Services

```bash
docker compose restart
```

### Restart Specific Service

```bash
docker compose restart flowboard-api
```

### Stop All Services

```bash
docker compose down
```

**Note:** This stops containers but keeps volumes (data persists).

### Start Services Again

```bash
docker compose up -d
```

### Stop and Remove Everything (Including Data)

```bash
docker compose down -v
```

**⚠️ WARNING:** `-v` flag deletes all database data. Use with caution!

### Rebuild Specific Service

```bash
docker compose up -d --build flowboard-api
```

### View Resource Usage

```bash
docker stats
```

**Press CTRL+C to exit.**

---

## 🛠️ When to Rebuild vs Restart

### 🟢 Only Restart Needed

If you changed **backend environment variables** only:
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`

```bash
docker compose down
docker compose up -d
```

**Why?** Backend reads environment variables at runtime.

---

### 🔴 Rebuild Required

If you changed **frontend environment variables** (`VITE_*`):
- `VITE_API_URL`
- `VITE_BACKEND_URL`
- `VITE_AGORA_APP_ID`

```bash
docker compose down
docker compose up -d --build
```

**Why?** Frontend variables are baked into the build at compile time.

---

### 🔴 Full Rebuild Required

If you changed **source code**:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 🔍 Verify Environment Variables Loaded

### Check Backend Environment

```bash
docker exec -it flowboard-api printenv | grep CORS
docker exec -it flowboard-api printenv | grep JWT
```

### Check Frontend Build Arguments

```bash
docker logs flowboard-ui 2>&1 | grep VITE
```

### Execute Command Inside Container

```bash
# Open shell in backend container
docker exec -it flowboard-api /bin/sh

# Inside container, check env
printenv

# Exit container
exit
```

---

## 🚨 Emergency Docker Fix

### If Build Fails with Snapshot/Extraction Errors

```bash
# Stop Docker completely
sudo systemctl stop docker.service
sudo systemctl stop docker.socket

# Remove buildkit cache
sudo rm -rf /var/lib/docker/buildkit

# Restart Docker
sudo systemctl start docker

# Rebuild
docker compose build --no-cache
docker compose up -d
```

---

## 🐛 Troubleshooting

### Container Keeps Restarting

**Check logs:**

```bash
docker compose logs flowboard-api
```

**Common causes:**
1. Database connection failed
2. Port already in use
3. Environment variable missing
4. Build error

---

### Port Already in Use

**Check what's using port 80:**

```bash
sudo lsof -i :80
```

**Kill the process:**

```bash
sudo kill -9 <PID>
```

**Or stop the service:**

```bash
sudo systemctl stop nginx  # If nginx is running
sudo systemctl stop apache2  # If apache is running
```

---

### Database Connection Failed

**Check if MySQL is running:**

```bash
docker ps | grep mysql
```

**Check MySQL logs:**

```bash
docker logs flowboard-db
```

**Test database connection:**

```bash
docker exec -it flowboard-db mysql -u root -p
# Enter password from .env file
```

---

### Frontend Shows Blank Page

**Check browser console for errors (F12)**

**Check nginx logs:**

```bash
docker logs flowboard-ui
```

**Verify frontend environment variables:**

```bash
# Rebuild frontend
docker compose up -d --build flowboard-ui
```

---

### API Returns 404

**Check backend is running:**

```bash
docker ps | grep flowboard-api
```

**Test backend directly:**

```bash
curl http://localhost:5000/api/health
```

**Check CORS settings in .env:**

```bash
cat .env | grep CORS
```

---

### Cannot Access from Browser

**Verify Security Group:**
- Port 80 must be open to 0.0.0.0/0
- Port 5000 must be open to 0.0.0.0/0

**Check if containers are listening:**

```bash
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :5000
```

**Test from EC2 instance itself:**

```bash
curl http://localhost
curl http://localhost:5000/api/health
```

---

## 🔐 Security Best Practices

### 1. Change Default Passwords

Edit `.env`:

```bash
DB_PASSWORD=YourStrongPassword123!
JWT_SECRET=VeryLongRandomString123456789abcdefghijklmnop
```

### 2. Restrict Database Access

Update `docker-compose.yml` to not expose MySQL port externally:

```yaml
mysql:
  ports:
    # Comment out or remove this line:
    # - "3306:3306"
```

### 3. Use Environment-Specific Configs

Consider using `.env.production` and `.env.development` files.

### 4. Enable Firewall

```bash
# Install UFW
sudo apt install ufw

# Allow SSH
sudo ufw allow 22

# Allow HTTP
sudo ufw allow 80

# Allow backend
sudo ufw allow 5000

# Enable firewall
sudo ufw enable
```

---

## 📊 Monitoring Commands

### Check Disk Usage

```bash
docker system df
```

### Clean Up Unused Resources

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

**⚠️ WARNING:** This removes ALL unused Docker resources.

---

## 🔄 Update Deployment

### Pull Latest Code

```bash
cd ~/project-management-system
git pull origin main
```

### Rebuild and Restart

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 📝 Important Notes

### For Production Use:

1. **Use SSL/HTTPS:** For production, follow the SSL_SETUP_GUIDE.md
2. **Set up backups:** Regularly backup your database
3. **Monitor logs:** Set up log aggregation
4. **Use CI/CD:** Automate deployment with GitHub Actions
5. **Set resource limits:** Configure Docker resource constraints

### IP Address Changes:

If your EC2 IP changes (after stop/start):
1. Update `.env` file with new IP
2. Rebuild frontend: `docker compose up -d --build flowboard-ui`
3. Restart backend: `docker compose restart flowboard-api`

### Database Persistence:

Database data is stored in Docker volumes. To backup:

```bash
# Backup
docker exec flowboard-db mysqldump -u root -p project_management_db > backup.sql

# Restore
docker exec -i flowboard-db mysql -u root -p project_management_db < backup.sql
```

---

## 🎉 Success Checklist

- [ ] Docker installed and user added to docker group
- [ ] Repository cloned successfully
- [ ] `.env` file configured with correct IP
- [ ] All containers built successfully
- [ ] All containers running (healthy status)
- [ ] Frontend accessible at http://YOUR_EC2_PUBLIC_IP
- [ ] Backend health check returns `{"status":"ok"}`
- [ ] Can register and login to application
- [ ] No errors in container logs

---

## 📚 Additional Resources

### Docker Commands Cheatsheet

```bash
# View all containers (including stopped)
docker ps -a

# View images
docker images

# Remove container
docker rm <container_id>

# Remove image
docker rmi <image_id>

# View volumes
docker volume ls

# Inspect container
docker inspect <container_name>

# Execute command in container
docker exec -it <container_name> /bin/sh

# Copy files from container
docker cp <container>:<path> <local_path>

# View container resource usage
docker stats <container_name>
```

### Useful Aliases

Add to `~/.bashrc`:

```bash
# Docker compose shortcuts
alias dc='docker compose'
alias dcup='docker compose up -d'
alias dcdown='docker compose down'
alias dclogs='docker compose logs -f'
alias dcps='docker ps'

# Apply aliases
source ~/.bashrc
```

---

## 🆘 Getting Help

### View Application Logs

```bash
docker compose logs -f
```

### Check System Resources

```bash
# CPU and memory
free -h
df -h

# Docker resource usage
docker stats
```

### If Nothing Works

```bash
# Nuclear option - restart everything
docker compose down -v
docker system prune -a --volumes
docker compose build --no-cache
docker compose up -d
```

**⚠️ WARNING:** This deletes all data!

---

## 🎊 You're Done!

Your FlowBoard Project Management System is now deployed and running on EC2!

**Access your application:**
- **Frontend:** http://YOUR_EC2_PUBLIC_IP
- **Backend API:** http://YOUR_EC2_PUBLIC_IP:5000/api/health

**Next Steps:**
1. Create your first user account
2. Test all features
3. Set up SSL/HTTPS (see SSL_SETUP_GUIDE.md)
4. Configure regular backups
5. Set up monitoring and alerts

---

**Questions or Issues?**
Check the troubleshooting section or review container logs for specific error messages.
