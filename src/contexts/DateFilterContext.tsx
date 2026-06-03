import { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { DateRange } from 'react-day-picker';

export type DatePreset = '1d' | '7d' | '15d' | '30d' | '60d' | '90d' | 'custom';

export interface DateFilterRange {
    /** YYYY-MM-DD (inclusive). undefined = no lower bound */
    startDate?: string;
    /** YYYY-MM-DD (inclusive). undefined = no upper bound */
    endDate?: string;
    /** true when no bounds are set (preset = 'all') */
    isAll: boolean;
}

interface DateFilterContextType {
    preset: DatePreset;
    setPreset: (p: DatePreset) => void;
    customRange: DateRange | undefined;
    setCustomRange: (r: DateRange | undefined) => void;
    /** Resolved range in YYYY-MM-DD, ready for Supabase `.gte/.lte('date', ...)`. */
    range: DateFilterRange;
    /** Short human label for headers/tooltips. */
    label: string;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

const STORAGE_PRESET = 'clickhero_date_preset';
const STORAGE_CUSTOM = 'clickhero_date_custom';

const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const presetDays: Record<Exclude<DatePreset, 'custom'>, number> = {
    '1d': 1,
    '7d': 7,
    '15d': 15,
    '30d': 30,
    '60d': 60,
    '90d': 90,
};

const presetLabels: Record<DatePreset, string> = {
    '1d': 'Ontem',
    '7d': 'Últimos 7 dias',
    '15d': 'Últimos 15 dias',
    '30d': 'Últimos 30 dias',
    '60d': 'Últimos 60 dias',
    '90d': 'Últimos 90 dias',
    custom: 'Personalizado',
};

export function DateFilterProvider({ children }: { children: ReactNode }) {
    const [preset, setPresetRaw] = useState<DatePreset>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_PRESET);
            // Migrate legacy 'all' (sem limites) para '30d' — só sincronizamos 90d na Meta,
            // então "todo o período" era enganoso. Default novo: últimos 30 dias.
            if (stored === 'all') return '30d';
            if (stored && ['1d', '7d', '15d', '30d', '60d', '90d', 'custom'].includes(stored)) {
                return stored as DatePreset;
            }
        } catch { /* noop */ }
        return '30d';
    });

    const [customRange, setCustomRangeRaw] = useState<DateRange | undefined>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_CUSTOM);
            if (!stored) return undefined;
            const parsed = JSON.parse(stored);
            if (!parsed?.from) return undefined;
            const from = new Date(parsed.from);
            if (isNaN(from.getTime())) return undefined;
            const to = parsed.to ? new Date(parsed.to) : undefined;
            return {
                from,
                to: to && !isNaN(to.getTime()) ? to : undefined,
            };
        } catch { /* noop */ }
        return undefined;
    });

    const setPreset = (p: DatePreset) => {
        setPresetRaw(p);
        try {
            localStorage.setItem(STORAGE_PRESET, p);
        } catch { /* noop */ }

        if (p !== 'custom') {
            setCustomRange(undefined);
            try {
                localStorage.removeItem(STORAGE_CUSTOM);
            } catch { /* noop */ }
            return;
        }

        setCustomRangeRaw((prev) => {
            if (prev?.from) return prev;
            const end = new Date();
            end.setDate(end.getDate() - 1);
            const start = new Date(end);
            start.setDate(start.getDate() - 29);
            const seeded = { from: start, to: end };
            try {
                localStorage.setItem(STORAGE_CUSTOM, JSON.stringify({
                    from: seeded.from.toISOString(),
                    to: seeded.to.toISOString(),
                }));
            } catch { /* noop */ }
            return seeded;
        });
    };

    const setCustomRange = (r: DateRange | undefined) => {
        setCustomRangeRaw(r);
        try {
            if (r?.from) {
                localStorage.setItem(STORAGE_CUSTOM, JSON.stringify({
                    from: r.from.toISOString(),
                    to: r.to ? r.to.toISOString() : null,
                }));
            } else {
                localStorage.removeItem(STORAGE_CUSTOM);
            }
        } catch { /* noop */ }
    };

    const range: DateFilterRange = useMemo(() => {
        if (preset === 'custom') {
            if (customRange?.from) {
                const end = customRange.to ?? customRange.from;
                return { startDate: fmt(customRange.from), endDate: fmt(end), isAll: false };
            }
            // Custom sem range escolhido — cai pros últimos 30 dias.
            const end = new Date();
            end.setDate(end.getDate() - 1);
            const start = new Date(end);
            start.setDate(start.getDate() - 29);
            return { startDate: fmt(start), endDate: fmt(end), isAll: false };
        }

        const days = presetDays[preset];
        // Meta has no same-day data — relative presets always end yesterday.
        // "Últimos 7 dias" = [hoje-7 .. ontem]. Matches the Meta Ads Manager.
        const end = new Date();
        end.setDate(end.getDate() - 1);
        const start = new Date(end);
        if (preset !== '1d') {
            start.setDate(start.getDate() - (days - 1));
        }
        return { startDate: fmt(start), endDate: fmt(end), isAll: false };
    }, [preset, customRange]);

    const label = useMemo(() => {
        if (preset === 'custom' && customRange?.from) {
            const endD = customRange.to ?? customRange.from;
            const same = customRange.from.getTime() === endD.getTime();
            const f = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            return same ? f(customRange.from) : `${f(customRange.from)} – ${f(endD)}`;
        }
        return presetLabels[preset];
    }, [preset, customRange]);

    const value: DateFilterContextType = {
        preset,
        setPreset,
        customRange,
        setCustomRange,
        range,
        label,
    };

    return (
        <DateFilterContext.Provider value={value}>
            {children}
        </DateFilterContext.Provider>
    );
}

export function useDateFilter() {
    const ctx = useContext(DateFilterContext);
    if (!ctx) throw new Error('useDateFilter must be used within DateFilterProvider');
    return ctx;
}
