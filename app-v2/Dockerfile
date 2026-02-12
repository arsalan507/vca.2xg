# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_BACKEND_URL
ARG VITE_POSTGREST_URL
ARG VITE_POSTGREST_JWT
# Legacy name kept for backward compatibility with existing Coolify config
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_API_KEY

# Set environment variables for build
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_POSTGREST_URL=$VITE_POSTGREST_URL
ENV VITE_POSTGREST_JWT=$VITE_POSTGREST_JWT
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_API_KEY=$VITE_GOOGLE_API_KEY

# Build the app
RUN npm run build

# ─── Production Stage ───────────────────────────────────────────────────────
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check disabled for now - app is working but Docker healthcheck has IPv6 resolution issues
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD ["/bin/sh", "-c", "wget --no-verbose --tries=1 --spider http://127.0.0.1/health || exit 1"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
