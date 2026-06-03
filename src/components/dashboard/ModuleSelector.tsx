import { motion } from 'framer-motion';
import { Palette, TrendingUp } from 'lucide-react';
import { useModule, AppModule } from '@/contexts/ModuleContext';
import { FeatureCard } from '@/components/ui/feature-card';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';

const OPTIONS: {
  id: AppModule;
  title: string;
  description: string;
  Icon: typeof Palette;
}[] = [
  {
    id: 'branding',
    title: 'Branding',
    description: 'Auditoria de identidade visual: regras, conformidade e aprovação de criativos.',
    Icon: Palette,
  },
  {
    id: 'performance',
    title: 'Performance',
    description: 'Análise de resultados: investimento, conversão, CPC e recomendações estratégicas.',
    Icon: TrendingUp,
  },
];

export function ModuleSelector() {
  const { setModule } = useModule();
  const reduced = useReducedMotion();
  const { fadeUp } = motionVariants(reduced);

  return (
    <motion.div
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={fadeUp}
      className="space-y-4"
    >
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Escolha o módulo de trabalho</h2>
        <p className="text-xs text-muted-foreground">
          O menu lateral se adapta ao módulo selecionado. Você pode trocar a qualquer momento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {OPTIONS.map(opt => (
          <FeatureCard
            key={opt.id}
            title={opt.title}
            description={opt.description}
            icon={opt.Icon}
            accent={opt.id === 'performance'}
            onClick={() => {
              setModule(opt.id);
              try {
                localStorage.setItem('clickhero_module_onboarded', '1');
              } catch {
                /* ignore */
              }
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
