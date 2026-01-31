package com.platform.api;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AggregateRepository extends CassandraRepository<MerchantAggregate, String> {
    List<MerchantAggregate> findByMerchantId(String merchantId);
}
