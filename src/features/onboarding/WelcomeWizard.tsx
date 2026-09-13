import React, { useState } from 'react';
import { FolderOpen, FileText, Link as LinkIcon, ArrowRight, X, Linkedin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MasterVault } from '../../types';
import { NavTabId } from '../../components/GlobalShell';
import { Button } from '../../components/ui/Button';
import { StorageKeys, readJson, writeJson } from '../../lib/storage';
import { isVaultEmpty } from '../../lib/vaultCompleteness';

export interface WelcomeWizardProps {
  vault: MasterVault;
  onNavigate: (tab: NavTabId) => void;
  className?: string;
}

/**
 * „Nowy" znaczy: żadna sekcja profilu nie ma jeszcze treści. Wystarczy jedna
 * wypełniona, żeby przewodnik zniknął — kto zaczął, ten nie potrzebuje już
 * instrukcji na pół ekranu.
 *
 * Warunek stał tu wcześniej wypisany z ręki i sprawdzał sześć pól. Ta sama
 * rzecz jest teraz liczona przez `measureVaultCompleteness`, więc lokalna
 * kopia znikła: dwie definicje „pustego profilu" rozjechałyby się przy
 * pierwszym dołożeniu sekcji (reguła 3 w `AGENTS.md`).
 */

export const WelcomeWizard: React.FC<WelcomeWizardProps> = ({
  vault,
  onNavigate,
  className = '',
}) => {
  // Zamknięcie przewodnika przeżywa przeładowanie strony. Bez tego wracałby
  // przy każdym wejściu na stronę główną, dopóki profil jest pusty — a to
  // dokładnie ten stan, w którym użytkownik ogląda ją najczęściej.
  const [dismissed, setDismissed] = useState(() =>
    readJson<boolean>(StorageKeys.onboardingDismissed, false)
  );

  const handleDismiss = () => {
    setDismissed(true);
    writeJson(StorageKeys.onboardingDismissed, true);
  };

  const steps = [
    {
      tab: 'profil' as const,
      title: '1. Uzupełnij profil',
      description:
        'Dodaj dane, doświadczenie i stack technologiczny, żeby dopasowanie było trafne od pierwszej oferty.',
      icon: FolderOpen,
    },
    {
      tab: 'profil' as const,
      title: '2. Wczytaj CV',
      description:
        'Zaimportuj PDF lub DOCX albo wklej treść CV, a CVelocity uzupełni brakujące pola profilu.',
      icon: FileText,
    },
    {
      tab: 'aplikuj' as const,
      title: '3. Porównaj ofertę',
      description:
        'Wklej ogłoszenie z OLX, Pracuj.pl czy No Fluff Jobs i sprawdź dopasowanie do swojego profilu.',
      icon: LinkIcon,
    },
  ];

  return (
    <AnimatePresence>
      {isVaultEmpty(vault) && !dismissed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-wizard-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className={`relative w-full max-w-3xl rounded-3xl border border-brand-200 bg-surface p-5 shadow-floating sm:p-7 ${className}`}
          >
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              aria-label="Zamknij przewodnik"
              onClick={handleDismiss}
              className="absolute right-4 top-4"
            />
            <div className="pr-10">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-brand-fg">
                Pierwsze uruchomienie
              </p>
              <h2 id="welcome-wizard-title" className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
                Zacznij od własnego CV, nie od pustego formularza.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Wgraj istniejące CV albo wklej jego treść. Link do LinkedIn możesz dodać do profilu ręcznie — aplikacja nie pobiera danych z LinkedIn automatycznie.
              </p>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => {
                    handleDismiss();
                    onNavigate(step.tab);
                  }}
                  className="rounded-xl border border-brand-200 bg-surface/80 p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-fg">
                      <Icon className="h-4 w-4" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-subtle" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{step.description}</p>
                </button>
              );
            })}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-sunken/40 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs text-muted">
                <Linkedin className="mt-0.5 h-4 w-4 shrink-0 text-brand-fg" />
                <span>Masz LinkedIn? W polu „LinkedIn” w profilu wklej publiczny adres — to wystarczy do kontaktu na CV.</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => {
                  handleDismiss();
                  onNavigate('profil');
                }}
              >
                Wczytaj CV
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
