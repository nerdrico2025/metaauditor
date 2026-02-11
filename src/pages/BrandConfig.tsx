import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Palette,
    Save,
    Loader2,
    Image,
    Type,
    AlertCircle,
    Plus,
    X,
    CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function BrandConfig() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const companyId = user?.company?.id;

    const [brandName, setBrandName] = useState(user?.company?.name || '');
    const [primaryColor, setPrimaryColor] = useState('#ff6b35');
    const [secondaryColor, setSecondaryColor] = useState('#1a1a24');
    const [logoUrl, setLogoUrl] = useState('');
    const [brandVoice, setBrandVoice] = useState('');
    const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
    const [requiredElements, setRequiredElements] = useState<string[]>([]);
    const [newForbiddenWord, setNewForbiddenWord] = useState('');
    const [newRequiredElement, setNewRequiredElement] = useState('');

    const saveBrandConfig = useMutation({
        mutationFn: async () => {
            if (!companyId) throw new Error('No company ID');

            const { error } = await supabase
                .from('companies')
                .update({
                    name: brandName,
                    primary_color: primaryColor,
                })
                .eq('id', companyId);

            if (error) throw error;

            // Save brand guidelines to a separate table if it exists
            // For now, we'll just save basic info
        },
        onSuccess: () => {
            toast.success('Configurações de marca salvas');
            queryClient.invalidateQueries({ queryKey: ['company', companyId] });
        },
        onError: (error) => {
            toast.error(`Erro ao salvar: ${error.message}`);
        },
    });

    const addForbiddenWord = () => {
        if (newForbiddenWord.trim() && !forbiddenWords.includes(newForbiddenWord.trim())) {
            setForbiddenWords([...forbiddenWords, newForbiddenWord.trim()]);
            setNewForbiddenWord('');
        }
    };

    const removeForbiddenWord = (word: string) => {
        setForbiddenWords(forbiddenWords.filter(w => w !== word));
    };

    const addRequiredElement = () => {
        if (newRequiredElement.trim() && !requiredElements.includes(newRequiredElement.trim())) {
            setRequiredElements([...requiredElements, newRequiredElement.trim()]);
            setNewRequiredElement('');
        }
    };

    const removeRequiredElement = (element: string) => {
        setRequiredElements(requiredElements.filter(e => e !== element));
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-ch-white mb-2">Configurações de Marca</h1>
                <p className="text-ch-text-muted">
                    Defina diretrizes visuais e de conteúdo para sua marca.
                </p>
            </div>

            <div className="space-y-8">
                {/* Basic Info */}
                <div className="glass rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-ch-white mb-4 flex items-center gap-2">
                        <Type className="w-5 h-5 text-ch-orange" />
                        Identidade da Marca
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Nome da Marca</Label>
                            <Input
                                value={brandName}
                                onChange={(e) => setBrandName(e.target.value)}
                                placeholder="Nome da sua empresa"
                                className="bg-ch-dark-gray border-ch-dark-gray"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>URL do Logo</Label>
                            <Input
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="https://exemplo.com/logo.png"
                                className="bg-ch-dark-gray border-ch-dark-gray"
                            />
                        </div>
                    </div>
                </div>

                {/* Colors */}
                <div className="glass rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-ch-white mb-4 flex items-center gap-2">
                        <Palette className="w-5 h-5 text-ch-orange" />
                        Paleta & Estética
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Cor Primária</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="w-12 h-10 p-1 bg-ch-dark-gray border-ch-dark-gray cursor-pointer"
                                />
                                <Input
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    placeholder="#ff6b35"
                                    className="bg-ch-dark-gray border-ch-dark-gray"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Cor Secundária</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="color"
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    className="w-12 h-10 p-1 bg-ch-dark-gray border-ch-dark-gray cursor-pointer"
                                />
                                <Input
                                    value={secondaryColor}
                                    onChange={(e) => setSecondaryColor(e.target.value)}
                                    placeholder="#1a1a24"
                                    className="bg-ch-dark-gray border-ch-dark-gray"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Color Preview */}
                    <div className="mt-4 flex gap-4">
                        <div
                            className="w-24 h-12 rounded-lg border border-ch-dark-gray"
                            style={{ backgroundColor: primaryColor }}
                        />
                        <div
                            className="w-24 h-12 rounded-lg border border-ch-dark-gray"
                            style={{ backgroundColor: secondaryColor }}
                        />
                    </div>
                </div>

                {/* Brand Voice */}
                <div className="glass rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-ch-white mb-4 flex items-center gap-2">
                        <Image className="w-5 h-5 text-ch-orange" />
                        Tom de Voz
                    </h2>

                    <div className="space-y-2">
                        <Label>Descrição do Tom de Voz</Label>
                        <Textarea
                            value={brandVoice}
                            onChange={(e) => setBrandVoice(e.target.value)}
                            placeholder="Descreva o tom de voz da sua marca. Ex: Profissional mas acessível, usa linguagem informal, evita jargões técnicos..."
                            className="bg-ch-dark-gray border-ch-dark-gray"
                            rows={4}
                        />
                    </div>
                </div>

                {/* Forbidden Words */}
                <div className="glass rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-ch-white mb-4 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        Palavras Proibidas
                    </h2>
                    <p className="text-sm text-ch-text-muted mb-4">
                        Palavras ou frases que não devem aparecer nos seus anúncios.
                    </p>

                    <div className="flex gap-2 mb-4">
                        <Input
                            value={newForbiddenWord}
                            onChange={(e) => setNewForbiddenWord(e.target.value)}
                            placeholder="Digite uma palavra..."
                            className="bg-ch-dark-gray border-ch-dark-gray"
                            onKeyDown={(e) => e.key === 'Enter' && addForbiddenWord()}
                        />
                        <Button
                            onClick={addForbiddenWord}
                            variant="outline"
                            className="border-ch-dark-gray"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {forbiddenWords.map((word) => (
                            <span
                                key={word}
                                className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm flex items-center gap-1"
                            >
                                {word}
                                <button onClick={() => removeForbiddenWord(word)} className="hover:text-red-300">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                        {forbiddenWords.length === 0 && (
                            <span className="text-ch-text-dimmed text-sm">Nenhuma palavra adicionada</span>
                        )}
                    </div>
                </div>

                {/* Required Elements */}
                <div className="glass rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-ch-white mb-4 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Elementos Obrigatórios
                    </h2>
                    <p className="text-sm text-ch-text-muted mb-4">
                        Elementos que devem estar presentes nos anúncios (disclaimers, hashtags, etc).
                    </p>

                    <div className="flex gap-2 mb-4">
                        <Input
                            value={newRequiredElement}
                            onChange={(e) => setNewRequiredElement(e.target.value)}
                            placeholder="Ex: #ad, @marca, ®..."
                            className="bg-ch-dark-gray border-ch-dark-gray"
                            onKeyDown={(e) => e.key === 'Enter' && addRequiredElement()}
                        />
                        <Button
                            onClick={addRequiredElement}
                            variant="outline"
                            className="border-ch-dark-gray"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {requiredElements.map((element) => (
                            <span
                                key={element}
                                className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm flex items-center gap-1"
                            >
                                {element}
                                <button onClick={() => removeRequiredElement(element)} className="hover:text-green-300">
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                        {requiredElements.length === 0 && (
                            <span className="text-ch-text-dimmed text-sm">Nenhum elemento adicionado</span>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button
                        onClick={() => saveBrandConfig.mutate()}
                        disabled={saveBrandConfig.isPending}
                        className="bg-ch-orange hover:bg-ch-orange/90"
                    >
                        {saveBrandConfig.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Salvar Configurações
                    </Button>
                </div>
            </div>
        </div>
    );
}
