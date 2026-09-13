import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  CornerDownLeft,
  FileDown,
  Printer,
  Briefcase,
  Wrench,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { preloadAdvisorModal } from '../features/advisor/AdvisorModalHost';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { useApplications } from '../store/useApplications';
import { downloadNativeDocxCv } from '../lib/docxExporter';
import { useFocusTrap } from '../hooks/useFocusTrap';

import {
  IconHome,
  IconMatcher,
  IconApplications,
  IconVault,
  IconBrain,
  IconPricing,
  IconSparkles,
  IconZap,
  IconPalette,
  IconSun,
  IconMoon,
} from './ui/icons/ModernIcons';

interface CommandItem {
  id: string;
  label: string;
  category: 'Nawigacja' | 'Narzędzia' | 'Ustawienia' | 'Oferty' | 'Umiejętności' | 'Eksport';
  icon: React.ElementType;
  hint?: string;
  keywords?: string;
  action: () => void;
}

/**
 * Fuzzy scoring: podsekwencja znaków zapytania w tekście, z bonusem za
 * spójne trafienia obok siebie.
 *
 * Celowo proste i bez zależności: paleta ma działać natychmiast przy każdym
 * naciśnięciu klawisza, a dopasowanie ma być przewidywalne dla człowieka —
 * „prc" znajduje „Pipeline — aplikacje", ale nie losowy skrót liter w środku
 * zdania, bo te dostają zerowy wynik kontekstowy.
 */
function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;

  // Trafienie dosłowne fragmentu — najlepsza klasa.
  const directIndex = t.indexOf(q);
  if (directIndex !== -1) {
    return 200 - directIndex;
  }

  let score = 0;
  let textIndex = 0;
  let streak = 0;

  for (const char of q) {
    const found = t.indexOf(char, textIndex);
    if (found === -1) return 0;

    streak = found === textIndex ? streak + 1 : 0;
    score += 10 + streak * 4 - Math.min(5, found - textIndex);
    textIndex = found + 1;
  }

  return score;
}

/** Statyczny identyfikator listboxa — paleta jest instancją singletonem w drzewie. */
const LISTBOX_ID = 'cmdk-list';

export interface CommandPaletteProps {
  /**
   * Jedyna droga zmiany zakładki z palety. Wcześniej komponent sięgał po
   * `setActiveTab` i omijał blokady sekcji — jedyny strażnik odblokowań
   * siedzi w `navigate()` w App.
   */
  onNavigate: (tab: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { setAdvisorOpen, setDesignTokensOpen, setVoiceLabOpen } = useAppStore();

  const { theme, setTheme } = useTheme();
  const { userVault } = useAuth();
  const { applications } = useApplications();

  // Paleta jest uruchamiana wyłącznie przez widoczny przycisk. Nie przechwytujemy
  // skrótów systemowych ani przeglądarkowych, które łatwo kolidują z nawykami.
  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('cvelocity:open-command-palette', open);
    return () => window.removeEventListener('cvelocity:open-command-palette', open);
  }, []);

  const commands: CommandItem[] = useMemo(() => {
    const base: CommandItem[] = [
      {
        id: 'nav-home',
        label: 'Przejdź do: Pulpit główny',
        category: 'Nawigacja',
        icon: IconHome,
        action: () => onNavigate('home'),
      },
      {
        id: 'nav-profil',
        label: 'Przejdź do: Profil & Master Vault',
        category: 'Nawigacja',
        icon: IconVault,
        keywords: 'master vault umiejętności doświadczenie edukacja',
        action: () => onNavigate('profil'),
      },
      {
        id: 'nav-aplikuj',
        label: 'Przejdź do: Aplikuj (oferta, dopasowanie ATS, generator)',
        category: 'Nawigacja',
        icon: IconMatcher,
        keywords: 'oferta praca matcher ats cv list motywacyjny',
        action: () => onNavigate('aplikuj'),
      },
      {
        id: 'nav-ats-lab',
        label: 'Przejdź do: Laboratorium Audytu ATS 360°',
        category: 'Nawigacja',
        icon: IconZap,
        keywords: 'ats lab audyt silniki telemetria konsensus',
        action: () => onNavigate('ats-lab'),
      },
      {
        id: 'nav-trenuj',
        label: 'Przejdź do: Trenuj (przygotowanie do rozmowy)',
        category: 'Nawigacja',
        icon: IconBrain,
        keywords: 'drill rozmowa trening pytania',
        action: () => onNavigate('trenuj'),
      },
      {
        id: 'nav-pipeline',
        label: 'Przejdź do: Pipeline (wysłane aplikacje i rozmowy)',
        category: 'Nawigacja',
        icon: IconApplications,
        action: () => onNavigate('pipeline'),
      },
      {
        id: 'nav-pricing',
        label: 'Przejdź do: Cennik & Pakiety Pro',
        category: 'Nawigacja',
        icon: IconPricing,
        action: () => onNavigate('pricing'),
      },
      {
        id: 'act-voice-lab',
        label: 'Laboratorium Głosu & Router VAD (180 nagrań, mikrofon i dyktowanie)',
        category: 'Narzędzia',
        icon: IconBrain,
        keywords: 'glos vad mikrofon nagrania audio rekruter dyktowanie speech router 180',
        action: () => {
          setVoiceLabOpen(true);
        },
      },
      {
        id: 'act-advisor',
        label: 'Otwórz Okienko Doradcy Kariery',
        category: 'Narzędzia',
        icon: IconSparkles,
        action: () => {
          void preloadAdvisorModal();
          setAdvisorOpen(true);
        },
      },
      // Paleta tokenów to narzędzie deweloperskie — w produkcji nie ma wejścia
      // (przycisk w topbarze jest ogrodzony tym samym warunkiem).
      ...(import.meta.env.DEV
        ? [
            {
              id: 'act-tokens',
              label: 'Pokaż Paletę Tokenów Design System',
              category: 'Narzędzia' as const,
              icon: IconPalette,
              action: () => setDesignTokensOpen(true),
            },
          ]
        : []),
      {
        id: 'act-theme',
        label: `Przełącz Motyw (Aktualny: ${theme === 'dark' ? 'Ciemny' : 'Jasny'})`,
        category: 'Ustawienia',
        icon: theme === 'dark' ? IconSun : IconMoon,
        action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      },
    ];

    // Eksport: realni konsumenci istniejących ścieżek eksportu.
    if (userVault) {
      base.push({
        id: 'export-docx',
        label: 'Eksport: CV do Word (.docx)',
        category: 'Eksport',
        icon: FileDown,
        keywords: 'docx word eksport pobierz zapisz dokument',
        action: () => {
          void downloadNativeDocxCv(
            userVault,
            [],
            userVault.personalInfo.title || '',
            ''
          );
        },
      });
      base.push({
        id: 'export-print',
        label: 'Drukuj / Zapisz jako PDF',
        category: 'Eksport',
        icon: Printer,
        keywords: 'pdf druk wydruk eksport papier',
        action: () => window.print(),
      });
    }

    // Aktywne oferty z Pipeline — po nazwie firmy trafi się szybciej niż przez menu.
    for (const application of applications.slice(0, 8)) {
      if (!application) continue;
      base.push({
        id: `app-${application.id}`,
        label: `Aplikacja: ${application.company || ''} — ${application.position || ''}`,
        category: 'Oferty',
        icon: Briefcase,
        keywords: `${application.status || ''} oferta`,
        action: () => onNavigate('pipeline'),
      });
    }

    // Umiejętności ze Skarbca — wejście prosto w profil, gdzie można je edytować.
    const skills = [
      ...new Set(
        [...(userVault?.skillsMatrix?.hardSkills ?? []), ...(userVault?.skillsMatrix?.toolsAndTech ?? [])].map(
          (skill) => skill.trim()
        )
      ),
    ]
      .filter(Boolean)
      .slice(0, 15);

    for (const skill of skills) {
      base.push({
        id: `skill-${skill}`,
        label: `Umiejętność z Master Vault: ${skill}`,
        category: 'Umiejętności',
        icon: Wrench,
        action: () => onNavigate('profil'),
      });
    }

    return base;
  }, [theme, setTheme, onNavigate, setAdvisorOpen, setDesignTokensOpen, userVault, applications]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.slice(0, 20);

    return commands
      .map((command) => ({
        command,
        score: Math.max(fuzzyScore(query, command.label), fuzzyScore(query, `${command.category} ${command.keywords ?? ''}`) * 0.8),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((entry) => entry.command);
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleExecute = (item: CommandItem) => {
    item.action();
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      handleExecute(filtered[selectedIndex]);
    }
  };

  const activeOptionId = filtered[selectedIndex] ? `${LISTBOX_ID}-opt-${filtered[selectedIndex].id}` : undefined;
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-label="Paleta poleceń"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-floating"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
              <Search className="h-4 w-4 text-muted" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDownList}
                role="combobox"
                aria-expanded="true"
                aria-controls={LISTBOX_ID}
                aria-autocomplete="list"
                aria-activedescendant={activeOptionId}
                aria-label="Szukaj poleceń, ofert i umiejętności"
                placeholder="Wpisz polecenie, ofertę albo umiejętność..."
                className="flex-1 bg-transparent text-sm text-ink placeholder:text-subtle focus:outline-none"
              />
              <span className="rounded-md border border-line bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-muted">
                ESC
              </span>
            </div>

            {/* Results List */}
            <div className="scrollbar-thin max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted" role="status">
                  Nie znaleziono żadnych pasujących poleceń.
                </div>
              ) : (
                <div className="space-y-1" role="listbox" id={LISTBOX_ID} aria-label="Wyniki wyszukiwania">
                  {filtered.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        id={`${LISTBOX_ID}-opt-${item.id}`}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleExecute(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors focus-visible:outline-none ${
                          isSelected
                            ? 'bg-brand-600 text-on-brand shadow-xs'
                            : 'text-ink hover:bg-elevated'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-on-brand' : 'text-muted'}`} />
                          <span className="truncate font-medium">{item.label}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`rounded-md px-1.5 py-px font-mono text-[10px] uppercase ${
                              isSelected ? 'bg-on-brand/20 text-on-brand' : 'bg-sunken text-muted border border-line/60'
                            }`}
                          >
                            {item.category}
                          </span>
                          {isSelected && <CornerDownLeft className="h-3 w-3 text-on-brand/80" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Navigation Hints */}
            <div className="flex items-center justify-between border-t border-line/60 bg-sunken/50 px-4 py-2 text-[10px] text-muted font-mono">
              <div className="flex items-center gap-3">
                <span>↑↓ Nawigacja</span>
                <span>↵ Wybierz</span>
              </div>
              <span>Wyszukiwarka funkcji</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
