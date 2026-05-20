#!/bin/bash
set -e

echo "🚀 Starting VPS deployment for MXT223..."

# 1. Check if schedule.db exists locally, create if missing so docker mount doesn't create it as a folder
if [ ! -f "schedule.db" ]; then
    echo "📦 schedule.db not found. Creating empty database file..."
    touch schedule.db
    chmod 666 schedule.db
fi

# 2. Build and start containers in detached mode
echo "🐳 Building and starting Docker container..."
docker compose down || true
docker compose up -d --build

# 3. Verify container is running
echo "⏱️ Waiting 3 seconds for FastAPI to initialize..."
sleep 3

if [ "$(docker inspect -f '{{.State.Running}}' mxt223-app)" = "true" ]; then
    echo "✅ MXT223 is running successfully!"
    echo "🌐 Access your app at: http://your-vps-ip:8000"
    echo "📊 Container status:"
    docker compose ps
else
    echo "❌ Deployment failed. Container is not running."
    echo "📜 Fetching recent logs:"
    docker compose logs --tail=20
    exit 1
fi
