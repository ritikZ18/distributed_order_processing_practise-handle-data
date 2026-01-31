## 1. Start Platform (Automated)

The easiest way to start the entire platform is using the provided script:

```bash
./start.sh
```

This script will:
1.  Start all Docker infrastructure.
2.  Generate Avro classes and build Maven modules.
3.  Launch the Producer, Processor, and API in the background.
4.  Provide a **Real-Time Dashboard** in your terminal with all service links.
5.  **Stay active**: The terminal will remain open showing links until you press `Ctrl+C` or run `./stop.sh`.

---

## 2. Start Platform (Manual Steps)

If you prefer to run components individually for debugging:

### A. Infrastructure
```bash
cd docker
docker-compose up -d
```

### B. Build
```bash
mvn clean install
```

### C. Services
Run each in a separate terminal:
*   **Producer**: `mvn -pl producer spring-boot:run`
*   **Processor**: `mvn -pl processor exec:java`
*   **API**: `mvn -pl api spring-boot:run` (Runs on port `8082`)

---

## 4. Setting up Data Services

To run the producer with real data:

1.  **Download Dataset**: Download any [NYC TLC Trip Record Parquet](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page) file (e.g., Yellow Taxi Jan 2024).
2.  **Place Data**: Create a `data/` folder in the project root and place the parquet file there.
3.  **Configure Producer**: Update the `TaxiParquetReader` configuration in the `producer` module or use the high-throughput simulated stream provided in `DataReplayService`.

---

## 5. Modern Terminal UI

We've added a premium **Arch Linux-inspired terminal UI** for the platform dashboard.

### Start the UI
```bash
cd frontend
npm install
npm run dev
```
The UI will be available at [http://localhost:3000](http://localhost:3000).

---

## 6. Port Reference

| Service | Protocol | Port |
|---------|----------|------|
| Analytics API | HTTP | `8082` |
| Spark Master | HTTP | `8080` |
| Frontend UI | HTTP | `3000` |
| Kafka | TCP | `9092` |
| Cassandra | TCP | `9042` |
| Redis | TCP | `6379` |
| Schema Registry | HTTP | `8081` |
