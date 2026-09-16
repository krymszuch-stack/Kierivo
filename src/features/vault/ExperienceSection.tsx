import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  Building2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  MapPin,
  Calendar,
  Layers,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkExperience } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { Combobox } from '../../components/ui/Combobox';
import { MonthYearPicker } from '../../components/ui/MonthYearPicker';
import { validateDateRange } from '../../lib/dateUtils';
import { auditExperienceTimelineAndMetrics } from '../../lib/consistencyGuard';
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

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const ExperienceSection: React.FC<ExperienceSectionProps> = ({
  history,
  onChange,
  userSkills = [],
  suggest,
  className = '',
}) => {
  const [wizardExperience, setWizardExperience] = useState<WorkExperience | null>(null);

  const audit = useMemo(() => auditExperienceTimelineAndMetrics(history), [history]);

  const handleAddExperience = () => {
    const newExp: WorkExperience = {
      id: generateId('exp'),
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

  const handleAddExperienceWithDates = (
    startDate: string,
    endDate: string,
    defaultCompany = 'Edukacja / Projekty / Kursy'
  ) => {
    const newExp: WorkExperience = {
      id: generateId('exp'),
      company: defaultCompany,
      role: 'Rozwój kompetencji / Projekty własne',
      location: 'Zdalnie',
      startDate,
      endDate,
      isCurrent: false,
      description: 'Samokształcenie, certyfikaty branżowe, realizacja projektów własnych lub okres sabbatical.',
      highlights: [
        {
          id: generateId('hl'),
          text: 'Ukończenie specjalistycznych kursów i realizacja 2 projektów praktycznych.',
          metric: '2 projekty',
          action: 'Edukacja',
          target: 'Kompetencje',
          tool: 'Kursy',
          keywords: ['Edukacja', 'Certyfikaty'],
        },
      ],
    };
    onChange([newExp, ...history]);
  };

  const handleAddXyzTemplate = (expId: string) => {
    const exp = history.find((e) => e.id === expId);
    if (!exp) return;
    const newHighlight = {
      id: generateId('hl'),
      text: 'Osiągnąłem [wzrost/rezultat, np. +25%], mierzone przez [konkretny wskaźnik], wdrażając [rozwiązanie/narzędzie].',
      metric: '',
      action: 'Osiągnięcie',
      target: '',
      tool: '',
      keywords: [],
    };
    handleUpdateExperience(expId, 'highlights', [...(exp.highlights || []), newHighlight]);
  };

  const handleMarkAsRemote = (expId: string) => {
    const exp = history.find((e) => e.id === expId);
    if (!exp) return;
    const currentLoc = (exp.location || '').trim();
    const newLoc = currentLoc ? `${currentLoc} (Zdalnie)` : 'Zdalnie';
    handleUpdateExperience(expId, 'location', newLoc);
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

      {/* Asystent Spójności i Chronologii (Wykrywanie luk, kolizji i metryk X-Y-Z) */}
      {history.length > 0 && (
        <>
          {!audit.isHealthy ? (
            <div className="rounded-2xl border border-line bg-elevated/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-start sm:items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-ink flex items-center gap-2">
                    <span>Asystent Spójności i Chronologii</span>
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-fg">
                      {audit.alerts.length} {audit.alerts.length === 1 ? 'uwaga' : audit.alerts.length < 5 ? 'uwagi' : 'uwag'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">
                    {audit.careerGaps.length > 0 && `${audit.careerGaps.length} luka w zatrudnieniu (> 6 mies.) • `}
                    {audit.locationConflicts.length > 0 && `${audit.locationConflicts.length} kolizja miast • `}
                    {audit.overlappingExperiences.length > 0 && `${audit.overlappingExperiences.length} nakładające się etaty • `}
                    {audit.missingMetrics.length > 0 && `${audit.missingMetrics.length} stanowisk bez twardych metryk X-Y-Z`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
                {audit.locationConflicts.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger-fg border border-danger/30">
                    <MapPin className="h-3 w-3" /> Kolizja miast
                  </span>
                )}
                {audit.careerGaps.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning-fg border border-warning/30">
                    <Calendar className="h-3 w-3" /> Luka &gt; 6 mies.
                  </span>
                )}
                {audit.missingMetrics.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-fg border border-brand-200">
                    <Sparkles className="h-3 w-3" /> Formuła X-Y-Z
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-success/30 bg-success-soft/30 px-3.5 py-2.5 flex items-center justify-between text-xs text-success-fg">
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-success-fg" />
                Chronologia, lokalizacje i mierzalne metryki w historii są w 100% spójne.
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-success-soft px-2 py-0.5 rounded-full border border-success/30">
                Spójność OK
              </span>
            </div>
          )}
        </>
      )}

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
            history.map((item, index) => {
              const locConflict = audit.locationConflicts.find(
                (a) => a.details?.experienceId === item.id || a.details?.sourceProject === item.company
              );
              const overlap = audit.overlappingExperiences.find(
                (a) => a.details?.experienceId === item.id || a.details?.sourceProject === item.company
              );
              const missingMetric = audit.missingMetrics.find(
                (a) => a.details?.experienceId === item.id
              );
              const followingGap = audit.careerGaps.find(
                (g) => g.details?.previousCompany === item.company || g.id.includes(item.id)
              );

              return (
                <React.Fragment key={item.id}>
                  <motion.div
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
                          className="cursor-pointer rounded-md p-1 text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === history.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          aria-label="Przesuń niżej"
                          className="cursor-pointer rounded-md p-1 text-muted transition-colors duration-[var(--duration-fast)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 disabled:cursor-not-allowed disabled:opacity-30"
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

                    {/* Contextual Warning: Kolizja lokalizacji lub równoległe etaty */}
                    {locConflict && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger-soft/60 p-3 text-xs animate-fadeIn">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-danger-fg shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-danger-fg">Kolizja lokalizacji w nakładających się terminach</span>
                            <p className="text-[11px] text-ink/90 mt-0.5">{locConflict.message}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsRemote(item.id)}
                          className="shrink-0 text-[11px] border-danger/30 text-danger-fg hover:bg-danger/10 self-end sm:self-auto"
                        >
                          Oznacz jako praca zdalna
                        </Button>
                      </div>
                    )}

                    {!locConflict && overlap && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft/60 p-3 text-xs animate-fadeIn">
                        <div className="flex items-start gap-2">
                          <Layers className="h-4 w-4 text-warning-fg shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-warning-fg">Nakładające się okresy zatrudnienia</span>
                            <p className="text-[11px] text-ink/90 mt-0.5">{overlap.message}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsRemote(item.id)}
                          className="shrink-0 text-[11px] self-end sm:self-auto"
                        >
                          Dopisz (Zdalnie / B2B)
                        </Button>
                      </div>
                    )}

                    {/* Contextual Suggestion: Brakujące metryki Google X-Y-Z */}
                    {missingMetric && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3 text-xs animate-fadeIn">
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-brand-fg">Formuła Google X-Y-Z: brak twardych rezultatów</span>
                            <p className="text-[11px] text-muted mt-0.5">
                              Opisy bez liczb i procentów są oceniane przez ATS nawet o 50% niżej. Dodaj mierzalny wskaźnik do osiągnięć.
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={Plus}
                          onClick={() => handleAddXyzTemplate(item.id)}
                          className="shrink-0 text-[11px] self-end sm:self-auto"
                        >
                          Wstaw szablon X-Y-Z
                        </Button>
                      </div>
                    )}

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

              {/* Łącznik osi czasu: Luka w zatrudnieniu pomiędzy stanowiskami */}
              {followingGap && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="my-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning-soft/30 p-4 shadow-2xs"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning-fg">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-ink flex items-center gap-2">
                        <span>Luka w zatrudnieniu (~{followingGap.details?.gapMonths} mies.)</span>
                        <span className="text-muted font-normal text-xs">
                          {followingGap.details?.gapStart} – {followingGap.details?.gapEnd}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        Przerwy powyżej 6 miesięcy budzą pytania rekruterów. Wypełnij ten okres wpisem o kursach, freelance lub urlopie.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    onClick={() =>
                      handleAddExperienceWithDates(
                        followingGap.details?.gapStart || '',
                        followingGap.details?.gapEnd || ''
                      )
                    }
                    className="shrink-0 text-xs self-end sm:self-auto"
                  >
                    Wypełnij tę przerwę
                  </Button>
                </motion.div>
              )}
            </React.Fragment>
          );
        })
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
