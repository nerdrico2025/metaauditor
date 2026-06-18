import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown, FileImage, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  formatPerformanceMetricValue,
  formatPerformanceThreshold,
  getCreativeMetricValues,
  getOperatorSymbol,
  type PerformanceRuleLike,
} from '@/lib/performanceRules';
import { getProxiedImageUrl } from '@/lib/utils';
import type { RuleBreakdown } from '@/hooks/usePerformanceRuleBreakdown';

interface PerformanceRuleExpandPanelProps {
  rule: PerformanceRuleLike;
  breakdown: RuleBreakdown;
  isLoading: boolean;
  panelId: string;
}

function CreativeRow({
  name,
  imageUrl,
  externalId,
  subtitle,
  variant,
  onClick,
}: {
  name: string;
  imageUrl: string | null;
  externalId: string | null;
  subtitle: string;
  variant: 'compliant' | 'violating';
  onClick: () => void;
}) {
  const isViolating = variant === 'violating';
  const thumb = imageUrl ? getProxiedImageUrl(imageUrl, externalId) || imageUrl : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-muted/40 ${
        isViolating
          ? 'bg-rose-500/5 border-rose-500/20'
          : 'bg-emerald-500/5 border-emerald-500/20'
      }`}
    >
      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted border border-border flex-shrink-0">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileImage className="w-4 h-4 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      {isViolating ? (
        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      )}
    </button>
  );
}

export function PerformanceRuleExpandPanel({
  rule,
  breakdown,
  isLoading,
  panelId,
}: PerformanceRuleExpandPanelProps) {
  const { t } = useTranslation('rules');
  const navigate = useNavigate();
  const [insufficientOpen, setInsufficientOpen] = useState(false);

  const cond = rule.trigger_conditions;
  const metric = cond?.metric ?? '';
  const opSymbol = getOperatorSymbol(cond?.operator ?? 'lt');
  const thresholdLabel = cond?.threshold != null ? formatPerformanceThreshold(metric, cond.threshold) : '';

  const buildSubtitle = (current: number) => {
    const currentLabel = formatPerformanceMetricValue(metric, current);
    return `${metric.toUpperCase()} ${currentLabel} (limite ${opSymbol} ${thresholdLabel})`;
  };

  if (isLoading) {
    return (
      <div id={panelId} className="flex justify-center py-8 border-t border-border/60 mt-4">
        <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
      </div>
    );
  }

  return (
    <motion.div
      id={panelId}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden border-t border-border/60 mt-4 pt-4"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-widest text-rose-400">
            {t('performance.outsideRule')} ({breakdown.counts.violating})
          </h5>
          {breakdown.violating.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
              {t('performance.emptyOutside')}
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {breakdown.violating.map(({ creative, violation }) => (
                <CreativeRow
                  key={creative.id}
                  name={creative.name}
                  imageUrl={creative.image_url}
                  externalId={creative.external_id}
                  subtitle={violation ? buildSubtitle(violation.current) : ''}
                  variant="violating"
                  onClick={() => navigate(`/criativos/${creative.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h5 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            {t('performance.withinRule')} ({breakdown.counts.compliant})
          </h5>
          {breakdown.compliant.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-xl">
              {t('performance.emptyWithin')}
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {breakdown.compliant.map(({ creative }) => {
                const metricKey = cond?.metric ?? '';
                const num = metricKey ? getCreativeMetricValues(creative)[metricKey] ?? 0 : 0;
                return (
                  <CreativeRow
                    key={creative.id}
                    name={creative.name}
                    imageUrl={creative.image_url}
                    externalId={creative.external_id}
                    subtitle={buildSubtitle(num)}
                    variant="compliant"
                    onClick={() => navigate(`/criativos/${creative.id}`)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {breakdown.insufficient_data.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setInsufficientOpen(v => !v)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${insufficientOpen ? 'rotate-180' : ''}`} />
            {t('performance.insufficientData')} ({breakdown.counts.insufficient})
          </button>
          {insufficientOpen && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {breakdown.insufficient_data.map(creative => (
                <button
                  key={creative.id}
                  type="button"
                  onClick={() => navigate(`/criativos/${creative.id}`)}
                  className="w-full text-left text-xs text-muted-foreground px-3 py-2 rounded-lg hover:bg-muted/50 truncate"
                >
                  {creative.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
