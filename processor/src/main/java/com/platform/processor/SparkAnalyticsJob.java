package com.platform.processor;

import org.apache.spark.sql.Dataset;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.streaming.StreamingQuery;
import org.apache.spark.sql.streaming.Trigger;
import org.apache.spark.sql.types.DataTypes;

import static org.apache.spark.sql.functions.*;

public class SparkAnalyticsJob {

    public static void main(String[] args) throws Exception {
        SparkSession spark = SparkSession.builder()
                .appName("FinancialAnalyticsJob")
                .master("local[*]")
                .config("spark.ui.enabled", "false") // Disable UI to avoid servlet conflicts
                .config("spark.driver.host", "localhost")
                .config("spark.driver.bindAddress", "127.0.0.1")
                .config("spark.cassandra.connection.host", "localhost")
                .getOrCreate();

        // 1. Read from Kafka
        Dataset<Row> rawEvents = spark.readStream()
                .format("kafka")
                .option("kafka.bootstrap.servers", "localhost:9092")
                .option("subscribe", "financial-transactions")
                .option("startingOffsets", "latest")
                .load();

        // 2. Transfrom and Aggregate
        // (Simplified: In a real app, use from_avro)
        Dataset<Row> events = rawEvents.selectExpr("CAST(value AS STRING) as json")
                .select(from_json(col("json"), getEventSchema()).as("data"))
                .select("data.*")
                .withColumn("timestamp", col("occurred_at").cast("timestamp"));

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

    private static org.apache.spark.sql.types.StructType getEventSchema() {
        return new org.apache.spark.sql.types.StructType()
                .add("event_id", DataTypes.StringType)
                .add("transaction_id", DataTypes.StringType)
                .add("occurred_at", DataTypes.LongType)
                .add("amount_cents", DataTypes.LongType)
                .add("merchant_id", DataTypes.StringType);
    }
}
