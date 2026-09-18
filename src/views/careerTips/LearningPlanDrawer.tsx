import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Trash2,
  Edit3,
  Calendar,
  Save,
  CheckSquare,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
  LearningPlan,
  LearningPlanItem,
} from '../../data/careerKnowledge';

export interface LearningPlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan: LearningPlan;
  onToggleStep: (stepId: string) => void;
  onUpdateStatus: (materialId: string, status: LearningPlanItem['status']) => void;
  onUpdateNotes: (materialId: string, notes: string, reminderDate?: string) => void;
  onRemoveItem: (materialId: string) => void;
  onOpenMaterial: (materialId: string) => void;
}

export const LearningPlanDrawer: React.FC<LearningPlanDrawerProps> = ({
  isOpen,
  onClose,
  plan,
  onToggleStep,
  onUpdateStatus,
  onUpdateNotes,
  onRemoveItem,
  onOpenMaterial,
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [tempReminder, setTempReminder] = useState('');

  const completedStepsCount = plan.steps.filter((s) => s.completed).length;

  const startEdit = (item: LearningPlanItem) => {
    setEditingItemId(item.materialId);
    setTempNotes(item.notes || '');
    setTempReminder(item.reminderDate || '');
  };

  const saveEdit = (materialId: string) => {
    onUpdateNotes(materialId, tempNotes, tempReminder);
    setEditingItemId(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mój plan nauki & Następny krok"
      description="Spokojny, uporządkowany plan działania. Nie musisz robić wszystkiego naraz — skup się na jednym kroku w tym tygodniu."
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-muted">
            Postęp checklisty: <strong className="text-ink">{completedStepsCount} / {plan.steps.length}</strong>
          </div>
          <Button variant="primary" size="md" onClick={onClose}>
            Gotowe
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* SEKCJA: MÓJ NASTĘPNY KROK (8 kroków) */}
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-brand-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-600">
                Mój następny krok — plan działania
              </h3>
            </div>
            <span className="text-[11px] text-muted font-mono font-semibold">
              {Math.round((completedStepsCount / plan.steps.length) * 100)}%
            </span>
          </div>

          <div className="space-y-2">
            {plan.steps.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => onToggleStep(step.id)}
                className={`flex items-start gap-2.5 w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  step.completed
                    ? 'border-line/40 bg-surface/60 text-muted line-through'
                    : 'border-line bg-surface text-ink hover:border-brand-300'
                }`}
              >
                {step.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-success-fg shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                )}
                <span className="text-xs font-medium leading-tight">{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SEKCJA: ZAPISANE MATERIAŁY I KWALIFIKACJE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-600" />
              Zapisane materiały i ścieżki ({plan.items.length})
            </h3>
          </div>

          {plan.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-6 text-center text-xs text-muted">
              Nie masz jeszcze zapisanych materiałów w planie.
              <br />
              Kliknij przycisk <strong className="text-ink">„Dodaj do mojego planu”</strong> przy dowolnym poradniku lub ścieżce zawodowej.
            </div>
          ) : (
            <div className="space-y-3">
              {plan.items.map((item) => {
                const isEditing = editingItemId === item.materialId;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-line bg-surface p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <button
                          type="button"
                          onClick={() => onOpenMaterial(item.materialId)}
                          className="text-xs sm:text-sm font-bold text-ink hover:text-brand-600 text-left cursor-pointer"
                        >
                          {item.materialTitle}
                        </button>
                        {item.nextTask && (
                          <div className="text-[11px] text-muted mt-1 flex items-start gap-1.5">
                            <strong className="text-brand-600 font-semibold">Następne zadanie:</strong>
                            <span>{item.nextTask}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.materialId)}
                        className="text-muted hover:text-danger-fg p-1 rounded transition-colors cursor-pointer"
                        title="Usuń z planu"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Status i data przypomnienia */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted text-[11px]">Status:</span>
                        <select
                          value={item.status}
                          onChange={(e) =>
                            onUpdateStatus(item.materialId, e.target.value as LearningPlanItem['status'])
                          }
                          className="text-xs rounded-lg border border-line bg-sunken px-2 py-1 text-ink focus:outline-none focus:border-brand-500 cursor-pointer"
                        >
                          <option value="not_started">Nie rozpoczęto</option>
                          <option value="in_progress">W trakcie</option>
                          <option value="completed">Gotowe</option>
                        </select>
                      </div>

                      {item.reminderDate && (
                        <div className="flex items-center gap-1 text-[11px] text-muted font-mono">
                          <Calendar className="w-3.5 h-3.5 text-brand-600" />
                          <span>Przypomnienie: {item.reminderDate}</span>
                        </div>
                      )}

                      {!isEditing && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          icon={Edit3}
                          onClick={() => startEdit(item)}
                        >
                          {item.notes ? 'Edytuj notatkę' : 'Dodaj notatkę'}
                        </Button>
                      )}
                    </div>

                    {/* Notatka lub tryb edycji */}
                    {isEditing ? (
                      <div className="space-y-2 pt-2 border-t border-line/40">
                        <textarea
                          rows={2}
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          placeholder="Własna notatka (np. termin naboru, kontakt do urzędu, koszt kursu)..."
                          className="w-full text-xs rounded-xl border border-line bg-sunken p-2 text-ink focus:outline-none focus:border-brand-500"
                        />
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <span>Przypomnienie:</span>
                            <input
                              type="date"
                              value={tempReminder}
                              onChange={(e) => setTempReminder(e.target.value)}
                              className="text-xs rounded-lg border border-line bg-sunken px-2 py-1 text-ink focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              icon={Save}
                              onClick={() => saveEdit(item.materialId)}
                            >
                              Zapisz
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingItemId(null)}
                            >
                              Anuluj
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      item.notes && (
                        <div className="rounded-xl bg-sunken/60 p-2.5 text-xs text-muted border border-line/60">
                          <strong className="text-ink font-semibold">Notatka: </strong>
                          {item.notes}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
