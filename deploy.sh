#!/bin/bash
# ══════════════════════════════════════════════
# FlowBoard — One-command EC2 setup script
# Run this on a fresh Ubuntu EC2 instance
# ══════════════════════════════════════════════

set -e

echo "🚀 FlowBoard EC2 Setup"
echo "======================"

# ─── Verify .env file exists ───
if [ ! -f .env ]; then
    echo ""
    echo "❌ ERROR: .env file not found!"
    echo ""
    echo "   Before deploying, create your .env file:"
    echo "   1. cp .env.example .env"
    echo "   2. Edit .env with your actual values (IP, passwords, Agora keys, etc.)"
    echo ""
    exit 1
fi

echo "✅ .env file found"

# ─── Validate critical variables ───
source .env 2>/dev/null || true

MISSING=""
[ -z "$DB_PASSWORD" ] && MISSING="$MISSING DB_PASSWORD"
[ -z "$JWT_SECRET" ] && MISSING="$MISSING JWT_SECRET"
[ -z "$VITE_API_URL" ] && MISSING="$MISSING VITE_API_URL"
[ -z "$VITE_BACKEND_URL" ] && MISSING="$MISSING VITE_BACKEND_URL"

if [ -n "$MISSING" ]; then
    echo ""
    echo "⚠️  WARNING: The following critical variables are empty in .env:"
    echo "   $MISSING"
    echo "   The app may not work correctly without them."
    echo ""
    read -p "   Continue anyway? (y/N) " -n 1 -r
    echo ""
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

echo "✅ Environment variables validated"

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed"
fi

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-compose-plugin
    echo "✅ Docker Compose installed"
fi

# Build and start
echo ""
echo "🔨 Building and starting services..."
echo "  This may take 3-5 minutes on first run."
echo ""

sudo docker compose down 2>/dev/null || true
sudo docker compose up -d --build

echo ""
echo "⏳ Waiting for MySQL to initialize (30s)..."
sleep 30

echo ""
echo "📊 Service Status:"
sudo docker compose ps

# Try to get the server IP from .env or AWS metadata
SERVER_IP=${SERVER_IP:-$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'YOUR_IP')}

echo ""
echo "════════════════════════════════════════"
echo "✅ FlowBoard is running!"
echo ""
echo "🌐 Frontend: http://${SERVER_IP}"
echo "🔌 Backend:  http://${SERVER_IP}:${BACKEND_PORT:-5000}"
echo ""
echo "📝 View logs:    sudo docker compose logs -f"
echo "🔄 Restart:      sudo docker compose restart"
echo "🛑 Stop:         sudo docker compose down"
echo "⚙️  Edit config:  nano .env && sudo docker compose up -d --build"
echo "════════════════════════════════════════"
