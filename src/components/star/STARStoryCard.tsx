import React, { useState } from 'react';
import {
  Award,
  Sparkles,
  Clock,
  Plus,
  Play,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Tag,
  Zap,
} from 'lucide-react';
import { STARStory } from '../../types';
import { suggestTagsForSTARStory } from '../../lib/starStoryEngine';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { PracticeTimer } from './PracticeTimer';

export interface STARStoryCardProps {
  story: STARStory;
  isActiveInHud?: boolean;
  onTagClick?: (tag: string) => void;
  onAddTag?: (storyId: string, newTag: string) => void;
  onUpdateDuration?: (storyId: string, durationSec: number) => void;
  className?: string;
}

export const STARStoryCard: React.FC<STARStoryCardProps> = ({
  story,
  isActiveInHud = false,
  onTagClick,
  onAddTag,
  onUpdateDuration,
  className = '',
}) => {
  const [isTimerOpen, setIsTimerOpen] = useState(false);

  // Sugestie tagów są regułowe (starStoryEngine) — żaden model językowy ich nie generuje,
  // więc nie wolno ich etykietować jako NLP.
  const suggestedTags = React.useMemo(() => {
    return suggestTagsForSTARStory(story, story.tags);
  }, [story]);

  return (
    <div
      className={`page-break-inside-avoid rounded-2xl border transition-all ${
        isActiveInHud
          ? 'border-brand-500 bg-elevated shadow-floating ring-2 ring-brand-500/20'
          : 'border-line bg-elevated shadow-raised hover:border-line-strong'
      } p-5 space-y-4 ${className}`}
    >
      {/* Header karty */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-line pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-ink">{story.title}</h4>
            {isActiveInHud && (
              <span className="rounded-full bg-brand-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-600 border border-brand-500/20 flex items-center gap-1">
                <Zap className="h-3 w-3" /> Aktywna w HUD (Slot 3)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted font-mono">
            <span>Projekt/Firma: {story.projectId}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-subtle" />
              <span>Czas docelowy: {story.durationSec}s</span>
            </span>
          </div>
        </div>

        {/* Przycisk timera ćwiczeń */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={Play}
          onClick={() => setIsTimerOpen(!isTimerOpen)}
        >
          {isTimerOpen ? 'Zamknij timer' : 'Ćwicz na głos'}
        </Button>
      </div>

      {/* Widok timera ćwiczeń */}
      {isTimerOpen && (
        <PracticeTimer
          targetDurationSec={story.durationSec || 90}
          onSaveDuration={(duration) => {
            if (onUpdateDuration) {
              onUpdateDuration(story.id, duration);
            }
          }}
        />
      )}

      {story.sourceEvidence && (
        <div className="rounded-xl border border-line bg-sunken/50 p-3">
          <span className="font-mono text-[10px] font-extrabold text-muted uppercase tracking-wider">
            Punkt źródłowy z profilu
          </span>
          <p className="mt-1 text-xs text-ink/90 leading-relaxed">{story.sourceEvidence}</p>
        </div>
      )}

      {/* Siatka S - T - A - R */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* S (Situation) */}
        <div className="rounded-xl border border-line/70 bg-surface p-3 space-y-1">
          <span className="font-mono text-[10px] font-extrabold text-muted uppercase tracking-wider block">
            S — Sytuacja
          </span>
          <p className="text-xs text-ink/90 leading-relaxed">{story.situation || 'Uzupełnij sytuację własnymi słowami.'}</p>
        </div>

        {/* T (Task) */}
        <div className="rounded-xl border border-line/70 bg-surface p-3 space-y-1">
          <span className="font-mono text-[10px] font-extrabold text-brand-600 uppercase tracking-wider block">
            T — Zadanie
          </span>
          <p className="text-xs text-ink/90 leading-relaxed">{story.task || 'Dopisz zadanie lub odpowiedzialność, którą faktycznie miałeś.'}</p>
        </div>

        {/* A (Action) */}
        <div className="rounded-xl border border-line/70 bg-surface p-3 space-y-1">
          <span className="font-mono text-[10px] font-extrabold text-brand-700 uppercase tracking-wider block">
            A — Działanie
          </span>
          <p className="text-xs text-ink/90 leading-relaxed">{story.action || 'Opisz własne działania, których nie ma w punkcie źródłowym.'}</p>
        </div>

        {/* R (Result) */}
        <div className="rounded-xl border border-success/30 bg-success-soft/40 p-3 space-y-1">
          <span className="font-mono text-[10px] font-extrabold text-success-fg uppercase tracking-wider block">
            R — Rezultat
          </span>
          <p className="text-xs font-semibold text-success-fg leading-relaxed">{story.result || 'Dodaj rzeczywisty rezultat; nie szacuj liczby, jeśli jej nie znasz.'}</p>
        </div>
      </div>

      {/* Metryki i Tagi */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Tagi kompetencyjne */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-muted shrink-0" />
          {story.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick?.(tag)}
              className="rounded-md border border-line bg-sunken px-2 py-0.5 font-mono text-[11px] font-medium text-ink hover:border-brand-500 hover:text-brand-600 transition-colors"
              title={`Filtruj i załaduj historię STAR do HUD dla tagu: ${tag}`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Metryki */}
        {story.metrics && story.metrics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {story.metrics.map((m, i) => (
              <span
                key={i}
                className="rounded-md bg-success-soft px-2 py-0.5 font-mono text-xs font-bold text-success-fg"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AUTO-TAG SUGGESTION BANNER (regułowy) */}
      {suggestedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/20 bg-brand-500/5 p-2.5 text-xs">
          <span className="flex items-center gap-1 font-semibold text-brand-600 text-[11px]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Sugerowane tagi:</span>
          </span>
          <div className="flex flex-wrap gap-1">
            {suggestedTags.slice(0, 4).map((sugTag) => (
              <button
                key={sugTag}
                type="button"
                onClick={() => onAddTag?.(story.id, sugTag)}
                className="inline-flex items-center gap-1 rounded-md border border-brand-500/30 bg-surface px-2 py-0.5 font-mono text-[10px] font-bold text-brand-700 hover:bg-brand-50 transition-colors"
                title="Kliknij, aby dodać ten tag do historii STAR"
              >
                <Plus className="h-2.5 w-2.5" />
                <span>{sugTag}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
