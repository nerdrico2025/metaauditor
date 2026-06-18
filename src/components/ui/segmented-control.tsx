import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springDefault } from '@/lib/motion-presets';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  className?: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  layoutId = 'segmented-indicator',
  className,
  size = 'md',
  fullWidth = true,
}: SegmentedControlProps<T>) {
  const sizeClasses = size === 'sm' ? 'text-xs py-1.5 px-2' : 'text-xs py-2 px-3';

  return (
    <div
      role="tablist"
      className={cn(
        'relative flex rounded-xl bg-muted/40 backdrop-blur-sm p-1 border-0',
        fullWidth && 'w-full',
        className,
      )}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors duration-200',
              sizeClasses,
              active ? 'text-ch-orange' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-ch-orange/10 border border-ch-orange/25 shadow-accent"
                transition={springDefault}
              />
            )}
            {opt.icon && <span className="relative z-10 shrink-0">{opt.icon}</span>}
            <span className="relative z-10 truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
