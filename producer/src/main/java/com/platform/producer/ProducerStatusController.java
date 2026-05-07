package com.platform.producer;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/producer")
@RequiredArgsConstructor
public class ProducerStatusController {

    private final DataReplayService dataReplayService;

    @GetMapping("/stats")
    public ProducerStats stats() {
        return new ProducerStats(
                dataReplayService.getTotalEventsSent(),
                dataReplayService.getLastEventSentAt()
        );
    }

    @GetMapping("/stats/rate")
    public SlidingWindowMetricsSnapshot rate(@RequestParam(defaultValue = "60") int windowSeconds) {
        return dataReplayService.getSlidingWindowSnapshot(windowSeconds);
    }

    @GetMapping("/stats/by-zone")
    public List<SlidingWindowMetricsSnapshot.ZoneCount> byZone(
            @RequestParam(defaultValue = "60") int windowSeconds,
            @RequestParam(defaultValue = "10") int limit
    ) {
        SlidingWindowMetricsSnapshot snapshot = dataReplayService.getSlidingWindowSnapshot(windowSeconds);
        int safeLimit = Math.min(Math.max(limit, 1), snapshot.zoneCounts().size());
        return snapshot.zoneCounts().subList(0, safeLimit);
    }

    public record ProducerStats(long totalEventsSent, Instant lastEventSentAt) {}
}
