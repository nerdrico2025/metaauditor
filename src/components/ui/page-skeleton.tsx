import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { statsGridCols } from '@/lib/responsiveGrids';

interface PageSkeletonProps {
  kpiCount?: number;
  sections?: number;
  className?: string;
}

export function PageSkeleton({ kpiCount = 6, sections = 2, className }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-6 animate-pulse', className)}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div
        className={cn(
          'grid gap-px bg-border rounded-xl overflow-hidden border border-border',
          statsGridCols[Math.min(Math.max(kpiCount, 2), 7) as 2 | 3 | 4 | 5 | 6 | 7] ?? statsGridCols[6],
        )}
      >
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} className="bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      {Array.from({ length: sections }).map((_, i) => (
        <Skeleton key={i} className="h-64 w-full rounded-2xl" />
      ))}
    </div>
  );
}
