# Deploy to OVH VPS - Complete Guide

## Your VPS Details
- **Hostname**: vps-6df1739c.vps.ovh.net
- **IP**: 51.195.46.40
- **IPv6**: 2001:41d0:701:1100::d20
- **OS**: Ubuntu 25.04
- **Resources**: 6 vCores, 12GB RAM, 100GB Storage

---

## Step 1: Initial VPS Setup

### 1.1 SSH into Your VPS
```bash
ssh root@51.195.46.40
```

If you don't have the root password, you can reset it from the OVH control panel.

### 1.2 Create a Non-Root User
```bash
# Create user
adduser deployer

# Add to sudo group
usermod -aG sudo deployer

# Switch to the new user
su - deployer
```

### 1.3 Install Required Software
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install npm and build tools
sudo apt install -y npm build-essential git

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install PostgreSQL (if you want local database)
sudo apt install -y postgresql postgresql-contrib

# Verify installations
node -v
npm -v
pm2 -v
nginx -v
```

---

## Step 2: Deploy Your Application

### 2.1 Clone Your Repository
```bash
cd /home/deployer
git clone <your-git-repo-url> ViralContentAnalyzer
cd ViralContentAnalyzer
```

### 2.2 Setup Backend

```bash
cd backend

# Install dependencies
npm install --production

# Create .env file
nano .env
```

Add your environment variables:
```env
PORT=3001
NODE_ENV=production

# Supabase
SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Frontend URL (update after domain setup)
FRONTEND_URL=http://51.195.46.40

# Google Drive Service Account (for scheduled sync)
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS={"type":"service_account",...}
GOOGLE_DRIVE_RAW_FOOTAGE_FOLDER_ID=1Ui0x45YRQVKbcrP6q074QpUFmq19e1Mo
GOOGLE_DRIVE_EDITED_VIDEO_FOLDER_ID=1sg77equgvOp1Ykuwx2S2KCA9J-y_thYD
GOOGLE_DRIVE_FINAL_VIDEO_FOLDER_ID=137Rftbg7yR5mGp2l6dYOjhjblK4TGfHc
```

Save and exit (Ctrl+X, Y, Enter)

```bash
# Start with PM2
pm2 start src/index.js --name viral-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 2.3 Setup Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env.production
nano .env.production
```

Add:
```env
VITE_SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_WS6oi184H9_qdaC0iCjF6A_UEC1gPyi
VITE_BACKEND_URL=http://51.195.46.40:3001
```

```bash
# Build for production
npm run build

# The build output will be in 'dist' folder
```

---

## Step 3: Configure Nginx

### 3.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/viral-app
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name 51.195.46.40 vps-6df1739c.vps.ovh.net;

    # Frontend
    location / {
        root /home/deployer/ViralContentAnalyzer/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
    }
}
```

### 3.2 Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/viral-app /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 4: Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS (for later when you add SSL)
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Step 5: Test Your Deployment

Visit in your browser:
- **Frontend**: http://51.195.46.40
- **Backend Health**: http://51.195.46.40/health

---

## Step 6: Add Domain Name (Optional but Recommended)

### 6.1 Get a Domain
You can use a free domain from:
- Freenom (free .tk, .ml, .ga domains)
- Or buy from Namecheap, GoDaddy, etc.

### 6.2 Point Domain to VPS
Add these DNS records:
```
Type: A
Name: @
Value: 51.195.46.40

Type: AAAA
Name: @
Value: 2001:41d0:701:1100::d20

Type: CNAME
Name: www
Value: yourdomain.com
```

### 6.3 Update Nginx for Domain
```bash
sudo nano /etc/nginx/sites-available/viral-app
```

Change `server_name` to:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 7: Add SSL Certificate (Free with Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal:
sudo certbot renew --dry-run
```

---

## Step 8: Scheduled Google Drive Sync

For syncing files to Google Drive every 3 months, we'll use **Supabase Storage** for immediate uploads, and create a sync script.

### 8.1 Create Sync Script

```bash
cd /home/deployer/ViralContentAnalyzer/backend
nano sync-to-drive.js
```

Add:
```javascript
// This script syncs files from Supabase Storage to Google Drive
// Run every 3 months via cron job

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
require('dotenv').config();

async function syncToDrive() {
  console.log('Starting sync to Google Drive...');

  // Initialize Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Initialize Google Drive
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // Get all files from Supabase Storage
  const { data: files, error } = await supabase.storage
    .from('production-files')
    .list();

  if (error) {
    console.error('Error listing files:', error);
    return;
  }

  console.log(`Found ${files.length} files to sync`);

  // Upload each file to Google Drive
  for (const file of files) {
    try {
      // Download from Supabase
      const { data: fileData } = await supabase.storage
        .from('production-files')
        .download(file.name);

      // Upload to Google Drive
      const response = await drive.files.create({
        requestBody: {
          name: file.name,
          parents: [process.env.GOOGLE_DRIVE_RAW_FOOTAGE_FOLDER_ID],
        },
        media: {
          mimeType: file.metadata?.mimetype || 'application/octet-stream',
          body: fileData,
        },
      });

      console.log(`✅ Synced: ${file.name}`);
    } catch (error) {
      console.error(`❌ Failed to sync ${file.name}:`, error.message);
    }
  }

  console.log('Sync complete!');
}

syncToDrive().catch(console.error);
```

### 8.2 Setup Cron Job (Every 3 Months)

```bash
# Edit crontab
crontab -e

# Add this line (runs on 1st day of every 3rd month at 2 AM)
0 2 1 */3 * cd /home/deployer/ViralContentAnalyzer/backend && node sync-to-drive.js >> /var/log/drive-sync.log 2>&1
```

---

## Step 9: Monitoring and Maintenance

### 9.1 View Logs
```bash
# Backend logs
pm2 logs viral-backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Sync logs
tail -f /var/log/drive-sync.log
```

### 9.2 Restart Services
```bash
# Restart backend
pm2 restart viral-backend

# Restart Nginx
sudo systemctl restart nginx

# View PM2 status
pm2 status
```

### 9.3 Update Application
```bash
cd /home/deployer/ViralContentAnalyzer
git pull
cd backend && npm install && pm2 restart viral-backend
cd ../frontend && npm install && npm run build
```

---

## Summary

✅ **Your app will be accessible at**: http://51.195.46.40
✅ **Files stored in**: Supabase Storage (100% reliable, no OAuth needed)
✅ **Google Drive backup**: Every 3 months automatically
✅ **Always running**: PM2 keeps backend alive
✅ **Production ready**: Nginx serving frontend + proxying backend

This is a much cleaner approach than dealing with OAuth popups!
