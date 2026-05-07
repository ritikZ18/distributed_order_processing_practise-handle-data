#!/bin/bash

# Real-Time Event Streaming Platform - Stop Script

set -euo pipefail

echo "🛑 Stopping Platform Services..."

kill_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    # Only kill userland services (our Spring apps) bound to these ports.
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi
}

# 1. Kill Services
for pid_file in .producer.pid .processor.pid .api.pid .frontend.pid; do
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

# As a last resort, free common dev ports in case PID files were stale.
kill_port 8082
kill_port 8083
kill_port 3000

# 2. Stop Docker Infrastructure
if command -v docker >/dev/null 2>&1 && docker version >/dev/null 2>&1; then
  echo "🐳 Stopping Docker Containers..."
  cd docker
  docker compose down
  cd ..
else
  echo "⚠️  Docker not available; skipping container shutdown."
fi

echo "🧹 Cleanup complete."
echo "✅ All services stopped."
