package com.platform.api;

import lombok.Data;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;

@Data
@Table("merchant_aggregates")
public class MerchantAggregate {

    @PrimaryKeyColumn(name = "merchant_id", type = PrimaryKeyType.PARTITIONED)
    private String merchantId;

    @PrimaryKeyColumn(name = "window_start", type = PrimaryKeyType.CLUSTERED)
    private Instant windowStart;

    @Column("total_revenue")
    private Long totalRevenue;

    @Column("transaction_count")
    private Long transactionCount;
}
