import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronRight, ChevronDown } from "lucide-react";

interface AssetSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    integrationId: string;
}

interface Creative {
    id: string;
    name: string;
    creative_id: string;
}

interface Campaign {
    id: string;
    name: string;
    creatives: Creative[];
}

export function AssetSelectionModal({ isOpen, onClose, integrationId }: AssetSelectionModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});

    // Selection state
    const [selectedCampaigns, setSelectedCampaigns] = useState<Record<string, boolean>>({});
    const [selectedCreatives, setSelectedCreatives] = useState<Record<string, boolean>>({});

    const { toast } = useToast();

    useEffect(() => {
        if (isOpen && integrationId) {
            fetchAssetTree();
        }
    }, [isOpen, integrationId]);

    const fetchAssetTree = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch current preferences from database
            const { data: integrationData, error: dbError } = await supabase
                .from('integrations')
                .select('sync_preferences')
                .eq('id', integrationId)
                .single();

            if (dbError) throw dbError;

            const prefs = integrationData?.sync_preferences as any || { campaigns: [], creatives: [] };

            const initialSelectedCampaigns: Record<string, boolean> = {};
            const initialSelectedCreatives: Record<string, boolean> = {};

            (prefs.campaigns || []).forEach((id: string) => { initialSelectedCampaigns[id] = true; });
            (prefs.creatives || []).forEach((id: string) => { initialSelectedCreatives[id] = true; });

            setSelectedCampaigns(initialSelectedCampaigns);
            setSelectedCreatives(initialSelectedCreatives);

            // 2. Fetch the tree from Edge Function
            const { data, error } = await supabase.functions.invoke('meta-fetch-asset-tree', {
                body: { integrationId }
            });

            if (error) throw error;

            if (data && data.success) {
                setCampaigns(data.campaigns || []);

                // Se for a primeira vez sincronizando (tudo vazio no DB), seleciona todas as campanhas e criativos por padrão
                if (!prefs.campaigns || prefs.campaigns.length === 0) {
                    const defaultCamps: Record<string, boolean> = {};
                    const defaultCreatives: Record<string, boolean> = {};

                    data.campaigns.forEach((camp: Campaign) => {
                        defaultCamps[camp.id] = true;
                        camp.creatives.forEach((cr: Creative) => {
                            defaultCreatives[cr.id] = true;
                        });
                    });

                    setSelectedCampaigns(defaultCamps);
                    setSelectedCreatives(defaultCreatives);
                }
            } else {
                throw new Error(data?.error || 'Erro ao buscar ativos');
            }

        } catch (error: any) {
            console.error("Error fetching assets:", error);
            toast({
                title: "Erro ao carregar ativos",
                description: error.message || "Não foi possível carregar a estrutura da conta.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleCampaign = (campaignId: string) => {
        const isSelected = !selectedCampaigns[campaignId];

        setSelectedCampaigns(prev => ({ ...prev, [campaignId]: isSelected }));

        // Auto toggle all creatives under this campaign
        const campaign = campaigns.find(c => c.id === campaignId);
        if (campaign) {
            setSelectedCreatives(prev => {
                const next = { ...prev };
                campaign.creatives.forEach(cr => {
                    next[cr.id] = isSelected;
                });
                return next;
            });
        }
    };

    const handleToggleCreative = (creativeId: string, campaignId: string) => {
        const isSelected = !selectedCreatives[creativeId];
        setSelectedCreatives(prev => ({ ...prev, [creativeId]: isSelected }));

        // Check if we need to auto-activate the campaign
        if (isSelected && !selectedCampaigns[campaignId]) {
            setSelectedCampaigns(prev => ({ ...prev, [campaignId]: true }));
        }
    };

    const toggleExpand = (campaignId: string) => {
        setExpandedCampaigns(prev => ({
            ...prev,
            [campaignId]: !prev[campaignId]
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const selectedCampIds = Object.keys(selectedCampaigns).filter(id => selectedCampaigns[id]);
            const selectedCreativeIds = Object.keys(selectedCreatives).filter(id => selectedCreatives[id]);

            const syncPreferences = {
                campaigns: selectedCampIds,
                creatives: selectedCreativeIds
            };

            const { error } = await supabase
                .from('integrations')
                .update({ sync_preferences: syncPreferences })
                .eq('id', integrationId);

            if (error) throw error;

            toast({
                title: "Preferências salvas",
                description: "Os ativos selecionados serão sincronizados na próxima atualização.",
            });

            onClose();
        } catch (error: any) {
            console.error("Error saving preferences:", error);
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível salvar suas preferências de sincronização.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectAll = () => {
        const defaultCamps: Record<string, boolean> = {};
        const defaultCreatives: Record<string, boolean> = {};

        campaigns.forEach((camp: Campaign) => {
            defaultCamps[camp.id] = true;
            camp.creatives.forEach((cr: Creative) => {
                defaultCreatives[cr.id] = true;
            });
        });

        setSelectedCampaigns(defaultCamps);
        setSelectedCreatives(defaultCreatives);
    }

    const handleDeselectAll = () => {
        setSelectedCampaigns({});
        setSelectedCreatives({});
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Selecionar Ativos para Sincronização</DialogTitle>
                    <DialogDescription>
                        Escolha quis campanhas e anúncios você deseja importar para o App. Desmarcar itens irrelevantes economiza dados e deixa o dashboard mais limpo.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-between items-center py-2">
                    <div className="text-sm text-muted-foreground">
                        {Object.values(selectedCampaigns).filter(Boolean).length} campanhas selecionadas
                    </div>
                    <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={handleSelectAll}>Selecionar Tudo</Button>
                        <Button variant="outline" size="sm" onClick={handleDeselectAll}>Limpar</Button>
                    </div>
                </div>

                <ScrollArea className="flex-1 border rounded-md p-4 min-h-[300px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full min-h-[200px]">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="ml-2">Carregando estrutura da conta...</span>
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            Nenhuma campanha encontrada nesta conta.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {campaigns.map(campaign => (
                                <div key={campaign.id} className="border rounded-md p-2">
                                    <div className="flex items-center gap-2 hover:bg-accent/50 p-2 rounded-sm transition-colors">
                                        <button
                                            onClick={() => toggleExpand(campaign.id)}
                                            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full"
                                        >
                                            {expandedCampaigns[campaign.id] ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </button>
                                        <Checkbox
                                            id={`camp-${campaign.id}`}
                                            checked={!!selectedCampaigns[campaign.id]}
                                            onCheckedChange={() => handleToggleCampaign(campaign.id)}
                                        />
                                        <label
                                            htmlFor={`camp-${campaign.id}`}
                                            className="text-sm font-medium leading-none cursor-pointer flex-1"
                                        >
                                            {campaign.name}
                                        </label>
                                    </div>

                                    {expandedCampaigns[campaign.id] && (
                                        <div className="ml-8 mt-2 space-y-2 pl-4 border-l-2 border-muted">
                                            {campaign.creatives && campaign.creatives.length > 0 ? (
                                                campaign.creatives.map(creative => (
                                                    <div key={creative.id} className="flex items-center gap-2 py-1">
                                                        <Checkbox
                                                            id={`ad-${creative.id}`}
                                                            checked={!!selectedCreatives[creative.id]}
                                                            onCheckedChange={() => handleToggleCreative(creative.id, campaign.id)}
                                                        />
                                                        <label
                                                            htmlFor={`ad-${creative.id}`}
                                                            className="text-sm leading-none cursor-pointer truncate max-w-[400px]"
                                                            title={creative.name}
                                                        >
                                                            {creative.name}
                                                        </label>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-xs text-muted-foreground py-1">Nenhum criativo encontrado ativo nesta campanha.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Preferências
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
