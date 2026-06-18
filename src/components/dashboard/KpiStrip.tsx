import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fadeUp, staggerContainer } from '@/lib/motion-presets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { statsGridCols } from '@/lib/responsiveGrids';

export interface KpiItem {
  label: string;
  value: string;
  tooltip?: string;
  sub?: string;
  valueClassName?: string;
  trend?: React.ReactNode;
  onClick?: () => void;
}

interface KpiStripProps {
  items: KpiItem[];
  isLoading?: boolean;
  columns?: 2 | 3 | 4 | 5 | 6 | 7;
  className?: string;
}

const stripContainerClass =
  'grid rounded-2xl overflow-hidden bg-card/85 backdrop-blur-sm shadow-soft border border-border/20 xl:divide-x xl:divide-border/15';

function KpiCell({ label, value, tooltip, trend, valueClassName, sub, onClick }: KpiItem) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const cell = (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'min-w-0 p-3 xl:p-4 transition-colors duration-200 hover:bg-muted/20',
        onClick && 'cursor-pointer hover:bg-muted/35',
        tooltip && !onClick && 'cursor-help',
      )}
    >
      <p
        className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest line-clamp-2 leading-snug"
        title={label}
      >
        {label}
      </p>
      <p
        className={cn(
          'text-lg xl:text-xl font-semibold mt-1 tabular-nums tracking-tight truncate',
          valueClassName,
        )}
        title={value}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate" title={sub}>
          {sub}
        </p>
      )}
      {trend && <div className="mt-1">{trend}</div>}
    </div>
  );

  if (!tooltip || onClick) return cell;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function KpiStrip({ items, isLoading, columns = 6, className }: KpiStripProps) {
  const reduced = useReducedMotion();
  const container = reduced ? {} : staggerContainer(0.04);
  const itemVariant = reduced ? { hidden: {}, visible: {} } : fadeUp;
  const gridClass = statsGridCols[columns] ?? statsGridCols[6];

  if (isLoading) {
    return (
      <div className={cn(stripContainerClass, gridClass, className)}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="min-w-0 p-3 xl:p-4 space-y-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className={cn(stripContainerClass, gridClass, className)}
    >
      {items.map((kpi, i) => (
        <motion.div key={`${kpi.label}-${i}`} variants={itemVariant} className="min-w-0">
          <KpiCell {...kpi} />
        </motion.div>
      ))}
    </motion.div>
  );
}
