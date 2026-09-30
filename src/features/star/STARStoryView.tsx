import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Award,
  Sparkles,
  Layers,
  Search,
  Zap,
  Tag,
  Clock,
  CheckCircle2,
  Sliders,
  Keyboard,
  BookOpen,
} from 'lucide-react';
import { MasterVault, STARStory } from '../../types';
import {
  buildStarStoriesFromVault,
  filterStarStoriesByTags,
  findStoryForActiveTag,
  suggestTagsForSTARStory,
} from '../../lib/starStoryEngine';
import { StarTagCloud } from '../../components/star/StarTagCloud';
import { STARStoryCard } from '../../components/star/STARStoryCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { showToast } from '../../store/useToastStore';

export interface STARStoryViewProps {
  vault: MasterVault;
  className?: string;
}

export const STARStoryView: React.FC<STARStoryViewProps> = ({
  vault,
  className = '',
}) => {
  // Bazowe historie STAR wygenerowane z MasterVault
  const [stories, setStories] = useState<STARStory[]>(() => buildStarStoriesFromVault(vault));
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [slot3Highlighted, setSlot3Highlighted] = useState(false);

  const slot3Ref = useRef<HTMLDivElement>(null);

  // Synchronizacja przy zmianie vaultu
  useEffect(() => {
    setStories(buildStarStoriesFromVault(vault));
  }, [vault]);

  // INTEGRACJA Z HUD: Znajdź historię dla aktywnego tagu i załaduj do Slotu 3
  const slot3Story = useMemo(() => {
    if (activeTags.length > 0) {
      return findStoryForActiveTag(stories, activeTags[0]);
    }
    return stories[0];
  }, [stories, activeTags]);

  // SKRÓT KLAWIATUROWY CTRL+3 / CMD+3
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault();
        setSlot3Highlighted(true);
        slot3Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('HUD Slot 3 Aktywowany [Ctrl+3]', {
          message: slot3Story
            ? `Załadowano: ${slot3Story.title}`
            : 'Wybierz tag, aby załadować historię do Slotu 3.',
        });
        setTimeout(() => setSlot3Highlighted(false), 2500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slot3Story]);

  const handleToggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== tag.toLowerCase());
      }
      // Ustawiamy jako aktywny tag (auto-load do Slotu 3)
      return [tag, ...prev];
    });
  };

  const handleAddTagToStory = (storyId: string, newTag: string) => {
    setStories((prev) =>
      prev.map((s) => {
        if (s.id === storyId && !s.tags.includes(newTag)) {
          return { ...s, tags: [...s.tags, newTag] };
        }
        return s;
      })
    );
    // Widok nie ma dostępu do zapisu vaultu — tag żyje w bieżącym podglądzie.
    // Wcześniej toast twierdził „Dodano tag NLP", jakby trafił do profilu.
    showToast('Tag dodany do podglądu', {
      message: `„${newTag}" — na tę sesję; trwałe tagi edytuj w PROFIL.`,
    });
  };

  const handleUpdateDuration = (storyId: string, durationSec: number) => {
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, durationSec } : s))
    );
    // Bez kłamstwa o zapisie: czas służy pomiarowi bieżącej próby, nie
    // aktualizacji dokumentu.
    showToast('Czas próby zmierzony', { message: `Wynik: ${durationSec}s.` });
  };

  // Filtrowanie historii
  const filteredStories = useMemo(() => {
    return filterStarStoriesByTags(stories, activeTags, searchQuery);
  }, [stories, activeTags, searchQuery]);

  // Pierwsza metryka pierwszego wpisu doświadczenia — dokładnie tyle, ile
  // naprawdę jest w danych. Wcześniejszy fallback „Zweryfikowane wdrożenia"
  // udawał twardy wynik użytkownika, którego nie było (reguła 1).
  const firstMetric = vault.history?.[0]?.highlights?.[0]?.metric;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* INTEGRACJA Z HUD: PANEL SLOTÓW HUD (z podglądem Slotu 3 i skrótu Ctrl+3) */}
      <div
        ref={slot3Ref}
        className={`rounded-2xl border transition-all duration-300 ${
          slot3Highlighted
            ? 'border-brand-500 bg-brand-50/20 ring-4 ring-brand-500/30'
            : 'border-line bg-elevated shadow-raised'
        } p-5 space-y-4`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink tracking-tight">
                  Career HUD • Aktywna Telemetria i Sloty
                </h3>
                <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] font-bold text-muted flex items-center gap-1">
                  <Keyboard className="h-3 w-3" /> Ctrl+3
                </span>
              </div>
              <p className="text-xs text-muted">
                Wybór tagu automatycznie ładuje odpowiadającą historię STAR do <strong>Slotu 3</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Chip variant={slot3Story ? 'success' : 'neutral'} size="sm">
              {slot3Story ? 'Slot 3: Załadowany' : 'Slot 3: Oczekuje na tag'}
            </Chip>
          </div>
        </div>

        {/* Trzy Sloty HUD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Slot 1: Profil */}
          <div className="rounded-xl border border-line bg-surface p-3.5 space-y-1">
            <span className="font-mono text-[10px] font-extrabold text-muted uppercase tracking-wider block">
              Slot 1: Rola Kandydata
            </span>
            <span className="font-bold text-xs text-ink block truncate">
              {vault.personalInfo?.title || 'Nie podano w profilu'}
            </span>
            <span className="text-[10px] font-mono text-subtle">MasterVault Base Profile</span>
          </div>

          {/* Slot 2: Kluczowa Metryka */}
          <div className="rounded-xl border border-line bg-surface p-3.5 space-y-1">
            <span className="font-mono text-[10px] font-extrabold text-muted uppercase tracking-wider block">
              Slot 2: Główna Metryka
            </span>
            {firstMetric ? (
              <span className="font-bold text-xs text-success-fg block truncate">
                {firstMetric}
              </span>
            ) : (
              // Empty-state zamiast zmyślonej metryki: slot mówi wprost, czego
              // brakuje, i kieruje do miejsca, gdzie użytkownik ją uzupełni.
              <span className="block truncate text-xs italic text-muted">
                Dodaj twardą liczbę w Vault
              </span>
            )}
            <span className="text-[10px] font-mono text-subtle">
              {vault.history?.[0]?.company || 'Doświadczenie'}
            </span>
          </div>

          {/* Slot 3: Aktywna Historia STAR (Auto-loaded z tagu / Ctrl+3) */}
          <div
            className={`rounded-xl border p-3.5 space-y-1 transition-colors ${
              slot3Highlighted
                ? 'border-brand-500 bg-brand-50'
                : 'border-brand-500/30 bg-brand-500/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-extrabold text-brand-700 uppercase tracking-wider">
                Slot 3: Historia STAR (Ctrl+3)
              </span>
              {activeTags[0] && (
                <span className="rounded bg-brand-600 text-on-brand px-1.5 py-0.2 font-mono text-[9px] font-bold">
                  Tag: {activeTags[0]}
                </span>
              )}
            </div>

            {slot3Story ? (
              <>
                <span className="font-bold text-xs text-ink block truncate">
                  {slot3Story.title}
                </span>
                <span className="text-[10px] font-mono text-brand-600 block">
                  Czas: {slot3Story.durationSec}s • Metryki: {slot3Story.metrics.slice(0, 2).join(', ') || 'Brak'}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted">Brak aktywnej historii w slocie.</span>
            )}
          </div>
        </div>
      </div>

      {/* CHMURA TAGÓW (Tag Cloud) */}
      <StarTagCloud
        stories={stories}
        activeTags={activeTags}
        onToggleTag={handleToggleTag}
        onClearTags={() => setActiveTags([])}
      />

      {/* Pasek wyszukiwania i statystyk */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-brand-600" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted font-mono">
            Gotowe Historie STAR ({filteredStories.length} z {stories.length})
          </h3>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
          <input
            type="text"
            placeholder="Szukaj w historiach..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-xs font-mono text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Lista Kart Historii STAR */}
      <div className="grid gap-4">
        {filteredStories.length === 0 ? (
          <EmptyState
            icon={searchQuery ? Search : BookOpen}
            title={searchQuery ? 'Brak wyników dla tego filtra' : 'Brak historii STAR'}
            description={
              searchQuery
                ? 'Żadna historia nie pasuje do wyszukiwanej frazy. Wyczyść pole, żeby zobaczyć wszystkie.'
                : 'Szkice zbudują się z punktów w Twoim doświadczeniu. Dopiszesz do nich własną sytuację, zadanie, działania i rzeczywisty rezultat.'
            }
          />
        ) : (
          filteredStories.map((story) => (
            <STARStoryCard
              key={story.id}
              story={story}
              isActiveInHud={slot3Story?.id === story.id}
              onTagClick={handleToggleTag}
              onAddTag={handleAddTagToStory}
              onUpdateDuration={handleUpdateDuration}
            />
          ))
        )}
      </div>
    </div>
  );
};
