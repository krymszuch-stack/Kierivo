import React, { useState } from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { spotlightCoords } from '../../lib/animationMath';

export interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'flat' | 'raised' | 'sunken' | 'elevated' | 'surface';
  tone?: 'flat' | 'raised' | 'sunken';
  hoverEffect?: boolean;
  /** Plamka światła podążająca za kursorem (wzorzec „Spotlight Card").
   *  Wyłącznie opt-in: handlery ruchu myszy doklejane są tylko wtedy, gdy
   *  ktoś o nią poprosi, więc 26 istniejących użyć karty nie płaci za efekt. */
  spotlight?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant,
  tone = 'raised',
  hoverEffect = true,
  spotlight = false,
  className = '',
  children,
  ...props
}) => {
  const resolvedTone = variant === 'flat' || variant === 'surface'
    ? 'flat'
    : variant === 'sunken'
    ? 'sunken'
    : tone;

  // Czy karta jest najechana — steruje wyłącznie zanikiem plamki. Pozycja
  // kursora NIE jest stanem Reacta: ruch mysy generuje dziesiątki zdarzeń na
  // sekundę i przepisywanie ich w rerendery byłoby droższe niż sama animacja.
  // Pozycja płynie przez zmienne CSS ustawiane bezpośrednio na elemencie.
  const [spotlit, setSpotlit] = useState(false);

  // HTMLElement, nie HTMLDivElement: wariant klikalny renderuje <button>,
  // a handlery muszą pasować do obu elementów (zdarzenie przycisku jest
  // przypisywalne do szerszego HTMLElement, nie odwrotnie).
  const handleSpotlightMove = (event: React.MouseEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const { x, y } = spotlightCoords(
      el.getBoundingClientRect(),
      event.clientX,
      event.clientY,
    );
    el.style.setProperty('--spot-x', `${x}%`);
    el.style.setProperty('--spot-y', `${y}%`);
  };

  const handleSpotlightLeave = (event: React.MouseEvent<HTMLElement>) => {
    setSpotlit(false);
    // Plamka ląduje poza kadrem, żeby transition-opacity zaniżał ją łagodnie,
    // a nie ucinał w połowie karty.
    const el = event.currentTarget;
    el.style.setProperty('--spot-x', '-100%');
    el.style.setProperty('--spot-y', '-100%');
  };

  // `card-ambient` czyni wypełnienie lekko przepuszczalnym, żeby karta łapała
  // poświatę tła zamiast ją zasłaniać (patrz tokens.css). `bg-elevated` zostaje
  // jako wypełnienie zapasowe dla przeglądarek bez rozmycia tła.
  const toneStyles = {
    flat: 'bg-surface border-line',
    raised: 'card-ambient bg-elevated border-line shadow-raised',
    sunken: 'bg-sunken border-line/80',
  };

  const hoverStyles = hoverEffect && resolvedTone === 'raised'
    ? 'hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/5 transition-[border-color,box-shadow] duration-150 ease-out'
    : hoverEffect
    ? 'hover:border-brand-500/30 transition-[border-color,box-shadow] duration-150 ease-out'
    : '';

  // Wariant klikalny: ten sam wygląd, ale <button> zamiast <div>, żeby kafelek
  // był osiągalny z klawiatury (div z onClick nie ma fokusu). Kafelki strony
  // startowej korzystają z tego zamiast ręcznie powtarzać styl karty.
  const interactive = Boolean(props.onClick);

  if (interactive) {
    return (
      <motion.button
        type="button"
        onMouseEnter={spotlight ? () => setSpotlit(true) : undefined}
        onMouseMove={spotlight ? handleSpotlightMove : undefined}
        onMouseLeave={spotlight ? handleSpotlightLeave : undefined}
        className={`relative cursor-pointer rounded-2xl border p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${toneStyles[resolvedTone]} ${hoverStyles} ${className}`}
        {...(props as unknown as HTMLMotionProps<'button'>)}
      >
        {spotlight && <SpotlightLayers spotlit={spotlit} />}
        {children}
      </motion.button>
    );
  }

  return (
    <motion.div
      onMouseEnter={spotlight ? () => setSpotlit(true) : undefined}
      onMouseMove={spotlight ? handleSpotlightMove : undefined}
      onMouseLeave={spotlight ? handleSpotlightLeave : undefined}
      className={`relative rounded-2xl border p-5 ${toneStyles[resolvedTone]} ${hoverStyles} ${className}`}
      {...props}
    >
      {spotlight && <SpotlightLayers spotlit={spotlit} />}
      {children}
    </motion.div>
  );
};

/** Plamka i obwódka spotlightu — wydzielone, by oba warianty karty dzieliły dokładnie ten sam efekt. */
const SpotlightLayers: React.FC<{ spotlit: boolean }> = ({ spotlit }) => (
  <>
    {/* Wypełnienie: miękkie światło brandowe za treścią karty.
        Karta jest relative + overflow-hidden tylko przy spotlight,
        bo clipowanie zmieniałoby render cieni u pozostałych użyć. */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-0 transition-opacity duration-[var(--duration-ui)]"
      style={{
        opacity: spotlit ? 1 : 0,
        background:
          'radial-gradient(320px circle at var(--spot-x, -100%) var(--spot-y, -100%), color-mix(in srgb, var(--brand-500) 12%, transparent), transparent 65%)',
      }}
    />
    {/* Obwódka: ten sam gradient, ale zamaskowany do 1px ramki
        (mask-composite wycina wnętrze). To ona sprzedaje efekt —
        kontur rozświetla się dokładnie tam, gdzie stoi kursor. */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl p-px opacity-0 transition-opacity duration-[var(--duration-ui)]"
      style={{
        opacity: spotlit ? 1 : 0,
        background:
          'radial-gradient(220px circle at var(--spot-x, -100%) var(--spot-y, -100%), color-mix(in srgb, var(--brand-500) 45%, transparent), transparent 70%)',
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    />
  </>
);
