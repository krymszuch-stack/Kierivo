import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarClock,
  Clock,
  FileWarning,
  Mail,
  Sparkles,
  Target,
  UserPlus,
} from 'lucide-react';
import { NextAction, NextActionType } from '../../lib/nextAction';
import { NavTabId } from '../../lib/navigation';
import { Button } from '../ui/Button';
import { useAppStore } from '../../store/useAppStore';

/**
 * Jedna karta z jedną rekomendacją — oś narracji całego interfejsu.
 *
 * Ekran startowy pokazywał wcześniej sześć kafelków „szybkich akcji", trzy
 * kafelki statystyk i bibliotekę porad. Wszystko naraz i wszystko równie
 * ważne, co w praktyce znaczy: użytkownik ma sam wymyślić, od czego zacząć.
 * Ta karta odpowiada za niego, na podstawie jego faktycznego stanu.
 *
 * Świadomie jedna, nie lista trzech „sugerowanych działań". Lista rekomendacji
 * jest tym samym problemem co menu z osiemnastoma pozycjami, tylko mniejszym.
 */

export interface NextActionCardProps {
  action: NextAction;
  onNavigate: (tab: NavTabId) => void;
  className?: string;
}

const ICONS: Record<NextActionType, React.ElementType> = {
  pre_call_brief: CalendarClock,
  send_followup: Mail,
  complete_vault: UserPlus,
  add_first_job: Target,
  improve_ats: FileWarning,
  follow_up_application: Clock,
  daily_challenge: Sparkles,
};

/**
 * Krok pilny wygląda inaczej niż krok „kiedyś".
 *
 * Rozróżnienie jest tylko wizualne i celowo dotyczy dwóch pierwszych reguł:
 * rozmowa i follow-up mają termin, którego nie da się przesunąć. Reszta to
 * praca, którą równie dobrze można wykonać jutro, i podkręcanie jej kolorem
 * na czerwono skończyłoby się tym, że kolor przestaje cokolwiek znaczyć.
 */
const URGENT: ReadonlySet<NextActionType> = new Set(['pre_call_brief', 'send_followup']);

/** Generyczne „Przejdź" nie mówiło, dokąd kliknięcie zawiedzie użytkownika. */
const TAB_LABELS: Partial<Record<NavTabId, string>> = {
  profil: 'Profil',
  aplikuj: 'Aplikuj',
  trenuj: 'Trenuj',
  pipeline: 'Moje aplikacje',
};

export const NextActionCard: React.FC<NextActionCardProps> = ({
  action,
  onNavigate,
  className = '',
}) => {
  const Icon = ICONS[action.actionType];
  const isUrgent = URGENT.has(action.actionType);
  const { setHighlightedApplicationId } = useAppStore();

  const handleGo = () => {
    // Rekomendacja wskazuje konkretną aplikację — przekaż ją dalej, żeby
    // Pipeline podświetlił właściwy wiersz, a nie tylko otworzył zakładkę.
    if (action.deepLink.applicationId) {
      setHighlightedApplicationId(action.deepLink.applicationId);
    }
    onNavigate(action.deepLink.tab);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.19, 1, 0.22, 1] }}
      aria-labelledby="next-action-title"
      className={`rounded-2xl border p-5 sm:p-6 ${
        isUrgent ? 'border-warning/40 bg-warning-soft' : 'border-brand-200 bg-brand-50'
      } ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isUrgent ? 'bg-warning/20 text-warning-fg' : 'bg-brand-500/15 text-brand-fg'
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-brand-fg">
              {isUrgent ? 'Zrób to teraz' : 'Twój następny krok'}
            </p>

            <h2
              id="next-action-title"
              className="mt-1.5 text-xl font-black tracking-tight text-ink sm:text-2xl"
            >
              {action.title}
            </h2>

            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
              {action.description}
            </p>

            <p className="mt-2 font-mono text-[11px] text-subtle">
              Szacowany czas: {action.estimatedMinutes} min
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          icon={ArrowRight}
          iconPosition="right"
          onClick={handleGo}
          className="shrink-0"
        >
          {TAB_LABELS[action.deepLink.tab]
            ? `Przejdź do ${TAB_LABELS[action.deepLink.tab]}`
            : 'Przejdź'}
        </Button>
      </div>
    </motion.section>
  );
};
