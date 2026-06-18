import { FileImage, Film, MousePointerClick, Type } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { getCtaStatus } from '@/lib/audit-improvements';
import type { AuditFocus } from '@/lib/audit-focus';

interface AuditCreativeProfileProps {
    creative: {
        text?: string | null;
        headline?: string | null;
        description?: string | null;
        call_to_action?: string | null;
        image_url?: string | null;
        video_url?: string | null;
        spend?: number | null;
        impressions?: number | null;
        clicks?: number | null;
        ctr?: number | null;
        cpc?: number | null;
    } | null | undefined;
    auditFocus: AuditFocus;
}

function FieldRow({
    label,
    value,
    badge,
}: {
    label: string;
    value: string;
    badge?: { text: string; variant: 'ok' | 'warning' | 'error' };
}) {
    const badgeClass =
        badge?.variant === 'ok'
            ? 'bg-emerald-500/10 text-emerald-500 border-0'
            : badge?.variant === 'error'
                ? 'bg-rose-500/10 text-rose-500 border-0'
                : 'bg-amber-500/10 text-amber-500 border-0';

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
                {badge && (
                    <Badge variant="outline" className={`text-[9px] ${badgeClass}`}>
                        {badge.text}
                    </Badge>
                )}
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{value}</p>
        </div>
    );
}

export function AuditCreativeProfile({ creative, auditFocus }: AuditCreativeProfileProps) {
    if (!creative) return null;

    const isBranding = auditFocus === 'branding';
    const text = (creative.text ?? '').trim();
    const headline = (creative.headline ?? '').trim();
    const description = (creative.description ?? '').trim();
    const cta = (creative.call_to_action ?? '').trim();
    const ctaStatus = getCtaStatus(cta);
    const isVideo = !!creative.video_url;
    const mediaUrl = creative.image_url || creative.video_url;

    const ctaBadge =
        ctaStatus === 'empty'
            ? { text: 'Vazio', variant: 'error' as const }
            : ctaStatus === 'generic'
                ? { text: 'Genérico', variant: 'warning' as const }
                : { text: 'OK', variant: 'ok' as const };

    const textBadge = text
        ? text.length < 40
            ? { text: 'Curto', variant: 'warning' as const }
            : { text: 'OK', variant: 'ok' as const }
        : { text: 'Vazio', variant: 'error' as const };

    const spend = Number(creative.spend) || 0;
    const impressions = Number(creative.impressions) || 0;
    const ctr = Number(creative.ctr) || 0;
    const cpc = Number(creative.cpc) || 0;

    return (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Type className="w-3 h-3 text-ch-orange" />
                Perfil do criativo
            </h4>

            <div className="flex flex-col sm:flex-row gap-4">
                {mediaUrl && (
                    <div className="shrink-0 w-full sm:w-36">
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                            {isVideo ? (
                                <video
                                    src={mediaUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    playsInline
                                    preload="metadata"
                                />
                            ) : (
                                <img src={mediaUrl} alt="Preview do criativo" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <Badge variant="outline" className="mt-2 text-[9px] border-border">
                            {isVideo ? (
                                <><Film className="w-3 h-3 mr-1 inline" /> Vídeo</>
                            ) : (
                                <><FileImage className="w-3 h-3 mr-1 inline" /> Imagem</>
                            )}
                        </Badge>
                    </div>
                )}

                <div className="flex-1 space-y-3 min-w-0">
                    <FieldRow
                        label="Headline"
                        value={headline || '— Não definida'}
                        badge={headline ? undefined : { text: 'Ausente', variant: 'warning' }}
                    />
                    <FieldRow
                        label="Texto principal"
                        value={text || '— Vazio (penalizado na avaliação)'}
                        badge={textBadge}
                    />
                    {description && (
                        <FieldRow label="Descrição" value={description} />
                    )}
                    <FieldRow
                        label="Call to action"
                        value={cta || '— Nenhum'}
                        badge={ctaBadge}
                    />
                </div>
            </div>

            {!isBranding && (spend > 0 || impressions > 0) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border">
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Investimento</p>
                        <p className="text-sm font-bold tabular-nums">{formatCurrency(spend)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Impressões</p>
                        <p className="text-sm font-bold tabular-nums">{impressions.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">CTR</p>
                        <p className="text-sm font-bold tabular-nums">{ctr.toFixed(2)}%</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2 text-center">
                        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">CPC</p>
                        <p className="text-sm font-bold tabular-nums">{formatCurrency(cpc)}</p>
                    </div>
                </div>
            )}

            {!mediaUrl && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    Sem mídia visual associada a este criativo.
                </p>
            )}
        </div>
    );
}
