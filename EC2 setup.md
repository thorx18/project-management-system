# 🚀 Docker Deployment Guide

Complete guide for deploying the Project Management System on EC2 using Docker and Docker Compose.

---

## 📋 Prerequisites

- EC2 instance running Ubuntu
- SSH access to the instance
- Security group configured with ports: 22 (SSH), 80 (HTTP), 5000 (Backend), 3306 (MySQL)

---

## 🐳 1. Install Docker & Docker Compose

```bash
sudo apt update -y
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu
```

---

## 🔄 2. Reconnect SSH

After adding user to docker group, reconnect:

```bash
exit
ssh ubuntu@YOUR_EC2_PUBLIC_IP
```

---

## ✅ 3. Verify Installation

```bash
docker --version
docker compose version
```

---

## 📦 4. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/project-management-system.git
cd project-management-system
```

---

## ⚙️ 5. Configure Environment Variables

Edit Docker Compose file:

```bash
nano docker-compose.yml
```

Update the following values using your EC2 public IP:

- `CORS_ORIGIN: http://YOUR_EC2_PUBLIC_IP`
- `VITE_API_URL: http://YOUR_EC2_PUBLIC_IP:5000/api`
- `VITE_BACKEND_URL: http://YOUR_EC2_PUBLIC_IP:5000`

### Example:

```yaml
CORS_ORIGIN: http://3.110.228.200
VITE_API_URL: http://3.110.228.200:5000/api
VITE_BACKEND_URL: http://3.110.228.200:5000
```

Save and exit (`Ctrl+X`, then `Y`, then `Enter`).

---

## 🏗 6. Build Application

```bash
docker compose build --no-cache
```

---

## ▶️ 7. Start Application

```bash
docker compose up -d
```

---

## 🔍 8. Verify Running Containers

```bash
docker ps
```

### Expected Containers:

| Container | Port | Status |
|-----------|------|--------|
| flowboard-ui | 80 | Up (healthy) |
| flowboard-api | 5000 | Up (healthy) |
| flowboard-db | 3306 | Up (healthy) |

---

## 🌐 9. Access Application

### Frontend
```
http://YOUR_EC2_PUBLIC_IP
```

### Backend Health Check
```
http://YOUR_EC2_PUBLIC_IP:5000/api/health
```

**Expected response:**
```json
{"status":"ok"}
```

---

## 🔧 Common Commands

### Restart Application
```bash
docker compose down
docker compose up -d
```

### Stop Application
```bash
docker compose down
```

### View Logs
```bash
docker compose logs -f
```

### View Specific Container Logs
```bash
docker compose logs -f flowboard-api
docker compose logs -f flowboard-ui
docker compose logs -f flowboard-db
```

---

## 🚨 Emergency Docker Fix

If you encounter snapshot or extraction errors during build:

```bash
sudo systemctl stop docker.service
sudo systemctl stop docker.socket
sudo rm -rf /var/lib/docker/buildkit
sudo systemctl start docker
docker compose build --no-cache
docker compose up -d
```

---

## 🐛 Troubleshooting

### Container Not Starting
```bash
docker compose logs [container-name]
```

### Check Container Health
```bash
docker inspect --format='{{.State.Health.Status}}' [container-name]
```

### Rebuild Single Service
```bash
docker compose up -d --build [service-name]
```

### Remove All Containers and Volumes
```bash
docker compose down -v
```

---

## 📝 Notes

- Always use your actual EC2 public IP address in place of `YOUR_EC2_PUBLIC_IP`
- Ensure security groups allow traffic on required ports
- First build may take several minutes
- Use `docker compose logs -f` to monitor application startup

---

## 🎉 Success!

Your application should now be running and accessible via your EC2 public IP address.
