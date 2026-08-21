#!/usr/bin/env bash
# =============================================================================
# TomoDine — EC2 Ubuntu Server Setup Script
# Run this ONCE on a fresh Ubuntu 22.04/24.04 EC2 instance as root.
# =============================================================================
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain-or-ip>}"
APP_DIR="/opt/tomodine"
LOG_DIR="/var/log/tomodine"

echo "============================================"
echo " TomoDine server setup — $DOMAIN"
echo "============================================"

# ------------------------------------------------------------------ 1. System
echo "[1/9] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y python3 python3-pip python3-venv python3-dev \
    build-essential libpq-dev nginx certbot python3-certbot-nginx \
    redis-server git curl

# ------------------------------------------------------------------ 2. User
echo "[2/9] Creating tomodine system user..."
id -u tomodine &>/dev/null || useradd --system --shell /usr/sbin/nologin --create-home tomodine

# ------------------------------------------------------------------ 3. Directories
echo "[3/9] Creating directories..."
mkdir -p "$APP_DIR/backend" "$APP_DIR/frontend" "$LOG_DIR"
chown -R tomodine:tomodine "$APP_DIR" "$LOG_DIR"

# ------------------------------------------------------------------ 4. Redis
echo "[4/9] Enabling Redis..."
systemctl enable redis-server
systemctl start redis-server
redis-cli ping

# ------------------------------------------------------------------ 5. Clone
echo "[5/9] Cloning repo..."
if [ ! -d "$APP_DIR/backend/manage.py" ]; then
    # Ask user to clone or copy their repo here
    echo "  → Copy your project to $APP_DIR/"
    echo "    Example: scp -r . tomodine@$DOMAIN:/opt/tomodine/"
    echo "  Or:  git clone https://github.com/YOU/tomodine.git $APP_DIR"
fi

# ------------------------------------------------------------------ 6. Python venv + deps
echo "[6/9] Setting up Python virtual environment..."
python3 -m venv "$APP_DIR/backend/venv"
"$APP_DIR/backend/venv/bin/pip" install --upgrade pip
if [ -f "$APP_DIR/backend/requirements.txt" ]; then
    "$APP_DIR/backend/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"
fi

# ------------------------------------------------------------------ 7. Django init
echo "[7/9] Running Django migrations & seed..."
cd "$APP_DIR/backend"
if [ -f ".env" ]; then
    set -a; source .env; set +a
fi
"$APP_DIR/backend/venv/bin/python" manage.py migrate --noinput
"$APP_DIR/backend/venv/bin/python" manage.py seed
"$APP_DIR/backend/venv/bin/python" manage.py collectstatic --noinput

# ------------------------------------------------------------------ 8. Frontend build
echo "[8/9] Building frontend..."
if [ -f "$APP_DIR/frontend/package.json" ]; then
    cd "$APP_DIR/frontend"
    npm install
    npm run build
fi

# ------------------------------------------------------------------ 9. Services
echo "[9/9] Installing systemd services..."

# Gunicorn (HTTP)
cp "$APP_DIR/deploy/tomodine-gunicorn.service" /etc/systemd/system/
# Daphne (WebSocket)
cp "$APP_DIR/deploy/tomodine-daphne.service" /etc/systemd/system/
# Celery (async tasks — optional)
cp "$APP_DIR/deploy/tomodine-celery.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable tomodine-gunicorn tomodine-daphne tomodine-celery
systemctl start tomodine-gunicorn tomodine-daphne tomodine-celery

# Nginx
cp "$APP_DIR/deploy/nginx-tomodine.conf" /etc/nginx/sites-available/tomodine
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/tomodine
sed -i "s/YOUR_EC2_PUBLIC_IP/$DOMAIN/g" /etc/nginx/sites-available/tomodine
ln -sf /etc/nginx/sites-available/tomodine /etc/nginx/sites-enabled/tomodine
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "============================================"
echo " Setup complete!"
echo ""
echo " Services:"
echo "   systemctl status tomodine-gunicorn"
echo "   systemctl status tomodine-daphne"
echo "   systemctl status tomodine-celery"
echo ""
echo " Next steps:"
echo "   1. Edit /opt/tomodine/backend/.env with real values"
echo "   2. Run: sudo certbot --nginx -d $DOMAIN"
echo "   3. Visit https://$DOMAIN"
echo "============================================"
