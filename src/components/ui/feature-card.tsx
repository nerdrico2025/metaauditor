import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface FeatureCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
  className?: string;
  accent?: boolean;
  children?: React.ReactNode;
  showArrow?: boolean;
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  onClick,
  className,
  accent = false,
  children,
  showArrow = !!onClick,
}: FeatureCardProps) {
  const interactive = !!onClick;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
                accent
                  ? 'bg-ch-orange/10 border-0 text-ch-orange'
                  : 'bg-muted/50 border-0 text-muted-foreground',
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground tracking-tight truncate">{title}</h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{description}</p>
            )}
          </div>
        </div>
        {showArrow && (
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 group-hover:text-ch-orange transition-all" />
        )}
      </div>
      {children}
    </>
  );

  if (interactive) {
    return (
      <Card
        variant="interactive"
        className={cn(
          'group rounded-2xl p-5 text-left w-full',
          accent && 'bg-gradient-to-br from-ch-orange/5 to-transparent hover:ring-1 hover:ring-ch-orange/20',
          !accent && 'hover:ring-1 hover:ring-primary/20',
          className,
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        {content}
      </Card>
    );
  }

  return (
    <Card variant="elevated" className={cn('group rounded-2xl p-5', className)}>
      {content}
    </Card>
  );
}
