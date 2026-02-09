import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdStepData, CampaignWizardState } from "@/types/campaign-wizard";
import { Loader2, AlertCircle } from "lucide-react";

interface StepAnuncioProps {
    data: AdStepData;
    fullData: CampaignWizardState;
    updateData: (data: Partial<AdStepData>) => void;
}

export default function StepAnuncio({ data, fullData, updateData }: StepAnuncioProps) {
    const integrationId = fullData.integration_id;

    // Fetch Pages for the selected Integration
    const { data: pages, isLoading, error } = useQuery({
        queryKey: ['meta-pages', integrationId],
        queryFn: async () => {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;

            const response = await fetch(`${supabaseUrl}/functions/v1/meta-list-pages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ integration_id: integrationId }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to list pages');
            }
            const res = await response.json();
            return res.pages;
        },
        enabled: !!integrationId
    });

    const handleCreativeUpdate = (field: string, value: any) => {
        updateData({
            creative: { ...data.creative, [field]: value }
        });
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4">
            <div className="space-y-2">
                <h2 className="text-xl font-semibold text-ch-white">Criativo do Anúncio</h2>
                <p className="text-sm text-ch-text-muted">Configure a identidade visual e o texto do seu anúncio.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Lado Esquerdo: Identidade e Mídia */}
                <div className="space-y-6">
                    {/* Nome do Anúncio */}
                    <div className="space-y-2">
                        <Label>Nome do Anúncio</Label>
                        <Input
                            value={data.name}
                            onChange={(e) => updateData({ name: e.target.value })}
                            className="bg-ch-dark-gray border-ch-dark-gray text-ch-white"
                        />
                    </div>

                    {/* Página do Facebook / Instagram */}
                    <div className="space-y-2">
                        <Label>Página do Facebook</Label>
                        {isLoading ? (
                            <div className="flex items-center text-sm text-ch-text-muted">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando páginas...
                            </div>
                        ) : error ? (
                            <div className="flex items-center text-sm text-red-400">
                                <AlertCircle className="w-4 h-4 mr-2" /> Erro ao carregar páginas
                            </div>
                        ) : (
                            <Select
                                value={data.creative.page_id}
                                onValueChange={(v) => handleCreativeUpdate('page_id', v)}
                            >
                                <SelectTrigger className="bg-ch-dark-gray border-ch-dark-gray text-ch-white">
                                    <SelectValue placeholder="Selecione a página" />
                                </SelectTrigger>
                                <SelectContent>
                                    {pages && pages.map((page: any) => (
                                        <SelectItem key={page.id} value={page.id}>
                                            <div className="flex items-center gap-2">
                                                {/* <img src={page.picture?.data?.url} className="w-5 h-5 rounded-full" /> */}
                                                <span>{page.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <p className="text-xs text-ch-text-dimmed">Esta página representará seu anúncio.</p>
                    </div>

                    {/* Imagem (URL por enquanto) */}
                    <div className="space-y-2">
                        <Label>URL da Imagem</Label>
                        <Input
                            value={data.creative.image_url}
                            onChange={(e) => handleCreativeUpdate('image_url', e.target.value)}
                            className="bg-ch-dark-gray border-ch-dark-gray text-ch-white"
                            placeholder="https://exemplo.com/imagem.png"
                        />
                        <p className="text-xs text-ch-text-dimmed">Cole o link direto da imagem do seu criativo.</p>
                    </div>

                    {/* URL de Destino */}
                    <div className="space-y-2">
                        <Label>URL de Destino (Site)</Label>
                        <Input
                            value={data.creative.link_url}
                            onChange={(e) => handleCreativeUpdate('link_url', e.target.value)}
                            className="bg-ch-dark-gray border-ch-dark-gray text-ch-white"
                            placeholder="https://seunegocio.com.br"
                        />
                    </div>
                </div>

                {/* Lado Direito: Texto e CTA */}
                <div className="space-y-6">
                    {/* Texto Principal (Body) */}
                    <div className="space-y-2">
                        <Label>Texto Principal</Label>
                        <Textarea
                            value={data.creative.body}
                            onChange={(e) => handleCreativeUpdate('body', e.target.value)}
                            className="bg-ch-dark-gray border-ch-dark-gray text-ch-white h-32"
                            placeholder="Digite o texto que aparece acima da imagem..."
                        />
                    </div>

                    {/* Título (Headline) */}
                    <div className="space-y-2">
                        <Label>Título (Headline)</Label>
                        <Input
                            value={data.creative.title}
                            onChange={(e) => handleCreativeUpdate('title', e.target.value)}
                            className="bg-ch-dark-gray border-ch-dark-gray text-ch-white"
                            placeholder="Título abaixo da imagem"
                        />
                    </div>

                    {/* CTA */}
                    <div className="space-y-2">
                        <Label>Botão de Ação (CTA)</Label>
                        <Select
                            value={data.creative.call_to_action}
                            onValueChange={(v) => handleCreativeUpdate('call_to_action', v)}
                        >
                            <SelectTrigger className="bg-ch-dark-gray border-ch-dark-gray text-ch-white">
                                <SelectValue placeholder="Selecione o botão" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LEARN_MORE">Saiba Mais</SelectItem>
                                <SelectItem value="SHOP_NOW">Comprar Agora</SelectItem>
                                <SelectItem value="SIGN_UP">Cadastre-se</SelectItem>
                                <SelectItem value="GET_OFFER">Obter Oferta</SelectItem>
                                <SelectItem value="CONTACT_US">Fale Conosco</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Preview Simplificado */}
            <div className="mt-8 p-4 border border-white/10 rounded-lg bg-ch-bg/50">
                <h3 className="text-sm font-medium text-ch-text-muted mb-4 uppercase text-center tracking-wider">Pré-visualização (Estilo Feed)</h3>

                <div className="max-w-md mx-auto bg-white rounded-lg overflow-hidden shadow-lg border border-gray-200">
                    {/* Header do Post */}
                    <div className="p-3 flex items-center gap-2 border-b border-gray-100">
                        <div className="font-bold text-gray-800 text-sm">
                            {data.creative.page_id ? 'Sua Página' : 'Nome da Página'}
                        </div>
                        <span className="text-gray-400 text-xs">• Patrocinado</span>
                    </div>

                    {/* Texto Principal */}
                    <div className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                        {data.creative.body || 'Texto principal do anúncio aparecerá aqui.'}
                    </div>

                    {/* Imagem */}
                    <div className="aspect-square bg-gray-100 w-full overflow-hidden">
                        {data.creative.image_url ? (
                            <img src={data.creative.image_url} alt="Ad Preview" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                Imagem do Anúncio
                            </div>
                        )}
                    </div>

                    {/* Footer/Link */}
                    <div className="bg-gray-50 px-3 py-3 flex justify-between items-center border-t border-gray-100">
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="text-xs text-gray-500 uppercase truncate">
                                {data.creative.link_url ? new URL(data.creative.link_url).hostname : 'WEBSITE.COM'}
                            </div>
                            <div className="font-bold text-gray-900 text-sm truncate">
                                {data.creative.title || 'Título do Anúncio'}
                            </div>
                        </div>
                        <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold py-2 px-4 rounded transition-colors whitespace-nowrap">
                            {data.creative.call_to_action?.replace('_', ' ') || 'SAIBA MAIS'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
