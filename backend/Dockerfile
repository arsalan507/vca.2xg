# Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create voice notes directory
RUN mkdir -p /data/voice-notes

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "src/index.js"]
