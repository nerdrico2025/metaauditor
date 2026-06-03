import { AlertTriangle, ShieldX, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreativeMediaPreview, type CreativeMediaType } from '@/components/branding/CreativeMediaPreview';

export type ComplianceStatus = 'approved' | 'warning' | 'rejected' | 'pending';

export interface FailedRulePreview {
  rule_name: string;
  severity?: string;
  reason?: string;
}

interface CreativeCompliancePreviewProps {
  imageUrl?: string | null;
  externalId?: string | null;
  name?: string;
  status?: ComplianceStatus;
  failedRules?: FailedRulePreview[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
  aspectClassName?: string;
  fit?: 'cover' | 'contain';
  /** When true, only renders the compliance tint overlay (for video/iframe previews). */
  overlayOnly?: boolean;
  mediaType?: CreativeMediaType;
  videoUrl?: string | null;
  interactive?: boolean;
}

const sizeClasses = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
};

export function ComplianceOverlayLayer({
  status,
  failedRules = [],
  className,
}: {
  status: ComplianceStatus;
  failedRules?: FailedRulePreview[];
  className?: string;
}) {
  const isNonCompliant = status === 'rejected' || status === 'warning';
  if (!isNonCompliant) return null;

  const isRejected = status === 'rejected';
  const failedCount = failedRules.length;

  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-3 backdrop-blur-[1px]',
        isRejected ? 'bg-rose-500/45' : 'bg-amber-500/35',
        className,
      )}
    >
      {isRejected ? (
        <ShieldX className="h-8 w-8 text-white drop-shadow-md" />
      ) : (
        <AlertTriangle className="h-8 w-8 text-white drop-shadow-md" />
      )}
      {failedCount > 0 && (
        <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {failedCount} regra{failedCount !== 1 ? 's' : ''} violada{failedCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

export function CreativeCompliancePreview({
  imageUrl,
  externalId,
  name,
  status = 'pending',
  failedRules = [],
  size = 'md',
  className,
  showLabel = false,
  aspectClassName = 'aspect-[4/5]',
  fit = 'cover',
  overlayOnly = false,
  mediaType,
  videoUrl,
  interactive = true,
}: CreativeCompliancePreviewProps) {
  if (overlayOnly) {
    return <ComplianceOverlayLayer status={status} failedRules={failedRules} />;
  }

  const fillsParent = aspectClassName.includes('h-full');

  return (
    <div className={cn('relative', fillsParent ? 'h-full w-full min-h-0' : aspectClassName, sizeClasses[size], className)}>
      <CreativeMediaPreview
        imageUrl={imageUrl}
        externalId={externalId}
        name={name}
        fit={fit}
        fill={fillsParent}
        aspectClassName={fillsParent ? undefined : 'h-full w-full'}
        roundedClassName={sizeClasses[size]}
        className="h-full w-full"
        mediaType={mediaType}
        videoUrl={videoUrl}
        interactive={interactive}
      />

      <ComplianceOverlayLayer status={status} failedRules={failedRules} />

      {status === 'approved' && (
        <div className="absolute right-2 top-2 z-20 rounded-full bg-emerald-500/90 p-1 shadow-md">
          <ShieldCheck className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      {showLabel && name && (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
          <p className="truncate text-xs font-semibold text-white">{name}</p>
        </div>
      )}
    </div>
  );
}
