# TomoDine — AWS EC2 Deployment Guide

Complete step-by-step guide to deploy TomoDine on an Ubuntu EC2 instance
with Redis, S3, Nginx, SSL, and systemd.

---

## Architecture

```
Internet
   │
   ▼
┌──────────────────────────┐
│   Nginx (port 80/443)    │  SSL termination, static files, reverse proxy
│   ├── /api/  ──────────► │  Gunicorn (port 8000)  — Django HTTP
│   ├── /api/ws/ ────────► │  Daphne   (port 8001)  — Django WebSockets
│   ├── /static/ ────────► │  WhiteNoise static files
│   └── /* ──────────────► │  React SPA (frontend/dist)
└──────────────────────────┘
   │           │
   ▼           ▼
┌──────┐  ┌──────────┐
│Redis │  │ PostgreSQL│  (Neon or local)
└──────┘  └──────────┘
   │
   ▼
┌──────────┐
│ AWS S3   │  Media files (dish images, logos)
└──────────┘
```

---

## Prerequisites

- AWS EC2 instance (Ubuntu 22.04 or 24.04, t3.small or larger)
- AWS S3 bucket created
- A domain name pointed to the EC2 public IP (A record)
- SSH access to the instance
- Neon PostgreSQL connection string (or local Postgres)

---

## Step 1 — Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Settings:
   - **Name**: `tomodine-prod`
   - **AMI**: Ubuntu Server 22.04 LTS (or 24.04)
   - **Instance type**: `t3.small` (2 vCPU, 2 GB RAM) minimum
   - **Key pair**: Create or select an existing `.pem` key
   - **Storage**: 20 GB gp3
3. **Security Group** — create with these inbound rules:

   | Type    | Port | Source    | Purpose         |
   |---------|------|-----------|-----------------|
   | SSH     | 22   | Your IP   | Admin access    |
   | HTTP    | 80   | 0.0.0.0/0 | Web traffic     |
   | HTTPS   | 443  | 0.0.0.0/0 | Secure traffic  |

4. Launch the instance and note the **Public IPv4 address**

---

## Step 2 — Configure AWS S3 Bucket

### 2a. Disable Block Public Access (DO THIS FIRST)

Go to **S3 → your bucket → Permissions → Block Public Access → Edit**:
- **Uncheck ALL boxes** (especially "Block all public access")
- Click **Save changes**
- Type `confirm` in the confirmation dialog and click **Confirm**

> ⚠️ You MUST do this before setting the bucket policy, otherwise AWS will reject the policy.

### 2b. Bucket Policy

Now go to **S3 → your bucket → Permissions → Bucket Policy → Edit** and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

Click **Save changes**.

### 2c. CORS Configuration

Go to **S3 → your bucket → Permissions → Cross-origin resource sharing (CORS) → Edit** and paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://www.tomodine.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Click **Save changes**.

### 2d. Create IAM User (if you don't have one)

1. Go to **IAM → Users → Create User**
   - Username: `tomodine-s3`
   - Attach policy directly → **AmazonS3FullAccess** (or create a scoped policy)
2. Go to **Security credentials → Create Access Key**
   - Choose "Application running on AWS service"
   - Save the **Access Key ID** and **Secret Access Key**

---

## Step 3 — SSH into EC2 and Prepare

```bash
# SSH into your instance
ssh -i your-key.pem ubuntu@13.212.121.201

# Update system
sudo apt update && sudo apt upgrade -y

# Install essentials (including image libraries for Pillow)
sudo apt install -y python3 python3-pip python3-venv python3-dev \
    build-essential libpq-dev libjpeg-dev zlib1g-dev libfreetype-dev \
    libwebp-dev nginx certbot python3-certbot-nginx redis-server git curl
```

---

## Step 4 — Create System User and Directories

```bash
# Create dedicated user
sudo useradd --system --shell /usr/sbin/nologin --create-home tomodine

# Create app directories
sudo mkdir -p /opt/tomodine/{backend,frontend,deploy}
sudo mkdir -p /var/log/tomodine

# Set ownership
sudo chown -R tomodine:tomodine /opt/tomodine /var/log/tomodine
```

---

## Step 5 — Upload Your Code via GitHub

### 5a. Push your code to GitHub (if not already)

**From your local machine:**

```bash
cd c:\Users\Ir. Nickson\Documents\GitHub\tomodine

# Initialize git if needed
git init
git add .
git commit -m "Initial commit — ready for EC2 deployment"

# Add your GitHub remote and push the aws-deploy branch
git remote add origin https://github.com/NickZeroCode/tomodine.git
git checkout -b aws-deploy
git push -u origin aws-deploy
```

### 5b. Clone on the EC2 server

**SSH into the server:**

```bash
ssh -i your-key.pem ubuntu@13.212.121.201

# Remove the empty directory created by the setup script (if it exists)
sudo rm -rf /opt/tomodine

# Clone the repo into /opt/tomodine (aws-deploy branch)
sudo git clone -b aws-deploy https://github.com/NickZeroCode/tomodine.git /opt/tomodine

# Fix ownership
sudo chown -R tomodine:tomodine /opt/tomodine
```

### 5c. Future updates

When you make changes locally, push to GitHub then pull on the server:

```bash
# Local machine
git checkout aws-deploy
git add .
git commit -m "Your change description"
git push

# On the server
cd /opt/tomodine
sudo -u tomodine git pull origin aws-deploy

# Then restart services (see Common Operations below)
```

> ⚠️ **Never commit `.env` to GitHub.** It contains secrets. The `.gitignore` already excludes it. Always create `.env` manually on the server (Step 6).

---

## Step 6 — Configure Environment Variables

```bash
sudo nano /opt/tomodine/backend/.env
```

Paste and fill in (see `deploy/env.production` for template):

```env
DJANGO_SECRET_KEY='your-random-50-char-secret-key-here'
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=13.212.121.201,www.tomodine.com

DATABASE_URL='postgresql://neondb_owner:YOUR_PASSWORD@YOUR_NEON_HOST/neondb?sslmode=require'

REDIS_URL=redis://localhost:6379/0
USE_REDIS_CHANNEL_LAYER=true

CORS_ALLOWED_ORIGINS=https://www.tomodine.com
CSRF_TRUSTED_ORIGINS=https://www.tomodine.com

AWS_ACCESS_KEY_ID=YOUR_S3_ACCESS_KEY
AWS_SECRET_ACCESS_KEY='YOUR_S3_SECRET_KEY'
AWS_STORAGE_BUCKET_NAME=YOUR_BUCKET_NAME
AWS_S3_REGION_NAME=YOUR_REGION

JWT_ACCESS_MINUTES=30
JWT_REFRESH_DAYS=7
CUSTOMER_APP_BASE_URL=https://www.tomodine.com/order
```

> ⚠️ Wrap values containing special characters (`)`, `(`, `$`, `!`, `*`, `#`) in single quotes `'like this'` to prevent bash interpretation errors.

```bash
# Secure the file
sudo chown tomodine:tomodine /opt/tomodine/backend/.env
sudo chmod 600 /opt/tomodine/backend/.env
```

---

## Step 7 — Set Up Python Environment

```bash
cd /opt/tomodine/backend

# Create virtual environment
sudo -u tomodine python3 -m venv venv

# Install dependencies
sudo -u tomodine ./venv/bin/pip install --upgrade pip
sudo -u tomodine ./venv/bin/pip install -r requirements.txt

# Load env and run Django setup
set -a; source .env; set +a

sudo -u tomodine ./venv/bin/python manage.py migrate --noinput
sudo -u tomodine ./venv/bin/python manage.py seed
sudo -u tomodine ./venv/bin/python manage.py collectstatic --noinput

# Create superuser
sudo -u tomodine ./venv/bin/python manage.py createsuperuser
```

---

## Step 8 — Build Frontend

```bash
cd /opt/tomodine/frontend

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Build
sudo -u tomodine npm install
sudo -u tomodine npm run build
```

---

## Step 9 — Configure Redis

```bash
# Redis should already be running from the apt install
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify
redis-cli ping
# Expected: PONG

# Optional: configure Redis for production
sudo nano /etc/redis/redis.conf
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru
# Then: sudo systemctl restart redis-server
```

---

## Step 10 — Install Systemd Services

```bash
# Copy service files
sudo cp /opt/tomodine/deploy/tomodine-gunicorn.service /etc/systemd/system/
sudo cp /opt/tomodine/deploy/tomodine-daphne.service /etc/systemd/system/
sudo cp /opt/tomodine/deploy/tomodine-celery.service /etc/systemd/system/

# Reload and enable
sudo systemctl daemon-reload
sudo systemctl enable tomodine-gunicorn tomodine-daphne tomodine-celery

# Start services
sudo systemctl start tomodine-gunicorn
sudo systemctl start tomodine-daphne
sudo systemctl start tomodine-celery

# Check status
sudo systemctl status tomodine-gunicorn
sudo systemctl status tomodine-daphne
sudo systemctl status tomodine-celery
```

### Verify services are listening:

```bash
ss -tlnp | grep -E '8000|8001'
# Should show Gunicorn on 8000, Daphne on 8001
```

---

## Step 11 — Configure Nginx

```bash
# Copy Nginx config
sudo cp /opt/tomodine/deploy/nginx-tomodine.conf /etc/nginx/sites-available/tomodine

# Replace placeholders with your actual domain and IP
sudo sed -i "s/YOUR_DOMAIN/www.tomodine.com/g" /etc/nginx/sites-available/tomodine
sudo sed -i "s/YOUR_EC2_PUBLIC_IP/13.212.121.201/g" /etc/nginx/sites-available/tomodine

# Enable site
sudo ln -sf /etc/nginx/sites-available/tomodine /etc/nginx/sites-enabled/tomodine
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 12 — SSL Certificate (Let's Encrypt)

```bash
# Get certificate (replace www.tomodine.com)
sudo certbot --nginx -d www.tomodine.com

# Auto-renew is set up automatically, verify:
sudo certbot renew --dry-run
```

After certbot runs, the Nginx config will have SSL configured automatically.

---

## Step 13 — Verify Everything

```bash
# Test API
curl https://www.tomodine.com/api/v1/subscription-plans/

# Test WebSocket (install wscat: npm i -g wscat)
wscat -c "wss://www.tomodine.com/api/ws/restaurants/SLUG/events/?token=JWT"

# Check logs
sudo journalctl -u tomodine-gunicorn -f
sudo journalctl -u tomodine-daphne -f
sudo journalctl -u tomodine-celery -f

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## Step 14 — Update Frontend Environment

Update `frontend/.env.production` (or set in CI):

```env
VITE_API_BASE_URL=https://www.tomodine.com
VITE_WS_BASE_URL=wss://www.tomodine.com
```

Then rebuild the frontend:

```bash
cd /opt/tomodine/frontend
sudo -u tomodine npm run build
```

---

## Common Operations

### Restart all services after code update:

```bash
cd /opt/tomodine/backend
set -a; source .env; set +a
sudo -u tomodine ./venv/bin/python manage.py migrate --noinput
sudo -u tomodine ./venv/bin/python manage.py collectstatic --noinput
sudo systemctl restart tomodine-gunicorn tomodine-daphne tomodine-celery
sudo systemctl reload nginx
```

### View logs:

```bash
sudo journalctl -u tomodine-gunicorn -n 50 --no-pager
sudo journalctl -u tomodine-daphne -n 50 --no-pager
sudo tail -f /var/log/tomodine/gunicorn-error.log
```

### Update code from Git:

```bash
cd /opt/tomodine
sudo -u tomodine git pull origin aws-deploy
cd backend
set -a; source .env; set +a
sudo -u tomodine ./venv/bin/pip install -r requirements.txt
sudo -u tomodine ./venv/bin/python manage.py migrate --noinput
sudo -u tomodine ./venv/bin/python manage.py collectstatic --noinput
sudo systemctl restart tomodine-gunicorn tomodine-daphne tomodine-celery
```

### Check S3 connectivity:

```bash
cd /opt/tomodine/backend
set -a; source .env; set +a
sudo -u tomodine ./venv/bin/python -c "
import boto3
s3 = boto3.client('s3')
buckets = s3.list_buckets()['Buckets']
for b in buckets:
    print(b['Name'])
"
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 502 Bad Gateway | `systemctl status tomodine-gunicorn` — is it running? |
| WebSocket 404 | `systemctl status tomodine-daphne` — is Daphne running? Nginx proxy_pass correct? |
| Images not loading | S3 bucket policy allows public read? CORS configured? |
| Static files 404 | `manage.py collectstatic` ran? Nginx alias path correct? |
| Database errors | `DATABASE_URL` correct in `.env`? Neon DB accessible from EC2 IP? |
| Redis errors | `systemctl status redis-server`? `redis-cli ping`? |
