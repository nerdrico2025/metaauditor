export function getScoreColor(score: number) {
    if (score >= 75) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
}

export function getScoreBgColor(score: number) {
    if (score >= 75) return 'bg-emerald-500/10';
    if (score >= 50) return 'bg-amber-500/10';
    return 'bg-rose-500/10';
}

export function getScoreLabel(score: number) {
    if (score >= 85) return 'Excelente';
    if (score >= 75) return 'Bom';
    if (score >= 60) return 'Médio';
    if (score >= 40) return 'Fraco';
    return 'Crítico';
}

export function getScoreBarColor(score: number) {
    if (score >= 75) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
}

export function getScalingBadge(recommendation?: string) {
    if (!recommendation) return null;
    const lower = recommendation.toLowerCase();
    if (lower.includes('agressivamente')) return { label: 'Escalar agressivamente', color: 'bg-emerald-500/10 text-emerald-500' };
    if (lower.includes('cautela')) return { label: 'Escalar com cautela', color: 'bg-blue-500/10 text-blue-500' };
    if (lower.includes('otimizar')) return { label: 'Otimizar antes de escalar', color: 'bg-amber-500/10 text-amber-500' };
    if (lower.includes('pausar')) return { label: 'Pausar e reconstruir', color: 'bg-rose-500/10 text-rose-500' };
    return { label: recommendation, color: 'bg-muted text-muted-foreground' };
}
