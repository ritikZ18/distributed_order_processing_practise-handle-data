#!/bin/bash

# Real-Time Event Streaming Platform - Interactive Start Script

# Fail fast on errors/undefined vars in the main script.
set -euo pipefail

is_wsl() {
  grep -qi microsoft /proc/version 2>/dev/null
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required command: $1"
    exit 1
  fi
}

require_docker() {
  require_cmd docker
  if ! docker version >/dev/null 2>&1; then
    echo "❌ Docker is not available from this environment."
    if is_wsl; then
      echo ""
      echo "WSL fix options:"
      echo "1) Docker Desktop (Windows) -> Settings -> Resources -> WSL Integration -> enable for this distro"
      echo "2) Or install Docker Engine inside WSL (dockerd) and ensure the daemon is running"
      echo ""
    else
      echo "Make sure Docker Engine is installed and the daemon is running."
    fi
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "❌ Docker Compose v2 is required (the 'docker compose' subcommand)."
    exit 1
  fi
}

compose_infra() {
  # Run compose from the docker/ folder so service names match the compose file.
  (cd docker && docker compose "$@")
}

cassandra_container_id() {
  compose_infra ps -q cassandra
}

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "⚠️  Received interrupt signal. Shutting down..."
    ./stop.sh
    exit
}

# Trap Ctrl+C (SIGINT) and call cleanup
trap cleanup SIGINT

echo "🚀 Starting Platform Infrastructure..."

# If previous runs left services running, stop them to avoid "port already in use"
if nc -z localhost 8082 2>/dev/null || nc -z localhost 8083 2>/dev/null; then
  echo "⚠️  Detected existing services on 8082/8083. Stopping old processes..."
  ./stop.sh || true
fi

# Preflight checks (avoid hanging forever when prerequisites aren't met)
require_docker
require_cmd mvn
require_cmd nc
require_cmd curl

# 1. Start Docker Containers
echo "♻️  Restarting Docker infrastructure..."
compose_infra down || true
compose_infra up -d

echo "⏳ Waiting for Kafka to be ready..."
while ! nc -z localhost 9092; do sleep 2; done

echo "⏳ Waiting for Schema Registry to be ready..."
until curl -s --connect-timeout 2 http://localhost:8081/subjects >/dev/null 2>&1; do
  sleep 2
done

echo "⏳ Waiting for Cassandra to be ready..."
# First wait for Cassandra to accept connections
CASSANDRA_ID="$(cassandra_container_id)"
if [ -z "${CASSANDRA_ID}" ]; then
  echo "❌ Cassandra container not found (docker compose ps -q cassandra returned empty)."
  exit 1
fi

until docker exec "${CASSANDRA_ID}" cqlsh -e "SELECT now() FROM system.local" > /dev/null 2>&1; do
  echo "  ...Cassandra is still starting..."
  sleep 5
done
echo "✅ Cassandra is ready. Initializing schema..."

# Now run the init script to create keyspace and tables
docker exec -i "${CASSANDRA_ID}" cqlsh < docker/init.cql
echo "✅ Schema initialized. Infrastructure is ready."

# 2. Build the Project
echo "📦 Building project (generating Avro schemas)..."
mvn clean install -DskipTests

# 3. Start Backend Services
echo "📡 Starting Kafka Producer..."
nohup mvn -pl producer spring-boot:run -Dspring-boot.run.fork=false > producer.log 2>&1 &
echo $! > .producer.pid

echo "🧠 Starting Spark Processor..."
nohup mvn -pl processor exec:exec > processor.log 2>&1 &
echo $! > .processor.pid

echo "🌐 Starting Analytics API..."
nohup mvn -pl api spring-boot:run -Dspring-boot.run.fork=false > api.log 2>&1 &
echo $! > .api.pid

echo "⏳ Waiting for Producer health..."
for i in {1..20}; do
  if curl -s --connect-timeout 2 http://localhost:8083/actuator/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 4. Start Frontend Services (Non-blocking)
echo "📡 Starting Frontend (Background)..."
(
  cd frontend
  if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install > frontend_install.log 2>&1
  fi
  nohup npm run dev > ../frontend.log 2>&1 &
  echo $! > ../.frontend.pid
)

echo "✅ All services started in background."
echo "⏳ Waiting for API to warm up..."
for i in {1..30}; do
  if [ "$(curl -s --connect-timeout 2 http://localhost:8082/api/v1/analytics/health 2>/dev/null || true)" == "UP" ]; then
    break
  fi
  sleep 1
done

# Clear screen for Dashboard
clear

echo "================================================================"
echo "      REAL-TIME EVENT STREAMING & ANALYTICS PLATFORM            "
echo "================================================================"
echo ""
echo "🔗 SERVICE LINKS:"
echo "----------------------------------------------------------------"
echo "🔹 Frontend Dashboard:      http://localhost:3000"
echo "🔹 Spark Master (Web UI):   http://localhost:8080"
echo "🔹 Schema Registry:         http://localhost:8081"
echo "🔹 Analytics API (Health):  http://localhost:8082/api/v1/analytics/health"
echo "🔹 Analytics API (Stats):   http://localhost:8082/api/v1/analytics/merchant/zone-1"
echo "🔹 Producer (Health):       http://localhost:8083/actuator/health"
echo "🔹 Kafka Bootstrap:         localhost:9092"
echo "🔹 Cassandra:               localhost:9042"
echo "🔹 Redis:                   localhost:6379"
echo "----------------------------------------------------------------"
echo ""
echo "📄 LOG CHANNELS (run these in a new terminal):"
echo "----------------------------------------------------------------"
echo "🔸 tail -f producer.log"
echo "🔸 tail -f processor.log"
echo "🔸 tail -f api.log"
echo "----------------------------------------------------------------"
echo ""
echo "👀 VERIFICATION:"
echo "----------------------------------------------------------------"
echo "⏳ Waiting for API to respond..."
for i in {1..15}; do
  HEALTH_STATUS=$(curl -s --connect-timeout 2 http://localhost:8082/api/v1/analytics/health)
  if [ "$HEALTH_STATUS" == "UP" ]; then
    break
  fi
  sleep 2
done

if [ "$HEALTH_STATUS" == "UP" ]; then
    echo "✅ API Status: UP"
else
    echo "❌ API Status: DOWN (Check api.log)"
fi
echo "----------------------------------------------------------------"
echo ""

# Auto-open browser to frontend dashboard
echo "🌐 Opening Dashboard in browser..."
sleep 1
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3000" 2>/dev/null &
elif command -v open &> /dev/null; then
    open "http://localhost:3000" 2>/dev/null &
elif command -v start &> /dev/null; then
    start "http://localhost:3000" 2>/dev/null &
fi

echo "🚀 Platform is RUNNING. Press Ctrl+C to stop all services."
echo "================================================================"

# Wait for background processes or manual exit
# We use a loop to keep the script alive and check for process health
while true; do
    sleep 5
    # Health-based checks (spring-boot:run may fork, making PID checks unreliable)
    if ! curl -s --connect-timeout 2 http://localhost:8083/actuator/health >/dev/null 2>&1; then
        echo "⚠️  WARNING: Producer health check failed! Check producer.log"
    fi
    if [ "$(curl -s --connect-timeout 2 http://localhost:8082/api/v1/analytics/health 2>/dev/null || true)" != "UP" ]; then
        echo "⚠️  WARNING: API health check failed! Check api.log"
    fi
done
