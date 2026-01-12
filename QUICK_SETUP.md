# Quick Setup - Google OAuth Upload

## 🚀 3 Steps to Get Started

### Step 1: Get Google OAuth Client ID (5 minutes)

1. **Go to**: https://console.cloud.google.com/apis/credentials
2. **Click**: "Create Credentials" → "OAuth client ID"
3. **Configure**:
   - Type: Web application
   - JavaScript origins: `http://localhost:5174`
   - Redirect URIs: `http://localhost:5174`
4. **Copy** the Client ID

### Step 2: Update .env File (30 seconds)

Open `frontend/.env` and update:

```env
VITE_GOOGLE_CLIENT_ID=paste-your-client-id-here.apps.googleusercontent.com
```

### Step 3: Restart Frontend (30 seconds)

```bash
cd frontend
npm run dev
```

---

## ✅ That's It!

Now when you upload a video:
1. Click "Sign in with Google"
2. Allow access
3. Upload your video
4. It goes to YOUR Google Drive!

Files are organized like this:
```
Production Files/
└── BCH-1001/
    ├── Raw Footage/
    │   └── your-video.mp4
    ├── Edited Videos/
    └── Final Videos/
```

---

## 📖 Need More Details?

See [GOOGLE_OAUTH_UPLOAD_SETUP.md](GOOGLE_OAUTH_UPLOAD_SETUP.md) for the full guide.
