import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Palette, TrendingUp } from 'lucide-react';
import { useModule } from '@/contexts/ModuleContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springPop } from '@/lib/motion-presets';

const META = {
  branding: { label: 'Branding', sub: 'Auditoria de identidade visual', Icon: Palette },
  performance: { label: 'Performance', sub: 'Análise de resultados', Icon: TrendingUp },
} as const;

const OVERLAY_MS = 600;

/**
 * Brief full-screen overlay shown when the user switches modules.
 * Respects prefers-reduced-motion.
 */
export function ModuleSwitchTransition() {
  const { module, lastSwitchAt } = useModule();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastSwitchAt) return;
    if (reduced) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), OVERLAY_MS);
    return () => clearTimeout(t);
  }, [lastSwitchAt, reduced]);

  const meta = META[module];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="module-switch"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={springPop}
            className="flex flex-col items-center gap-3 px-12 py-9 rounded-3xl border border-ch-orange/30 bg-card/95 shadow-elevated"
          >
            <div className="w-14 h-14 rounded-2xl bg-ch-orange/10 border border-ch-orange/30 flex items-center justify-center text-ch-orange shadow-accent">
              <meta.Icon className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground tracking-tight">{meta.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{meta.sub}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
