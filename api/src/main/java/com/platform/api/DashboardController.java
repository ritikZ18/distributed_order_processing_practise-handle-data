package com.platform.api;

import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class DashboardController {

    private final AggregateRepository repository;

    @GetMapping("/merchant/{id}")
    @Cacheable(value = "merchantStats", key = "#id")
    public List<MerchantAggregate> getMerchantStats(@PathVariable String id) {
        return repository.findByMerchantId(id);
    }

    @GetMapping("/health")
    public String health() {
        return "UP";
    }
}
