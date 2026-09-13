import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Rocket } from 'lucide-react';
import {
  APPLICATION_CHANNELS,
  ApplicationChannel,
  FAILURE_REASONS,
  FailureReason,
  SALARY_TRANSPARENCY_OPTIONS,
  SalaryTransparency,
  buildApplicationFromPending,
  buildFeedbackPayload,
  guessChannel,
  noteForFailure,
  sendApplicationFeedback,
} from '../../lib/applicationFeedback';
import {
  dismissPendingConfirmation,
  resolvePendingConfirmation,
  usePendingApplication,
} from '../../store/usePendingApplication';
import { useApplications } from '../../store/useApplications';
import { showToast } from '../../store/useToastStore';

import { Button } from '../../components/ui/Button';
import type { NavTabId } from '../../lib/navigation';

/**
 * Ankieta po eksporcie dokumentu — pływająca karta w rogu, nie modal.
 *
 * Świadomie bez nakładki blokującej ekran: pytanie jest naszą ciekawością,
 * a nie krokiem, który użytkownik musi wykonać. Zasłonięcie mu aplikacji po
 * pobraniu CV kosztowałoby więcej niż warta jest odpowiedź.
 *
 * Cała logika (co wysłać, jaki wpis zbudować) siedzi w
 * `src/lib/applicationFeedback.ts` i jest testowana w Node — tutaj zostaje
 * wybór kroku i podpięcie do sklepów.
 */

export interface ApplicationFeedbackModalProps {
  /** Przejście do Pipeline po potwierdzeniu wysyłki. */
  onNavigate?: (tab: NavTabId) => void;
  className?: string;
}

type Step = 'ask' | 'success' | 'problem';

const CHIP_BASE =
  'cursor-pointer rounded-xl border px-3 py-1.5 text-left font-mono text-[11px] font-bold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50';
const CHIP_OFF = 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700';
const CHIP_ON = 'border-[#F26440] bg-[#F26440]/15 text-[#F26440]';

export const ApplicationFeedbackModal: React.FC<ApplicationFeedbackModalProps> = ({
  onNavigate,
  className = '',
}) => {
  const pending = usePendingApplication();
  const { applications, saveApplication, patchApplication } = useApplications();

  const [step, setStep] = useState<Step>('ask');
  const [channel, setChannel] = useState<ApplicationChannel | null>(null);
  const [transparency, setTransparency] = useState<SalaryTransparency | null>(null);
  const [failure, setFailure] = useState<FailureReason | null>(null);

  const suggestedChannel = useMemo(() => guessChannel(pending?.sourceUrl), [pending?.sourceUrl]);
  const activeChannel = channel ?? suggestedChannel;

  if (!pending) return null;

  const resetLocal = () => {
    setStep('ask');
    setChannel(null);
    setTransparency(null);
    setFailure(null);
  };

  /** Wpis w Pipeline: istniejący aktualizujemy, nowy dokładamy. */
  const upsert = (status: 'Wysłana' | 'Do wysłania', notes?: string) => {
    const existing = applications.find(
      (entry) =>
        entry.id === pending.jobId ||
        (entry.company === pending.company && entry.position === pending.title)
    );

    if (existing) {
      const candidate = buildApplicationFromPending(pending, status, { notes });
      patchApplication(existing.id, {
        status,
        notes: notes ?? existing.notes,
        // Ręcznie dodana aplikacja może już istnieć. Nie zastępujemy jej
        // historią, a tylko dokładamy migawkę dokumentu, jeśli właśnie
        // powstała przy eksporcie.
        documentSnapshot: candidate.documentSnapshot ?? existing.documentSnapshot,
      });
      return;
    }

    saveApplication(buildApplicationFromPending(pending, status, { notes }));
  };


  const handleApplied = () => {
    upsert('Wysłana');
    showToast('Dodano do moich aplikacji', {
      message: `${pending.title} — ${pending.company}. Status: wysłana.`,
    });
    setStep('success');
  };

  const handleFinishSuccess = (goToPipeline: boolean) => {
    sendApplicationFeedback(
      buildFeedbackPayload(pending, {
        appliedSuccessfully: true,
        channel: activeChannel,
        salaryTransparency: transparency,
      })
    );
    resolvePendingConfirmation(pending.jobId);
    resetLocal();
    if (goToPipeline) onNavigate?.('pipeline');
  };

  const handleFinishProblem = () => {
    upsert('Do wysłania', noteForFailure(failure));
    sendApplicationFeedback(
      buildFeedbackPayload(pending, { appliedSuccessfully: false, failureReason: failure })
    );
    showToast('Oferta czeka na liście aplikacji', {
      message: 'Zostawiliśmy ją jako „Do wysłania” razem z powodem.',
      variant: 'info',
    });
    resolvePendingConfirmation(pending.jobId);
    resetLocal();
  };

  return (
    <AnimatePresence>
      <motion.aside
        key="application-feedback"
        role="dialog"
        aria-label="Potwierdzenie wysłania aplikacji"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.28, ease: [0.19, 1, 0.22, 1] }}
        className={`fixed bottom-4 right-4 z-[70] w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-5 text-slate-100 shadow-2xl backdrop-blur-xl print:hidden ${className}`}
      >
        <button
          type="button"
          onClick={() => {
            dismissPendingConfirmation();
            resetLocal();
          }}
          aria-label="Pomiń, przypomnij później"
          className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 ease-out hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50"
        >
          <X className="h-4 w-4" />
        </button>

        {step === 'ask' && (
          <div className="space-y-4">
            <div className="pr-8">
              <h2 className="flex items-center gap-2 text-base font-black tracking-tight">
                Aplikacja wysłana?
                <Rocket className="h-4 w-4 text-[#F26440]" />
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                Dopasowaliśmy CV do oferty <span className="font-bold text-slate-100">{pending.title}</span>{' '}
                w <span className="font-bold text-slate-100">{pending.company}</span>. Czy zgłoszenie
                poszło w świat?
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleApplied}
                className="flex-1 cursor-pointer rounded-xl bg-[#F26440] px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50"
              >
                Tak, zaaplikowałem!
              </button>
              <button
                type="button"
                onClick={() => setStep('problem')}
                className="flex-1 cursor-pointer rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-200 transition-colors duration-200 ease-out hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50"
              >
                Jeszcze nie / Miałem problem
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4">
            <div className="pr-8">
              <h2 className="text-base font-black tracking-tight">Dodane do moich aplikacji 🚀</h2>
              <p className="mt-1.5 text-sm text-slate-300">
                Dwa kliknięcia i znikamy — anonimowo, bez Twojego konta. Dzięki nim następna osoba
                wie, gdzie ta rekrutacja naprawdę się toczy.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Gdzie wysłano?
              </legend>
              <div className="flex flex-wrap gap-2">
                {APPLICATION_CHANNELS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={activeChannel === option}
                    onClick={() => setChannel(option)}
                    className={`${CHIP_BASE} ${activeChannel === option ? CHIP_ON : CHIP_OFF}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Czy w ogłoszeniu podano realne widełki?
              </legend>
              <div className="flex flex-wrap gap-2">
                {SALARY_TRANSPARENCY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={transparency === option.id}
                    onClick={() => setTransparency(option.id)}
                    className={`${CHIP_BASE} ${transparency === option.id ? CHIP_ON : CHIP_OFF}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => handleFinishSuccess(false)}
                className="cursor-pointer rounded-xl px-2 py-1.5 text-left font-mono text-[11px] text-slate-400 transition-colors duration-200 ease-out hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50"
              >
                Zostaw mnie tutaj
              </button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={ArrowRight}
                iconPosition="right"
                onClick={() => handleFinishSuccess(true)}
              >
                Przejdź do aplikacji i ściągi
              </Button>
            </div>
          </div>
        )}

        {step === 'problem' && (
          <div className="space-y-4">
            <div className="pr-8">
              <h2 className="text-base font-black tracking-tight">Co stanęło na przeszkodzie?</h2>
              <p className="mt-1.5 text-sm text-slate-300">
                Oferta zostaje na liście jako „Do wysłania”, więc nie zginie.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {FAILURE_REASONS.map((reason) => (
                <button
                  key={reason.id}
                  type="button"
                  aria-pressed={failure === reason.id}
                  onClick={() => setFailure(reason.id)}
                  className={`${CHIP_BASE} min-h-[3rem] leading-snug ${failure === reason.id ? CHIP_ON : CHIP_OFF}`}
                >
                  {reason.label}
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleFinishProblem}
                disabled={!failure}
              >
                Zapisz i zamknij
              </Button>
            </div>
          </div>
        )}
      </motion.aside>
    </AnimatePresence>
  );
};
