# Multi-stage build for production

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args for environment variables (baked into the build)
ARG VITE_POSTGREST_URL
ARG VITE_BACKEND_URL
ARG VITE_AUTH_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_GOOGLE_API_KEY
ARG VITE_ADMIN_GOOGLE_EMAIL

# Set them as env vars for the build
ENV VITE_POSTGREST_URL=$VITE_POSTGREST_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_API_KEY=$VITE_GOOGLE_API_KEY
ENV VITE_ADMIN_GOOGLE_EMAIL=$VITE_ADMIN_GOOGLE_EMAIL

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
