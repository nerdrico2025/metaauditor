
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseUrl, supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Shield,
    AlertTriangle,
    CheckCircle,
    MapPin,
    Search,
    AlertOctagon,
    Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Violation {
    id?: string;
    keyword_id?: string;
    text?: string;
    match_type?: string;
    city?: string;
    region?: string;
    clicks?: number;
    cost?: number;
    issue: string;
    severity: 'high' | 'medium';
}

interface AuditResult {
    brand_violations: Violation[];
    geo_violations: Violation[];
    brand_health_score: number;
}

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function GoogleAdsAudit() {
    const { session } = useAuth();

    // We fetch user's company_id first
    const { data: userData } = useQuery({
        queryKey: ['user-company'],
        queryFn: async () => {
            const { data } = await supabase.auth.getUser();
            if (!data.user) return null;
            const { data: profile } = await supabase.from('users').select('company_id').eq('id', data.user.id).single();
            return profile?.company_id;
        }
    });

    const { data: auditData, isLoading, refetch } = useQuery({
        queryKey: ['google-audit-data', userData],
        enabled: !!userData && !!session?.access_token,
        queryFn: async () => {
            const response = await fetch(`${supabaseUrl}/functions/v1/google-audit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ company_id: userData }),
            });
            if (!response.ok) throw new Error('Falha na auditoria');
            return response.json() as Promise<AuditResult>;
        }
    });

    if (isLoading) return <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    const score = auditData?.brand_health_score || 0;
    const isHealthy = score > 80;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div variants={item} className="md:col-span-1 glass-premium rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col items-center justify-center text-center">
                    <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center mb-4 ${isHealthy ? 'border-ch-blue text-ch-blue' : 'border-ch-orange text-ch-orange'}`}>
                        <span className="text-5xl font-semibold tracking-tighter">{score}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground uppercase tracking-tight">Brand Health Score</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">Índice de conformidade da marca</p>

                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                        <Shield className="w-40 h-40" />
                    </div>
                </motion.div>

                <div className="md:col-span-2 grid grid-cols-1 gap-4">
                    {/* Summary Cards */}
                    <Card className="bg-card border-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-2">
                                <Search className="w-4 h-4 text-primary" /> Proteção de Keywords
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-2xl font-semibold text-foreground">{auditData?.brand_violations.length}</span>
                                    <span className="text-xs font-bold text-muted-foreground ml-2">Infrações Detectadas</span>
                                </div>
                                <Button variant="outline" size="sm" className="h-8 text-[9px] uppercase font-semibold tracking-widest bg-transparent border-border hover:bg-muted">Verificar</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-400" /> Geo-Compliance
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-2xl font-semibold text-foreground">{auditData?.geo_violations.length}</span>
                                    <span className="text-xs font-bold text-muted-foreground ml-2">Praças Irregulares</span>
                                </div>
                                <Button variant="outline" size="sm" className="h-8 text-[9px] uppercase font-semibold tracking-widest bg-transparent border-border hover:bg-muted">Detalhes</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Violation Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <motion.div variants={item} className="glass-card rounded-3xl p-6 space-y-4 bg-card">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertOctagon className="w-5 h-5 text-ch-orange" />
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Infrações de Marca (High Risk)</h3>
                    </div>

                    <div className="space-y-3">
                        {auditData?.brand_violations.length === 0 ? (
                            <div className="p-8 text-center bg-card/5 rounded-2xl border border-border border-dashed">
                                <CheckCircle className="w-8 h-8 text-ch-blue mx-auto mb-3 opacity-50" />
                                <p className="text-[10px] font-bold text-ch-blue uppercase tracking-widest">Nenhuma infração detectada</p>
                            </div>
                        ) : (
                            auditData?.brand_violations.map((v, i) => (
                                <div key={i} className="p-4 bg-ch-orange/10 border border-ch-orange/20 rounded-xl space-y-2">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs font-semibold text-ch-orange uppercase">"{v.text}"</span>
                                        <span className="px-2 py-0.5 rounded bg-ch-orange/20 text-[9px] font-semibold text-ch-orange uppercase tracking-wider">{v.match_type}</span>
                                    </div>
                                    <p className="text-[10px] font-medium text-ch-orange/80">{v.issue}</p>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                <motion.div variants={item} className="glass-card rounded-3xl p-6 space-y-4 bg-card">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="w-5 h-5 text-ch-orange" />
                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-tight">Infrações Geográficas (Free BID)</h3>
                    </div>

                    <div className="space-y-3">
                        {auditData?.geo_violations.length === 0 ? (
                            <div className="p-8 text-center bg-card/5 rounded-2xl border border-border border-dashed">
                                <CheckCircle className="w-8 h-8 text-ch-blue mx-auto mb-3 opacity-50" />
                                <p className="text-[10px] font-bold text-ch-blue uppercase tracking-widest">Geo-Targeting Validado</p>
                            </div>
                        ) : (
                            auditData?.geo_violations.map((v, i) => (
                                <div key={i} className="p-4 bg-ch-orange/10 border border-ch-orange/20 rounded-xl space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3 h-3 text-ch-orange" />
                                            <span className="text-xs font-semibold text-ch-orange uppercase">{v.city || v.region}</span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded bg-ch-orange/20 text-[9px] font-semibold text-ch-orange uppercase tracking-wider">{v.clicks} Clicks</span>
                                    </div>
                                    <p className="text-[10px] font-medium text-ch-orange/80">{v.issue}</p>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
