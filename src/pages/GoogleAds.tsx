
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
    RefreshCw,
    BarChart3,
    Loader2,
    Sparkles,
    AlertTriangle,
    Lightbulb,
    Users,
    MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import GoogleAdsPerformance from '@/components/google-ads/GoogleAdsPerformance';
import GoogleAdsAudit from '@/components/google-ads/GoogleAdsAudit';
import GoogleAdsInsights from '@/components/google-ads/GoogleAdsInsights';
import GoogleAdsAICreatives from '@/components/google-ads/GoogleAdsCreatives';
import GoogleAdsGeo from '@/components/google-ads/GoogleAdsGeo';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function GoogleAdsPage() {
    const { session } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            // Fetch user company_id
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Ideally we get company_id from a hook context, assuming single tenant for now or grabbing from DB
            const { data: profile } = await supabase
                .from('users')
                .select('company_id')
                .eq('id', user.id)
                .single();

            if (!profile?.company_id) {
                toast.error("Empresa não encontrada para este usuário.");
                return;
            }

            const { error } = await supabase.functions.invoke('sync-google-stub', {
                body: { company_id: profile.company_id }
            });

            if (error) throw error;
            toast.success("Dados do Google Ads sincronizados!");
            window.location.reload(); // Simple refresh to pick up new data
        } catch (error) {
            console.error(error);
            toast.error("Erro ao sincronizar dados.");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={container}
            className="p-6 space-y-8"
        >
            <motion.div variants={item} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Users className="w-4 h-4 text-[#4285F4]" />
                        <span className="text-[10px] font-semibold text-[#4285F4] uppercase tracking-wide">Google Ads Intelligence</span>
                    </div>
                    <h1 className="text-3xl font-semibold text-foreground tracking-tight uppercase">Performance & Compliance</h1>
                    <p className="text-muted-foreground font-medium mt-1">Gestão avançada de search, proteção de marca e leilão.</p>
                </div>
                {/* Botão de Sincronização removido conforme solicitação para focar apenas na visualização */}
            </motion.div>

            <Tabs defaultValue="performance" className="space-y-6">
                <TabsList className="bg-white/5 border border-border p-1 rounded-xl flex flex-wrap md:flex-nowrap gap-2 md:gap-0">
                    <TabsTrigger
                        value="performance"
                        className="data-[state=active]:bg-ch-orange data-[state=active]:text-black h-10 px-6 rounded-lg text-muted-foreground uppercase font-semibold text-[10px] tracking-widest transition-all flex-1 md:flex-none"
                    >
                        <BarChart3 className="w-3.5 h-3.5 mr-2" />
                        Performance
                    </TabsTrigger>

                    <TabsTrigger
                        value="geo"
                        className="data-[state=active]:bg-blue-500 data-[state=active]:text-white h-10 px-6 rounded-lg text-muted-foreground uppercase font-semibold text-[10px] tracking-widest transition-all flex-1 md:flex-none"
                    >
                        <MapPin className="w-3.5 h-3.5 mr-2" />
                        Unidades e Localidades
                    </TabsTrigger>

                    <TabsTrigger
                        value="ai-creatives"
                        className="data-[state=active]:bg-purple-500 data-[state=active]:text-white h-10 px-6 rounded-lg text-muted-foreground uppercase font-semibold text-[10px] tracking-widest transition-all flex-1 md:flex-none"
                    >
                        <Sparkles className="w-3.5 h-3.5 mr-2" />
                        Análise de IA
                    </TabsTrigger>

                    <TabsTrigger
                        value="audit"
                        className="data-[state=active]:bg-ch-orange data-[state=active]:text-black h-10 px-6 rounded-lg text-muted-foreground uppercase font-semibold text-[10px] tracking-widest transition-all flex-1 md:flex-none"
                    >
                        <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                        Auditoria
                    </TabsTrigger>
                    <TabsTrigger
                        value="insights"
                        className="data-[state=active]:bg-ch-orange data-[state=active]:text-black h-10 px-6 rounded-lg text-muted-foreground uppercase font-semibold text-[10px] tracking-widest transition-all flex-1 md:flex-none"
                    >
                        <Lightbulb className="w-3.5 h-3.5 mr-2" />
                        Insights do Leilão
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="performance" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <GoogleAdsPerformance />
                </TabsContent>

                <TabsContent value="geo" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <GoogleAdsGeo />
                </TabsContent>

                <TabsContent value="ai-creatives" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <GoogleAdsAICreatives />
                </TabsContent>

                <TabsContent value="audit" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <GoogleAdsAudit />
                </TabsContent>

                <TabsContent value="insights" className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <GoogleAdsInsights />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}
