import React, { useState, useMemo, useEffect } from 'react';
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
  Edit3,
  Info,
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
  /**
   * Błędy walidacji per stanowisko przekazywane z nadrzędnego formularza (np. przy kliknięciu Dalej).
   */
  errors?: Record<string, { company?: string; role?: string }>;
  onClearError?: (id: string, field: 'company' | 'role') => void;
}

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const ExperienceSection: React.FC<ExperienceSectionProps> = ({
  history,
  onChange,
  userSkills = [],
  suggest,
  className = '',
  errors = {},
  onClearError,
}) => {
  const [wizardExperience, setWizardExperience] = useState<WorkExperience | null>(null);

  // Zbiór ID stanowisk rozwiniętych do pełnej edycji
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // Zbiór ID stanowisk z rozwiniętym edytorem STAR
  const [starExpandedIds, setStarExpandedIds] = useState<Set<string>>(() => {
    // Domyślnie rozwijamy STAR tylko dla tych pozycji, które mają już osiągnięcia
    const initial = new Set<string>();
    history.forEach((exp) => {
      if (exp.highlights && exp.highlights.length > 0) {
        initial.add(exp.id);
      }
    });
    return initial;
  });

  // Automatycznie rozwiń kartę, jeśli pojawił się w niej błąd walidacji
  useEffect(() => {
    const errorIds = Object.keys(errors);
    if (errorIds.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        errorIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [errors]);

  const audit = useMemo(() => auditExperienceTimelineAndMetrics(history), [history]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleStarExpand = (id: string) => {
    setStarExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddExperience = () => {
    const newId = generateId('exp');
    const newExp: WorkExperience = {
      id: newId,
      company: '',
      role: '',
      location: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      description: '',
      highlights: [],
    };
    // Nowe stanowisko jest od razu rozwinięte do wpisania danych
    setExpandedIds((prev) => new Set(prev).add(newId));
    onChange([newExp, ...history]);
  };

  const handleUpdateExperience = <K extends keyof WorkExperience>(id: string, field: K, value: WorkExperience[K]) => {
    if (field === 'company' || field === 'role') {
      onClearError?.(id, field);
    }
    onChange(
      history.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveExperience = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setStarExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
    const newId = generateId('exp');
    const newExp: WorkExperience = {
      id: newId,
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
    setExpandedIds((prev) => new Set(prev).add(newId));
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
    // Upewnij się, że sekcja STAR jest rozwinięta
    setStarExpandedIds((prev) => new Set(prev).add(expId));
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
      {/* 1. Jasny komunikat startowy: Minimum na teraz */}
      <div className="rounded-2xl border border-brand-200/70 bg-brand-50/60 dark:border-brand-800/50 dark:bg-brand-950/30 p-4 flex items-start gap-3">
        <div className="rounded-xl bg-brand-100 dark:bg-brand-900/60 p-2 text-brand-fg shrink-0 mt-0.5">
          <Info className="h-4 w-4" />
        </div>
        <div className="text-xs">
          <span className="font-bold text-ink">
            Minimum na teraz: nazwa firmy i stanowisko.
          </span>
          <p className="text-muted mt-0.5 leading-relaxed">
            Opis, daty i osiągnięcia możesz uzupełnić później. Wystarczy wpisać firmę i stanowisko, aby przejść do kolejnego kroku.
          </p>
        </div>
      </div>

      {/* Nagłówek sekcji i przycisk dodawania */}
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-600" />
            Historia Zatrudnienia i Doświadczenie
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Wpisz swoje stanowiska pracy. Domyślnie karty są zwinięte — kliknij „Edytuj szczegóły”, aby uzupełnić daty i opis.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={handleAddExperience}
          aria-label="Dodaj Stanowisko"
        >
          Dodaj Stanowisko
        </Button>
      </div>

      {/* Asystent Spójności i Chronologii */}
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

      {/* Lista doświadczeń */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {history.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Brak dodanego doświadczenia"
              description="Dodaj swoje pierwsze stanowisko. Wystarczy nazwa firmy i stanowisko, aby przejść do kolejnego kroku."
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={handleAddExperience}
                  aria-label="Dodaj pierwsze stanowisko"
                >
                  Dodaj pierwsze stanowisko
                </Button>
              }
            />
          ) : (
            history.map((item, index) => {
              const isExpanded = expandedIds.has(item.id);
              const isStarExpanded = starExpandedIds.has(item.id);
              const itemErrors = errors[item.id] || {};

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

              // Podsumowanie okresu dla karty zwiniętej
              const dateSummary = item.startDate
                ? `${item.startDate} – ${item.isCurrent ? 'Obecnie' : item.endDate || '...'}`
                : 'Daty do uzupełnienia';

              return (
                <React.Fragment key={item.id}>
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`relative space-y-4 rounded-2xl border transition-all ${
                      itemErrors.company || itemErrors.role
                        ? 'border-danger/60 bg-danger-soft/10 ring-2 ring-danger/20 p-5'
                        : 'border-line bg-surface p-5 shadow-2xs'
                    }`}
                  >
                    {/* Header & Controls */}
                    <div className="flex items-center justify-between border-b border-line pb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 font-mono text-label font-bold text-brand-fg shrink-0">
                          {index + 1}
                        </span>
                        <div className="truncate">
                          <span className="text-sm font-bold text-ink truncate block">
                            {item.role || 'Nowe Stanowisko'} {item.company ? `w ${item.company}` : ''}
                          </span>
                          {!isExpanded && (
                            <span className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                              <span>{dateSummary}</span>
                              {item.location && <span>• {item.location}</span>}
                              {item.highlights && item.highlights.length > 0 && (
                                <span className="font-semibold text-brand-fg">
                                  • {item.highlights.length} osiągnięć STAR
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Przycisk rozwijania/zwijania szczegółów */}
                        <Button
                          type="button"
                          variant={isExpanded ? 'secondary' : 'outline'}
                          size="sm"
                          icon={isExpanded ? ChevronUp : Edit3}
                          onClick={() => toggleExpand(item.id)}
                          className="text-xs h-8"
                          aria-label={isExpanded ? `Zwiń szczegóły ${item.role || 'stanowiska'}` : `Edytuj szczegóły ${item.role || 'stanowiska'}`}
                        >
                          {isExpanded ? 'Zwiń szczegóły' : 'Edytuj szczegóły'}
                        </Button>

                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                          aria-label="Przesuń wyżej"
                          className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 ml-1"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === history.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          aria-label="Przesuń niżej"
                          className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleRemoveExperience(item.id)}
                          className="text-danger-fg hover:bg-danger-soft ml-1"
                          title="Usuń stanowisko"
                          aria-label={`Usuń stanowisko ${item.role || ''}`}
                        >
                          Usuń
                        </Button>
                      </div>
                    </div>

                    {/* KOMPAKTOWY WIDOK: Gdy zwinięte, nie renderujemy całego formularza */}
                    {!isExpanded ? (
                      <div className="flex items-center justify-between pt-1 text-xs text-muted">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-sunken/60 px-2.5 py-1 text-[11px] font-medium text-ink">
                            {item.company || 'Brak nazwy firmy'}
                          </span>
                          <span className="rounded-lg bg-sunken/60 px-2.5 py-1 text-[11px] font-medium text-ink">
                            {item.role || 'Brak nazwy stanowiska'}
                          </span>
                          {item.location && (
                            <span className="rounded-lg bg-sunken/60 px-2.5 py-1 text-[11px] text-muted">
                              {item.location}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          className="text-brand-fg font-semibold hover:underline text-[11px] cursor-pointer"
                        >
                          Uzupełnij daty i opis →
                        </button>
                      </div>
                    ) : (
                      /* ROZWINIĘTY WIDOK SZCZEGÓŁÓW */
                      <div className="space-y-4 pt-1">
                        {/* Ostrzeżenia audytu */}
                        {locConflict && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger-soft/60 p-3 text-xs">
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
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft/60 p-3 text-xs">
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

                        {missingMetric && (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3 text-xs">
                            <div className="flex items-start gap-2">
                              <Sparkles className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-brand-fg">Formuła Google X-Y-Z: brak twardych rezultatów</span>
                                <p className="text-[11px] text-muted mt-0.5">
                                  Opisy z liczbami i procentami zwiększają dopasowanie CV. Możesz wstawić szablon teraz lub później.
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

                        {/* Pola formularza: z jasnym oznaczeniem wymagane vs opcjonalne */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Combobox
                              label="Nazwa Firmy / Organizacji * (wymagane)"
                              icon={Building2}
                              value={item.company}
                              onChange={(value) => handleUpdateExperience(item.id, 'company', value)}
                              suggestions={suggest?.('company', item.company) ?? []}
                              placeholder="np. Szpital Wojewódzki, Mostostal S.A., Zakład Pracy..."
                              required
                            />
                            {itemErrors.company && (
                              <p className="text-[11px] font-semibold text-danger-fg mt-1">
                                {itemErrors.company}
                              </p>
                            )}
                          </div>

                          <div>
                            <Combobox
                              label="Nazwa Stanowiska * (wymagane)"
                              icon={Briefcase}
                              value={item.role}
                              onChange={(value) => handleUpdateExperience(item.id, 'role', value)}
                              suggestions={suggest?.('jobTitle', item.role) ?? []}
                              placeholder="np. Monter / Inżynier / Spawacz..."
                              hint="Zacznij wpisywać nazwę zawodu lub stanowiska"
                              required
                            />
                            {itemErrors.role && (
                              <p className="text-[11px] font-semibold text-danger-fg mt-1">
                                {itemErrors.role}
                              </p>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <Combobox
                              label="Lokalizacja (opcjonalne)"
                              icon={MapPin}
                              value={item.location || ''}
                              onChange={(value) => handleUpdateExperience(item.id, 'location', value)}
                              suggestions={suggest?.('location', item.location || '') ?? []}
                              placeholder="np. Warszawa / Katowice / Zdalnie"
                            />
                          </div>

                          {(() => {
                            const dateValidation = validateDateRange(
                              item.startDate,
                              item.endDate,
                              item.isCurrent
                            );
                            return (
                              <>
                                <MonthYearPicker
                                  label="Data Rozpoczęcia (opcjonalne)"
                                  value={item.startDate}
                                  onChange={(val) => handleUpdateExperience(item.id, 'startDate', val || '')}
                                  warning={dateValidation.warning}
                                  hint="Wystarczy miesiąc i rok (możesz dodać później)"
                                />

                                <MonthYearPicker
                                  label="Data Zakończenia (opcjonalne)"
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

                        {/* Ogólny opis roli (opcjonalne) */}
                        <div className="space-y-1.5 pt-2 border-t border-line/50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="text-xs font-bold text-ink">
                              Ogólny Opis Roli i Zakres Odpowiedzialności (opcjonalne)
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
                            placeholder="Krótki zarys projektu, wielkość zespołu lub zakres obowiązków (możesz uzupełnić później)..."
                          />
                        </div>

                        {/* STAR Achievements: Progressive Disclosure */}
                        <div className="border-t border-line/60 pt-3">
                          {!isStarExpanded && (!item.highlights || item.highlights.length === 0) ? (
                            <div className="rounded-xl border border-line/80 bg-sunken/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-brand-fg shrink-0" />
                                <div className="text-xs">
                                  <span className="font-semibold text-ink">Osiągnięcia i rezultaty STAR</span>
                                  <span className="text-muted ml-1.5 text-[11px]">(opcjonalne)</span>
                                  <p className="text-[11px] text-muted mt-0.5">
                                    Chcesz wyróżnić mierzalny sukces lub liczbę z tej pracy?
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                icon={Plus}
                                onClick={() => toggleStarExpand(item.id)}
                                className="text-xs h-7 self-end sm:self-auto shrink-0"
                                aria-label="Rozwiń edytor osiągnięć STAR"
                              >
                                Dodaj osiągnięcie STAR
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                                  Osiągnięcia i rezultaty STAR (opcjonalne)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleStarExpand(item.id)}
                                  className="text-[11px] text-muted hover:text-ink cursor-pointer"
                                >
                                  {isStarExpanded ? 'Zwiń sekcję STAR' : 'Rozwiń sekcję STAR'}
                                </button>
                              </div>

                              {isStarExpanded && (
                                <AchievementEditor
                                  highlights={item.highlights || []}
                                  roleTitle={item.role}
                                  onChange={(hl) => handleUpdateExperience(item.id, 'highlights', hl)}
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Przycisk zwiń szczegóły na dole otwartej karty */}
                        <div className="flex justify-end pt-2 border-t border-line/40">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(item.id)}
                            className="text-xs text-muted hover:text-ink"
                          >
                            Zwiń szczegóły stanowiska
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Łącznik osi czasu: Luka w zatrudnieniu */}
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
                            Przerwy powyżej 6 miesięcy budzą pytania rekruterów. Możesz uzupełnić ten okres teraz lub później.
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
