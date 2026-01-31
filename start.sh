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

echo "⏳ Waiting for Cassandra & Keyspace to be ready..."
while ! docker exec docker-cassandra-1 cqlsh -e "DESCRIBE KEYSPACE analytics" > /dev/null 2>&1; do
  sleep 3
done
echo "✅ Infrastructure is ready."

# 2. Build the Project
echo "📦 Building project (generating Avro schemas)..."
mvn clean install -DskipTests

# 3. Start Services in background
echo "📡 Starting Kafka Producer..."
nohup mvn -pl producer spring-boot:run > producer.log 2>&1 &
echo $! > .producer.pid

echo "🧠 Starting Spark Processor..."
nohup mvn -pl processor exec:exec > processor.log 2>&1 &
echo $! > .processor.pid

echo "🌐 Starting Analytics API..."
nohup mvn -pl api spring-boot:run > api.log 2>&1 &
echo $! > .api.pid

echo "✅ Services started in background."
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
