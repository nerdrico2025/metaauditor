import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    BrainCircuit,
    Building2,
    CloudDownload,
    Database,
    Dna,
    Facebook,
    Globe,
    Search,
    SearchCheck,
    ShieldCheck,
    Sparkles,
    Zap,
    FileCheck,
    Layers,
    ClipboardCheck,
} from 'lucide-react';

export interface OverlayStep {
    icon: LucideIcon;
    label: string;
    color: string;
    bg: string;
}

export type OverlayTheme = 'meta' | 'branding' | 'audit';

export interface OverlayThemeConfig {
    outerRing: string;
    outerDots: string;
    middleRing: string;
    middleDots: string;
    innerRing: string;
    innerDots: string;
    pulseRing: string;
    centerGradient: string;
    progressGradient: string;
    centerIcon: LucideIcon;
}

export const OVERLAY_THEMES: Record<OverlayTheme, OverlayThemeConfig> = {
    meta: {
        outerRing: 'border-blue-500/20',
        outerDots: 'bg-blue-500',
        middleRing: 'border-ch-orange/20',
        middleDots: 'bg-ch-orange',
        innerRing: 'border-emerald-500/20',
        innerDots: 'bg-emerald-400',
        pulseRing: 'border-blue-500/30',
        centerGradient: 'from-blue-600 to-blue-400',
        progressGradient: 'from-blue-500 to-ch-orange',
        centerIcon: Facebook,
    },
    branding: {
        outerRing: 'border-purple-500/20',
        outerDots: 'bg-purple-500',
        middleRing: 'border-ch-orange/20',
        middleDots: 'bg-ch-orange',
        innerRing: 'border-emerald-500/20',
        innerDots: 'bg-emerald-400',
        pulseRing: 'border-purple-500/30',
        centerGradient: 'from-purple-600 to-violet-400',
        progressGradient: 'from-purple-500 to-ch-orange',
        centerIcon: Sparkles,
    },
    audit: {
        outerRing: 'border-ch-orange/20',
        outerDots: 'bg-ch-orange',
        middleRing: 'border-emerald-500/20',
        middleDots: 'bg-emerald-400',
        innerRing: 'border-purple-500/20',
        innerDots: 'bg-purple-400',
        pulseRing: 'border-ch-orange/30',
        centerGradient: 'from-ch-orange to-amber-600',
        progressGradient: 'from-ch-orange to-amber-400',
        centerIcon: BrainCircuit,
    },
};

export const META_SYNC_STEPS: OverlayStep[] = [
    { icon: Activity, label: 'Diagnosticando volume', color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { icon: Globe, label: 'Conectando à API do Meta', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { icon: Building2, label: 'Buscando BMs e Contas', color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
    { icon: Database, label: 'Sincronizando Campanhas', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { icon: CloudDownload, label: 'Importando Criativos', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { icon: ShieldCheck, label: 'Auditando Compliance', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { icon: Zap, label: 'Finalizando', color: 'text-ch-orange', bg: 'bg-ch-orange/20' },
];

export const BRANDING_STEPS: OverlayStep[] = [
    { icon: Layers, label: 'Preparando regras', color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { icon: Search, label: 'Carregando criativos', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { icon: FileCheck, label: 'Verificando conformidade', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { icon: ClipboardCheck, label: 'Consolidando resultados', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { icon: Zap, label: 'Concluído', color: 'text-ch-orange', bg: 'bg-ch-orange/20' },
];

export const AUDIT_STEPS: OverlayStep[] = [
    { icon: Search, label: 'Scanner de Biblioteca', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { icon: SearchCheck, label: 'Agente de Visão', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
    { icon: Activity, label: 'Agente de Performance', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { icon: Dna, label: 'Agente de Marketing', color: 'text-purple-400', bg: 'bg-purple-500/20' },
    { icon: ShieldCheck, label: 'Verificação de Compliance', color: 'text-amber-400', bg: 'bg-amber-500/20' },
    { icon: Zap, label: 'Compilação Final', color: 'text-ch-orange', bg: 'bg-ch-orange/20' },
];

export function mapFractionToStepIndex(fraction: number, stepCount: number): number {
    if (stepCount <= 1) return 0;
    const clamped = Math.max(0, Math.min(1, fraction));
    return Math.min(stepCount - 1, Math.floor(clamped * stepCount));
}

export function mapProgressRange(
    current: number,
    total: number,
    minPct = 10,
    maxPct = 90,
): number {
    if (total <= 0) return minPct;
    const fraction = Math.max(0, Math.min(1, current / total));
    return Math.round(minPct + fraction * (maxPct - minPct));
}
