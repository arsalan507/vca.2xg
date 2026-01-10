#!/bin/bash

# Viral Content Analyzer - Development Startup Script
# This script starts both frontend and backend servers

echo "🚀 Starting Viral Content Analyzer..."
echo ""

# Check if backend .env exists
if [ ! -f "backend/.env" ]; then
    echo "❌ Backend .env file not found!"
    echo "📝 Please create backend/.env with your Supabase credentials"
    echo ""
    echo "Run this command to create it:"
    echo "cp backend/.env.example backend/.env"
    echo ""
    echo "Then edit backend/.env and add your SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# Check if node_modules exist
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo "✅ Dependencies installed"
echo ""

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup EXIT INT TERM

# Start backend server
echo "🔧 Starting backend server on http://localhost:3001..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend server
echo "🎨 Starting frontend server on http://localhost:5174..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Both servers are running!"
echo ""
echo "📊 Backend:  http://localhost:3001"
echo "🌐 Frontend: http://localhost:5174"
echo "⚙️  Settings: http://localhost:5174/settings"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait
