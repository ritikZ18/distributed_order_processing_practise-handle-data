#!/bin/bash

# Real-Time Event Streaming Platform - Interactive Start Script

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "⚠️  Received interrupt signal. Shutting down..."
    ./stop.sh
    ./stop.sh
    exit
}

# Trap Ctrl+C (SIGINT) and call cleanup
trap cleanup SIGINT

echo "🚀 Starting Platform Infrastructure..."

# 1. Start Docker Containers
cd docker
docker compose up -d
cd ..

echo "⏳ Waiting for Kafka to be ready..."
while ! nc -z localhost 9092; do sleep 2; done

echo "⏳ Waiting for Cassandra to be ready..."
# First wait for Cassandra to accept connections
until docker exec docker-cassandra-1 cqlsh -e "SELECT now() FROM system.local" > /dev/null 2>&1; do
  echo "  ...Cassandra is still starting..."
  sleep 5
done
echo "✅ Cassandra is ready. Initializing schema..."

# Now run the init script to create keyspace and tables
docker exec -i docker-cassandra-1 cqlsh < docker/init.cql
echo "✅ Schema initialized. Infrastructure is ready."

# 2. Build the Project
echo "📦 Building project (generating Avro schemas)..."
mvn clean install -DskipTests

# 3. Start Backend Services
echo "📡 Starting Kafka Producer..."
nohup mvn -pl producer spring-boot:run > producer.log 2>&1 &
echo $! > .producer.pid

echo "🧠 Starting Spark Processor..."
nohup mvn -pl processor exec:exec > processor.log 2>&1 &
echo $! > .processor.pid

echo "🌐 Starting Analytics API..."
nohup mvn -pl api spring-boot:run > api.log 2>&1 &
echo $! > .api.pid

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
sleep 20

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
    # Optional: Quick check if background processes are still alive
    if ! kill -0 $(cat .producer.pid) 2>/dev/null; then
        echo "⚠️  WARNING: Producer process died! Check producer.log"
    fi
    if ! kill -0 $(cat .api.pid) 2>/dev/null; then
        echo "⚠️  WARNING: API process died! Check api.log"
    fi
done
