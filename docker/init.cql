CREATE KEYSPACE IF NOT EXISTS analytics WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE analytics;

CREATE TABLE IF NOT EXISTS merchant_aggregates (
    merchant_id text,
    window_start timestamp,
    total_revenue bigint,
    transaction_count bigint,
    PRIMARY KEY (merchant_id, window_start)
) WITH CLUSTERING ORDER BY (window_start DESC);
