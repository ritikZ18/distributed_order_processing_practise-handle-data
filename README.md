# Real-Time Event Streaming & Analytics Platform

This project is a high-throughput event streaming platform built using **Java**, **Kafka**, **Spark**, **Cassandra**, and **Redis**. It is designed to process financial-grade transaction events with Exactly-Once Semantics (EOS) and provide low-latency analytics.

## Folder Structure

*   `producer/`: Java/Spring Boot service replaying NYC Taxi data into Kafka.
*   `processor/`: Spark Structured Streaming job for real-time windowed aggregations.
*   `api/`: Spring Boot REST API for serving metrics with Redis caching.
*   `shared/`: Avro schemas and shared DTOs.
*   `docker/`: Infrastructure configuration (Kafka, Cassandra, Redis, Spark).
*   `docs/`: Detailed architecture and setup guides.

## Quick Start

1.  **Infrastructure**: `cd docker && docker-compose up -d`
2.  **Build**: `mvn clean install`
3.  **Run**:
    *   Producer: `cd producer && mvn spring-boot:run`
    *   Analytics: `cd api && mvn spring-boot:run`
    *   Processor: `cd processor && mvn exec:java`
    *   Frontend: `cd frontend && npm install && npm run dev`
  
4.  Or run : `./start.sh`  to start the services and `./stop.sh`

For more details, see [Architecture](docs/architecture.md) and [Setup Guide](docs/setup.md).

<img width="2454" height="1661" alt="image" src="https://github.com/user-attachments/assets/a38b6f95-52a2-4b95-83d0-fd080a1efcb1" />
<img width="2094" height="1616" alt="Screenshot 2026-01-31 185207" src="https://github.com/user-attachments/assets/597ddcfc-9eb1-4e75-90fc-936f40da4b5c" />
