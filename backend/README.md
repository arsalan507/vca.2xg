# Viral Content Analyzer - Backend API

This backend server handles admin operations that require Supabase service role privileges, such as creating and deleting users.

## Features

- User creation with admin privileges
- User deletion with admin privileges
- JWT token verification
- Role-based access control (SUPER_ADMIN only)

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
FRONTEND_URL=http://localhost:5173
```

**Where to find your Supabase Service Role Key:**
1. Go to your Supabase Dashboard
2. Click on "Settings" → "API"
3. Copy the "service_role" key (NOT the anon key)
4. ⚠️ **IMPORTANT:** Keep this key secret! Never commit it to git or expose it in frontend code.

### 3. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3001`

### 4. Verify Setup

Check if the server is running:
```bash
curl http://localhost:3001/health
```

You should see:
```json
{
  "status": "ok",
  "message": "Backend server is running"
}
```

## API Endpoints

### Health Check
- **GET** `/health`
- Public endpoint to verify server status

### Create User (Admin Only)
- **POST** `/api/admin/users`
- **Headers:** `Authorization: Bearer <jwt_token>`
- **Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password",
  "fullName": "John Doe",
  "role": "VIDEOGRAPHER"
}
```
- **Roles:** `VIDEOGRAPHER`, `EDITOR`, `POSTING_MANAGER`, `SCRIPT_WRITER`, `CREATOR`, `SUPER_ADMIN`

### Delete User (Admin Only)
- **DELETE** `/api/admin/users/:userId`
- **Headers:** `Authorization: Bearer <jwt_token>`

## Deployment

### Coolify + OVH Cloud Deployment

When deploying to Coolify on OVH Cloud:

1. **Set Environment Variables** in Coolify:
   - `PORT=3001`
   - `SUPABASE_URL=your-supabase-url`
   - `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`
   - `FRONTEND_URL=https://your-frontend-domain.com`

2. **Build Command:** `npm install`

3. **Start Command:** `npm start`

4. **Port:** Expose port `3001`

5. **Update Frontend:** Change `VITE_BACKEND_URL` in frontend `.env` to your backend domain

### Docker Deployment (Optional)

You can also containerize this backend:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Security Notes

⚠️ **Critical Security Information:**

1. **Service Role Key:** Never expose this in client-side code. It has full database access.
2. **CORS:** Update `FRONTEND_URL` to match your production frontend domain
3. **HTTPS:** Always use HTTPS in production
4. **Rate Limiting:** Consider adding rate limiting for production use
5. **Authentication:** All admin endpoints require valid JWT token from authenticated SUPER_ADMIN

## Troubleshooting

### Error: "No authorization header"
- Make sure you're logged in as SUPER_ADMIN in the frontend
- Check that the Authorization header is being sent with requests

### Error: "Unauthorized - Admin access required"
- Verify your user role is set to `SUPER_ADMIN` in the profiles table
- Check Supabase dashboard: Authentication → Users → [Your User] → User Metadata

### Error: "Invalid token"
- Your session may have expired. Log out and log back in
- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct

### Error: "Failed to create user profile"
- Check that RLS policies allow SUPER_ADMIN to update profiles table
- Verify the profiles table exists and has correct schema

## Development Notes

- The backend uses Express.js for simplicity
- JWT tokens are validated using Supabase auth
- All admin operations are logged to console
- CORS is enabled for the configured frontend URL

## Future Enhancements

- [ ] Add rate limiting
- [ ] Add request logging middleware
- [ ] Add user activity audit logs
- [ ] Add bulk user operations
- [ ] Add user role update endpoint via API
- [ ] Add password reset endpoint
- [ ] Add email verification resend endpoint
