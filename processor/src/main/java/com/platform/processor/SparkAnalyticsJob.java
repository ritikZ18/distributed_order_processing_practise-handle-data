package com.platform.processor;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.streaming.StreamingQuery;
import org.apache.spark.sql.streaming.Trigger;
import org.apache.spark.sql.types.DataTypes;

import java.util.Arrays;

import static org.apache.spark.sql.functions.*;
import static org.apache.spark.sql.avro.functions.from_avro;

public class SparkAnalyticsJob {

    // Confluent Schema Registry Avro serializer prepends a 5-byte header:
    // [magic byte=0][schema id (4 bytes big-endian)][avro payload...]
    // Spark's from_avro() expects the raw Avro payload, so we strip the header first.
    private static final int CONFLUENT_WIRE_HEADER_BYTES = 5;

    // Keep this schema in-sync with shared/schemas/transaction.avsc
    private static final String FINANCIAL_TXN_EVENT_SCHEMA_JSON = """
            {
              "type": "record",
              "name": "FinancialTransactionEvent",
              "namespace": "com.platform.events.v1",
              "fields": [
                {"name": "event_id", "type": "string", "doc": "Unique identifier for the event"},
                {"name": "transaction_id", "type": "string", "doc": "Domain-specific transaction ID"},
                {"name": "occurred_at", "type": {"type": "long", "logicalType": "timestamp-millis"}, "doc": "When the event occurred"},
                {"name": "amount_cents", "type": "long", "doc": "Transaction amount in cents"},
                {"name": "currency", "type": "string", "default": "USD"},
                {"name": "merchant_id", "type": "string", "doc": "Identifier for the merchant or pickup zone"},
                {"name": "payment_method", "type": "string", "doc": "e.g., Credit Card, Cash"},
                {"name": "status", "type": {"type": "enum", "name": "TxnStatus", "symbols": ["PENDING", "SUCCESS", "FAILED"]}, "doc": "Transaction status"},
                {"name": "region", "type": "string", "doc": "Deployment region (us-east, us-west)"},
                {"name": "trace_id", "type": "string", "doc": "Correlation ID for observability"}
              ]
            }
            """;

    public static void main(String[] args) throws Exception {
        SparkSession spark = SparkSession.builder()
                .appName("FinancialAnalyticsJob")
                .master("local[*]")
                .config("spark.ui.enabled", "false") // Disable UI to avoid servlet conflicts
                .config("spark.driver.host", "localhost")
                .config("spark.driver.bindAddress", "127.0.0.1")
                .config("spark.cassandra.connection.host", "localhost")
                .getOrCreate();

        spark.udf().register(
                "strip_confluent_header",
                (byte[] value) -> {
                    if (value == null || value.length == 0) {
                        return null;
                    }
                    if (value.length < CONFLUENT_WIRE_HEADER_BYTES) {
                        return null;
                    }
                    // Confluent "magic byte" is 0 for Avro.
                    if (value[0] != 0) {
                        // Not Confluent-framed; assume it's already a raw Avro payload.
                        return value;
                    }
                    return Arrays.copyOfRange(value, CONFLUENT_WIRE_HEADER_BYTES, value.length);
                },
                DataTypes.BinaryType
        );

        // 1. Read from Kafka
        Dataset<Row> rawEvents = spark.readStream()
                .format("kafka")
                .option("kafka.bootstrap.servers", "localhost:9092")
                .option("subscribe", "financial-transactions")
                .option("startingOffsets", "latest")
                .load();

        // 2. Decode (Confluent Avro -> raw Avro -> Spark struct) and aggregate
        Dataset<Row> decoded = rawEvents
                .selectExpr("strip_confluent_header(value) as avro_payload")
                .filter(col("avro_payload").isNotNull());

        Dataset<Row> events = decoded
                .select(from_avro(col("avro_payload"), FINANCIAL_TXN_EVENT_SCHEMA_JSON).as("data"))
                .select("data.*")
                // occurred_at is timestamp-millis; Spark expects seconds for cast(long->timestamp)
                .withColumn("timestamp", col("occurred_at").divide(lit(1000)).cast("timestamp"))
                .filter(col("merchant_id").isNotNull())
                .filter(col("amount_cents").isNotNull());

        Dataset<Row> windowedAgg = events
                .withWatermark("timestamp", "10 minutes")
                .groupBy(
                        window(col("timestamp"), "5 minutes"),
                        col("merchant_id")
                )
                .agg(
                        sum("amount_cents").as("total_revenue"),
                        count("*").as("transaction_count")
                );

        // 3. Write to Cassandra
        StreamingQuery query = windowedAgg.writeStream()
                .outputMode("update")
                .foreachBatch((batchDF, batchId) -> {
                    batchDF.select(
                            col("merchant_id"),
                            col("window.start").as("window_start"),
                            col("total_revenue"),
                            col("transaction_count")
                    ).write()
                            .format("org.apache.spark.sql.cassandra")
                            .options(java.util.Map.of("table", "merchant_aggregates", "keyspace", "analytics"))
                            .mode("append")
                            .save();
                })
                .trigger(Trigger.ProcessingTime("1 minute"))
                .start();

        query.awaitTermination();
    }
}
