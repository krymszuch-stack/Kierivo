import React, { useState, useMemo } from 'react';
import {
  Search,
  Clock,
  ChevronRight,
  BookOpen,
  Sparkles,
  Compass,
  Zap,
  GraduationCap,
  Briefcase,
  Coins,
  CheckCircle2,
  Bookmark,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterVault } from '../types';
import { trackProductInsight } from '../lib/productInsights';
import {
  INITIAL_MATERIALS,
  KNOWLEDGE_CATEGORIES,
  USER_INTENTS,
  QUICK_GOALS,
  KnowledgeCategory,
  UserIntent,
  QuickGoalType,
  KnowledgeMaterial,
  LearningPlan,
} from '../data/careerKnowledge';
import {
  getLearningPlan,
  addMaterialToPlan,
  updatePlanItemStatus,
  updatePlanItemNotes,
  removeMaterialFromPlan,
  togglePlanStep,
} from '../lib/learningPlanStorage';
import { MaterialDetailModal } from './careerTips/MaterialDetailModal';
import { LearningPlanDrawer } from './careerTips/LearningPlanDrawer';

export interface CareerTipsViewProps {
  vault?: MasterVault;
}

export const CareerTipsView: React.FC<CareerTipsViewProps> = ({ vault }) => {
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory>('all');
  const [activeIntent, setActiveIntent] = useState<UserIntent>('all');
  const [activeQuickGoal, setActiveQuickGoal] = useState<QuickGoalType | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllMaterials, setShowAllMaterials] = useState(false);

  const [selectedMaterial, setSelectedMaterial] = useState<KnowledgeMaterial | null>(null);
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState(false);
  const [learningPlan, setLearningPlan] = useState<LearningPlan>(() => getLearningPlan());

  // Odświeżenie planu po zmianach
  const reloadPlan = () => {
    setLearningPlan(getLearningPlan());
  };

  // Obsługa celów z sekcji "Nie wiesz, co dalej?"
  const handleSelectQuickGoal = (goal: QuickGoalType) => {
    if (activeQuickGoal === goal) {
      setActiveQuickGoal(null);
      setActiveCategory('all');
      setActiveIntent('all');
      return;
    }

    setActiveQuickGoal(goal);
    const config = QUICK_GOALS.find((g) => g.id === goal);
    if (config?.categoryFilter) {
      setActiveCategory(config.categoryFilter);
    } else {
      setActiveCategory('all');
    }
    if (config?.intentFilter) {
      setActiveIntent(config.intentFilter);
    } else {
      setActiveIntent('all');
    }
  };

  // Dodawanie do planu
  const handleAddToPlan = (material: KnowledgeMaterial) => {
    addMaterialToPlan(material);
    reloadPlan();
  };

  // Rekomendacje powiązane z profilem
  const profileRecommendations = useMemo(() => {
    const recs: { title: string; hint: string; materialId: string }[] = [];
    const profiler = vault?.profiler;
    const licenses = profiler?.licenses || [];
    const careerGoal = profiler?.careerGoal;

    // 1. Sprawdzenie brakujących uprawnień SEP/UDT
    if (!licenses.includes('sep_1kv') && !licenses.includes('sep_g2')) {
      recs.push({
        title: 'Jak zdobyć uprawnienia SEP (G1, G2, G3)',
        hint: 'Kluczowe uprawnienie otwierające drogę do prac technicznych i elektroinstalacji.',
        materialId: 'uprawnienia-sep-g1-g2-g3',
      });
    }

    if (!licenses.includes('udt_forklift')) {
      recs.push({
        title: 'Operator wózka widłowego — uprawnienia UDT',
        hint: 'Konkretna, poszukiwana kwalifikacja magazynowo-logistyczna.',
        materialId: 'sciezka-operator-wozka-widlowego',
      });
    }

    // 2. W zależności od celu zawodowego
    if (careerGoal === 'FIRST_JOB' || careerGoal === 'UNDECIDED') {
      recs.push({
        title: 'Jak znaleźć pracę, której można nauczyć się od podstaw',
        hint: 'Miejsca i branże z programem wdrożeniowym i płatnym przyuczeniem.',
        materialId: 'praca-od-podstaw-bez-doswiadczenia',
      });
    }

    if (careerGoal === 'CAREER_CHANGE') {
      recs.push({
        title: 'Jak znaleźć umiejętności przenośne — z prac fizycznych do biura',
        hint: 'Jak pokazać most kompetencji w podsumowaniu i nie zaczynać od zera.',
        materialId: 'umiejetnosci-przenosne-most-kompetencji',
      });
    }

    // Zawsze polecamy sprawdzić dofinansowanie
    recs.push({
      title: 'Jak zapytać urząd pracy o szkolenie indywidualne',
      hint: 'Możliwość sfinansowania kursu ze środków Funduszu Pracy.',
      materialId: 'jak-zapytac-urzad-pracy-o-szkolenie',
    });

    return recs.slice(0, 4);
  }, [vault]);

  // Filtrowanie materiałów
  const filteredMaterials = useMemo(() => {
    return INITIAL_MATERIALS.filter((mat) => {
      // Kategoria
      const matchesCategory = activeCategory === 'all' || mat.category === activeCategory;

      // Intencja
      const matchesIntent =
        activeIntent === 'all' || mat.intents.includes(activeIntent);

      // Wyszukiwarka
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        mat.title.toLowerCase().includes(q) ||
        mat.snippet.toLowerCase().includes(q) ||
        mat.tags.some((t) => t.toLowerCase().includes(q)) ||
        (mat.possibleLicenses && mat.possibleLicenses.some((l) => l.toLowerCase().includes(q))) ||
        (mat.initialRoles && mat.initialRoles.some((r) => r.toLowerCase().includes(q)));

      return matchesCategory && matchesIntent && matchesSearch;
    });
  }, [activeCategory, activeIntent, searchQuery]);

  // Maksymalnie 6-8 kart na pierwszym ekranie
  const visibleMaterials = useMemo(() => {
    if (showAllMaterials || searchQuery.trim().length > 0 || activeIntent !== 'all' || activeCategory !== 'all') {
      return filteredMaterials;
    }
    return filteredMaterials.slice(0, 6);
  }, [filteredMaterials, showAllMaterials, searchQuery, activeIntent, activeCategory]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-6 lg:p-8 text-ink">
      {/* 1. Nagłówek i krótki opis */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Baza Wiedzy i Poradnik Kariery"
          description="Praktyczne ścieżki nauki, rzetelne informacje o uprawnieniach państwowych i możliwościach dofinansowania dla każdego etapu kariery."
          badge="Przewodnik & Edukacja"
        />

        {/* Przycisk do planu nauki */}
        <Button
          type="button"
          variant="outline"
          size="md"
          icon={Bookmark}
          onClick={() => setIsPlanDrawerOpen(true)}
          className="self-start sm:self-auto shrink-0 border-brand-300 dark:border-brand-800 hover:bg-brand-50/50 cursor-pointer"
        >
          Mój plan nauki ({learningPlan.items.length})
        </Button>
      </div>

      {/* 2. Wyszukiwarka z wymaganym placeholderem */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Czego szukasz? Np. kurs, SEP, praca w magazynie, zmiana branży"
          className="w-full pl-11 pr-4 py-3 text-xs sm:text-sm rounded-2xl border border-line bg-surface text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink cursor-pointer"
          >
            Wyczyść
          </button>
        )}
      </div>

      {/* 3. Wyróżniona sekcja: „Nie wiesz, co dalej?” */}
      <div className="rounded-3xl border border-brand-500/30 bg-gradient-to-br from-brand-50/70 via-surface to-brand-50/30 dark:from-brand-950/40 dark:via-surface dark:to-brand-950/20 p-5 sm:p-6 space-y-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-brand-600 font-bold text-xs uppercase tracking-wider">
            <Compass className="w-4 h-4" />
            Nie wiesz, co dalej?
          </div>
          <h3 className="text-base sm:text-lg font-bold text-ink mt-1">
            Wybierz swój cel, a pokażemy Ci możliwe ścieżki nauki, kwalifikacje i następne kroki.
          </h3>
        </div>

        {/* 5 przycisków szybkiego wyboru celu */}
        <div className="flex flex-wrap gap-2">
          {QUICK_GOALS.map((goal) => {
            const isSelected = activeQuickGoal === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => handleSelectQuickGoal(goal.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-brand-600 bg-brand-600 text-white shadow-xs'
                    : 'border-line/80 bg-surface hover:border-brand-300 text-ink hover:text-brand-600'
                }`}
              >
                {goal.id === 'from_scratch' && <Compass className="w-3.5 h-3.5" />}
                {goal.id === 'quick_licenses' && <Zap className="w-3.5 h-3.5" />}
                {goal.id === 'career_change' && <Sparkles className="w-3.5 h-3.5" />}
                {goal.id === 'find_training' && <GraduationCap className="w-3.5 h-3.5" />}
                {goal.id === 'check_funding' && <Coins className="w-3.5 h-3.5" />}
                <span>{goal.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Rekomendacje profilowe: „Polecane dla Ciebie” */}
      {profileRecommendations.length > 0 && !searchQuery && (
        <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-brand-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Na podstawie Twojego profilu możesz sprawdzić:
                </h3>
              </div>
              <p className="text-xs text-muted mt-1 italic">
                „Nie musisz od razu wybierać całej kariery. Wybierz jeden realny krok, który możesz wykonać w tym tygodniu.”
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profileRecommendations.map((rec, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const found = INITIAL_MATERIALS.find((m) => m.id === rec.materialId);
                  if (found) {
                    trackProductInsight('career_article_opened');
                    setSelectedMaterial(found);
                  }
                }}
                className="rounded-2xl border border-line/80 bg-sunken/40 hover:bg-sunken p-3.5 text-left transition-colors flex items-start justify-between gap-2 cursor-pointer group"
              >
                <div className="space-y-1">
                  <div className="text-xs font-bold text-ink group-hover:text-brand-600 transition-colors">
                    {rec.title}
                  </div>
                  <div className="text-[11px] text-muted leading-relaxed">
                    {rec.hint}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted group-hover:text-brand-600 shrink-0 mt-0.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Filtry: Kategorie i Intencje */}
      <div className="space-y-3">
        {/* Pasek kategorii */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {KNOWLEDGE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCategory(cat.id);
                setActiveQuickGoal(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                activeCategory === cat.id
                  ? 'border-brand-500 bg-brand-500/10 text-brand-600 font-bold'
                  : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filtr intencji użytkownika */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted pt-1">
          <span className="font-semibold text-ink shrink-0">Intencja:</span>
          {USER_INTENTS.map((intent) => (
            <button
              key={intent.id}
              type="button"
              onClick={() => {
                setActiveIntent(intent.id);
                setActiveQuickGoal(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border cursor-pointer ${
                activeIntent === intent.id
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/40 text-brand-600 font-bold'
                  : 'border-line/60 bg-surface/80 text-muted hover:text-ink'
              }`}
            >
              {intent.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Siatka materiałów i ścieżek */}
      <div className="space-y-6">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Znaleziono materiałów: <strong className="text-ink">{filteredMaterials.length}</strong></span>
          {filteredMaterials.length > 6 && !searchQuery && activeCategory === 'all' && activeIntent === 'all' && (
            <button
              type="button"
              onClick={() => setShowAllMaterials(!showAllMaterials)}
              className="text-brand-600 hover:underline font-semibold cursor-pointer"
            >
              {showAllMaterials ? 'Pokaż tylko najważniejsze (6)' : `Zobacz wszystkie materiały (${filteredMaterials.length})`}
            </button>
          )}
        </div>

        {filteredMaterials.length === 0 ? (
          <div className="rounded-3xl border border-line bg-surface p-12 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-muted mx-auto" />
            <div className="text-sm font-bold text-ink">Brak materiałów spełniających wybrane kryteria</div>
            <p className="text-xs text-muted max-w-md mx-auto">
              Spróbuj zmienić kategorię, wybrać „Wszystkie intencje” lub wpisać ogólniejszą frazę w wyszukiwarkę.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveCategory('all');
                setActiveIntent('all');
                setActiveQuickGoal(null);
                setSearchQuery('');
              }}
            >
              Zresetuj filtry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visibleMaterials.map((mat) => {
              const isPathway = mat.type === 'pathway';
              const isInPlan = learningPlan.items.some((it) => it.materialId === mat.id);

              return (
                <div
                  key={mat.id}
                  className={`rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between transition-all border ${
                    isPathway
                      ? 'border-brand-300 dark:border-brand-700 bg-surface hover:border-brand-500 shadow-sm'
                      : 'border-line bg-surface hover:border-brand-300'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Tagi karty */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isPathway ? (
                          <span className="rounded-md bg-brand-600 text-white px-2 py-0.5 text-[10px] font-bold tracking-wide flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Ścieżka zawodowa
                          </span>
                        ) : (
                          <span className="rounded-md bg-brand-500/10 text-brand-600 px-2 py-0.5 text-[10px] font-bold font-mono">
                            {mat.seriesTitle}
                          </span>
                        )}

                        <span className="rounded-md border border-line bg-sunken/60 px-2 py-0.5 text-[10px] text-muted font-medium">
                          {mat.entryLevelLabel}
                        </span>
                      </div>

                      <span className="flex items-center gap-1 text-muted text-[11px] font-mono">
                        <Clock className="h-3 w-3" />
                        {mat.readTime}
                      </span>
                    </div>

                    {/* Tytuł */}
                    <h3 className="font-bold text-base text-ink leading-snug">
                      {mat.title}
                    </h3>

                    {/* Opis / snippet */}
                    <p className="text-xs text-muted leading-relaxed line-clamp-3">
                      {mat.snippet}
                    </p>

                    {/* Dodatkowe informacje dla ścieżki zawodowej */}
                    {isPathway && mat.possibleLicenses && mat.possibleLicenses.length > 0 && (
                      <div className="pt-1 text-[11px] text-muted flex items-start gap-1.5">
                        <span className="text-brand-600 font-semibold shrink-0">Uprawnienia:</span>
                        <span className="line-clamp-1">{mat.possibleLicenses.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Dolny pasek akcji */}
                  <div className="pt-4 mt-4 border-t border-line/60 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        trackProductInsight('career_article_opened');
                        setSelectedMaterial(mat);
                      }}
                      className="text-brand-600 font-semibold hover:underline p-0 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isPathway ? 'Zobacz ścieżkę' : 'Czytaj materiał'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={isInPlan ? 'secondary' : 'outline'}
                      icon={isInPlan ? CheckCircle2 : Bookmark}
                      onClick={() => handleAddToPlan(mat)}
                      className="cursor-pointer"
                    >
                      {isInPlan ? 'W planie' : 'Do planu'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Link na dole do pokazania wszystkich materiałów */}
        {!showAllMaterials && filteredMaterials.length > 6 && !searchQuery && activeCategory === 'all' && activeIntent === 'all' && (
          <div className="text-center pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              icon={Layers}
              onClick={() => setShowAllMaterials(true)}
            >
              Zobacz wszystkie materiały ({filteredMaterials.length})
            </Button>
          </div>
        )}
      </div>

      {/* Modal szczegółów materiału (9 punktów + wiarygodność + dodawanie do planu) */}
      <MaterialDetailModal
        material={selectedMaterial}
        isOpen={Boolean(selectedMaterial)}
        onClose={() => setSelectedMaterial(null)}
        onAddToPlan={handleAddToPlan}
        isAlreadyInPlan={
          selectedMaterial
            ? learningPlan.items.some((it) => it.materialId === selectedMaterial.id)
            : false
        }
      />

      {/* Panel / Modal planu nauki */}
      <LearningPlanDrawer
        isOpen={isPlanDrawerOpen}
        onClose={() => setIsPlanDrawerOpen(false)}
        plan={learningPlan}
        onToggleStep={(stepId) => {
          togglePlanStep(stepId);
          reloadPlan();
        }}
        onUpdateStatus={(materialId, status) => {
          updatePlanItemStatus(materialId, status);
          reloadPlan();
        }}
        onUpdateNotes={(materialId, notes, reminder) => {
          updatePlanItemNotes(materialId, notes, reminder);
          reloadPlan();
        }}
        onRemoveItem={(materialId) => {
          removeMaterialFromPlan(materialId);
          reloadPlan();
        }}
        onOpenMaterial={(materialId) => {
          const found = INITIAL_MATERIALS.find((m) => m.id === materialId);
          if (found) {
            setSelectedMaterial(found);
          }
        }}
      />
    </div>
  );
};
