import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Activity, FileText, Layout, Server, Database, Github, Cpu } from 'lucide-react';

const ACCENT_COLOR = "#1793d1";

export default function App() {
    const [lines, setLines] = useState<string[]>([]);
    const [command, setCommand] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const commands: Record<string, () => void> = {
        'whoami': () => addLines(['user: swamizero', 'role: distributed systems engineer', 'location: us-east', 'status: active']),
        'ls projects/': () => addLines(['├── distributed-processing-orders (CURRENT)', '├── dns-tls-observatory', '├── voice-outreach-ai', '└── telehealth-funnel-analytics']),
        'neofetch': () => addLines([
            '                  -`                    swamizero@arch',
            '                 .o+`                   --------------',
            '                `ooo/                   OS: Arch Linux x86_64',
            '               `+oooo:                  Kernel: 5.15.0-distributed',
            '              `+oooooo:                 Platform: Kafka + Spark + Cassandra',
            '              -+oooooo+:                Services: Ingestion, Analytics, API',
            '            `/:-:++oooo+:               CPU: Distributed 1.2M events/day',
            '           `/++++/+++++++:              Memory: 16GB Redis Cluster',
            '          `/++++++++++++++:             Latency: < 80ms P99',
            '         `/+++ooooooooooooo/`          ',
            '        ./ooossssqllffoooonn/`         ',
            '       .ooossssqllffoooonnnnno.        ',
            '      -ooossssqllffoooonnnnnoons.      ',
            '     `+ossssqllffoooonnnnnoonsoso:     ',
            '    `++ossssqllffoooonnnnnoonsososo.   ',
            '   `++ossssqllffoooonnnnnoonsososo/`   ',
            '  .++ossssqllffoooonnnnnoonsososo/`    '
        ]),
        'cat about.txt': () => addLines([
            'This platform is a high-performance event streaming system.',
            'It leverages Kafka for fault-tolerant ingestion, Spark for',
            'real-time windowed aggregation, and Cassandra for persistence.',
            'A Redis-backed API ensures sub-80ms response times for dashboards.'
        ]),
        'help': () => addLines(['Available commands: whoami, ls projects/, neofetch, cat about.txt, clear, help']),
        'clear': () => setLines([])
    };

    const addLines = (newLines: string[]) => {
        setLines(prev => [...prev, ...newLines]);
    };

    useEffect(() => {
        if (isTyping) {
            const initial = [
                'Arch Linux 6.1.0-platform (tty1)',
                'swamizero login: system',
                'Password: *********',
                'Last login: ' + new Date().toLocaleString(),
                'Welcome to the Real-Time Event Platform.',
                'Type "help" for a list of available commands.',
                ''
            ];
            let i = 0;
            const interval = setInterval(() => {
                setLines(prev => [...prev, initial[i]]);
                i++;
                if (i >= initial.length) {
                    clearInterval(interval);
                    setIsTyping(false);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lines]);

    const handleCommand = (e: React.FormEvent) => {
        e.preventDefault();
        const cmd = command.trim().toLowerCase();
        addLines([`swamizero@arch ~ $ ${command}`]);

        if (commands[cmd]) {
            commands[cmd]();
        } else if (cmd !== '') {
            addLines([`zsh: command not found: ${command}`]);
        }
        setCommand('');
    };

    return (
        <div className="flex flex-col h-screen w-screen p-4 md:p-8">
            <div className="scanline" />

            {/* Terminal Title Bar */}
            <div className="bg-terminal-header border-t border-l border-r border-[#1793d1]/30 rounded-t-md px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-[#1793d1]" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#1793d1]/80">swamizero@arch: ~</span>
                </div>
                <div className="flex gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#1793d1]" />
                </div>
            </div>

            {/* Terminal Content */}
            <div
                ref={scrollRef}
                className="flex-1 bg-background border border-[#1793d1]/30 rounded-b-md p-4 md:p-6 overflow-y-auto terminal-window"
            >
                <div className="space-y-1">
                    {lines.map((line, idx) => (
                        <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                            {line.startsWith('swamizero@arch') ? (
                                <span className="text-terminal-accent font-bold">{line}</span>
                            ) : line.includes('│') || line.includes('─') || line.includes('├') ? (
                                <span className="text-terminal-bracket">{line}</span>
                            ) : (
                                <span>{line}</span>
                            )}
                        </div>
                    ))}

                    {!isTyping && (
                        <form onSubmit={handleCommand} className="flex items-center gap-2 mt-2">
                            <span className="text-terminal-accent font-bold">swamizero@arch ~ $</span>
                            <input
                                autoFocus
                                type="text"
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                className="bg-transparent border-none outline-none flex-1 text-terminal-text focus:ring-0 p-0"
                            />
                            <motion.div
                                animate={{ opacity: [1, 0] }}
                                transition={{ repeat: Infinity, duration: 0.8 }}
                                className="w-2 h-5 bg-terminal-accent"
                            />
                        </form>
                    )}
                </div>
            </div>

            {/* Quick Dashboard Overlay */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] uppercase font-bold tracking-tighter">
                <StatusCard icon={<Server size={14} />} label="Kafka Cluster" status="Operational" />
                <StatusCard icon={<Cpu size={14} />} label="Spark Jobs" status="Running" />
                <StatusCard icon={<Database size={14} />} label="Cassandra" status="Stable" />
                <StatusCard icon={<Activity size={14} />} label="End-to-End Latency" status="72ms" />
            </div>
        </div>
    );
}

function StatusCard({ icon, label, status }: { icon: any, label: string, status: string }) {
    return (
        <div className="bg-terminal-header border border-[#1793d1]/10 p-3 flex flex-col gap-1 transition-all hover:bg-terminal-header/50 hover:border-terminal-accent/30 cursor-crosshair">
            <div className="flex items-center gap-2 text-terminal-accent/60">
                {icon}
                <span>{label}</span>
            </div>
            <div className="text-terminal-text">{status}</div>
        </div>
    );
}
