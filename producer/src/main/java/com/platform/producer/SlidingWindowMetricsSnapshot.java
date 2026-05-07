package com.platform.producer;

import java.time.Instant;
import java.util.List;

public record SlidingWindowMetricsSnapshot(
        int windowSeconds,
        List<RatePoint> ratePoints,
        long totalEventsInWindow,
        List<ZoneCount> zoneCounts
) {
    public record RatePoint(Instant secondStart, int count) {}

    public record ZoneCount(String zoneId, int count) {}
}

