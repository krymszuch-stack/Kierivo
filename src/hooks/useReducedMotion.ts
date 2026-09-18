import { useReducedMotion as useMotionReducedMotion } from 'motion/react';

/**
 * Hook wykrywający preferencję redukcji ruchu (prefers-reduced-motion: reduce)
 * zintegrowany z nadrzędnym <MotionConfig reducedMotion="user">.
 */
export function useReducedMotion(): boolean {
  const motionReduced = useMotionReducedMotion();
  return Boolean(motionReduced);
}

export default useReducedMotion;
