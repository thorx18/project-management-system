lowBoard – EC2 Production Deployment Script
🏗 Infrastructure Overview

Frontend: React + Vite (served via Nginx) → Port 80

Backend: Node.js + Express → Port 5000

Database: MySQL 8 → Port 3306

Containerization: Docker + Docker Compose

Hosting: AWS EC2 (Ubuntu)

🔐 1. Launch EC2 Instance

Recommended:

OS: Ubuntu 22.04 / 24.04

Instance Type: t3.medium (recommended) or t2.micro

Security Group Inbound Rules:

22 → SSH

80 → HTTP

5000 → API

🔗 2. Connect to EC2
ssh ubuntu@YOUR_EC2_PUBLIC_IP

🐳 3. Install Docker & Docker Compose
sudo apt update -y
sudo apt install -y docker.io docker-compose-plugin

sudo systemctl enable docker
sudo systemctl start docker

sudo usermod -aG docker ubuntu


Reconnect SSH:

exit
ssh ubuntu@YOUR_EC2_PUBLIC_IP


Verify installation:

docker --version
docker compose version

📦 4. Clone Repository
git clone https://github.com/YOUR_USERNAME/project-management-system.git
cd project-management-system

⚙️ 5. Configure Environment Variables

Edit docker-compose configuration:

nano docker-compose.yml


Update the following values using your EC2 public IP:

CORS_ORIGIN: http://YOUR_EC2_PUBLIC_IP
VITE_API_URL: http://YOUR_EC2_PUBLIC_IP:5000/api
VITE_BACKEND_URL: http://YOUR_EC2_PUBLIC_IP:5000


Example:

CORS_ORIGIN: http://3.110.228.200
VITE_API_URL: http://3.110.228.200:5000/api
VITE_BACKEND_URL: http://3.110.228.200:5000


Save and exit.

🏗 6. Build Application
docker compose build --no-cache

▶️ 7. Start Application
docker compose up -d

🔍 8. Verify Running Containers
docker ps


Expected output:

flowboard-ui → Port 80

flowboard-api → Port 5000

flowboard-db → Port 3306

All containers should show Up (healthy).

🌐 9. Access Application

Frontend:

http://YOUR_EC2_PUBLIC_IP


Backend health check:

http://YOUR_EC2_PUBLIC_IP:5000/api/health


Expected response:

{"status":"ok"}

🔄 Restart Application
docker compose down
docker compose up -d

🧹 Stop Application
docker compose down

🚨 Emergency Docker Fix (If Build Fails)

If you see snapshot or extraction errors:

sudo systemctl stop docker.service
sudo systemctl stop docker.socket
sudo rm -rf /var/lib/docker/buildkit
sudo systemctl start docker

docker compose build --no-cache
docker compose up -d
