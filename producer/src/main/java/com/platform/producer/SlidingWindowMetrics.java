package com.platform.producer;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * In-memory observability for the producer. Tracks a fixed-size rolling window of per-second counts,
 * plus per-zone distribution for the same window.
 *
 * This is intentionally simple (no external deps) and is meant for local demos / portfolio UI.
 */
final class SlidingWindowMetrics {

    private final int maxWindowSeconds;
    private final int maxZones;

    private final long[] epochSecondsByBucket;
    private final int[] totalCountByBucket;
    private final int[][] zoneCountByBucket;

    SlidingWindowMetrics(int maxWindowSeconds, int maxZones) {
        if (maxWindowSeconds <= 0) {
            throw new IllegalArgumentException("maxWindowSeconds must be > 0");
        }
        if (maxZones <= 0) {
            throw new IllegalArgumentException("maxZones must be > 0");
        }
        this.maxWindowSeconds = maxWindowSeconds;
        this.maxZones = maxZones;
        this.epochSecondsByBucket = new long[maxWindowSeconds];
        this.totalCountByBucket = new int[maxWindowSeconds];
        this.zoneCountByBucket = new int[maxWindowSeconds][maxZones];
    }

    synchronized void record(Instant sentAt, String zoneId) {
        long epochSecond = sentAt.getEpochSecond();
        int bucket = Math.floorMod((int) epochSecond, maxWindowSeconds);

        if (epochSecondsByBucket[bucket] != epochSecond) {
            epochSecondsByBucket[bucket] = epochSecond;
            totalCountByBucket[bucket] = 0;
            for (int z = 0; z < maxZones; z++) {
                zoneCountByBucket[bucket][z] = 0;
            }
        }

        totalCountByBucket[bucket]++;

        int zoneIndex = parseZoneIndex(zoneId);
        if (zoneIndex >= 0) {
            zoneCountByBucket[bucket][zoneIndex]++;
        }
    }

    synchronized SlidingWindowMetricsSnapshot snapshot(int windowSeconds) {
        int window = Math.min(Math.max(windowSeconds, 1), maxWindowSeconds);
        long nowSec = Instant.now().getEpochSecond();

        List<SlidingWindowMetricsSnapshot.RatePoint> points = new ArrayList<>(window);
        long total = 0;

        int[] zoneTotals = new int[maxZones];
        for (int i = window - 1; i >= 0; i--) {
            long sec = nowSec - i;
            int bucket = Math.floorMod((int) sec, maxWindowSeconds);
            int count = (epochSecondsByBucket[bucket] == sec) ? totalCountByBucket[bucket] : 0;
            points.add(new SlidingWindowMetricsSnapshot.RatePoint(Instant.ofEpochSecond(sec), count));
            total += count;

            if (epochSecondsByBucket[bucket] == sec) {
                for (int z = 0; z < maxZones; z++) {
                    zoneTotals[z] += zoneCountByBucket[bucket][z];
                }
            }
        }

        List<SlidingWindowMetricsSnapshot.ZoneCount> zoneCounts = new ArrayList<>();
        for (int z = 0; z < maxZones; z++) {
            int count = zoneTotals[z];
            if (count > 0) {
                zoneCounts.add(new SlidingWindowMetricsSnapshot.ZoneCount("zone-" + (z + 1), count));
            }
        }
        zoneCounts.sort(Comparator.comparingInt(SlidingWindowMetricsSnapshot.ZoneCount::count).reversed());

        return new SlidingWindowMetricsSnapshot(window, points, total, zoneCounts);
    }

    private int parseZoneIndex(String zoneId) {
        if (zoneId == null) {
            return -1;
        }
        // Expect "zone-<n>"
        if (!zoneId.startsWith("zone-")) {
            return -1;
        }
        try {
            int zoneNumber = Integer.parseInt(zoneId.substring("zone-".length()));
            if (zoneNumber < 1 || zoneNumber > maxZones) {
                return -1;
            }
            return zoneNumber - 1;
        } catch (NumberFormatException ignored) {
            return -1;
        }
    }
}

