import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  Building2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkExperience } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { Combobox } from '../../components/ui/Combobox';
import { MonthYearPicker } from '../../components/ui/MonthYearPicker';
import { validateDateRange } from '../../lib/dateUtils';
import type { SuggestFn } from '../../hooks/useFieldSuggestions';
import { AchievementEditor } from './AchievementEditor';
import { EmptyState } from '../../components/ui/EmptyState';
import { ExperienceWizardModal } from './ExperienceWizardModal';

export interface ExperienceSectionProps {
  history: WorkExperience[];
  onChange: (updated: WorkExperience[]) => void;
  userSkills?: string[];
  /**
   * Podpowiedzi do nazwy firmy i stanowiska. Opcjonalne — bez nich `Combobox`
   * dostaje pustą listę i zachowuje się jak zwykły `Input`.
   */
  suggest?: SuggestFn;
  className?: string;
}

export const ExperienceSection: React.FC<ExperienceSectionProps> = ({
  history,
  onChange,
  userSkills = [],
  suggest,
  className = '',
}) => {
  const [wizardExperience, setWizardExperience] = useState<WorkExperience | null>(null);

  const handleAddExperience = () => {
    const newExp: WorkExperience = {
      id: `exp-${Date.now()}`,
      company: '',
      role: '',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      description: '',
      highlights: [],
    };
    onChange([newExp, ...history]);
  };

  const handleUpdateExperience = (id: string, field: keyof WorkExperience, value: any) => {
    onChange(
      history.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveExperience = (id: string) => {
    onChange(history.filter((item) => item.id !== id));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= history.length) return;

    const updated = [...history];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChange(updated);
  };

  const handleApplyWizardDescription = (desc: string) => {
    if (!wizardExperience) return;
    handleUpdateExperience(wizardExperience.id, 'description', desc);
  };

  return (
    <Card tone="raised" className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-600" />
            Historia Zatrudnienia i Doświadczenie
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Dodaj swoje stanowiska. Im więcej szczegółów i faktów, tym precyzyjniej silnik dopasuje Twoje CV do ogłoszenia.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={handleAddExperience}
        >
          Dodaj Stanowisko
        </Button>
      </div>

      <div className="space-y-6">
        <AnimatePresence initial={false}>
          {history.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Brak dodanego doświadczenia"
              description="Dodaj swoje pierwsze stanowisko, aby silnik mógł wygenerować trafne podsumowanie i dopasować słowa kluczowe."
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={handleAddExperience}
                >
                  Dodaj pierwsze stanowisko
                </Button>
              }
            />
          ) : (
            history.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="relative space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-2xs"
              >
                {/* Header & Reorder Controls */}
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 font-mono text-label font-bold text-brand-fg">
                      {index + 1}
                    </span>
                    <span className="text-sm font-bold text-ink">
                      {item.role || 'Nowe Stanowisko'} {item.company ? `w ${item.company}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      aria-label="Przesuń wyżej"
                      className="cursor-pointer rounded-md p-1 text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === history.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      aria-label="Przesuń niżej"
                      className="cursor-pointer rounded-md p-1 text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26440]/50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleRemoveExperience(item.id)}
                      className="text-danger-fg hover:bg-danger-soft ml-2"
                      title="Usuń stanowisko"
                    >
                      Usuń
                    </Button>
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Combobox
                    label="Nazwa Firmy / Organizacji"
                    icon={Building2}
                    value={item.company}
                    onChange={(value) => handleUpdateExperience(item.id, 'company', value)}
                    suggestions={suggest?.('company', item.company) ?? []}
                    placeholder="np. Szpital Wojewódzki, Firma Sp. z o.o., Zakład Pracy..."
                    required
                  />

                  <Combobox
                    label="Nazwa Stanowiska"
                    icon={Briefcase}
                    value={item.role}
                    onChange={(value) => handleUpdateExperience(item.id, 'role', value)}
                    suggestions={suggest?.('jobTitle', item.role) ?? []}
                    placeholder="np. Monter / Programista / Inżynier..."
                    hint="Zacznij wpisywać, np. IT Support Specialist lub Spawacz"
                    required
                  />

                  <Combobox
                    label="Lokalizacja"
                    icon={MapPin}
                    value={item.location || ''}
                    onChange={(value) => handleUpdateExperience(item.id, 'location', value)}
                    suggestions={suggest?.('location', item.location || '') ?? []}
                    placeholder={
                      history[index + 1]?.location
                        ? `np. ${history[index + 1].location} (poprzednia)`
                        : 'np. Warszawa / Kraków'
                    }
                  />

                  {(() => {
                    const dateValidation = validateDateRange(
                      item.startDate,
                      item.endDate,
                      item.isCurrent
                    );
                    return (
                      <>
                        <MonthYearPicker
                          label="Data Rozpoczęcia"
                          value={item.startDate}
                          onChange={(val) => handleUpdateExperience(item.id, 'startDate', val || '')}
                          warning={dateValidation.warning}
                          hint="Wystarczy miesiąc i rok"
                        />

                        <MonthYearPicker
                          label="Data Zakończenia"
                          value={item.endDate}
                          onChange={(val) => handleUpdateExperience(item.id, 'endDate', val || '')}
                          allowCurrent
                          isCurrent={item.isCurrent}
                          onToggleCurrent={(checked) => {
                            handleUpdateExperience(item.id, 'isCurrent', checked);
                            if (checked) {
                              handleUpdateExperience(item.id, 'endDate', '');
                            }
                          }}
                          currentLabel="Nadal tu pracuję / Obecnie"
                          error={dateValidation.error}
                          disabled={item.isCurrent}
                        />
                      </>
                    );
                  })()}
                </div>

                {/* Description with Experience Wizard */}
                <div className="space-y-1.5 pt-2 border-t border-line/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-ink">
                      Ogólny Opis Roli i Zakres Odpowiedzialności
                    </label>
                    <button
                      type="button"
                      onClick={() => setWizardExperience(item)}
                      className="text-[11px] font-bold text-brand-fg hover:underline cursor-pointer flex items-center gap-1.5 bg-brand-500/10 hover:bg-brand-500/20 px-2.5 py-1 rounded-xl transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                      <span>Pomóż opisać to stanowisko (Mikro-wywiad)</span>
                    </button>
                  </div>

                  <Textarea
                    rows={2}
                    value={item.description || ''}
                    onChange={(e) => handleUpdateExperience(item.id, 'description', e.target.value)}
                    placeholder="Krótki zarys projektu, wielkość zespołu oraz zakres odpowiedzialności..."
                  />
                </div>

                {/* STAR Achievements Editor */}
                <div className="border-t border-line/60 pt-4">
                  <AchievementEditor
                    highlights={item.highlights || []}
                    roleTitle={item.role}
                    onChange={(hl) => handleUpdateExperience(item.id, 'highlights', hl)}
                  />
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Modal Mikro-Wywiadu Doświadczenia */}
      {wizardExperience && (
        <ExperienceWizardModal
          isOpen={Boolean(wizardExperience)}
          onClose={() => setWizardExperience(null)}
          roleTitle={wizardExperience.role}
          userSkills={userSkills}
          onApplyDescription={handleApplyWizardDescription}
        />
      )}
    </Card>
  );
};
