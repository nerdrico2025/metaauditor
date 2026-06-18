import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Eye,
  FileImage,
  Film,
  Grid3X3,
  History,
  Image as ImageIcon,
  MoreHorizontal,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreativeCompliancePreview } from '@/components/branding/CreativeCompliancePreview';
import { CreativeMediaPreview } from '@/components/branding/CreativeMediaPreview';
import { CrossFocusStatusBadge } from '@/components/creatives/CrossFocusStatusBadge';
import type { AuditFocus } from '@/lib/audit-focus';
import type { CrossFocusDisplayStatus } from '@/lib/crossFocusAudit';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface FailedRulePreview {
  rule_name: string;
  reason?: string;
}

export interface CreativeGridCardProps {
  creative: {
    id: string;
    name: string;
    type: string | null;
    image_url?: string | null;
    external_id?: string | null;
    video_url?: string | null;
    impressions?: number | null;
    ctr?: number | null;
    campaigns?: { status?: string | null } | null;
  };
  isBranding: boolean;
  isRejected: boolean;
  isWarning: boolean;
  failedRules: FailedRulePreview[];
  ruleCheckStatus?: string | null;
  brandingStatus?: 'approved' | 'rejected' | 'pending' | null;
  crossFocusStatus?: CrossFocusDisplayStatus;
  crossFocusOpposite?: AuditFocus;
  onClick: () => void;
  onRuleCheck: (e: React.MouseEvent) => void;
  onDiagnosis?: (e: React.MouseEvent) => void;
  onHistory: (e: React.MouseEvent) => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: LucideIcon; iconClass: string }> = {
  video: { label: 'Motion Asset', icon: Film, iconClass: 'text-indigo-400' },
  image: { label: 'Static Visual', icon: FileImage, iconClass: 'text-blue-400' },
  carousel: { label: 'Multi-Asset', icon: Grid3X3, iconClass: 'text-emerald-400' },
};

function getTypeConfig(type: string | null) {
  return (
    TYPE_CONFIG[type || ''] ?? {
      label: 'Other Asset',
      icon: ImageIcon,
      iconClass: 'text-muted-foreground',
    }
  );
}

function RuleCheckButton({
  status,
  onClick,
  className,
}: {
  status?: string | null;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <Button
      size="icon"
      onClick={onClick}
      className={cn(
        'rounded-xl border transition-all h-8 w-8 lg:h-9 lg:w-9',
        status === 'approved'
          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black'
          : status === 'rejected'
            ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white'
            : status === 'warning'
              ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black'
              : 'bg-white/10 border-white/10 hover:bg-blue-500 hover:text-white',
        className,
      )}
      title="Verificar Regras de Criativo"
    >
      <ShieldCheck className="w-4 h-4" />
    </Button>
  );
}

export function CreativeGridCard({
  creative,
  isBranding,
  isRejected,
  isWarning,
  failedRules,
  ruleCheckStatus,
  brandingStatus,
  crossFocusStatus,
  crossFocusOpposite,
  onClick,
  onRuleCheck,
  onDiagnosis,
  onHistory,
}: CreativeGridCardProps) {
  const config = getTypeConfig(creative.type);
  const Icon = config.icon;

  const borderClass = isRejected
    ? 'border-2 border-rose-500 ring-2 ring-rose-500/20 hover:border-rose-400'
    : isWarning
      ? 'border-2 border-amber-500 ring-2 ring-amber-500/20 hover:border-amber-400'
      : 'border border-border hover:border-ch-orange/40';

  const actionButtons = (
    <>
      <RuleCheckButton status={ruleCheckStatus} onClick={onRuleCheck} />
      {!isBranding && onDiagnosis && (
        <Button
          size="icon"
          onClick={onDiagnosis}
          className="rounded-xl h-8 w-8 lg:h-9 lg:w-9 bg-white/10 hover:bg-emerald-500 hover:text-black transition-all border border-white/10"
          title="Diagnóstico IA"
        >
          <BrainCircuit className="w-4 h-4" />
        </Button>
      )}
      <Button
        size="icon"
        onClick={onHistory}
        className="rounded-xl h-8 w-8 lg:h-9 lg:w-9 bg-white/10 hover:bg-ch-blue hover:text-white transition-all border border-white/10"
        title="Histórico de Análises"
      >
        <History className="w-4 h-4" />
      </Button>
      <Button
        size="icon"
        className="rounded-xl h-8 w-8 lg:h-9 lg:w-9 bg-white/10 hover:bg-ch-orange hover:text-black transition-all border border-white/10"
        title="Ver detalhes"
      >
        <Eye className="w-4 h-4" />
      </Button>
    </>
  );

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative bg-card rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover-lift cursor-pointer active:scale-[0.99] min-w-0',
        borderClass,
      )}
    >
      <div className="aspect-[4/5] relative overflow-hidden bg-neutral-950">
        {creative.image_url ? (
          isBranding ? (
            <CreativeCompliancePreview
              imageUrl={creative.image_url}
              externalId={creative.external_id}
              name={creative.name}
              status={(ruleCheckStatus as 'approved' | 'rejected' | 'warning' | 'pending') ?? 'pending'}
              failedRules={failedRules}
              size="md"
              fit={creative.type === 'video' ? 'contain' : 'cover'}
              mediaType={creative.type ?? undefined}
              videoUrl={creative.video_url}
              aspectClassName="h-full w-full"
              className="h-full w-full rounded-none"
            />
          ) : (
            <CreativeMediaPreview
              imageUrl={creative.image_url}
              externalId={creative.external_id}
              name={creative.name}
              mediaType={creative.type ?? undefined}
              videoUrl={creative.video_url}
              fit={creative.type === 'video' ? 'contain' : 'cover'}
              fill
              roundedClassName="rounded-none"
            />
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-muted/50 px-4">
            <Icon className="w-10 h-10 text-muted-foreground opacity-20" />
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
              <span className="text-[9px] font-semibold text-red-500 leading-tight text-center">
                Sem permissão do administrador na conta de anúncios
              </span>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-2/5 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-70 group-hover:opacity-90 transition-opacity" />

        <div className="absolute top-3 left-3 md:top-4 md:left-4 flex flex-col gap-1.5 max-w-[calc(100%-4.5rem)]">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
            <Icon className={cn('w-3 h-3 shrink-0', config.iconClass)} />
            <span className="text-[9px] md:text-[10px] font-semibold text-white uppercase tracking-widest truncate">
              {config.label}
            </span>
          </div>
          {failedRules.length > 0 && (
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-md border cursor-default max-w-full',
                isRejected
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-300',
              )}
              title={failedRules.map(r => `⚠ ${r.rule_name}: ${r.reason}`).join('\n')}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="text-[9px] font-bold truncate">
                {failedRules.length} regra{failedRules.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {!isBranding && failedRules.length > 0 && (
          <div className="absolute top-3 right-3 md:top-4 md:right-4">
            <div className="flex items-center justify-center min-w-9 h-9 px-1.5 rounded-xl bg-rose-500/90 backdrop-blur-md text-white shadow-lg">
              <Activity className="w-3.5 h-3.5 mr-0.5" />
              <span className="text-xs font-bold">{failedRules.length}</span>
            </div>
          </div>
        )}

        {isBranding && (
          <div className="absolute top-3 right-3 md:top-4 md:right-4">
            <div
              className={cn(
                'flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl backdrop-blur-md shadow-lg',
                brandingStatus === 'approved'
                  ? 'bg-emerald-500 text-white'
                  : brandingStatus === 'rejected'
                    ? 'bg-red-500 text-white'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {brandingStatus === 'approved' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : brandingStatus === 'rejected' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5 opacity-30" />
              )}
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 right-3 md:bottom-4 md:left-4 md:right-4">
          <h3
            className="text-sm md:text-base lg:text-lg font-bold text-white leading-tight mb-1 line-clamp-2 group-hover:text-ch-orange transition-colors pr-1"
            title={creative.name}
          >
            {creative.name}
          </h3>
          {crossFocusOpposite && crossFocusStatus && crossFocusStatus !== 'none' && (
            <div className="mb-2">
              <CrossFocusStatusBadge
                oppositeFocus={crossFocusOpposite}
                status={crossFocusStatus}
                className="text-[9px] py-0.5"
              />
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            {!isBranding ? (
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                <div className="flex flex-col">
                  <span className="text-[8px] md:text-[9px] font-bold text-white/40 uppercase tracking-widest">
                    Impressões
                  </span>
                  <span className="text-xs md:text-sm font-bold text-white tabular-nums">
                    {formatNumber(creative.impressions || 0)}
                  </span>
                </div>
                <div className="w-px h-5 md:h-6 bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[8px] md:text-[9px] font-bold text-white/40 uppercase tracking-widest">
                    CTR
                  </span>
                  <span className="text-xs md:text-sm font-bold text-emerald-400 tabular-nums">
                    {(creative.ctr || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            ) : (
              <div />
            )}

            {/* Desktop: hover-reveal row */}
            <div className="hidden lg:flex gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity">
              {actionButtons}
            </div>

            {/* Mobile/tablet: compact menu */}
            <div className="lg:hidden flex justify-end" onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/20"
                    title="Ações"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={onRuleCheck}>Verificar regras</DropdownMenuItem>
                  {!isBranding && onDiagnosis && (
                    <DropdownMenuItem onClick={onDiagnosis}>Diagnóstico IA</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onHistory}>Histórico IA</DropdownMenuItem>
                  <DropdownMenuItem onClick={onClick}>Ver detalhes</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { getTypeConfig };
