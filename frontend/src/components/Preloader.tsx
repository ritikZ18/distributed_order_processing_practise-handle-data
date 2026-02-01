import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Radio, Cpu, Database, HardDrive, Zap, LayoutDashboard,
    CheckCircle, Loader2
} from 'lucide-react';

interface PreloaderProps {
    onComplete: () => void;
}

interface LoadingStep {
    id: string;
    name: string;
    icon: React.ReactNode;
    duration: number; // ms
}

const loadingSteps: LoadingStep[] = [
    { id: 'kafka', name: 'Kafka Message Broker', icon: <Radio size={16} />, duration: 800 },
    { id: 'spark', name: 'Spark Streaming Engine', icon: <Cpu size={16} />, duration: 700 },
    { id: 'cassandra', name: 'Cassandra Database', icon: <Database size={16} />, duration: 600 },
    { id: 'redis', name: 'Redis Cache Layer', icon: <HardDrive size={16} />, duration: 500 },
    { id: 'api', name: 'Analytics API Gateway', icon: <Zap size={16} />, duration: 600 },
    { id: 'dashboard', name: 'Live Dashboard', icon: <LayoutDashboard size={16} />, duration: 400 },
];

export default function Preloader({ onComplete }: PreloaderProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
    const [isExiting, setIsExiting] = useState(false);

    const progress = ((currentStep + 1) / loadingSteps.length) * 100;

    useEffect(() => {
        if (currentStep >= loadingSteps.length) {
            // All steps complete, start exit animation
            setTimeout(() => {
                setIsExiting(true);
                setTimeout(onComplete, 600);
            }, 300);
            return;
        }

        const step = loadingSteps[currentStep];
        const timer = setTimeout(() => {
            setCompletedSteps(prev => new Set([...prev, step.id]));
            setCurrentStep(prev => prev + 1);
        }, step.duration);

        return () => clearTimeout(timer);
    }, [currentStep, onComplete]);

    return (
        <AnimatePresence>
            {!isExiting && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                    className="fixed inset-0 z-50 flex items-center justify-center preloader-bg"
                >
                    {/* Ambient Glow Orbs */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 0.5, 0.3]
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
                            style={{
                                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
                                filter: 'blur(40px)',
                            }}
                        />
                        <motion.div
                            animate={{
                                scale: [1.1, 1, 1.1],
                                opacity: [0.2, 0.4, 0.2]
                            }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                            className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
                            style={{
                                background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)',
                                filter: 'blur(40px)',
                            }}
                        />
                    </div>

                    {/* Main Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="relative z-10 flex flex-col items-center"
                    >
                        {/* Logo / Title */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mb-8 text-center"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                    className="relative"
                                >
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{
                                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(34, 211, 238, 0.2))',
                                            border: '1px solid rgba(59, 130, 246, 0.3)',
                                        }}
                                    >
                                        <Zap size={20} className="text-cyan-400" />
                                    </div>
                                </motion.div>
                                <h1 className="text-xl font-semibold tracking-tight text-white">
                                    Event Streaming Platform
                                </h1>
                            </div>
                            <p className="text-sm text-slate-400">
                                Real-Time Analytics Engine
                            </p>
                        </motion.div>

                        {/* Glass Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="glass-card p-8 w-80"
                        >
                            {/* Loading Message */}
                            <div className="text-center mb-6">
                                <motion.p
                                    key={currentStep}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-sm font-medium text-slate-300"
                                >
                                    {currentStep < loadingSteps.length
                                        ? `Initializing ${loadingSteps[currentStep].name}...`
                                        : 'Launching Dashboard...'
                                    }
                                </motion.p>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-6">
                                <div className="progress-bar-container">
                                    <motion.div
                                        className="progress-bar-fill"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                    />
                                </div>
                                <div className="flex justify-between mt-2 text-xs text-slate-500">
                                    <span>{Math.round(progress)}%</span>
                                    <span>{currentStep}/{loadingSteps.length}</span>
                                </div>
                            </div>

                            {/* Service Steps */}
                            <div className="space-y-3">
                                {loadingSteps.map((step, index) => {
                                    const isComplete = completedSteps.has(step.id);
                                    const isActive = index === currentStep && !isComplete;
                                    const isPending = index > currentStep;

                                    return (
                                        <motion.div
                                            key={step.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 * index }}
                                            className={`service-step ${isComplete ? 'complete' : isActive ? 'active' : ''}`}
                                        >
                                            <div className={`service-step-dot ${isActive ? 'animate-pulse' : ''}`} />

                                            <div className={`transition-colors duration-300 ${isComplete ? 'text-emerald-400' :
                                                    isActive ? 'text-cyan-400' :
                                                        'text-slate-500'
                                                }`}>
                                                {step.icon}
                                            </div>

                                            <span className={`flex-1 text-sm transition-colors duration-300 ${isComplete ? 'text-slate-300' :
                                                    isActive ? 'text-white' :
                                                        'text-slate-500'
                                                }`}>
                                                {step.name}
                                            </span>

                                            <div className="w-4 h-4 flex items-center justify-center">
                                                {isComplete && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                                    >
                                                        <CheckCircle size={14} className="text-emerald-400" />
                                                    </motion.div>
                                                )}
                                                {isActive && (
                                                    <Loader2 size={14} className="text-cyan-400 animate-spin" />
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* Bottom Text */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="mt-6 text-xs text-slate-500"
                        >
                            Powered by Kafka • Spark • Cassandra
                        </motion.p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
