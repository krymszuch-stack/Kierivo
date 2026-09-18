import React, { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Liczba animowana od zera (przy montowaniu) i między kolejnymi wartościami —
 * wzorzec „Count Up" z najwyżej ocenianych bibliotek UI (react-bits, Magic UI).
 *
 * Dlaczego MotionValue, a nie stan Reacta: licznik zmienia tekst dziesiątki
 * razy na sekundę i każdy krok jako rerender komponentu byłby droższy niż
 * sama animacja. MotionValue aktualizuje węzeł tekstowy poza cyklem renderu.
 */
export interface AnimatedNumberProps {
  value: number;
  className?: string;
  /** Domyślnie zaokrąglenie do liczby całkowitej z grupowaniem pl-PL. */
  format?: (value: number) => string;
}

const defaultFormat = (value: number): string =>
  new Intl.NumberFormat('pl-PL').format(Math.round(value));

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  className,
  format = defaultFormat,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const motionValue = useMotionValue(shouldReduceMotion ? value : 0);
  const text = useTransform(motionValue, format);

  useEffect(() => {
    // Przy „redukcji ruchu" licznik ma pokazać wynik od razu — to zmiana stanu,
    // którą trzeba odebrać natychmiast, nie dekoracja do wyłączania.
    if (shouldReduceMotion) {
      motionValue.set(value);
      return;
    }
    // 700 ms = token --duration-data; ta sama stała czasowa co ScoreRing,
    // żeby wszystkie animacje danych w aplikacji biegły jednym rytmem.
    const controls = animate(motionValue, value, {
      duration: 0.7,
      ease: [0.19, 1, 0.22, 1],
    });
    return () => controls.stop();
  }, [value, shouldReduceMotion, motionValue]);

  if (shouldReduceMotion) {
    return <span className={className}>{format(value)}</span>;
  }

  return <motion.span className={className}>{text}</motion.span>;
};
