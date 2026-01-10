# Coolify Deployment Guide - Viral Content Analyzer

Complete guide to deploy the Viral Content Analyzer on your OVH VPS using Coolify.

---

## 🖥️ Your VPS Details

- **Host**: vps-6df1739c.vps.ovh.net
- **IPv4**: 51.195.46.40
- **IPv6**: 2001:41d0:701:1100::d20
- **OS**: Ubuntu 25.04
- **Location**: Frankfurt, Germany
- **Resources**: 6 vCores, 12 GB RAM, 100 GB Storage

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ SSH access to your VPS
- ✅ Domain name (optional but recommended)
- ✅ Supabase project credentials
- ✅ Google OAuth credentials
- ✅ Google API key for Drive

---

## Step 1: Initial VPS Setup

### 1.1 Connect to Your VPS

```bash
ssh root@51.195.46.40
# or
ssh root@vps-6df1739c.vps.ovh.net
```

### 1.2 Update System

```bash
apt update && apt upgrade -y
```

### 1.3 Create a Non-Root User (Recommended)

```bash
adduser coolify
usermod -aG sudo coolify
su - coolify
```

### 1.4 Set Up Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8000/tcp  # Coolify dashboard
sudo ufw enable
```

---

## Step 2: Install Coolify

### 2.1 Install Coolify with One Command

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

This will:
- Install Docker and Docker Compose
- Install Coolify
- Set up SSL certificates with Let's Encrypt
- Configure the Coolify dashboard

### 2.2 Access Coolify Dashboard

After installation completes, access Coolify at:
```
http://51.195.46.40:8000
```

Or if you've configured a domain:
```
https://coolify.yourdomain.com
```

### 2.3 Complete Initial Setup

1. Create your admin account
2. Set up your email for notifications
3. Configure your SSH keys

---

## Step 3: Configure Domain (Optional but Recommended)

### 3.1 Add DNS Records

In your domain registrar (e.g., Cloudflare, Namecheap), add:

**A Record:**
```
Type: A
Name: @ (or your subdomain)
Value: 51.195.46.40
TTL: Auto
```

**AAAA Record (IPv6):**
```
Type: AAAA
Name: @ (or your subdomain)
Value: 2001:41d0:701:1100::d20
TTL: Auto
```

**Example subdomains:**
- `app.yourdomain.com` - Main application
- `coolify.yourdomain.com` - Coolify dashboard

### 3.2 Wait for DNS Propagation

Check DNS propagation:
```bash
dig yourdomain.com
# or
nslookup yourdomain.com
```

---

## Step 4: Deploy Application in Coolify

### 4.1 Connect Git Repository

1. In Coolify dashboard, go to **Projects** → **New Project**
2. Name: `Viral Content Analyzer`
3. Click **Add Source** → **GitHub/GitLab/Gitea**
4. Choose your repository location

### 4.2 Configure Application

1. Click **New Resource** → **Docker Compose**
2. Select your repository
3. Branch: `main` (or your production branch)
4. Docker Compose File: `docker-compose.yml`

### 4.3 Set Environment Variables

In Coolify, go to your application → **Environment Variables** and add:

```env
VITE_SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-google-api-key
VITE_APP_URL=https://yourdomain.com
```

**Important**: Get these from:
- Supabase: Project Settings → API
- Google: Cloud Console → Credentials

### 4.4 Configure Domain in Coolify

1. Go to your application → **Domains**
2. Add your domain: `app.yourdomain.com`
3. Enable **HTTPS** (Let's Encrypt will auto-configure)
4. Enable **Force HTTPS** redirect

### 4.5 Deploy

1. Click **Deploy** button
2. Coolify will:
   - Pull your repository
   - Build Docker images
   - Start containers
   - Configure SSL certificates
   - Set up reverse proxy

Monitor the deployment logs in real-time.

---

## Step 5: Update Google OAuth Settings

After deployment, update your Google OAuth redirect URIs:

### 5.1 Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Add to **Authorized JavaScript origins**:
   ```
   https://yourdomain.com
   https://ckfbjsphyasborpnwbyy.supabase.co
   ```
4. Add to **Authorized redirect URIs**:
   ```
   https://ckfbjsphyasborpnwbyy.supabase.co/auth/v1/callback
   https://yourdomain.com/auth/callback
   ```

### 5.2 Supabase Configuration

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your production URL to **Site URL**:
   ```
   https://yourdomain.com
   ```
3. Add to **Redirect URLs**:
   ```
   https://yourdomain.com/**
   ```

---

## Step 6: Database Migration

Your Supabase database is already configured. Just verify:

### 6.1 Run File Approval System SQL

If you haven't already, run the SQL from `add-file-approval-system.sql`:

1. Open Supabase SQL Editor
2. Paste and run the SQL
3. Verify fields were added to `production_files` table

### 6.2 Verify RLS Policies

Check that Row Level Security policies are properly configured for production use.

---

## Step 7: Testing Production Deployment

### 7.1 Health Checks

1. Visit your domain: `https://yourdomain.com`
2. Check SSL certificate (should show green padlock)
3. Test login functionality
4. Verify Google OAuth works
5. Test file uploads to Google Drive

### 7.2 Performance Testing

```bash
# Check response time
curl -w "@-" -o /dev/null -s https://yourdomain.com <<'EOF'
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
      time_redirect:  %{time_redirect}\n
   time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
         time_total:  %{time_total}\n
EOF
```

---

## Step 8: Continuous Deployment

### 8.1 Enable Auto-Deploy

In Coolify:
1. Go to your application → **General**
2. Enable **Auto Deploy on Git Push**
3. Configure webhook in your Git repository

Now every push to `main` branch will automatically deploy!

### 8.2 Deployment Webhook (GitHub Example)

GitHub will automatically trigger deployments via webhook configured by Coolify.

---

## Step 9: Monitoring & Maintenance

### 9.1 View Application Logs

In Coolify:
- Application → **Logs** → View real-time logs
- Check for errors or warnings

### 9.2 Resource Monitoring

```bash
# On VPS, check resource usage
htop
# or
docker stats
```

### 9.3 Set Up Automated Backups

Your OVH VPS already has automated backups enabled (last backup: 9 January 2026).

For database backups:
- Supabase has automatic daily backups
- Export important data regularly

### 9.4 Update Application

```bash
# Pull latest changes
git pull origin main

# Redeploy in Coolify (or use auto-deploy)
```

---

## Step 10: Security Best Practices

### 10.1 SSL/TLS

✅ Coolify automatically configures Let's Encrypt SSL
✅ Force HTTPS redirect enabled

### 10.2 Environment Variables

- ✅ Never commit `.env` files to Git
- ✅ Use Coolify's environment variable management
- ✅ Rotate secrets regularly

### 10.3 Firewall

```bash
sudo ufw status
# Should show: 22, 80, 443, 8000 allowed
```

### 10.4 SSH Security

```bash
# Disable root login (optional)
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart ssh
```

### 10.5 Regular Updates

```bash
# Update system monthly
sudo apt update && sudo apt upgrade -y

# Update Docker
sudo apt update && sudo apt install docker-ce docker-ce-cli containerd.io
```

---

## Troubleshooting

### Application won't start

```bash
# Check Docker logs
docker ps -a
docker logs <container-id>

# Rebuild
cd /path/to/app
docker-compose down
docker-compose up --build -d
```

### SSL Certificate Issues

```bash
# In Coolify, regenerate certificate
# Or manually with certbot:
sudo certbot --nginx -d yourdomain.com
```

### Out of Memory

```bash
# Check memory
free -h

# Restart Docker
sudo systemctl restart docker
```

### Database Connection Issues

1. Verify Supabase credentials in environment variables
2. Check Supabase project status
3. Verify network connectivity from VPS to Supabase

---

## Useful Commands

### Docker Commands

```bash
# View running containers
docker ps

# View all containers
docker ps -a

# View logs
docker logs -f <container-name>

# Restart container
docker restart <container-name>

# Stop all containers
docker-compose down

# Start all containers
docker-compose up -d

# Rebuild and restart
docker-compose up --build -d
```

### Coolify CLI

```bash
# Check Coolify status
coolify status

# Update Coolify
coolify update

# Restart Coolify
coolify restart
```

### System Monitoring

```bash
# Disk usage
df -h

# Memory usage
free -h

# CPU and process monitoring
htop

# Network connections
netstat -tuln
```

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Internet                          │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              Cloudflare (Optional)                   │
│              - DDoS Protection                       │
│              - CDN                                   │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│          OVH VPS (51.195.46.40)                     │
│  ┌─────────────────────────────────────────────┐   │
│  │           Coolify (Port 8000)               │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │      Nginx Reverse Proxy (80, 443)          │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │   Docker Container: Frontend (React+Vite)   │   │
│  │   - Nginx serving static files              │   │
│  │   - Port 5173 → 80                          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              External Services                       │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │    Supabase      │  │  Google Drive    │         │
│  │   PostgreSQL     │  │   File Storage   │         │
│  │   Auth & API     │  │                  │         │
│  └──────────────────┘  └──────────────────┘         │
└─────────────────────────────────────────────────────┘
```

---

## Cost Optimization Tips

1. **Enable Cloudflare** (Free Plan):
   - CDN caching reduces VPS bandwidth
   - DDoS protection
   - Free SSL certificates

2. **Optimize Docker Images**:
   - Use multi-stage builds (already configured)
   - Clean up unused images: `docker system prune -a`

3. **Monitor Resources**:
   - Current VPS: 6 vCores, 12GB RAM is plenty
   - Scale down if consistently under 50% usage

4. **Supabase Free Tier**:
   - 500MB database (should be sufficient for now)
   - 1GB file storage
   - 50MB file uploads

---

## Next Steps After Deployment

1. ✅ Set up monitoring alerts in Coolify
2. ✅ Configure backup strategy
3. ✅ Add custom domain
4. ✅ Enable Cloudflare (optional)
5. ✅ Set up staging environment
6. ✅ Configure CI/CD pipeline
7. ✅ Add uptime monitoring (e.g., UptimeRobot)

---

## Support & Resources

### Coolify Documentation
- Docs: https://coolify.io/docs
- Discord: https://discord.gg/coolify

### OVH Support
- Documentation: https://docs.ovh.com/
- Support: https://www.ovh.com/manager/

### Application Stack
- Supabase Docs: https://supabase.com/docs
- React Docs: https://react.dev
- Vite Docs: https://vitejs.dev

---

## Summary Checklist

Before going live:

- [ ] VPS configured and secured
- [ ] Coolify installed and running
- [ ] Domain DNS configured
- [ ] Application deployed in Coolify
- [ ] Environment variables set
- [ ] SSL certificates active
- [ ] Google OAuth configured for production domain
- [ ] Supabase URL configuration updated
- [ ] Database migrations run
- [ ] Application tested end-to-end
- [ ] Monitoring and alerts configured
- [ ] Backup strategy in place

---

**🎉 You're ready to deploy!**

Your Viral Content Analyzer will be live at `https://yourdomain.com` with automatic deployments, SSL, and production-ready infrastructure.
