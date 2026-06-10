import type { DateFilterRange } from '@/contexts/DateFilterContext';

export function isCheckedAtInRange(checkedAt: string, startDate: string, endDate: string): boolean {
    const day = checkedAt.slice(0, 10);
    return day >= startDate && day <= endDate;
}

export function hasDateRangeBounds(
    range?: DateFilterRange,
): range is DateFilterRange & { startDate: string; endDate: string } {
    return !!range && !range.isAll && !!range.startDate && !!range.endDate;
}

type CheckWithCreative = { creative_id: string; checked_at: string };

export function filterChecksByDateRange<T extends CheckWithCreative>(
    checks: T[],
    startDate: string,
    endDate: string,
): T[] {
    return checks.filter((row) => isCheckedAtInRange(row.checked_at, startDate, endDate));
}

/** Latest check per creative within the date range (expects checks ordered by checked_at desc). */
export function latestChecksPerCreativeInRange<T extends CheckWithCreative>(
    checks: T[],
    startDate: string,
    endDate: string,
): Map<string, T> {
    const map = new Map<string, T>();
    for (const row of filterChecksByDateRange(checks, startDate, endDate)) {
        if (!map.has(row.creative_id)) {
            map.set(row.creative_id, row);
        }
    }
    return map;
}
