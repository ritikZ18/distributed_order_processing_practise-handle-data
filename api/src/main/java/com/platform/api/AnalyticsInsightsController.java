package com.platform.api;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsInsightsController {

    private static final Duration DEFAULT_WINDOW = Duration.ofMinutes(5);

    private final AggregateRepository repository;
    private final CqlSession session;

    @GetMapping("/timeseries/{merchantId}")
    public List<MerchantAggregate> timeSeries(
            @PathVariable String merchantId,
            @RequestParam(defaultValue = "12") int windows
    ) {
        int limit = Math.min(Math.max(windows, 1), 500);
        List<MerchantAggregate> rows = repository.findByMerchantId(merchantId);
        return rows.size() <= limit ? rows : rows.subList(0, limit);
    }

    @GetMapping("/leaderboard")
    public List<LeaderboardRow> leaderboard(
            @RequestParam(defaultValue = "5m") String window,
            @RequestParam(defaultValue = "10") int limit
    ) {
        Duration duration = WindowParser.parse(window, DEFAULT_WINDOW);
        int safeLimit = Math.min(Math.max(limit, 1), 50);

        Instant cutoff = Instant.now().minus(duration);
        PreparedStatement ps = session.prepare("""
                SELECT merchant_id, window_start, total_revenue, transaction_count
                FROM analytics.merchant_aggregates
                WHERE window_start >= ? ALLOW FILTERING
                """);
        BoundStatement bs = ps.bind(cutoff);

        Map<String, Totals> totalsByZone = new HashMap<>();
        for (Row row : session.execute(bs)) {
            String zoneId = row.getString("merchant_id");
            if (zoneId == null) {
                continue;
            }
            long revenue = safeGetLong(row, "total_revenue");
            long txns = safeGetLong(row, "transaction_count");
            Instant windowStart = row.getInstant("window_start");

            Totals totals = totalsByZone.computeIfAbsent(zoneId, ignored -> new Totals());
            totals.totalRevenue += revenue;
            totals.totalTransactions += txns;
            if (windowStart != null && (totals.latestWindowStart == null || windowStart.isAfter(totals.latestWindowStart))) {
                totals.latestWindowStart = windowStart;
            }
        }

        List<LeaderboardRow> rows = new ArrayList<>(totalsByZone.size());
        for (Map.Entry<String, Totals> e : totalsByZone.entrySet()) {
            Totals t = e.getValue();
            rows.add(new LeaderboardRow(e.getKey(), t.totalRevenue, t.totalTransactions, t.latestWindowStart));
        }

        rows.sort(Comparator.comparingLong(LeaderboardRow::totalRevenue).reversed());
        return rows.size() <= safeLimit ? rows : rows.subList(0, safeLimit);
    }

    @GetMapping("/global")
    public GlobalStats global(@RequestParam(defaultValue = "1h") String window) {
        Duration duration = WindowParser.parse(window, Duration.ofHours(1));
        Instant cutoff = Instant.now().minus(duration);

        PreparedStatement ps = session.prepare("""
                SELECT merchant_id, total_revenue, transaction_count
                FROM analytics.merchant_aggregates
                WHERE window_start >= ? ALLOW FILTERING
                """);
        BoundStatement bs = ps.bind(cutoff);

        long totalRevenue = 0;
        long totalTransactions = 0;
        int activeZones = 0;
        Map<String, Boolean> seen = new HashMap<>();

        for (Row row : session.execute(bs)) {
            String zoneId = row.getString("merchant_id");
            if (zoneId == null) {
                continue;
            }
            totalRevenue += safeGetLong(row, "total_revenue");
            totalTransactions += safeGetLong(row, "transaction_count");
            if (seen.putIfAbsent(zoneId, Boolean.TRUE) == null) {
                activeZones++;
            }
        }

        return new GlobalStats(window, totalRevenue, totalTransactions, activeZones);
    }

    private long safeGetLong(Row row, String col) {
        if (row.isNull(col)) {
            return 0;
        }
        return row.getLong(col);
    }

    private static final class Totals {
        long totalRevenue;
        long totalTransactions;
        Instant latestWindowStart;
    }

    public record LeaderboardRow(String zoneId, long totalRevenue, long totalTransactions, Instant latestWindowStart) {}

    public record GlobalStats(String window, long totalRevenue, long totalTransactions, int activeZones) {}
}
