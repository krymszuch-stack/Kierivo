/**
 * ContextualAdvisorFab — Pływający, inteligentny przycisk Doradcy Kierivo 11/10.
 *
 * Zamiast jednego generycznego chatbota, przycisk natychmiast adaptuje się do ekranu:
 * - Na profilu:     „✦ Pomóż opisać doświadczenie”
 * - Na ofercie:     „✦ Wyjaśnij wymagania”
 * - Na CV:          „✦ Pomóż poprawić CV”
 * - Na aplikacji:   „✦ Przygotuj mnie do rozmowy”
 * - Na innych:      „✦ Zapytaj Kierivo”
 */

import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import type { NavTabId } from '../../lib/navigation';

export interface ContextualAdvisorFabProps {
  activeTab: NavTabId;
  onOpenAdvisor: (initialQuestion?: string) => void;
  className?: string;
}

interface ContextConfig {
  label: string;
  initialQuestion: string;
}

const CONTEXT_MAP: Partial<Record<NavTabId, ContextConfig>> = {
  profil: {
    label: 'Pomóż opisać doświadczenie',
    initialQuestion: 'Pomóż mi precyzyjnie opisać moje stanowisko i zakres obowiązków z użyciem mierzalnych rezultatów i konkretnych czasowników akcji.',
  },
  aplikuj: {
    label: 'Wyjaśnij wymagania',
    initialQuestion: 'Pomóż mi przeanalizować kluczowe wymagania tej oferty pracy i wyjaśnij, na co rekruter będzie zwracał szczególną uwagę.',
  },
  cv: {
    label: 'Pomóż poprawić CV',
    initialQuestion: 'Przeanalizuj treść mojego CV i podpowiedz 2–3 konkretne ulepszenia struktury, podsumowania zawodowego lub punktów doświadczenia.',
  },
  pipeline: {
    label: 'Przygotuj mnie do rozmowy',
    initialQuestion: 'Jakie pytania rekrutacyjne i techniczne mogę usłyszeć na najbliższym etapie i jak przygotować odpowiedzi według modelu STAR?',
  },
  trenuj: {
    label: 'Przećwicz odpowiedź',
    initialQuestion: 'Przećwiczmy symulację odpowiedzi rekrutacyjnej na trudne pytanie o moje doświadczenie i luki technologiczne.',
  },
};

const DEFAULT_CONFIG: ContextConfig = {
  label: 'Zapytaj Kierivo',
  initialQuestion: 'Co warto teraz zrobić w procesie poszukiwania pracy i jak najlepiej wykorzystać mój profil?',
};

export const ContextualAdvisorFab: React.FC<ContextualAdvisorFabProps> = ({
  activeTab,
  onOpenAdvisor,
  className = '',
}) => {
  const config = CONTEXT_MAP[activeTab] || DEFAULT_CONFIG;

  const handleClick = () => {
    onOpenAdvisor(config.initialQuestion);
  };

  return (
    <aside aria-label="Kontekstowy doradca AI" className={`fixed bottom-5 right-5 z-40 ${className}`}>
      <motion.button
        type="button"
        onClick={handleClick}
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="group flex cursor-pointer items-center gap-2 rounded-full border border-brand-500/30 bg-surface/95 px-4 py-2.5 font-sans text-xs font-bold text-ink shadow-raised backdrop-blur-md transition-all duration-150 hover:border-brand-500 hover:bg-surface-raised hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
        title={config.label}
        aria-label={config.label}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500/10 text-brand-fg transition-transform duration-200 group-hover:scale-110">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="font-semibold tracking-tight text-ink group-hover:text-brand-fg transition-colors">
          {config.label}
        </span>
      </motion.button>
    </aside>
  );
};

export default ContextualAdvisorFab;
