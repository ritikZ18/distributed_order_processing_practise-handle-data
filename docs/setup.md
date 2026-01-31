# Setup and Run Guide

Follow these steps to deploy and run the platform locally using Docker.

## Prerequisites

*   Docker and Docker Compose
*   Java 17
*   Maven 3.8+

## 1. Start Infrastructure

Navigate to the `docker` directory and start the containers:

```bash
cd docker
docker-compose up -d
```

This will start:
*   **Kafka** at `localhost:9092`
*   **Schema Registry** at `localhost:8081`
*   **Cassandra** at `localhost:9042`
*   **Redis** at `localhost:6379`
*   **Spark** at `localhost:8080` (Web UI)

## 2. Generate Schema and Build

From the root directory, generate the Avro classes and build the project:

```bash
mvn clean install
```

## 3. Run the Services

### Start the Kafka Producer
The producer will start replaying events automatically.
```bash
cd producer
mvn spring-boot:run
```

### Start the Spark Processor
Submit the job to Spark (or run locally for testing):
```bash
cd processor
mvn exec:java -Dexec.mainClass="com.platform.processor.SparkAnalyticsJob"
```

### Start the Analytics API
```bash
cd api
mvn spring-boot:run
```

## 4. Verify

Check the health and metrics via the API:

```bash
curl http://localhost:8080/api/v1/analytics/health
curl http://localhost:8080/api/v1/analytics/merchant/zone-1
```
