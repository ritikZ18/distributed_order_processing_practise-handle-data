import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Terminal, Activity, Server, Database, Cpu, Zap,
    Radio, HardDrive, Clock, TrendingUp, AlertCircle, CheckCircle,
    LayoutDashboard, Gauge, ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import Preloader from './components/Preloader';

const POLL_INTERVAL = 3000;

// Types
interface ServiceStatus {
    status: 'up' | 'down' | 'loading';
    latency?: number;
    details?: string;
}

interface MerchantStats {
    merchant_id: string;
    window_start: string;
    total_revenue: number;
    transaction_count: number;
}

interface PlatformMetrics {
    api: ServiceStatus;
    producer: ServiceStatus;
    kafka: ServiceStatus;
    cassandra: ServiceStatus;
    redis: ServiceStatus;
    spark: ServiceStatus;
    merchantStats: MerchantStats[];
    eventsPerSecond: number;
    totalTransactions: number;
}

type TabType = 'dashboard' | 'terminal' | 'health';

export default function App() {
    const [showPreloader, setShowPreloader] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [lines, setLines] = useState<string[]>([]);
    const [command, setCommand] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [metrics, setMetrics] = useState<PlatformMetrics>({
        api: { status: 'loading' },
        producer: { status: 'loading' },
        kafka: { status: 'loading' },
        cassandra: { status: 'loading' },
        redis: { status: 'loading' },
        spark: { status: 'loading' },
        merchantStats: [],
        eventsPerSecond: 0,
        totalTransactions: 0,
    });

    // Previous values for trend calculation
    const [prevTransactions, setPrevTransactions] = useState(0);

    // Fetch service health
    const fetchMetrics = useCallback(async () => {
        const start = Date.now();

        try {
            const res = await fetch('/api/v1/analytics/health');
            const latency = Date.now() - start;
            if (res.ok) {
                setMetrics(prev => ({ ...prev, api: { status: 'up', latency, details: 'Healthy' } }));
            } else {
                setMetrics(prev => ({ ...prev, api: { status: 'down', details: `HTTP ${res.status}` } }));
            }
        } catch {
            setMetrics(prev => ({ ...prev, api: { status: 'down', details: 'Unreachable' } }));
        }

        try {
            const producerStart = Date.now();
            const res = await fetch('/producer/actuator/health');
            const latency = Date.now() - producerStart;
            if (res.ok) {
                const data = await res.json();
                setMetrics(prev => ({
                    ...prev,
                    producer: { status: data.status === 'UP' ? 'up' : 'down', latency, details: data.status }
                }));
            }
        } catch {
            setMetrics(prev => ({ ...prev, producer: { status: 'down', details: 'Offline' } }));
        }

        try {
            const res = await fetch('/api/v1/analytics/merchant/zone-1');
            if (res.ok) {
                const data: MerchantStats[] = await res.json();
                const total = data.reduce((sum, s) => sum + s.transaction_count, 0);
                setMetrics(prev => {
                    setPrevTransactions(prev.totalTransactions);
                    return {
                        ...prev,
                        merchantStats: data.slice(0, 5),
                        totalTransactions: total,
                        eventsPerSecond: Math.round(total / Math.max(data.length * 300, 1)),
                        cassandra: { status: 'up', details: `${data.length} windows` }
                    };
                });
            }
        } catch {
            setMetrics(prev => ({ ...prev, cassandra: { status: 'down', details: 'No data' } }));
        }

        setMetrics(prev => ({
            ...prev,
            kafka: prev.api.status === 'up' ? { status: 'up', details: 'Broker active' } : { status: 'down', details: 'Offline' },
            redis: prev.api.status === 'up' ? { status: 'up', details: 'Cache ready' } : { status: 'down', details: 'Offline' },
            spark: prev.cassandra.status === 'up' ? { status: 'up', details: 'Streaming' } : { status: 'down', details: 'No jobs' },
        }));
    }, []);

    useEffect(() => {
        if (!showPreloader) {
            fetchMetrics();
            const interval = setInterval(fetchMetrics, POLL_INTERVAL);
            return () => clearInterval(interval);
        }
    }, [fetchMetrics, showPreloader]);

    // Terminal commands
    const commands: Record<string, () => void> = {
        'whoami': () => addLines(['user: swamizero', 'role: distributed systems engineer', 'status: active']),
        'ls services/': () => addLines([
            '├── kafka (9092)      → ' + (metrics.kafka.status === 'up' ? '🟢 UP' : '🔴 DOWN'),
            '├── cassandra (9042)  → ' + (metrics.cassandra.status === 'up' ? '🟢 UP' : '🔴 DOWN'),
            '├── redis (6379)      → ' + (metrics.redis.status === 'up' ? '🟢 UP' : '🔴 DOWN'),
            '├── spark (8080)      → ' + (metrics.spark.status === 'up' ? '🟢 UP' : '🔴 DOWN'),
            '├── producer (8083)   → ' + (metrics.producer.status === 'up' ? '🟢 UP' : '🔴 DOWN'),
            '└── api (8082)        → ' + (metrics.api.status === 'up' ? '🟢 UP' : '🔴 DOWN'),
        ]),
        'stats': () => addLines([
            `Total Transactions: ${metrics.totalTransactions.toLocaleString()}`,
            `Events/sec: ~${metrics.eventsPerSecond}`,
            `API Latency: ${metrics.api.latency || 'N/A'}ms`,
        ]),
        'neofetch': () => addLines([
            '                  -`                    swamizero@platform',
            '                 .o+`                   ──────────────────',
            '                `ooo/                   OS: Event Streaming Platform',
            '               `+oooo:                  Kernel: Kafka + Spark + Cassandra',
            '              `+oooooo:                 Services: 6 active',
            '              -+oooooo+:                Throughput: ' + metrics.eventsPerSecond + ' evt/s',
            '            `/:-:++oooo+:               Latency: ' + (metrics.api.latency || '?') + 'ms',
        ]),
        'help': () => addLines(['Commands: whoami, ls services/, stats, neofetch, clear']),
        'clear': () => setLines([])
    };

    const addLines = (newLines: string[]) => setLines(prev => [...prev, ...newLines]);

    useEffect(() => {
        if (!showPreloader && isTyping) {
            const initial = [
                'Event Streaming Platform v2.0',
                'Session established: ' + new Date().toLocaleString(),
                'Type "help" for available commands.',
                ''
            ];
            let i = 0;
            const interval = setInterval(() => {
                setLines(prev => [...prev, initial[i]]);
                i++;
                if (i >= initial.length) { clearInterval(interval); setIsTyping(false); }
            }, 60);
            return () => clearInterval(interval);
        }
    }, [showPreloader, isTyping]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [lines]);

    const handleCommand = (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = command.trim().toLowerCase();
        addLines([`$ ${command}`]);
        if (commands[cmd]) commands[cmd]();
        else if (cmd !== '') addLines([`command not found: ${command}`]);
        setCommand('');
    };

    // Calculate transaction trend
    const transactionTrend = prevTransactions > 0
        ? ((metrics.totalTransactions - prevTransactions) / prevTransactions * 100).toFixed(1)
        : '0';
    const trendIsPositive = parseFloat(transactionTrend) >= 0;

    if (showPreloader) {
        return <Preloader onComplete={() => setShowPreloader(false)} />;
    }

    return (
        <div className="min-h-screen w-full preloader-bg">
            {/* Navigation */}
            <nav className="glass-card mx-4 mt-4 mb-6 px-6 py-3 flex items-center justify-between"
                style={{ borderRadius: '12px' }}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(34, 211, 238, 0.2))',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                        }}>
                        <Zap size={16} className="text-cyan-400" />
                    </div>
                    <span className="text-sm font-semibold text-white tracking-tight">
                        Event Platform
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <NavItem
                        active={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                        icon={<LayoutDashboard size={14} />}
                        label="Dashboard"
                    />
                    <NavItem
                        active={activeTab === 'terminal'}
                        onClick={() => setActiveTab('terminal')}
                        icon={<Terminal size={14} />}
                        label="Terminal"
                    />
                    <NavItem
                        active={activeTab === 'health'}
                        onClick={() => setActiveTab('health')}
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
                    {activeTab === 'dashboard' && (
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
                                    value={metrics.totalTransactions.toLocaleString()}
                                    trend={`${trendIsPositive ? '+' : ''}${transactionTrend}%`}
                                    trendUp={trendIsPositive}
                                    icon={<TrendingUp size={18} />}
                                    color="blue"
                                />
                                <MetricCard
                                    title="Events / Second"
                                    value={`~${metrics.eventsPerSecond}`}
                                    trend="live"
                                    icon={<Activity size={18} />}
                                    color="cyan"
                                    pulse
                                />
                                <MetricCard
                                    title="API Latency"
                                    value={metrics.api.latency ? `${metrics.api.latency}ms` : '--'}
                                    trend={metrics.api.latency && metrics.api.latency < 100 ? 'optimal' : metrics.api.latency ? 'high' : 'N/A'}
                                    icon={<Clock size={18} />}
                                    color={metrics.api.latency && metrics.api.latency < 100 ? 'emerald' : 'amber'}
                                />
                            </div>

                            {/* Service Status Row */}
                            <div>
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 px-1">
                                    Service Status
                                </h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                    <ServiceCard name="Kafka" port="9092" status={metrics.kafka} icon={<Radio size={16} />} />
                                    <ServiceCard name="Spark" port="8080" status={metrics.spark} icon={<Cpu size={16} />} />
                                    <ServiceCard name="Cassandra" port="9042" status={metrics.cassandra} icon={<Database size={16} />} />
                                    <ServiceCard name="Redis" port="6379" status={metrics.redis} icon={<HardDrive size={16} />} />
                                    <ServiceCard name="Producer" port="8083" status={metrics.producer} icon={<Server size={16} />} />
                                    <ServiceCard name="API" port="8082" status={metrics.api} icon={<Zap size={16} />} />
                                </div>
                            </div>

                            {/* Aggregates Table */}
                            <div>
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Recent Aggregates
                                    </h2>
                                    <span className="text-xs text-slate-500">zone-1</span>
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
                                            {metrics.merchantStats.length > 0 ? metrics.merchantStats.map((stat, idx) => (
                                                <motion.tr
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                >
                                                    <td className="font-mono text-slate-300">
                                                        {new Date(stat.window_start).toLocaleTimeString()}
                                                    </td>
                                                    <td className="text-right font-mono text-cyan-400">
                                                        {stat.transaction_count.toLocaleString()}
                                                    </td>
                                                    <td className="text-right font-mono text-slate-400">
                                                        {stat.total_revenue?.toLocaleString()}
                                                    </td>
                                                </motion.tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={3} className="text-center py-8 text-slate-500">
                                                        Waiting for data... Processor may still be initializing.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'terminal' && (
                        <motion.div
                            key="terminal"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="glass-card overflow-hidden"
                            style={{ height: 'calc(100vh - 140px)' }}
                        >
                            {/* Terminal Header */}
                            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between"
                                style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <div className="flex items-center gap-2">
                                    <Terminal size={14} className="text-cyan-400" />
                                    <span className="text-xs font-medium text-slate-400">swamizero@platform: ~</span>
                                </div>
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-white/10" />
                                    <div className="w-3 h-3 rounded-full bg-white/10" />
                                    <div className="w-3 h-3 rounded-full bg-cyan-500/50" />
                                </div>
                            </div>

                            {/* Terminal Body */}
                            <div ref={scrollRef} className="p-4 overflow-y-auto font-mono text-sm"
                                style={{ height: 'calc(100% - 50px)' }}>
                                <div className="space-y-1">
                                    {lines.map((line, idx) => (
                                        <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                                            {line.startsWith('$') ? (
                                                <span className="text-cyan-400">{line}</span>
                                            ) : line.includes('🟢') ? (
                                                <span className="text-emerald-400">{line}</span>
                                            ) : line.includes('🔴') ? (
                                                <span className="text-rose-400">{line}</span>
                                            ) : (
                                                <span className="text-slate-300">{line}</span>
                                            )}
                                        </div>
                                    ))}
                                    {!isTyping && (
                                        <form onSubmit={handleCommand} className="flex items-center gap-2 mt-2">
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

                    {activeTab === 'health' && (
                        <motion.div
                            key="health"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <div className="glass-card p-6">
                                <h2 className="text-lg font-semibold text-white mb-4">Service Health Monitor</h2>
                                <div className="space-y-3">
                                    <HealthRow name="Kafka Message Broker" port="9092" status={metrics.kafka} icon={<Radio size={18} />} />
                                    <HealthRow name="Spark Streaming Engine" port="8080" status={metrics.spark} icon={<Cpu size={18} />} />
                                    <HealthRow name="Cassandra Database" port="9042" status={metrics.cassandra} icon={<Database size={18} />} />
                                    <HealthRow name="Redis Cache" port="6379" status={metrics.redis} icon={<HardDrive size={18} />} />
                                    <HealthRow name="Event Producer" port="8083" status={metrics.producer} icon={<Server size={18} />} />
                                    <HealthRow name="Analytics API" port="8082" status={metrics.api} icon={<Zap size={18} />} />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Footer */}
            <footer className="fixed bottom-0 left-0 right-0 px-6 py-2 text-xs text-slate-500 flex justify-between"
                style={{ background: 'linear-gradient(to top, rgba(10, 13, 18, 0.9), transparent)' }}>
                <span>Polling every {POLL_INTERVAL / 1000}s</span>
                <span>Real-Time Event Streaming & Analytics Platform</span>
            </footer>
        </div>
    );
}

// ============================================
// COMPONENTS
// ============================================

function NavItem({ active, onClick, icon, label }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`nav-item flex items-center gap-2 rounded-lg ${active ? 'active' : ''}`}
            style={active ? {
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
            } : {}}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

function ServiceCard({ name, port, status, icon }: {
    name: string;
    port: string;
    status: ServiceStatus;
    icon: React.ReactNode;
}) {
    const statusClass = status.status === 'up' ? 'healthy' : status.status === 'down' ? 'down' : 'initializing';

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

function MetricCard({ title, value, trend, trendUp, icon, color, pulse }: {
    title: string;
    value: string;
    trend: string;
    trendUp?: boolean;
    icon: React.ReactNode;
    color: 'blue' | 'cyan' | 'emerald' | 'amber';
    pulse?: boolean;
}) {
    const colorClasses = {
        blue: 'text-blue-400',
        cyan: 'text-cyan-400',
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
    };

    const trendColor = trend === 'live' ? 'text-emerald-400' :
        trend === 'optimal' ? 'text-emerald-400' :
            trend === 'high' ? 'text-amber-400' :
                trendUp ? 'text-emerald-400' : 'text-rose-400';

    return (
        <div className="metric-card">
            <div className="flex items-center justify-between mb-4">
                <div className={`${colorClasses[color]}`}>{icon}</div>
                <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
                    {trend !== 'live' && trend !== 'optimal' && trend !== 'high' && trend !== 'N/A' && (
                        trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />
                    )}
                    {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />}
                    {trend}
                </div>
            </div>
            <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
            <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{title}</div>
        </div>
    );
}

function HealthRow({ name, port, status, icon }: {
    name: string;
    port: string;
    status: ServiceStatus;
    icon: React.ReactNode;
}) {
    const statusClass = status.status === 'up' ? 'healthy' : status.status === 'down' ? 'down' : 'initializing';
    const StatusIcon = status.status === 'up' ? CheckCircle : status.status === 'down' ? AlertCircle : Clock;
    const statusColor = status.status === 'up' ? 'text-emerald-400' : status.status === 'down' ? 'text-rose-400' : 'text-amber-400';

    return (
        <div className="flex items-center justify-between p-4 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center gap-4">
                <div className="text-slate-400">{icon}</div>
                <div>
                    <div className="text-sm font-medium text-white">{name}</div>
                    <div className="text-xs text-slate-500">Port {port}</div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {status.latency && (
                    <span className="text-xs text-slate-400 font-mono">{status.latency}ms</span>
                )}
                <div className="flex items-center gap-2">
                    <div className={`status-dot ${statusClass}`} />
                    <StatusIcon size={16} className={statusColor} />
                </div>
            </div>
        </div>
    );
}
