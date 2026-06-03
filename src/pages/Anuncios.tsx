// Phase E (briefing #11): "Histórico de Anúncios".
//
// Acessível direto via menu lateral — sem precisar passar pelo fluxo
// Campanha → Conjunto → Criativo. Permite consultar qualquer criativo já
// analisado pelos filtros Campanha / Regra / Status.
//
// Implementação: reaproveita os mesmos hooks usados em Criativos.tsx para não
// duplicar plumbing; renderiza um layout mais simples e focado em consulta.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAnunciosCampaigns } from '@/hooks/useAnunciosCampaigns';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import {
    Search,
    Filter,
    ShieldCheck,
    AlertTriangle,
    Loader2,
    Image as ImageIcon,
    Video,
    X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationFilter } from '@/contexts/IntegrationFilterContext';
import { useCreatives } from '@/hooks/useCreatives';
import { useCreativeImageCache } from '@/hooks/useCreativeImageCache';
import { useCreativeRules } from '@/hooks/useCreativeRules';
import { useBrandingCompliance } from '@/hooks/useBrandingCompliance';
import { supabase } from '@/integrations/supabase/client';
import { CreativeCompliancePreview } from '@/components/branding/CreativeCompliancePreview';
import { InfoTip } from '@/components/ui/info-tip';
import {
    countByComplianceStatus,
    creativeIdsForComplianceStatus,
} from '@/lib/brandingComplianceFilter';
import { creativeGalleryGrid } from '@/lib/responsiveGrids';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 24;

type StatusFilter = 'all' | 'approved' | 'rejected' | 'pending';

export default function Anuncios() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const { effectiveIds } = useIntegrationFilter();
    const companyId = user?.company?.id;

    const statusFromUrl = searchParams.get('status');
    const initialStatus: StatusFilter =
        statusFromUrl === 'approved' || statusFromUrl === 'rejected' || statusFromUrl === 'pending'
            ? statusFromUrl
            : 'all';

    const [search, setSearch] = useState('');
    const [campaignId, setCampaignId] = useState<string>('all');
    const [ruleId, setRuleId] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
    const [page, setPage] = useState(0);

    useEffect(() => {
        const param = searchParams.get('status');
        if (param === 'approved' || param === 'rejected' || param === 'pending') {
            setStatusFilter(param);
            setPage(0);
        } else if (!param) {
            setStatusFilter('all');
        }
    }, [searchParams]);

    const { data: compliance, isLoading: complianceLoading } = useBrandingCompliance();
    const { rules } = useCreativeRules();

    const { campaigns } = useAnunciosCampaigns(companyId, effectiveIds);

    const statusCounts = useMemo(
        () => countByComplianceStatus(compliance?.byCreative ?? new Map()),
        [compliance?.byCreative],
    );

    const { data: ruleChecks } = useQuery({
        queryKey: ['anuncios-rule-checks', companyId, ruleId],
        enabled: !!companyId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('creative_rule_checks')
                .select('creative_id, overall_status, results, checked_at')
                .eq('company_id', companyId!)
                .order('checked_at', { ascending: false })
                .limit(5000);
            if (error) throw error;
            return data ?? [];
        },
    });

    const ruleFilteredCreativeIds = useMemo(() => {
        if (ruleId === 'all') return null;
        const seen = new Set<string>();
        const matches = new Set<string>();
        for (const row of (ruleChecks ?? [])) {
            if (seen.has(row.creative_id)) continue;
            seen.add(row.creative_id);
            const results = (row.results || []) as Array<{ rule_id?: string; rule_name?: string }>;
            const hit = results.some(r => r.rule_id === ruleId || (rules?.find(rr => rr.id === ruleId)?.name === r.rule_name));
            if (hit) matches.add(row.creative_id);
        }
        return matches;
    }, [ruleChecks, ruleId, rules]);

    const restrictToCreativeIds = useMemo(() => {
        let ids: string[] | undefined;
        if (statusFilter !== 'all' && compliance?.byCreative) {
            ids = creativeIdsForComplianceStatus(compliance.byCreative, statusFilter);
        }
        if (ruleFilteredCreativeIds) {
            const ruleIds = [...ruleFilteredCreativeIds];
            ids = ids ? ids.filter(id => ruleFilteredCreativeIds.has(id)) : ruleIds;
        }
        return ids;
    }, [statusFilter, compliance?.byCreative, ruleFilteredCreativeIds]);

    const { data, isLoading, refetch } = useCreatives({
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        sortBy: 'created_at' as const,
        sortOrder: 'desc',
        integrationIds: effectiveIds,
        campaignId: campaignId !== 'all' ? campaignId : undefined,
        restrictToCreativeIds,
    });

    const reduced = useReducedMotion();
    const { staggerContainer, fadeUp } = motionVariants(reduced);

    const creatives = data?.creatives || [];
    useCreativeImageCache(companyId ?? user?.company_id, creatives, refetch);

    const handleStatusFilter = (v: StatusFilter) => {
        setStatusFilter(v);
        setPage(0);
        if (v === 'all') {
            searchParams.delete('status');
        } else {
            searchParams.set('status', v);
        }
        setSearchParams(searchParams, { replace: true });
    };

    const pillLabel = (v: StatusFilter, base: string) => {
        if (complianceLoading || !compliance?.byCreative.size) return base;
        const n =
            v === 'all' ? statusCounts.total :
            v === 'approved' ? statusCounts.approved :
            v === 'rejected' ? statusCounts.rejected :
            statusCounts.pending;
        return `${base} (${n})`;
    };

    const emptyMessage =
        statusFilter === 'rejected' && !complianceLoading && statusCounts.rejected === 0
            ? 'Nenhum anúncio reprovado no escopo atual.'
            : statusFilter !== 'all' && restrictToCreativeIds?.length === 0
                ? 'Nenhum anúncio corresponde a este status com os filtros aplicados.'
                : 'Nenhum anúncio encontrado';

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto"
        >
            <motion.div variants={fadeUp}>
                <SectionHeader
                    title="Anúncios"
                    description="Consulta direta de qualquer anúncio analisado — sem precisar passar pela campanha. Filtre por campanha, regra ou status de branding."
                />
            </motion.div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Localizar criativo por nome..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        className="pl-9 h-11"
                    />
                    {search && (
                        <button onClick={() => { setSearch(''); setPage(0); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <Select value={campaignId} onValueChange={(v) => { setCampaignId(v); setPage(0); }}>
                    <InfoTip title="Filtrar por campanha" hint="Mostra só os anúncios de uma campanha específica.">
                      <SelectTrigger className="h-11">
                        <Filter className="w-3.5 h-3.5 mr-2" />
                        <SelectValue placeholder="Campanha" />
                      </SelectTrigger>
                    </InfoTip>
                    <SelectContent>
                        <SelectItem value="all">Todas as campanhas</SelectItem>
                        {(campaigns ?? []).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={ruleId} onValueChange={(v) => { setRuleId(v); setPage(0); }}>
                    <InfoTip title="Filtrar por regra" hint="Mostra só os anúncios avaliados por uma regra de branding específica.">
                      <SelectTrigger className="h-11">
                        <ShieldCheck className="w-3.5 h-3.5 mr-2" />
                        <SelectValue placeholder="Regra" />
                      </SelectTrigger>
                    </InfoTip>
                    <SelectContent>
                        <SelectItem value="all">Todas as regras</SelectItem>
                        {(rules ?? []).map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Status pills */}
            <div className="flex items-center gap-2 flex-wrap">
                {([
                    { v: 'all', label: 'Todos', cls: '' },
                    { v: 'approved', label: 'Aprovados', cls: 'data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-500 data-[active=true]:border-emerald-500/30' },
                    { v: 'rejected', label: 'Reprovados', cls: 'data-[active=true]:bg-red-500/15 data-[active=true]:text-red-500 data-[active=true]:border-red-500/30' },
                    { v: 'pending', label: 'Pendentes', cls: 'data-[active=true]:bg-muted data-[active=true]:text-muted-foreground' },
                ] as const).map(opt => {
                    const active = statusFilter === opt.v;
                    return (
                        <button
                            key={opt.v}
                            data-active={active}
                            onClick={() => handleStatusFilter(opt.v as StatusFilter)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${active ? 'bg-ch-orange/10 text-ch-orange border-ch-orange/30' : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'} ${opt.cls}`}
                        >
                            {pillLabel(opt.v, opt.label)}
                        </button>
                    );
                })}
            </div>

            {/* Results */}
            {isLoading || (statusFilter !== 'all' && complianceLoading) ? (
                <div className="py-20 flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-ch-orange" />
                </div>
            ) : creatives.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-muted/20">
                    <Search className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Tente ajustar os filtros.</p>
                </div>
            ) : (
                <div className={cn('grid gap-3', creativeGalleryGrid)}>
                    {creatives.map(creative => {
                        const status = compliance?.byCreative.get(creative.id) ?? null;
                        const complianceStatus = status === 'approved' || status === 'rejected'
                            ? status
                            : 'pending';
                        return (
                            <button
                                key={creative.id}
                                onClick={() => navigate(`/criativos/${creative.id}`)}
                                className={`group relative rounded-2xl overflow-hidden border bg-card text-left transition-all hover-lift shadow-sm active:scale-[0.99] ${
                                    status === 'approved' ? 'border-emerald-500/40' :
                                    status === 'rejected' ? 'border-red-500/40' :
                                    'border-border'
                                }`}
                            >
                                <div className="aspect-square bg-muted relative">
                                    {creative.image_url ? (
                                        <CreativeCompliancePreview
                                            imageUrl={creative.image_url}
                                            externalId={creative.external_id}
                                            name={creative.name}
                                            status={complianceStatus}
                                            mediaType={creative.type}
                                            videoUrl={creative.video_url}
                                            size="sm"
                                            fit="cover"
                                            aspectClassName="h-full w-full"
                                            className="h-full w-full rounded-none"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                                            {creative.type === 'video' ? <Video className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2">
                                        {status === 'approved' && (
                                            <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-bold">
                                                <ShieldCheck className="w-2.5 h-2.5 mr-1" /> Aprovado
                                            </Badge>
                                        )}
                                        {status === 'rejected' && (
                                            <Badge className="bg-red-500 text-white border-0 text-[10px] font-bold">
                                                <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Reprovado
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="p-2.5 border-t border-border">
                                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">
                                        {creative.name || creative.id}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Simple pagination */}
            {data && data.total > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                        Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} de {data.total}
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            className="px-3 py-1.5 rounded-lg text-xs border border-border disabled:opacity-30"
                        >
                            Anterior
                        </button>
                        <button
                            disabled={(page + 1) * PAGE_SIZE >= data.total}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1.5 rounded-lg text-xs border border-border disabled:opacity-30"
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
