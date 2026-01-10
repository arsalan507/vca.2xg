# Quick Start - Deploy in 15 Minutes

Fast track deployment guide for your OVH VPS.

---

## 1️⃣ Connect to VPS

```bash
ssh root@51.195.46.40
# Password: [Your OVH password]
```

---

## 2️⃣ Run Setup Script

```bash
# Download setup script
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/setup-vps.sh | bash

# Or if you have the file locally:
scp setup-vps.sh root@51.195.46.40:/root/
ssh root@51.195.46.40
chmod +x setup-vps.sh
./setup-vps.sh
```

This installs:
- ✅ Docker
- ✅ Coolify
- ✅ Firewall configuration
- ✅ System updates

---

## 3️⃣ Access Coolify

Open in browser:
```
http://51.195.46.40:8000
```

Create your admin account.

---

## 4️⃣ Deploy Application

### In Coolify Dashboard:

1. **Create New Project**
   - Name: Viral Content Analyzer

2. **Add Git Source**
   - Connect your GitHub/GitLab repo
   - Branch: `main`

3. **New Resource → Docker Compose**
   - Select repository
   - Docker Compose file: `docker-compose.yml`

4. **Environment Variables**
   Add these in Coolify:
   ```
   VITE_SUPABASE_URL=https://ckfbjsphyasborpnwbyy.supabase.co
   VITE_SUPABASE_ANON_KEY=[Your Key]
   VITE_GOOGLE_CLIENT_ID=[Your Client ID]
   VITE_GOOGLE_API_KEY=[Your API Key]
   ```

5. **Add Domain** (Optional)
   - Domain: `yourdomain.com`
   - Enable HTTPS
   - Force HTTPS redirect

6. **Click Deploy** 🚀

---

## 5️⃣ Update Google OAuth

### Google Cloud Console

Add to Authorized Origins:
```
https://yourdomain.com
```

Add to Redirect URIs:
```
https://ckfbjsphyasborpnwbyy.supabase.co/auth/v1/callback
```

---

## 6️⃣ Test Application

Visit: `https://yourdomain.com`

Test:
- ✅ Login works
- ✅ File upload works
- ✅ Admin dashboard accessible

---

## 🎉 Done!

Your application is live with:
- ✅ Auto SSL/HTTPS
- ✅ Auto-deploy on git push
- ✅ Production-ready infrastructure

---

## Quick Commands

```bash
# View logs
docker logs -f <container-id>

# Restart application
docker-compose restart

# Update application
git pull && docker-compose up --build -d

# Check resources
htop
docker stats
```

---

## Need Help?

See [COOLIFY_DEPLOYMENT_GUIDE.md](COOLIFY_DEPLOYMENT_GUIDE.md) for detailed instructions.
