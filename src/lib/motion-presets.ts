import type { Transition, Variants } from 'framer-motion';

export const springDefault: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 32,
};

export const springPop: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 24,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
};

export const fadeUpInstant: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

export const staggerContainer = (stagger = 0.04, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const staggerContainerInstant: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0, delayChildren: 0 } },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

export const pageTransitionInstant: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 1, y: 0 },
};

/** Returns motion variants respecting reduced-motion preference. */
export function motionVariants(reduced: boolean) {
  return {
    fadeUp: reduced ? fadeUpInstant : fadeUp,
    staggerContainer: reduced ? staggerContainerInstant : staggerContainer(),
    pageTransition: reduced ? pageTransitionInstant : pageTransition,
  };
}

/** Reads --ch-orange from document root for charts (module-aware). */
export function getAccentColor(): string {
  if (typeof document === 'undefined') return 'hsl(35 97% 41%)';
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--ch-orange').trim();
  return raw ? `hsl(${raw})` : 'hsl(35 97% 41%)';
}
