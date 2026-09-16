import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Tag, BookOpen, Lightbulb, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HighlightMetric } from '../../types';
import { HR_AND_COMMON_STOP_WORDS } from '../../lib/atsSimulator';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Textarea } from '../../components/ui/Field';
import { EmptyState } from '../../components/ui/EmptyState';
import { StarHelperModal } from './StarHelperModal';
import { getStarContextConfig } from '../../lib/starContextHelper';
import { hasMeasurableMetric } from '../../lib/consistencyGuard';

export interface AchievementEditorProps {
  highlights: HighlightMetric[];
  roleTitle?: string;
  onChange: (updated: HighlightMetric[]) => void;
  className?: string;
}

export const AchievementEditor: React.FC<AchievementEditorProps> = ({
  highlights,
  roleTitle,
  onChange,
  className = '',
}) => {
  const [isStarModalOpen, setIsStarModalOpen] = useState(false);
  const [targetHighlightId, setTargetHighlightId] = useState<string | null>(null);
  const contextConfig = getStarContextConfig(roleTitle);
  const handleAddHighlight = () => {
    const newHighlight: HighlightMetric = {
      id: `hl-${Date.now()}`,
      text: '',
      metric: '',
      target: '',
      action: '',
      tool: '',
      keywords: [],
    };
    onChange([...highlights, newHighlight]);
  };

  const handleUpdateText = (id: string, text: string) => {
    // Ekstrakcja słów kluczowych: uwzględnia polskie znaki diakrytyczne i odrzuca stop words
    const words = text
      .split(/[\s,.;:!?()]+/)
      .map((w) => w.trim())
      .filter(
        (w) =>
          w.length > 3 &&
          /^[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ+#.-]+$/.test(w) &&
          !HR_AND_COMMON_STOP_WORDS.has(w.toLowerCase())
      )
      .slice(0, 5);

    onChange(
      highlights.map((h) =>
        h.id === id
          ? {
              ...h,
              text,
              keywords: Array.from(new Set([...(h.keywords || []), ...words])),
            }
          : h
      )
    );
  };

  const handleRemoveHighlight = (id: string) => {
    onChange(highlights.filter((h) => h.id !== id));
  };

  const handleApplySnippet = (snippet: string) => {
    if (targetHighlightId) {
      handleUpdateText(targetHighlightId, snippet);
    } else if (highlights.length > 0) {
      const emptyHl = highlights.find((h) => !h.text.trim());
      if (emptyHl) {
        handleUpdateText(emptyHl.id, snippet);
      } else {
        const newHl: HighlightMetric = {
          id: `hl-${Date.now()}`,
          text: snippet,
          metric: '',
          target: '',
          action: '',
          tool: '',
          keywords: [],
        };
        onChange([...highlights, newHl]);
      }
    } else {
      const newHl: HighlightMetric = {
        id: `hl-${Date.now()}`,
        text: snippet,
        metric: '',
        target: '',
        action: '',
        tool: '',
        keywords: [],
      };
      onChange([newHl]);
    }
  };

  return (
    <div className={`space-y-3.5 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h4 className="text-label font-bold uppercase tracking-wider text-muted">
            Kluczowe Osiągnięcia i Rezultaty (Metoda STAR)
          </h4>
          <p className="text-meta text-subtle">
            Formułuj punkty jako: Działanie + Zastosowane Narzędzie + Mierzalny Rezultat (%).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={BookOpen}
            onClick={() => {
              setTargetHighlightId(null);
              setIsStarModalOpen(true);
            }}
            className="text-brand-fg hover:bg-brand-50"
            title="Otwórz słowniczek czasowników i wzorców STAR"
          >
            Słowniczek STAR
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={handleAddHighlight}
          >
            Dodaj Punkt Osiągnięcia
          </Button>
        </div>
      </div>

      {/* Szybkie czasowniki sprawcze (one-click starters) dopasowane do branży */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] font-bold text-muted flex items-center gap-1">
          <Lightbulb className="h-3 w-3 text-amber-500" />
          Czasowniki akcji ({contextConfig.domainLabel}):
        </span>
        {contextConfig.defaultVerbs.map((verb) => (
          <button
            key={verb}
            type="button"
            onClick={() => {
              if (highlights.length === 0) {
                const newId = `hl-${Date.now()}`;
                onChange([
                  {
                    id: newId,
                    text: `${verb} `,
                    metric: '',
                    target: '',
                    action: '',
                    tool: '',
                    keywords: [],
                  },
                ]);
                return;
              }
              const targetId =
                targetHighlightId || highlights[highlights.length - 1].id;
              const currentText =
                highlights.find((h) => h.id === targetId)?.text || '';
              const newText = currentText ? `${verb} ${currentText}` : `${verb} `;
              handleUpdateText(targetId, newText);
            }}
            className="rounded-lg border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-muted hover:border-brand-500/50 hover:bg-brand-500/5 hover:text-brand-fg transition-colors cursor-pointer"
          >
            + {verb}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {highlights.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Brak dodanych osiągnięć"
              description="Opisz co najmniej 2–3 mierzalne sukcesy — tylko takie punkty realnie podnoszą siłę CV."
              action={
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={BookOpen}
                    onClick={() => {
                      setTargetHighlightId(null);
                      setIsStarModalOpen(true);
                    }}
                  >
                    Zobacz słowniczek i przykłady
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    onClick={handleAddHighlight}
                  >
                    Dodaj pierwsze osiągnięcie
                  </Button>
                </div>
              }
            />
          ) : (
            highlights.map((hl, index) => (
              <motion.div
                key={hl.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl border border-line bg-surface p-3.5 space-y-2.5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-brand-fg mt-1">
                    #{index + 1}
                  </span>

                  <div className="flex-1">
                    <Textarea
                      rows={2}
                      value={hl.text}
                      onChange={(e) => handleUpdateText(hl.id, e.target.value)}
                      placeholder={contextConfig.placeholder}
                      className="text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1 mt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={BookOpen}
                      onClick={() => {
                        setTargetHighlightId(hl.id);
                        setIsStarModalOpen(true);
                      }}
                      className="text-brand-fg hover:bg-brand-50"
                      title="Wybierz wzorzec STAR dla tego osiągnięcia"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleRemoveHighlight(hl.id)}
                      className="text-danger-fg hover:bg-danger-soft"
                      title="Usuń osiągnięcie"
                    />
                  </div>
                </div>

                {/* Actions & Chips */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/50">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Tag className="h-3 w-3 text-subtle" />
                    {(hl.keywords || []).slice(0, 4).map((kw, i) => (
                      <Chip key={i} variant="neutral" className="text-[10px] py-px">
                        {kw}
                      </Chip>
                    ))}
                  </div>

                  {hl.text.trim() && (
                    <>
                      {hasMeasurableMetric(hl.text, hl.metric) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success-fg border border-success/30">
                          <CheckCircle2 className="h-3 w-3" />
                          Mierzalny rezultat wykryty (ATS & Rekruter OK)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning-fg border border-warning/30">
                          <Sparkles className="h-3 w-3" />
                          Wskazówka X-Y-Z: dodaj liczbę, %, czas lub skalę
                        </span>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Słowniczek STAR & Bank Czasowników Modal */}
      <StarHelperModal
        isOpen={isStarModalOpen}
        initialIndustry={contextConfig.domain}
        onClose={() => {
          setIsStarModalOpen(false);
          setTargetHighlightId(null);
        }}
        onApplySnippet={(snippet) => {
          handleApplySnippet(snippet);
          setIsStarModalOpen(false);
          setTargetHighlightId(null);
        }}
      />
    </div>
  );
};
