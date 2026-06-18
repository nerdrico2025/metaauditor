import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2 } from 'lucide-react';
import {
    type OverlayStep,
    type OverlayTheme,
    OVERLAY_THEMES,
} from '@/components/common/syncLikeOverlayPresets';

export interface OverlayStats {
    processed?: number;
    total?: number;
    audited?: number;
    skipped?: number;
    failed?: number;
    extraLine?: string;
}

interface SyncLikeOverlayProps {
    open: boolean;
    progress: number;
    title: string;
    subtitle: string;
    steps: OverlayStep[];
    currentStepIndex: number;
    currentStepDetail?: string;
    theme: OverlayTheme;
    finished?: boolean;
    finishedTitle?: string;
    footerText?: string;
    footerFinishedText?: string;
    stats?: OverlayStats;
}

export function SyncLikeOverlay({
    open,
    progress,
    title,
    subtitle,
    steps,
    currentStepIndex,
    currentStepDetail,
    theme,
    finished = false,
    finishedTitle,
    footerText,
    footerFinishedText,
    stats,
}: SyncLikeOverlayProps) {
    const themeConfig = OVERLAY_THEMES[theme];
    const CenterIcon = themeConfig.centerIcon;
    const displayTitle = finished && finishedTitle ? finishedTitle : title;

    const statsLine = stats?.extraLine ?? (
        stats && (stats.audited !== undefined || stats.skipped !== undefined || stats.failed !== undefined)
            ? `${stats.audited ?? 0} auditados · ${stats.skipped ?? 0} pulados · ${stats.failed ?? 0} falhas`
            : null
    );

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="sync-like-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    style={{ backdropFilter: 'blur(12px)' }}
                >
                    <div className="absolute inset-0 bg-black/80" />

                    <motion.div
                        initial={{ scale: 0.85, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: -20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300, delay: 0.1 }}
                        className="relative z-10 flex flex-col items-center gap-8 p-10 max-w-lg w-full"
                    >
                        <div className="relative w-40 h-40">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                className={`absolute inset-0 rounded-full border-2 ${themeConfig.outerRing}`}
                            >
                                {[0, 60, 120, 180, 240, 300].map((deg) => (
                                    <motion.div
                                        key={deg}
                                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: (deg / 360) * 2 }}
                                        className={`absolute w-2.5 h-2.5 rounded-full ${themeConfig.outerDots}`}
                                        style={{
                                            top: `${50 - 50 * Math.cos((deg * Math.PI) / 180)}%`,
                                            left: `${50 + 50 * Math.sin((deg * Math.PI) / 180)}%`,
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    />
                                ))}
                            </motion.div>

                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                                className={`absolute inset-6 rounded-full border ${themeConfig.middleRing}`}
                            >
                                {[0, 90, 180, 270].map((deg) => (
                                    <motion.div
                                        key={deg}
                                        animate={{ scale: [1, 1.8, 1], opacity: [0.4, 1, 0.4] }}
                                        transition={{ duration: 1.5, repeat: Infinity, delay: (deg / 360) * 1.5 }}
                                        className={`absolute w-2 h-2 rounded-full ${themeConfig.middleDots}`}
                                        style={{
                                            top: `${50 - 50 * Math.cos((deg * Math.PI) / 180)}%`,
                                            left: `${50 + 50 * Math.sin((deg * Math.PI) / 180)}%`,
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    />
                                ))}
                            </motion.div>

                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                className={`absolute inset-12 rounded-full border ${themeConfig.innerRing}`}
                            >
                                {[0, 120, 240].map((deg) => (
                                    <motion.div
                                        key={deg}
                                        animate={{ scale: [1, 2, 1], opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 1, repeat: Infinity, delay: deg / 360 }}
                                        className={`absolute w-1.5 h-1.5 rounded-full ${themeConfig.innerDots}`}
                                        style={{
                                            top: `${50 - 50 * Math.cos((deg * Math.PI) / 180)}%`,
                                            left: `${50 + 50 * Math.sin((deg * Math.PI) / 180)}%`,
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    />
                                ))}
                            </motion.div>

                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                className="absolute inset-0 flex items-center justify-center"
                            >
                                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${themeConfig.centerGradient} flex items-center justify-center shadow-sm`}>
                                    <CenterIcon className="w-8 h-8 text-white" />
                                </div>
                            </motion.div>

                            <motion.div
                                animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                                className={`absolute inset-0 rounded-full border-2 ${themeConfig.pulseRing}`}
                            />
                        </div>

                        <div className="text-center space-y-2">
                            <motion.h2
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="text-xl font-bold text-white tracking-tight"
                            >
                                {displayTitle}
                            </motion.h2>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="text-sm text-white/50"
                            >
                                {subtitle}
                            </motion.p>
                            {statsLine && (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-xs text-white/40"
                                >
                                    {statsLine}
                                </motion.p>
                            )}
                        </div>

                        <div className="w-full space-y-3">
                            {steps.map((agent, i) => {
                                const isComplete = i < currentStepIndex;
                                const isCurrent = i === currentStepIndex;
                                const AgentIcon = agent.icon;

                                return (
                                    <motion.div
                                        key={agent.label}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 + i * 0.1 }}
                                        className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-500 ${
                                            isCurrent
                                                ? 'bg-white/10 border border-white/20 shadow-lg'
                                                : isComplete
                                                    ? 'bg-white/5 border border-white/10'
                                                    : 'border border-white/10 opacity-40'
                                        }`}
                                    >
                                        <div className={`relative p-2 rounded-lg ${isCurrent ? agent.bg : isComplete ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                                            {isComplete ? (
                                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                            ) : (
                                                <AgentIcon className={`w-4 h-4 ${isCurrent ? agent.color : 'text-white/30'}`} />
                                            )}
                                            {isCurrent && (
                                                <motion.div
                                                    animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                    className={`absolute inset-0 rounded-lg ${agent.bg}`}
                                                />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <span className={`text-sm font-semibold ${isCurrent ? 'text-white' : isComplete ? 'text-white/60' : 'text-white/30'}`}>
                                                {agent.label}
                                            </span>
                                            {isCurrent && currentStepDetail && (
                                                <motion.p
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="text-xs text-white/40 truncate"
                                                >
                                                    {currentStepDetail}
                                                </motion.p>
                                            )}
                                        </div>

                                        <div className="flex-shrink-0">
                                            {isComplete && (
                                                <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider"
                                                >
                                                    Concluído
                                                </motion.span>
                                            )}
                                            {isCurrent && !finished && (
                                                <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        <div className="w-full space-y-2">
                            <div className="flex items-center justify-between text-[10px] text-white/40 font-bold uppercase tracking-widest">
                                <span>Progresso</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full bg-gradient-to-r ${themeConfig.progressGradient} rounded-full`}
                                    initial={{ width: '0%' }}
                                    animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                        </div>

                        {(footerText || footerFinishedText) && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.5 }}
                                className="text-[11px] text-white/20 text-center"
                            >
                                {finished && footerFinishedText ? footerFinishedText : footerText}
                            </motion.p>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
