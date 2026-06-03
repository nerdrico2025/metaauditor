import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import {
  useCompany,
  useUpdateCompany,
  emptyBrandBriefing,
  isBrandBriefingComplete,
  type BrandBriefing,
  type CompanyAiContext,
} from '@/hooks/useCompany';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  allowSkip?: boolean;
}

const STEPS = [
  {
    title: 'Essência da marca',
    description: 'Conte quem é a marca e como ela deve ser percebida.',
    fields: ['brand_promise', 'brand_personality', 'audience_perception'] as const,
  },
  {
    title: 'Identidade visual',
    description: 'Descreva cores, logo e estilo visual dos anúncios.',
    fields: ['visual_identity', 'logo_usage'] as const,
  },
  {
    title: 'Tom e diretrizes',
    description: 'Defina o que pode e o que não pode aparecer nos criativos.',
    fields: ['tone_in_ads', 'mandatory_elements', 'forbidden_practices', 'reference_notes'] as const,
  },
] as const;

const FIELD_LABELS: Record<keyof BrandBriefing, string> = {
  completed_at: '',
  brand_promise: 'O que a marca representa / promessa de marca',
  brand_personality: 'Personalidade da marca (ex.: confiável, jovem, premium)',
  visual_identity: 'Identidade visual (cores, tipografia, estilo)',
  logo_usage: 'Como usar logo e elementos visuais',
  tone_in_ads: 'Tom de voz específico para anúncios',
  mandatory_elements: 'O que SEMPRE deve aparecer nos criativos',
  forbidden_practices: 'O que NUNCA pode aparecer',
  audience_perception: 'Como o público deve perceber a marca',
  reference_notes: 'Referências visuais / o que evitar parecer',
};

const FIELD_PLACEHOLDERS: Partial<Record<keyof BrandBriefing, string>> = {
  brand_promise: 'Ex.: Conectamos famílias com internet rápida e atendimento humano de verdade.',
  brand_personality: 'Ex.: Acessível, confiável, próximo — nunca corporativo ou distante.',
  visual_identity: 'Ex.: Azul #0055FF, branco, tipografia sans-serif limpa. Fotos reais, luz natural.',
  logo_usage: 'Ex.: Logo sempre no canto inferior direito, mínimo 48px, fundo contrastante.',
  tone_in_ads: 'Ex.: Direto e empático. Frases curtas. Segunda pessoa ("você"). Sem jargão técnico.',
  mandatory_elements: 'Ex.: Logo, CTA claro, menção "sujeito à viabilidade" em ofertas.',
  forbidden_practices: 'Ex.: Não usar stock genérico, não prometer velocidade fixa, sem caps lock.',
  audience_perception: 'Ex.: Marca local de confiança, não uma grande operadora impessoal.',
  reference_notes: 'Ex.: Evitar parecer com Vivo/Claro. Referência: Nubank (clareza) + Magalu (proximidade).',
};

function cleanBriefing(form: BrandBriefing): BrandBriefing {
  const out: BrandBriefing = {};
  for (const key of Object.keys(form) as (keyof BrandBriefing)[]) {
    if (key === 'completed_at') continue;
    const val = form[key]?.trim();
    if (val) (out as Record<string, string>)[key] = val;
  }
  if (isBrandBriefingComplete(out)) {
    out.completed_at = new Date().toISOString();
  }
  return out;
}

export function BrandBriefingWizard({ isOpen, onClose, onComplete, allowSkip = false }: Props) {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const updateCompany = useUpdateCompany();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<BrandBriefing>({ ...emptyBrandBriefing });

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setForm({
        ...emptyBrandBriefing,
        ...company?.ai_context?.brand_briefing,
      });
    }
  }, [isOpen, company?.ai_context?.brand_briefing]);

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const handleSave = async () => {
    const briefing = cleanBriefing(form);
    if (!isBrandBriefingComplete(briefing)) {
      toast.error('Preencha promessa de marca, identidade visual e tom de voz para continuar.');
      return;
    }

    const existingCtx: CompanyAiContext = company?.ai_context ?? {};
    try {
      await updateCompany.mutateAsync({
        ai_context: {
          ...existingCtx,
          brand_briefing: briefing,
        },
      });
      onComplete();
      onClose();
    } catch {
      toast.error('Erro ao salvar briefing.');
    }
  };

  const updateField = (key: keyof BrandBriefing, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Briefing de marca
          </DialogTitle>
          <DialogDescription>
            Etapa {step + 1} de {STEPS.length} — {currentStep.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {currentStep.fields.map((field) => (
            <div key={field} className="space-y-1.5">
              <Label className="text-sm">{FIELD_LABELS[field]}</Label>
              <Textarea
                rows={field === 'mandatory_elements' || field === 'forbidden_practices' ? 3 : 2}
                placeholder={FIELD_PLACEHOLDERS[field]}
                value={form[field] || ''}
                onChange={(e) => updateField(field, e.target.value)}
              />
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Você pode editar depois em{' '}
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => { onClose(); navigate('/contexto'); }}
          >
            Configurações → Contexto da IA
          </button>
          .
        </p>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {allowSkip && (
              <Button type="button" variant="ghost" onClick={() => { onComplete(); onClose(); }}>
                Pular por agora
              </Button>
            )}
            {!isLastStep ? (
              <Button type="button" onClick={() => setStep(s => s + 1)}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSave} disabled={updateCompany.isPending}>
                {updateCompany.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Salvar e continuar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
