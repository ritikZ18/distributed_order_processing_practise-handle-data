package com.platform.api;

import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class DashboardController {

    private final AggregateRepository repository;

    @GetMapping("/merchant/{id}")
    @Cacheable(value = "merchantStatsV3", key = "#id + ':' + #window + ':' + #limit")
    public List<MerchantAggregate> getMerchantStats(
            @PathVariable("id") String id,
            @RequestParam(name = "window", defaultValue = "24h") String window,
            @RequestParam(name = "limit", defaultValue = "20") int limit
    ) {
        Duration duration = WindowParser.parse(window, Duration.ofHours(24));
        Instant cutoff = Instant.now().minus(duration);
        int safeLimit = Math.min(Math.max(limit, 1), 200);

        return repository.findByMerchantId(id).stream()
                .filter(row -> row.getWindowStart() != null && !row.getWindowStart().isBefore(cutoff))
                .sorted(Comparator.comparing(MerchantAggregate::getWindowStart).reversed())
                .limit(safeLimit)
                .toList();
    }

    @GetMapping("/health")
    public String health() {
        return "UP";
    }
}
