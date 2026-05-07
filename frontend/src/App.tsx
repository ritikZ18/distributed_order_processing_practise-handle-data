import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Activity,
  Server,
  Database,
  Cpu,
  Zap,
  Radio,
  HardDrive,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  LayoutDashboard,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Preloader from "./components/Preloader";

const POLL_INTERVAL = 3000;

// Types
interface ServiceStatus {
  status: "up" | "down" | "loading";
  latency?: number;
  details?: string;
}

interface MerchantStats {
  merchantId: string;
  windowStart: string;
  totalRevenue: number;
  transactionCount: number;
}

interface RatePoint {
  secondStart: string;
  count: number;
}

interface ZoneCount {
  zoneId: string;
  count: number;
}

interface LeaderboardRow {
  zoneId: string;
  totalRevenue: number;
  totalTransactions: number;
  latestWindowStart: string | null;
}

interface GlobalStats {
  window: string;
  totalRevenue: number;
  totalTransactions: number;
  activeZones: number;
}

interface PlatformMetrics {
  api: ServiceStatus;
  producer: ServiceStatus;
  kafka: ServiceStatus;
  cassandra: ServiceStatus;
  redis: ServiceStatus;
  spark: ServiceStatus;
  merchantStats: MerchantStats[];
  producerRatePoints: RatePoint[];
  producerZoneDistribution: ZoneCount[];
  leaderboard: LeaderboardRow[];
  globalStats: GlobalStats | null;
  eventsPerSecond: number;
  totalTransactions: number;
}

type TabType = "dashboard" | "terminal" | "health";
type AggregateWindow = "30m" | "12h" | "24h" | "7d";

const AGGREGATE_WINDOW_OPTIONS: { value: AggregateWindow; label: string }[] = [
  { value: "30m", label: "30 min" },
  { value: "12h", label: "12 hrs" },
  { value: "24h", label: "24 hrs" },
  { value: "7d", label: "7 days" },
];

const PLACEHOLDER_RATE_POINTS: RatePoint[] = Array.from({ length: 24 }, (_, index) => ({
  secondStart: new Date(Date.now() - (23 - index) * 2500).toISOString(),
  count: 12 + ((index * 7) % 15) + (index % 4) * 3,
}));

const PLACEHOLDER_ZONE_DISTRIBUTION: ZoneCount[] = [
  { zoneId: "zone-132", count: 86 },
  { zoneId: "zone-87", count: 71 },
  { zoneId: "zone-45", count: 64 },
  { zoneId: "zone-1", count: 58 },
  { zoneId: "zone-210", count: 49 },
];

const PLACEHOLDER_LEADERBOARD: LeaderboardRow[] = [
  {
    zoneId: "zone-132",
    totalRevenue: 184200,
    totalTransactions: 19,
    latestWindowStart: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    zoneId: "zone-87",
    totalRevenue: 161480,
    totalTransactions: 16,
    latestWindowStart: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    zoneId: "zone-45",
    totalRevenue: 149920,
    totalTransactions: 15,
    latestWindowStart: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    zoneId: "zone-1",
    totalRevenue: 132600,
    totalTransactions: 13,
    latestWindowStart: new Date(Date.now() - 30_000).toISOString(),
  },
];

const PLACEHOLDER_GLOBAL_STATS: GlobalStats = {
  window: "30s",
  totalRevenue: 628200,
  totalTransactions: 63,
  activeZones: 18,
};

function buildPlaceholderMerchantStats(zoneId: string): MerchantStats[] {
  return Array.from({ length: 5 }, (_, index) => ({
    merchantId: zoneId,
    windowStart: new Date(Date.now() - index * 30_000).toISOString(),
    totalRevenue: 102400 - index * 8400,
    transactionCount: 11 - index,
  }));
}

export default function App() {
  const [showPreloader, setShowPreloader] = useState(() => {
    try {
      return sessionStorage.getItem("preloaderDone") !== "1";
    } catch {
      return true;
    }
  });
  const [zoneQuery, setZoneQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState("zone-1");
  const [aggregateWindow, setAggregateWindow] = useState<AggregateWindow>("24h");
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [lines, setLines] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [metrics, setMetrics] = useState<PlatformMetrics>({
    api: { status: "loading" },
    producer: { status: "loading" },
    kafka: { status: "loading" },
    cassandra: { status: "loading" },
    redis: { status: "loading" },
    spark: { status: "loading" },
    merchantStats: [],
    producerRatePoints: [],
    producerZoneDistribution: [],
    leaderboard: [],
    globalStats: null,
    eventsPerSecond: 0,
    totalTransactions: 0,
  });

  // Previous values for trend calculation
  const [prevTransactions, setPrevTransactions] = useState(0);

  const normalizedZoneQuery = zoneQuery.trim().toLowerCase();
  const allZones = Array.from({ length: 263 }, (_, i) => `zone-${i + 1}`);
  const filteredZones = normalizedZoneQuery
    ? allZones.filter((z) => z.includes(normalizedZoneQuery))
    : allZones;
  const hasLiveRateData = metrics.producerRatePoints.length > 0;
  const hasLiveZoneDistribution = metrics.producerZoneDistribution.length > 0;
  const hasLiveLeaderboard = metrics.leaderboard.length > 0;
  const hasLiveMerchantStats = metrics.merchantStats.length > 0;
  const hasLiveGlobalStats =
    metrics.globalStats !== null &&
    (metrics.globalStats.totalTransactions > 0 ||
      metrics.globalStats.totalRevenue > 0 ||
      metrics.globalStats.activeZones > 0);
  const displayedRatePoints = hasLiveRateData
    ? metrics.producerRatePoints
    : PLACEHOLDER_RATE_POINTS;
  const displayedZoneDistribution = hasLiveZoneDistribution
    ? metrics.producerZoneDistribution
    : PLACEHOLDER_ZONE_DISTRIBUTION;
  const displayedLeaderboard = hasLiveLeaderboard
    ? metrics.leaderboard
    : PLACEHOLDER_LEADERBOARD;
  const displayedGlobalStats: GlobalStats = hasLiveGlobalStats
    ? metrics.globalStats!
    : PLACEHOLDER_GLOBAL_STATS;
  const displayedMerchantStats = hasLiveMerchantStats
    ? metrics.merchantStats
    : buildPlaceholderMerchantStats(selectedZone);
  const displayedEventsPerSecond =
    metrics.eventsPerSecond > 0
      ? metrics.eventsPerSecond
      : Math.round(
          PLACEHOLDER_RATE_POINTS.reduce((sum, point) => sum + point.count, 0) /
            PLACEHOLDER_RATE_POINTS.length
        );
  const displayedTotalTransactions =
    metrics.totalTransactions > 0
      ? metrics.totalTransactions
      : displayedGlobalStats.totalTransactions;

  // Fetch service health
  const fetchMetrics = useCallback(async () => {
    const start = Date.now();

    try {
      const res = await fetch("/api/v1/analytics/health");
      const latency = Date.now() - start;
      if (res.ok) {
        setMetrics((prev) => ({
          ...prev,
          api: { status: "up", latency, details: "Healthy" },
        }));
      } else {
        setMetrics((prev) => ({
          ...prev,
          api: { status: "down", details: `HTTP ${res.status}` },
        }));
      }
    } catch {
      setMetrics((prev) => ({
        ...prev,
        api: { status: "down", details: "Unreachable" },
      }));
    }

    try {
      const producerStart = Date.now();
      const res = await fetch("/producer/actuator/health");
      const latency = Date.now() - producerStart;
      if (!res.ok) {
        setMetrics((prev) => ({
          ...prev,
          producer: { status: "down", latency, details: `HTTP ${res.status}` },
        }));
      } else {
        const data = await res.json();
        setMetrics((prev) => ({
          ...prev,
          producer: {
            status: data.status === "UP" ? "up" : "down",
            latency,
            details: data.status,
          },
        }));
      }
    } catch {
      setMetrics((prev) => ({
        ...prev,
        producer: { status: "down", details: "Offline" },
      }));
    }

    // Optional: display producer "log-like" signal (last sent + total sent)
    try {
      const res = await fetch("/producer/api/v1/producer/stats");
      if (res.ok) {
        const stats = await res.json();
        setMetrics((prev) => ({
          ...prev,
          producer: {
            ...prev.producer,
            details: `sent=${stats.totalEventsSent}${stats.lastEventSentAt ? ` last=${new Date(stats.lastEventSentAt).toLocaleTimeString()}` : ""}`,
          },
        }));
      }
    } catch {
      // ignore
    }

    try {
      const [rateRes, byZoneRes] = await Promise.all([
        fetch("/producer/api/v1/producer/stats/rate?windowSeconds=60"),
        fetch("/producer/api/v1/producer/stats/by-zone?windowSeconds=60&limit=8"),
      ]);

      if (rateRes.ok) {
        const rate = await rateRes.json();
        const totalInWindow = Number(rate.totalEventsInWindow ?? 0);
        const windowSeconds = Math.max(Number(rate.windowSeconds ?? 60), 1);
        setMetrics((prev) => ({
          ...prev,
          producerRatePoints: rate.ratePoints ?? [],
          eventsPerSecond: Math.round(totalInWindow / windowSeconds),
        }));
      }

      if (byZoneRes.ok) {
        const zones = await byZoneRes.json();
        setMetrics((prev) => ({
          ...prev,
          producerZoneDistribution: zones ?? [],
        }));
      }
    } catch {
      // ignore
    }

    try {
      const res = await fetch(
        `/api/v1/analytics/merchant/${selectedZone}?window=${aggregateWindow}&limit=20`
      );
      if (res.ok) {
        const data: MerchantStats[] = await res.json();
        setMetrics((prev) => {
          setPrevTransactions(prev.totalTransactions);
          return {
            ...prev,
            merchantStats: data,
            cassandra: {
              status: "up",
              details: `${data.length} rows · ${aggregateWindow}`,
            },
          };
        });
      } else {
        setMetrics((prev) => ({
          ...prev,
          cassandra: { status: "down", details: `HTTP ${res.status}` },
        }));
      }
    } catch {
      setMetrics((prev) => ({
        ...prev,
        cassandra: { status: "down", details: "No data" },
      }));
    }

    try {
      const [leaderboardRes, globalRes] = await Promise.all([
        fetch("/api/v1/analytics/leaderboard?window=30s&limit=8"),
        fetch("/api/v1/analytics/global?window=30s"),
      ]);

      if (leaderboardRes.ok) {
        const leaderboard = await leaderboardRes.json();
        setMetrics((prev) => ({
          ...prev,
          leaderboard: leaderboard ?? [],
        }));
      }

      if (globalRes.ok) {
        const global = await globalRes.json();
        setMetrics((prev) => ({
          ...prev,
          globalStats: global,
          totalTransactions: Number(global.totalTransactions ?? prev.totalTransactions),
        }));
      }
    } catch {
      // ignore
    }

    setMetrics((prev) => ({
      ...prev,
      kafka:
        prev.api.status === "up"
          ? { status: "up", details: "Broker active" }
          : { status: "down", details: "Offline" },
      redis:
        prev.api.status === "up"
          ? { status: "up", details: "Cache ready" }
          : { status: "down", details: "Offline" },
      spark:
        prev.cassandra.status === "up"
          ? { status: "up", details: "Streaming" }
          : { status: "down", details: "No jobs" },
    }));
  }, [aggregateWindow, selectedZone]);

  useEffect(() => {
    if (!showPreloader) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, showPreloader]);

  // Terminal commands
  const commands: Record<string, () => void> = {
    whoami: () =>
      addLines([
        "user: swamizero",
        "role: distributed systems engineer",
        "status: active",
      ]),
    "ls services/": () =>
      addLines([
        "├── kafka (9092)      → " +
          (metrics.kafka.status === "up" ? "🟢 UP" : "🔴 DOWN"),
        "├── cassandra (9042)  → " +
          (metrics.cassandra.status === "up" ? "🟢 UP" : "🔴 DOWN"),
        "├── redis (6379)      → " +
          (metrics.redis.status === "up" ? "🟢 UP" : "🔴 DOWN"),
        "├── spark (8080)      → " +
          (metrics.spark.status === "up" ? "🟢 UP" : "🔴 DOWN"),
        "├── producer (8083)   → " +
          (metrics.producer.status === "up" ? "🟢 UP" : "🔴 DOWN"),
        "└── api (8082)        → " +
          (metrics.api.status === "up" ? "🟢 UP" : "🔴 DOWN"),
      ]),
    stats: () =>
      addLines([
        `Total Transactions: ${displayedTotalTransactions.toLocaleString()}`,
        `Events/sec: ~${displayedEventsPerSecond}`,
        `API Latency: ${metrics.api.latency || "N/A"}ms`,
      ]),
    producer: () =>
      addLines([
        `Producer: ${metrics.producer.status.toUpperCase()}${metrics.producer.details ? ` (${metrics.producer.details})` : ""}`,
      ]),
    neofetch: () =>
      addLines([
        "                  -`                    swamizero@platform",
        "                 .o+`                   ──────────────────",
        "                `ooo/                   OS: Event Streaming Platform",
        "               `+oooo:                  Kernel: Kafka + Spark + Cassandra",
        "              `+oooooo:                 Services: 6 active",
        "              -+oooooo+:                Throughput: " +
          displayedEventsPerSecond +
          " evt/s",
        "            `/:-:++oooo+:               Latency: " +
          (metrics.api.latency || "?") +
          "ms",
      ]),
    help: () =>
      addLines([
        "Commands:",
        "  whoami",
        "  ls services/   (aliases: services, status, ls services)",
        "  stats",
        "  producer       (shows producer status)",
        "  neofetch",
        "  clear",
      ]),
    clear: () => setLines([]),
  };

  const addLines = (newLines: string[]) =>
    setLines((prev) => [...prev, ...newLines]);

  useEffect(() => {
    if (!showPreloader && isTyping) {
      const initial = [
        "Event Streaming Platform v2.0",
        "Session established: " + new Date().toLocaleString(),
        'Type "help" for available commands.',
        "",
      ];
      let i = 0;
      const interval = setInterval(() => {
        setLines((prev) => [...prev, initial[i]]);
        i++;
        if (i >= initial.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 60);
      return () => clearInterval(interval);
    }
  }, [showPreloader, isTyping]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = command.trim();
    const normalized = raw.toLowerCase().replace(/\s+/g, " ");
    addLines([`$ ${raw}`]);

    // Aliases / forgiving inputs
    const alias: Record<string, string> = {
      "ls services": "ls services/",
      "ls services/": "ls services/",
      services: "ls services/",
      status: "ls services/",
      "?": "help",
    };

    const resolved = alias[normalized] ?? normalized;
    if (commands[resolved]) commands[resolved]();
    else if (normalized !== "")
      addLines([`command not found: ${raw}`, `try: help`]);
    setCommand("");
  };

  // Calculate transaction trend
  const transactionTrend =
    prevTransactions > 0
      ? (
          ((metrics.totalTransactions - prevTransactions) / prevTransactions) *
          100
        ).toFixed(1)
      : "0";
  const trendIsPositive = parseFloat(transactionTrend) >= 0;

  if (showPreloader) {
    return (
      <Preloader
        onComplete={() => {
          try {
            sessionStorage.setItem("preloaderDone", "1");
          } catch {
            /* ignore */
          }
          setShowPreloader(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full preloader-bg">
      {/* Navigation */}
      <nav
        className="glass-card mx-4 mt-4 mb-6 px-6 py-3 flex items-center justify-between"
        style={{ borderRadius: "12px" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(34, 211, 238, 0.2))",
              border: "1px solid rgba(59, 130, 246, 0.3)",
            }}
          >
            <Zap size={16} className="text-cyan-400" />
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">
            Event Platform
          </span>
        </div>

        <div className="flex items-center gap-1">
          <NavItem
            active={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
            icon={<LayoutDashboard size={14} />}
            label="Dashboard"
          />
          <NavItem
            active={activeTab === "terminal"}
            onClick={() => setActiveTab("terminal")}
            icon={<Terminal size={14} />}
            label="Terminal"
          />
          <NavItem
            active={activeTab === "health"}
            onClick={() => setActiveTab("health")}
            icon={<Gauge size={14} />}
            label="Service Health"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live</span>
        </div>
      </nav>

      {/* Main Content */}
      <main className="px-4 pb-6">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  title="Total Transactions"
                  value={displayedTotalTransactions.toLocaleString()}
                  trend={`${trendIsPositive ? "+" : ""}${transactionTrend}%`}
                  trendUp={trendIsPositive}
                  icon={<TrendingUp size={18} />}
                  color="blue"
                />
                <MetricCard
                  title="Events / Second"
                  value={`~${displayedEventsPerSecond}`}
                  trend="live"
                  icon={<Activity size={18} />}
                  color="cyan"
                  pulse
                />
                <MetricCard
                  title="API Latency"
                  value={
                    metrics.api.latency ? `${metrics.api.latency}ms` : "--"
                  }
                  trend={
                    metrics.api.latency && metrics.api.latency < 100
                      ? "optimal"
                      : metrics.api.latency
                        ? "high"
                        : "N/A"
                  }
                  icon={<Clock size={18} />}
                  color={
                    metrics.api.latency && metrics.api.latency < 100
                      ? "emerald"
                      : "amber"
                  }
                />
              </div>

              {/* Service Status Row */}
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 px-1">
                  Service Status
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <ServiceCard
                    name="Kafka"
                    port="9092"
                    status={metrics.kafka}
                    icon={<Radio size={16} />}
                  />
                  <ServiceCard
                    name="Spark"
                    port="8080"
                    status={metrics.spark}
                    icon={<Cpu size={16} />}
                  />
                  <ServiceCard
                    name="Cassandra"
                    port="9042"
                    status={metrics.cassandra}
                    icon={<Database size={16} />}
                  />
                  <ServiceCard
                    name="Redis"
                    port="6379"
                    status={metrics.redis}
                    icon={<HardDrive size={16} />}
                  />
                  <ServiceCard
                    name="Producer"
                    port="8083"
                    status={metrics.producer}
                    icon={<Server size={16} />}
                  />
                  <ServiceCard
                    name="API"
                    port="8082"
                    status={metrics.api}
                    icon={<Zap size={16} />}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="glass-card p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Producer Throughput
                      </div>
                      <div className="text-2xl font-semibold text-white mt-1">
                        ~{displayedEventsPerSecond} evt/s
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>Last 60s</div>
                      <div>{metrics.producer.details ?? "No producer data"}</div>
                    </div>
                  </div>
                  <SparklineChart
                    points={displayedRatePoints}
                    isPlaceholder={!hasLiveRateData}
                  />
                </div>

                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Producer Top Zones
                    </div>
                    <div className="text-xs text-slate-500">Last 60s</div>
                  </div>
                  <div className="space-y-2">
                    {displayedZoneDistribution.length > 0 ? (
                      displayedZoneDistribution.map((zone) => (
                        <ZoneBar
                          key={zone.zoneId}
                          label={zone.zoneId}
                          value={zone.count}
                          maxValue={displayedZoneDistribution[0].count}
                        />
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">No producer distribution data yet.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="glass-card p-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                    Global Totals
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-slate-500">Window</div>
                      <div className="text-sm text-slate-200">{displayedGlobalStats.window}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Transactions</div>
                      <div className="text-2xl font-semibold text-white">
                        {displayedGlobalStats.totalTransactions.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Revenue (cents)</div>
                      <div className="text-lg text-slate-200">
                        {displayedGlobalStats.totalRevenue.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Active Zones</div>
                      <div className="text-lg text-slate-200">{displayedGlobalStats.activeZones}</div>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Top Revenue Zones
                    </div>
                    <div className="text-xs text-slate-500">30s leaderboard</div>
                  </div>
                  <div className="space-y-2">
                    {displayedLeaderboard.length > 0 ? (
                      displayedLeaderboard.map((row) => (
                        <div key={row.zoneId} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                          <div>
                            <div className="text-sm text-white">{row.zoneId}</div>
                            <div className="text-xs text-slate-500">
                              {row.totalTransactions.toLocaleString()} txns
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-cyan-300">{row.totalRevenue.toLocaleString()}</div>
                            <div className="text-xs text-slate-500">
                              {row.latestWindowStart ? new Date(row.latestWindowStart).toLocaleTimeString() : "n/a"}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">No leaderboard rows yet.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Aggregates Table */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Recent Aggregates
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{selectedZone}</span>
                    <span>·</span>
                    <span>{aggregateWindow}</span>
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row gap-3 mb-3">
                  <div className="flex-1">
                    <input
                      value={zoneQuery}
                      onChange={(e) => setZoneQuery(e.target.value)}
                      placeholder="Search zones (e.g. 1, 12, zone-64)"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <div className="md:w-64">
                    <select
                      value={selectedZone}
                      onChange={(e) => setSelectedZone(e.target.value)}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50"
                    >
                      {filteredZones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:w-48">
                    <select
                      value={aggregateWindow}
                      onChange={(e) =>
                        setAggregateWindow(e.target.value as AggregateWindow)
                      }
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/50"
                    >
                      {AGGREGATE_WINDOW_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-3 text-xs text-slate-500">
                  Showing latest {displayedMerchantStats.length} rows for {selectedZone} in the selected window.
                </div>
                <div className="glass-table">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left">Window Start</th>
                        <th className="text-right">Transactions</th>
                        <th className="text-right">Revenue (cents)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedMerchantStats.length > 0 ? (
                        displayedMerchantStats.map((stat, idx) => (
                          <motion.tr
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <td className="font-mono text-slate-300">
                              {new Date(stat.windowStart).toLocaleTimeString()}
                            </td>
                            <td className="text-right font-mono text-cyan-400">
                              {stat.transactionCount.toLocaleString()}
                            </td>
                            <td className="text-right font-mono text-slate-400">
                              {stat.totalRevenue?.toLocaleString()}
                            </td>
                          </motion.tr>
                        ))
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "terminal" && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card overflow-hidden"
              style={{ height: "calc(100vh - 140px)" }}
            >
              {/* Terminal Header */}
              <div
                className="px-4 py-3 border-b border-white/5 flex items-center justify-between"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-cyan-400" />
                  <span className="text-xs font-medium text-slate-400">
                    swamizero@platform: ~
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-cyan-500/50" />
                </div>
              </div>

              {/* Terminal Body */}
              <div
                ref={scrollRef}
                className="p-4 overflow-y-auto font-mono text-sm"
                style={{ height: "calc(100% - 50px)" }}
              >
                <div className="space-y-1">
                  {lines.map((line, idx) => {
                    const safeLine = typeof line === "string" ? line : "";
                    return (
                      <div
                        key={idx}
                        className="whitespace-pre-wrap leading-relaxed"
                      >
                        {safeLine.startsWith("$") ? (
                          <span className="text-cyan-400">{safeLine}</span>
                        ) : safeLine.includes("🟢") ? (
                          <span className="text-emerald-400">{safeLine}</span>
                        ) : safeLine.includes("🔴") ? (
                          <span className="text-rose-400">{safeLine}</span>
                        ) : (
                          <span className="text-slate-300">{safeLine}</span>
                        )}
                      </div>
                    );
                  })}
                  {!isTyping && (
                    <form
                      onSubmit={handleCommand}
                      className="flex items-center gap-2 mt-2"
                    >
                      <span className="text-cyan-400">$</span>
                      <input
                        autoFocus
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className="bg-transparent border-none outline-none flex-1 text-slate-200 caret-cyan-400"
                      />
                      <motion.div
                        animate={{ opacity: [1, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="w-2 h-5 bg-cyan-400"
                      />
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "health" && (
            <motion.div
              key="health"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Service Health Monitor
                </h2>
                <div className="space-y-3">
                  <HealthRow
                    name="Kafka Message Broker"
                    port="9092"
                    status={metrics.kafka}
                    icon={<Radio size={18} />}
                  />
                  <HealthRow
                    name="Spark Streaming Engine"
                    port="8080"
                    status={metrics.spark}
                    icon={<Cpu size={18} />}
                  />
                  <HealthRow
                    name="Cassandra Database"
                    port="9042"
                    status={metrics.cassandra}
                    icon={<Database size={18} />}
                  />
                  <HealthRow
                    name="Redis Cache"
                    port="6379"
                    status={metrics.redis}
                    icon={<HardDrive size={18} />}
                  />
                  <HealthRow
                    name="Event Producer"
                    port="8083"
                    status={metrics.producer}
                    icon={<Server size={18} />}
                  />
                  <HealthRow
                    name="Analytics API"
                    port="8082"
                    status={metrics.api}
                    icon={<Zap size={18} />}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer
        className="fixed bottom-0 left-0 right-0 px-6 py-2 text-xs text-slate-500 flex justify-between"
        style={{
          background:
            "linear-gradient(to top, rgba(10, 13, 18, 0.9), transparent)",
        }}
      >
        <span>Polling every {POLL_INTERVAL / 1000}s</span>
        <span>Real-Time Event Streaming & Analytics Platform</span>
      </footer>
    </div>
  );
}

// ============================================
// COMPONENTS
// ============================================

function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`nav-item flex items-center gap-2 rounded-lg ${active ? "active" : ""}`}
      style={
        active
          ? {
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
            }
          : {}
      }
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ServiceCard({
  name,
  port,
  status,
  icon,
}: {
  name: string;
  port: string;
  status: ServiceStatus;
  icon: React.ReactNode;
}) {
  const statusClass =
    status.status === "up"
      ? "healthy"
      : status.status === "down"
        ? "down"
        : "initializing";

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.02 }}
      className="glass-card-sm p-4 cursor-default"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-slate-400">{icon}</div>
        <div className={`status-dot ${statusClass}`} />
      </div>
      <div className="text-sm font-medium text-white">{name}</div>
      <div className="text-xs text-slate-500 mt-0.5">:{port}</div>
      {status.latency && (
        <div className="text-xs text-cyan-400 mt-2">{status.latency}ms</div>
      )}
    </motion.div>
  );
}

function MetricCard({
  title,
  value,
  trend,
  trendUp,
  icon,
  color,
  pulse,
}: {
  title: string;
  value: string;
  trend: string;
  trendUp?: boolean;
  icon: React.ReactNode;
  color: "blue" | "cyan" | "emerald" | "amber";
  pulse?: boolean;
}) {
  const colorClasses = {
    blue: "text-blue-400",
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
  };

  const trendColor =
    trend === "live"
      ? "text-emerald-400"
      : trend === "optimal"
        ? "text-emerald-400"
        : trend === "high"
          ? "text-amber-400"
          : trendUp
            ? "text-emerald-400"
            : "text-rose-400";

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-4">
        <div className={`${colorClasses[color]}`}>{icon}</div>
        <div
          className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}
        >
          {trend !== "live" &&
            trend !== "optimal" &&
            trend !== "high" &&
            trend !== "N/A" &&
            (trendUp ? (
              <ArrowUpRight size={12} />
            ) : (
              <ArrowDownRight size={12} />
            ))}
          {pulse && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
          )}
          {trend}
        </div>
      </div>
      <div className="text-3xl font-bold text-white tracking-tight">
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">
        {title}
      </div>
    </div>
  );
}

function SparklineChart({
  points,
  isPlaceholder,
}: {
  points: RatePoint[];
  isPlaceholder?: boolean;
}) {
  const width = 480;
  const height = 120;
  const values = points.map((p) => p.count);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const chartPadding = 12;
  const chartHeight = height - chartPadding * 2;
  const chartPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : (index / (points.length - 1)) * width;
    const y =
      height -
      chartPadding -
      ((point.count - minValue) / Math.max(maxValue - minValue, 1)) *
        chartHeight;
    return { x, y, count: point.count };
  });
  const smoothedPoints = chartPoints.map((point, index, arr) => {
    const prev = arr[index - 1]?.count ?? point.count;
    const next = arr[index + 1]?.count ?? point.count;
    const smoothedCount = (prev + point.count * 2 + next) / 4;
    const y =
      height -
      chartPadding -
      ((smoothedCount - minValue) / Math.max(maxValue - minValue, 1)) *
        chartHeight;
    return { ...point, y };
  });

  const path = smoothedPoints.reduce((acc, point, index, arr) => {
    if (index === 0) {
      return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }
    const prev = arr[index - 1];
    const controlX = ((prev.x + point.x) / 2).toFixed(1);
    return `${acc} Q ${controlX} ${prev.y.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, "");
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
  const lastPoint = smoothedPoints[smoothedPoints.length - 1];
  const midGuide = height - chartPadding - chartHeight / 2;

  return points.length > 0 ? (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28">
        <line
          x1="0"
          y1={chartPadding}
          x2={width}
          y2={chartPadding}
          stroke="rgba(148, 163, 184, 0.18)"
          strokeDasharray="4 6"
        />
        <line
          x1="0"
          y1={midGuide}
          x2={width}
          y2={midGuide}
          stroke="rgba(148, 163, 184, 0.14)"
          strokeDasharray="4 6"
        />
        <line
          x1="0"
          y1={height - chartPadding}
          x2={width}
          y2={height - chartPadding}
          stroke="rgba(148, 163, 184, 0.18)"
          strokeDasharray="4 6"
        />
        <path
          d={areaPath}
          fill="url(#sparkGradient)"
          opacity="0.32"
        />
        <path
          d={path}
          fill="none"
          stroke="rgb(34 211 238)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={path}
          fill="none"
          stroke="rgba(125, 211, 252, 0.35)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="4.5"
          fill="rgb(34 211 238)"
          stroke="rgba(15, 23, 42, 0.95)"
          strokeWidth="2"
        />
        <defs>
          <linearGradient id="sparkGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgb(34 211 238)" />
            <stop offset="100%" stopColor="rgb(34 211 238)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{points.length * 2.5}s history</span>
        <span>
          min {minValue} · max {maxValue} · last {points[points.length - 1].count}
        </span>
      </div>
      {isPlaceholder ? (
        <div className="mt-2 text-xs text-amber-400">
          Showing preview traffic until the first live Spark window lands.
        </div>
      ) : null}
    </div>
  ) : (
    <div className="h-28 flex items-center justify-center text-sm text-slate-500">
      No throughput data yet.
    </div>
  );
}

function ZoneBar({
  label,
  value,
  maxValue,
}: {
  label: string;
  value: number;
  maxValue: number;
}) {
  const width = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-xs font-mono text-slate-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: "linear-gradient(90deg, rgba(34,211,238,0.35), rgba(59,130,246,0.85))",
          }}
        />
      </div>
    </div>
  );
}

function HealthRow({
  name,
  port,
  status,
  icon,
}: {
  name: string;
  port: string;
  status: ServiceStatus;
  icon: React.ReactNode;
}) {
  const statusClass =
    status.status === "up"
      ? "healthy"
      : status.status === "down"
        ? "down"
        : "initializing";
  const StatusIcon =
    status.status === "up"
      ? CheckCircle
      : status.status === "down"
        ? AlertCircle
        : Clock;
  const statusColor =
    status.status === "up"
      ? "text-emerald-400"
      : status.status === "down"
        ? "text-rose-400"
        : "text-amber-400";

  return (
    <div
      className="flex items-center justify-between p-4 rounded-lg"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center gap-4">
        <div className="text-slate-400">{icon}</div>
        <div>
          <div className="text-sm font-medium text-white">{name}</div>
          <div className="text-xs text-slate-500">Port {port}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {status.latency && (
          <span className="text-xs text-slate-400 font-mono">
            {status.latency}ms
          </span>
        )}
        <div className="flex items-center gap-2">
          <div className={`status-dot ${statusClass}`} />
          <StatusIcon size={16} className={statusColor} />
        </div>
      </div>
    </div>
  );
}
