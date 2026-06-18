import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, ShieldX, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreativeCompliancePreview } from '@/components/branding/CreativeCompliancePreview';
import { BatchCheckResultItem } from '@/hooks/useBatchCreativeRuleCheck';
import { cn } from '@/lib/utils';

interface ComplianceReportOverlayProps {
  open: boolean;
  onClose: () => void;
  items: BatchCheckResultItem[];
  approvedCount?: number;
}

export function ComplianceReportOverlay({
  open,
  onClose,
  items,
  approvedCount = 0,
}: ComplianceReportOverlayProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const rejected = items.filter(i => i.check.overall_status === 'rejected');
  const warnings = items.filter(i => i.check.overall_status === 'warning');

  const content = (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background/80 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4 border-b border-border/40 px-6 py-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Criativos fora de conformidade
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rejected.length > 0 && (
              <span className="mr-3 inline-flex items-center gap-1 text-rose-400">
                <ShieldX className="h-3.5 w-3.5" />
                {rejected.length} reprovado{rejected.length !== 1 ? 's' : ''}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="mr-3 inline-flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {warnings.length} alerta{warnings.length !== 1 ? 's' : ''}
              </span>
            )}
            {approvedCount > 0 && (
              <span className="text-muted-foreground">
                {approvedCount} aprovado{approvedCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-semibold text-foreground">Todos os criativos estão em conformidade</p>
            <p className="mt-1 text-sm text-muted-foreground">Nenhuma violação encontrada nesta verificação.</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(item => {
              const failedRules = (item.check.results || [])
                .filter(r => !r.passed)
                .map(r => ({ rule_name: r.rule_name, severity: r.severity, reason: r.reason }));

              return (
                <article
                  key={item.creativeId}
                  className={cn(
                    'overflow-hidden rounded-2xl border bg-card/90 shadow-soft',
                    item.check.overall_status === 'rejected'
                      ? 'border-rose-500/40'
                      : 'border-amber-500/40',
                  )}
                >
                  <CreativeCompliancePreview
                    imageUrl={item.imageUrl}
                    externalId={item.externalId}
                    name={item.name}
                    status={item.check.overall_status}
                    failedRules={failedRules}
                    size="lg"
                    aspectClassName="aspect-[4/5] w-full"
                    showLabel
                  />
                  <div className="space-y-2 p-4">
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.check.ai_summary}</p>
                    <ul className="space-y-1.5">
                      {failedRules.slice(0, 3).map((fr, idx) => (
                        <li key={idx} className="text-xs">
                          <span className="font-semibold text-foreground">{fr.rule_name}: </span>
                          <span className="text-muted-foreground">{fr.reason}</span>
                        </li>
                      ))}
                      {failedRules.length > 3 && (
                        <li className="text-[10px] text-muted-foreground">
                          +{failedRules.length - 3} outra{failedRules.length - 3 !== 1 ? 's' : ''} violação
                        </li>
                      )}
                    </ul>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => {
                        onClose();
                        navigate(`/criativos/${item.creativeId}`);
                      }}
                    >
                      Ver criativo
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-border/40 px-6 py-4">
        <Button onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
