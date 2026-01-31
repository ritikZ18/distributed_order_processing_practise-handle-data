#!/bin/bash

# Real-Time Event Streaming Platform - Stop Script

echo "🛑 Stopping Platform Services..."

# 1. Kill Java Services
for pid_file in .producer.pid .processor.pid .api.pid; do
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        echo "Killing process $pid from $pid_file..."
        kill -9 $pid > /dev/null 2>&1
        rm "$pid_file"
    fi
done

# Also kill any remaining mvn processes related to this project
pkill -f "com.platform" || true
pkill -f "distributed-processing-orders" || true

# 2. Stop Docker Infrastructure
echo "🐳 Stopping Docker Containers..."
cd docker
docker compose down
cd ..

echo "🧹 Cleanup complete."
echo "✅ All services stopped."
