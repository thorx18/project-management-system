# 🚀 FlowBoard — AWS EC2 Deployment Guide

## Prerequisites
- AWS EC2 instance (Ubuntu 22.04 recommended, t2.medium or larger)
- SSH access to the instance
- Domain name (optional, can use EC2 public IP)

---

## Step 1: Launch EC2 Instance

1. Go to AWS Console → EC2 → **Launch Instance**
2. Choose **Ubuntu Server 22.04 LTS**
3. Instance type: **t2.medium** (2 vCPU, 4GB RAM) minimum
4. **Security Group** — open these ports:
   | Port  | Protocol | Source    | Purpose           |
   |-------|----------|-----------|-------------------|
   | 22    | TCP      | Your IP   | SSH               |
   | 80    | TCP      | 0.0.0.0/0 | Frontend (HTTP)   |
   | 5000  | TCP      | 0.0.0.0/0 | Backend API       |
   | 443   | TCP      | 0.0.0.0/0 | HTTPS (optional)  |
5. Launch and download the key pair (.pem file)

---

## Step 2: Connect & Install Docker

```bash
# SSH into your EC2
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Re-login for group changes
exit
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# Verify
docker --version
docker compose version
```

---

## Step 3: Upload Project to EC2

**Option A: Clone from Git** (recommended)
```bash
git clone YOUR_REPO_URL
cd project-management-system
```

**Option B: Upload via SCP**
```bash
# From your local machine:
scp -i your-key.pem -r ./project-management-system ubuntu@YOUR_EC2_PUBLIC_IP:~/
```

---

## Step 4: Configure Environment

```bash
cd project-management-system

# Create .env from template
cp .env.example .env

# Edit with your EC2 public IP
nano .env
```

**Replace ALL occurrences of `YOUR_EC2_PUBLIC_IP` with your actual EC2 public IP:**

```env
CORS_ORIGIN=http://13.233.XXX.XXX
VITE_API_URL=http://13.233.XXX.XXX:5000/api
VITE_BACKEND_URL=http://13.233.XXX.XXX:5000
```

Also update these if needed:
- `DB_PASSWORD` — set a strong database password
- `JWT_SECRET` — set a random secret string
- `AGORA_APP_ID` — your Agora App ID
- `AGORA_APP_CERTIFICATE` — your Agora App Certificate

---

## Step 5: Deploy! 🚀

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f

# If you need to see individual service logs:
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mysql
```

---

## Step 6: Verify

Open your browser and go to:
```
http://YOUR_EC2_PUBLIC_IP
```

You should see the FlowBoard login page! 🎉

---

## ⚠️ Important Notes

### Video Calls & HTTPS
- **Camera/mic access requires HTTPS** on non-localhost origins (Chrome requirement)
- Agora handles the actual video streaming, so the call itself will work
- But the browser needs a secure context to access `getUserMedia()`
- **Quick fix**: Use Firefox, which is more lenient about HTTP + camera
- **Proper fix**: Set up SSL with Let's Encrypt (see below)

### Setting Up HTTPS (Recommended for Video Calls)

```bash
# Install Certbot
sudo apt install certbot -y

# You need a domain name pointing to your EC2 IP
# Then get a certificate:
sudo certbot certonly --standalone -d yourdomain.com

# Update your .env to use HTTPS URLs
# Then rebuild: docker compose up -d --build
```

---

## Common Commands

```bash
# Stop all services
docker compose down

# Restart all services
docker compose restart

# Rebuild after code changes
docker compose up -d --build

# Reset database (⚠️ deletes all data)
docker compose down -v
docker compose up -d --build

# View real-time logs
docker compose logs -f

# Check if MySQL is ready
docker compose exec mysql mysqladmin -u root -p ping
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Frontend can't reach backend | Check `CORS_ORIGIN`, `VITE_API_URL`, `VITE_BACKEND_URL` in `.env` match your EC2 IP |
| Database connection refused | Wait 30s for MySQL to initialize, then check `docker compose logs mysql` |
| Video call fails | Ensure port 5000 is open in EC2 security group, and Agora credentials are correct |
| "Refused to connect" | Check EC2 security group allows port 80 and 5000 from `0.0.0.0/0` |
| Black screen on video | Use Firefox or set up HTTPS for camera access |
