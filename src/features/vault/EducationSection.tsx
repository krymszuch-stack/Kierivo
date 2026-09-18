import React, { useState, useRef, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  Trash2,
  BookOpen,
  Award,
  CheckCircle2,
  Edit3,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Education } from '../../types';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { Combobox } from '../../components/ui/Combobox';
import { MonthYearPicker } from '../../components/ui/MonthYearPicker';
import { validateDateRange } from '../../lib/dateUtils';
import type { SuggestFn } from '../../hooks/useFieldSuggestions';
import { Modal } from '../../components/ui/Modal';

const generateEducationId = () => `edu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export interface EducationSectionProps {
  education: Education[];
  onChange: (updated: Education[]) => void;
  suggest?: SuggestFn;
  isRequired?: boolean;
  className?: string;
}

export const EducationSection: React.FC<EducationSectionProps> = ({
  education,
  onChange,
  suggest,
  isRequired = false,
  className = '',
}) => {
  // Identyfikator aktualnie edytowanej pozycji (tylko 1 rozwinięta naraz)
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal potwierdzenia usunięcia pozycji z danymi
  const [itemToDelete, setItemToDelete] = useState<Education | null>(null);

  // Status autosave
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pola dotknięte (do walidacji onBlur)
  const [touched, setTouched] = useState<Record<string, Record<string, boolean>>>({});

  // Referencja do nowo dodanej karty w celu przewinięcia
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const markSaving = () => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saved');
    }, 450);
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleAddEducation = () => {
    const newId = generateEducationId();
    const newEntry: Education = {
      id: newId,
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      description: '',
    };
    markSaving();
    onChange([...education, newEntry]);
    setEditingId(newId);

    // Przewinięcie do nowo dodanej karty
    setTimeout(() => {
      const el = cardRefs.current[newId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleUpdateEducation = (id: string, field: keyof Education, value: string) => {
    markSaving();
    onChange(
      education.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleBlurField = (id: string, field: string) => {
    setTouched((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: true,
      },
    }));
  };

  const onRequestRemove = (item: Education) => {
    const hasAnyData = Boolean(
      item.institution.trim() ||
        item.fieldOfStudy.trim() ||
        item.degree.trim() ||
        item.startDate.trim() ||
        item.endDate.trim() ||
        item.description?.trim()
    );

    if (!hasAnyData) {
      // Pusty wpis usuwamy natychmiast bez modala
      executeRemove(item.id);
    } else {
      // Zapisany wpis wymaga potwierdzenia
      setItemToDelete(item);
    }
  };

  const executeRemove = (id: string) => {
    markSaving();
    onChange(education.filter((item) => item.id !== id));
    if (editingId === id) setEditingId(null);
    setItemToDelete(null);
  };

  // Walidacja konkretnej pozycji
  const getFieldErrors = (item: Education) => {
    const errors: { institution?: string; fieldOfStudy?: string; endDate?: string } = {};

    if (!item.institution.trim()) {
      errors.institution = 'Wpisz nazwę szkoły lub uczelni.';
    }

    if (!item.fieldOfStudy.trim()) {
      errors.fieldOfStudy = 'Wpisz kierunek studiów.';
    }

    const isCurrent = item.endDate === 'Obecnie';
    if (!isCurrent && item.startDate && item.endDate) {
      const dateValidation = validateDateRange(item.startDate, item.endDate, false);
      if (dateValidation.error) {
        errors.endDate = 'Data ukończenia nie może być wcześniejsza niż data rozpoczęcia.';
      }
    }

    return errors;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Nagłówek sekcji z opisem, statusem zapisu i przyciskiem akcji */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-base font-bold text-ink">Edukacja i wykształcenie</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isRequired
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                  : 'bg-sunken text-muted'
              }`}
            >
              {isRequired ? 'Wymagana' : 'Opcjonalna'}
            </span>

            {/* Status Autosave */}
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
              {saveStatus === 'saving' ? (
                <span className="text-brand-600 animate-pulse">Zapisywanie…</span>
              ) : (
                <span className="flex items-center gap-1 text-success-fg">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Zapisano przed chwilą
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-muted mt-1">
            {isRequired
              ? 'Dodaj co najmniej jedną szkołę lub uczelnię, aby przejść dalej.'
              : 'Dodaj szkoły, uczelnie i kierunki, które chcesz pokazać w CV. Ta sekcja jest opcjonalna — możesz przejść dalej bez jej uzupełniania.'}
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={handleAddEducation}
          className="shrink-0 self-start sm:self-auto cursor-pointer"
        >
          + Dodaj szkołę / uczelnię
        </Button>
      </div>

      {/* Lista edukacji */}
      <div className="space-y-3">
        {education.length === 0 ? (
          /* Spokojny stan pusty (Empty State) */
          <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 sm:p-8 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/40">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-ink">Nie dodano jeszcze edukacji</h4>
              <p className="text-xs text-muted max-w-md mx-auto">
                Dodaj szkołę lub uczelnię, aby pokazać ją w CV.
              </p>
            </div>
            <div className="pt-2 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={handleAddEducation}
                className="cursor-pointer"
              >
                + Dodaj szkołę / uczelnię
              </Button>
              {!isRequired && (
                <span className="text-[11px] text-subtle">
                  Możesz też pominąć ten krok.
                </span>
              )}
            </div>
          </div>
        ) : (
          education.map((item) => {
            const isEditing = editingId === item.id;
            const isCurrent = item.endDate === 'Obecnie';
            const errors = getFieldErrors(item);
            const itemTouched = touched[item.id] || {};

            // Nagłówek i podtytuł karty podsumowującej
            const displayTitle = item.degree?.trim()
              ? item.degree
              : item.fieldOfStudy?.trim()
              ? item.fieldOfStudy
              : item.institution?.trim()
              ? item.institution
              : 'Nowa edukacja';

            const displaySubtitle = item.degree?.trim()
              ? [item.fieldOfStudy, item.institution].filter(Boolean).join(' • ')
              : item.institution?.trim() || 'Uzupełnij wymagane pola';

            const dateSummary = isCurrent
              ? `${item.startDate || ''} – nadal trwa`.trim()
              : item.startDate || item.endDate
              ? `${item.startDate || ''} – ${item.endDate || ''}`.trim()
              : '';

            const isComplete = Boolean(item.institution.trim() && item.fieldOfStudy.trim());

            return (
              <div
                key={item.id}
                ref={(el) => {
                  cardRefs.current[item.id] = el;
                }}
                className="rounded-2xl border border-line bg-surface overflow-hidden shadow-2xs transition-all duration-200"
              >
                {/* Kompaktowa karta podsumowania (widok zwinięty) */}
                {!isEditing ? (
                  <div className="flex items-center justify-between gap-3 p-4 hover:bg-elevated/40 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 mt-0.5">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-ink truncate block">
                            {displayTitle}
                          </span>
                          {!isComplete && (
                            <span className="rounded-md bg-warning-soft px-1.5 py-0.2 text-[9px] font-semibold text-warning-fg">
                              Do uzupełnienia
                            </span>
                          )}
                        </div>
                        <span className="block text-[11px] text-muted truncate">
                          {displaySubtitle}
                        </span>
                        {dateSummary && (
                          <span className="font-mono text-[10px] text-subtle block">
                            {dateSummary}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Edit3}
                        onClick={() => setEditingId(item.id)}
                        className="h-8 px-2.5 text-xs cursor-pointer"
                        title="Edytuj szczegóły edukacji"
                      >
                        Edytuj
                      </Button>
                      <button
                        type="button"
                        onClick={() => onRequestRemove(item)}
                        className="p-2 text-muted hover:text-danger-fg transition-colors rounded-lg cursor-pointer"
                        title="Usuń wpis edukacji"
                        aria-label={`Usuń ${displayTitle}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Formularz edycji (widok rozwinięty) */
                  <div className="p-4 sm:p-5 space-y-4 border-l-4 border-l-brand-600">
                    <div className="flex items-center justify-between border-b border-line/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">
                          {item.institution.trim() ? item.institution : 'Nowa edukacja'}
                        </span>
                        <span className="font-mono text-[10px] text-brand-fg bg-brand-50 px-1.5 py-0.5 rounded">
                          Edycja
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          className="h-7 text-xs text-muted hover:text-ink cursor-pointer"
                        >
                          Zwiń
                        </Button>
                        <button
                          type="button"
                          onClick={() => onRequestRemove(item)}
                          className="p-1.5 text-muted hover:text-danger-fg transition-colors rounded-lg cursor-pointer"
                          title="Usuń wpis"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Szkoła / uczelnia * */}
                      <div>
                        <Combobox
                          label="Szkoła / uczelnia *"
                          icon={GraduationCap}
                          value={item.institution}
                          onChange={(value) => handleUpdateEducation(item.id, 'institution', value)}
                          onBlur={() => handleBlurField(item.id, 'institution')}
                          suggestions={suggest?.('institution', item.institution) ?? []}
                          placeholder="np. Politechnika Warszawska / Zespół Szkół"
                          required
                        />
                        {itemTouched.institution && errors.institution && (
                          <p className="mt-1 text-[11px] text-danger-fg font-medium flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {errors.institution}
                          </p>
                        )}
                      </div>

                      {/* Kierunek studiów * */}
                      <div>
                        <Combobox
                          label="Kierunek studiów *"
                          icon={BookOpen}
                          value={item.fieldOfStudy}
                          onChange={(value) => handleUpdateEducation(item.id, 'fieldOfStudy', value)}
                          onBlur={() => handleBlurField(item.id, 'fieldOfStudy')}
                          suggestions={suggest?.('fieldOfStudy', item.fieldOfStudy) ?? []}
                          placeholder="np. Informatyka Stosowana / Elektrotechnika"
                          required
                        />
                        {itemTouched.fieldOfStudy && errors.fieldOfStudy && (
                          <p className="mt-1 text-[11px] text-danger-fg font-medium flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {errors.fieldOfStudy}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {/* Uzyskany tytuł / stopień (opcjonalny) */}
                      <div>
                        <Combobox
                          label="Uzyskany tytuł / stopień (opcjonalnie)"
                          icon={Award}
                          value={item.degree}
                          onChange={(value) => handleUpdateEducation(item.id, 'degree', value)}
                          suggestions={suggest?.('degree', item.degree) ?? []}
                          placeholder="np. Inżynier / Magister / Technik"
                        />
                      </div>

                      {/* Data rozpoczęcia */}
                      <div>
                        <MonthYearPicker
                          label="Data rozpoczęcia (opcjonalnie)"
                          value={item.startDate}
                          onChange={(val) => handleUpdateEducation(item.id, 'startDate', val || '')}
                          hint="Miesiąc i rok"
                        />
                      </div>

                      {/* Data ukończenia + przełącznik nadal trwa */}
                      <div>
                        <MonthYearPicker
                          label="Data ukończenia (opcjonalnie)"
                          value={isCurrent ? null : item.endDate}
                          onChange={(val) => handleUpdateEducation(item.id, 'endDate', val || '')}
                          disabled={isCurrent}
                          hint={isCurrent ? 'Nauka nadal trwa' : 'Miesiąc i rok'}
                        />
                        {itemTouched.endDate && errors.endDate && (
                          <p className="mt-1 text-[11px] text-danger-fg font-medium flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {errors.endDate}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Pełnoprawny przełącznik: Nauka nadal trwa */}
                    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-sunken/40 px-3.5 py-2.5">
                      <input
                        type="checkbox"
                        id={`current-study-${item.id}`}
                        checked={isCurrent}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          handleUpdateEducation(item.id, 'endDate', checked ? 'Obecnie' : '');
                        }}
                        className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                      <label
                        htmlFor={`current-study-${item.id}`}
                        className="text-xs font-semibold text-ink cursor-pointer select-none"
                      >
                        Nauka nadal trwa (aktualnie w trakcie studiów / szkoły)
                      </label>
                    </div>

                    {/* Specjalizacja / osiągnięcia akademickie */}
                    <Textarea
                      label="Specjalizacja / osiągnięcia akademickie (opcjonalnie)"
                      rows={2}
                      value={item.description || ''}
                      onChange={(e) => handleUpdateEducation(item.id, 'description', e.target.value)}
                      placeholder="np. Praca dyplomowa z zakresu sieci komputerowych, stypendium naukowe..."
                    />

                    {/* Pomoc pod formularzem */}
                    <div className="flex items-center justify-between pt-1 border-t border-line/40">
                      <p className="text-[11px] text-subtle flex items-center gap-1">
                        <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted" />
                        Wymagane są tylko szkoła / uczelnia oraz kierunek. Tytuł, specjalizacja i osiągnięcia akademickie są opcjonalne.
                      </p>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingId(null)}
                        className="cursor-pointer"
                      >
                        Gotowe
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal potwierdzenia usunięcia */}
      {itemToDelete && (
        <Modal
          isOpen={Boolean(itemToDelete)}
          onClose={() => setItemToDelete(null)}
          title="Usunąć tę edukację?"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Czy na pewno chcesz usunąć wpis{' '}
              <strong className="text-ink">
                {itemToDelete.fieldOfStudy || itemToDelete.institution || 'tę pozycję'}
              </strong>
              ? Dane zostaną trwale usunięte z profilu i podglądu CV.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItemToDelete(null)}
              >
                Anuluj
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => executeRemove(itemToDelete.id)}
                className="bg-danger-600 hover:bg-danger-700 text-white"
              >
                Usuń
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
