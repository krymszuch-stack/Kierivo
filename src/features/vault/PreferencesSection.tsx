import React, { useState } from 'react';
import {
  Briefcase,
  MapPin,
  Compass,
  TrendingUp,
  Sparkles,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import {
  ProfilerState,
  ExperienceLevel,
  LocationPreferences,
  CareerGoal,
  ExperienceYears,
  IndependenceLevel,
} from '../../types';
import {
  CAREER_GOALS,
  EXPERIENCE_YEARS_OPTIONS,
  INDEPENDENCE_OPTIONS,
  resolveSeniorityFromCareerModel,
} from '../../data/careerGoals';
import { SENIORITY_LEVELS } from '../../data/seniority';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Field';
import { Slider } from '../../components/ui/Slider';
import { Toggle } from '../../components/ui/Toggle';

export interface PreferencesSectionProps {
  profiler: ProfilerState;
  onChange: (updated: ProfilerState) => void;
  className?: string;
}

const GOAL_ICONS: Record<CareerGoal, React.ComponentType<{ className?: string }>> = {
  FIRST_JOB: Compass,
  EXPERIENCED_ROLE: Briefcase,
  MORE_RESPONSIBLE: TrendingUp,
  CAREER_CHANGE: Sparkles,
  SIDE_OR_CASUAL: Clock,
  UNDECIDED: HelpCircle,
};

export const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  profiler,
  onChange,
  className = '',
}) => {
  const [showAdvancedAts, setShowAdvancedAts] = useState(false);

  // Aktualizacja modelu kariery ze spójnym przeliczeniem wewnętrznego poziomu ATS
  const handleUpdateCareerModel = (updates: Partial<ProfilerState>) => {
    const nextState: ProfilerState = {
      ...profiler,
      ...updates,
    };
    // Jeśli włączony jest automatyczny dobór (domyślnie), wyliczamy wewnętrzny experienceLevel
    if (nextState.autoDetermineSeniority !== false) {
      nextState.experienceLevel = resolveSeniorityFromCareerModel(nextState);
    }
    onChange(nextState);
  };

  const handleSelectGoal = (goalId: CareerGoal) => {
    const goalConfig = CAREER_GOALS.find((g) => g.id === goalId);
    handleUpdateCareerModel({
      careerGoal: goalId,
      // Jeśli użytkownik wybiera start w zawodzie lub zmianę branży, podpowiadamy adekwatną samodzielność
      ...(goalConfig && !profiler.independenceLevel
        ? { independenceLevel: goalConfig.defaultIndependence }
        : {}),
    });
  };

  const handleUpdateLocation = <K extends keyof LocationPreferences>(
    field: K,
    value: LocationPreferences[K]
  ) => {
    onChange({
      ...profiler,
      location: {
        ...profiler.location,
        [field]: value,
      },
    });
  };

  const isAutoSeniority = profiler.autoDetermineSeniority !== false;

  return (
    <Card tone="raised" className={`space-y-8 ${className}`}>
      <div>
        <h3 className="text-lg font-bold text-ink tracking-tight">Preferencje Zawodowe i Twój Cel</h3>
        <p className="text-xs text-muted mt-0.5">
          Dopasuj oferty i podpowiedzi profilu do tego, czego naprawdę szukasz — bez korporacyjnego żargonu.
        </p>
      </div>

      {/* 1. Twój cel zawodowy */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Twój cel zawodowy
          </label>
          <p className="text-xs text-muted mt-0.5">
            Wybierz sytuację, która najlepiej oddaje Twój obecny moment na rynku pracy.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {CAREER_GOALS.map((goal) => {
            const Icon = GOAL_ICONS[goal.id];
            const isSelected = profiler.careerGoal === goal.id;

            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => handleSelectGoal(goal.id)}
                className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/30 text-ink shadow-sm ring-2 ring-brand-500/20'
                    : 'border-line bg-surface hover:border-brand-300 hover:bg-sunken/50 text-ink'
                }`}
              >
                <div className="flex items-start justify-between gap-2 w-full mb-1.5">
                  <div
                    className={`p-2 rounded-xl flex items-center justify-center ${
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-elevated text-muted border border-line/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                  )}
                </div>
                <div className="text-xs font-bold text-ink leading-snug">{goal.title}</div>
                <div className="text-[11px] text-muted mt-1 leading-normal">
                  {goal.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Osobne wymiary: Doświadczenie, Samodzielność, Gotowość do nowej branży */}
      <div className="space-y-5 border-t border-line/60 pt-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
          Doświadczenie i Samodzielność
        </h4>

        {/* Staż w zawodzie */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink">
            Dotychczasowy staż w docelowej dziedzinie
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXPERIENCE_YEARS_OPTIONS.map((opt) => {
              const isSelected = profiler.experienceYears === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    handleUpdateCareerModel({ experienceYears: opt.id as ExperienceYears })
                  }
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-950/30 ring-1 ring-brand-500'
                      : 'border-line bg-surface hover:border-brand-300'
                  }`}
                >
                  <div className="text-xs font-semibold text-ink">{opt.label}</div>
                  <div className="text-[10px] text-muted">{opt.sublabel}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Oczekiwana samodzielność */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink">
            Oczekiwany poziom samodzielności
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {INDEPENDENCE_OPTIONS.map((opt) => {
              const isSelected = profiler.independenceLevel === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    handleUpdateCareerModel({ independenceLevel: opt.id as IndependenceLevel })
                  }
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/60 dark:bg-brand-950/30 ring-1 ring-brand-500'
                      : 'border-line bg-surface hover:border-brand-300'
                  }`}
                >
                  <div className="text-xs font-bold text-ink">{opt.label}</div>
                  <div className="text-[11px] text-muted mt-1 leading-snug">
                    {opt.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gotowość do zmiany branży */}
        <div className="rounded-2xl border border-line bg-sunken/30 p-4">
          <Toggle
            checked={Boolean(profiler.industryChangeReady || profiler.careerGoal === 'CAREER_CHANGE')}
            onChange={(checked) =>
              handleUpdateCareerModel({ industryChangeReady: checked })
            }
            label="Otwartość na zmianę branży lub zawodu"
            description="Uwzględniaj oferty z pokrewnych lub nowych dziedzin, w których przydadzą się Twoje ogólne umiejętności."
          />
        </div>
      </div>

      {/* 3. Sekcja zaawansowana: Wewnętrzny profil ATS */}
      <div className="border-t border-line/60 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvancedAts(!showAdvancedAts)}
          className="flex items-center justify-between w-full text-left py-2 px-1 text-xs text-muted hover:text-ink transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 font-medium">
            <Sliders className="w-3.5 h-3.5" />
            Zaawansowane: Dopasowanie techniczne do skanerów ofert i ATS
          </span>
          {showAdvancedAts ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showAdvancedAts && (
          <div className="mt-3 p-4 rounded-2xl border border-line bg-surface-elevated/40 space-y-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted leading-relaxed">
                Systemy rekrutacyjne i skanery ATS wciąż używają tradycyjnych kategorii zaszeregowania.
                Kierivo ustawia ten parametr automatycznie w tle na podstawie Twojego celu i stażu, aby
                Twoje CV trafiało do właściwych rekruterów.
              </p>
            </div>

            <Toggle
              checked={isAutoSeniority}
              onChange={(checked) => {
                const nextState = {
                  ...profiler,
                  autoDetermineSeniority: checked,
                };
                if (checked) {
                  nextState.experienceLevel = resolveSeniorityFromCareerModel(nextState);
                }
                onChange(nextState);
              }}
              label="Dobierz automatycznie na podstawie celu (zalecane)"
              description={`Aktualnie wyliczony poziom techniczny: ${profiler.experienceLevel}`}
            />

            {!isAutoSeniority && (
              <div className="space-y-2 pt-2 border-t border-line/60">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Ręczne nadpisanie poziomu technicznego (dla zaawansowanych)
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SENIORITY_LEVELS.map((level) => {
                    const isSelected = profiler.experienceLevel === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() =>
                          onChange({
                            ...profiler,
                            experienceLevel: level.id as ExperienceLevel,
                            autoDetermineSeniority: false,
                          })
                        }
                        className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'border-brand-600 bg-brand-600 text-white font-semibold'
                            : 'border-line bg-surface hover:border-brand-300 text-ink'
                        }`}
                      >
                        <div>{level.label}</div>
                        <div
                          className={`text-[10px] ${
                            isSelected ? 'text-white/80' : 'text-muted'
                          }`}
                        >
                          {level.range || level.id}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Miejsce pracy i lokalizacja */}
      <div className="border-t border-line/60 pt-6 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
          Lokalizacja i Tryb Pracy
        </h4>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Miasto docelowe lub rejon pracy"
            icon={MapPin}
            value={profiler.location.city || ''}
            onChange={(e) => handleUpdateLocation('city', e.target.value)}
            placeholder="np. Kraków, Poznań, okolice..."
          />

          <div className="flex flex-col justify-center gap-3 pt-2">
            <Toggle
              checked={profiler.location.remoteOnly}
              onChange={(checked) => handleUpdateLocation('remoteOnly', checked)}
              label="Tylko praca zdalna (100%)"
            />

            <Toggle
              checked={profiler.location.hybridWork}
              onChange={(checked) => handleUpdateLocation('hybridWork', checked)}
              label="Dopuszczam pracę hybrydową"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
          <Toggle
            checked={profiler.location.willingnessToTravel}
            onChange={(checked) => handleUpdateLocation('willingnessToTravel', checked)}
            label="Gotowość do wyjazdów / delegacji"
            description="Praca w terenie, serwis lub wyjazdy do klientów"
          />

          <Toggle
            checked={profiler.location.relocationReady || false}
            onChange={(checked) => handleUpdateLocation('relocationReady', checked)}
            label="Gotowość do zmiany miejsca zamieszkania"
            description="Otwartość na oferty z zapewnionym zakwaterowaniem lub pakietem relokacyjnym"
          />
        </div>

        {!profiler.location.remoteOnly && (
          <div className="rounded-2xl border border-line bg-surface p-4 mt-2">
            <Slider
              label="Maksymalny promień dojazdu do miejsca pracy"
              value={profiler.location.commuteRadiusKm || profiler.location.radiusKm || 30}
              onChange={(val) => {
                handleUpdateLocation('commuteRadiusKm', val);
                handleUpdateLocation('radiusKm', val);
              }}
              min={0}
              max={100}
              step={5}
              unit="km"
            />
          </div>
        )}
      </div>
    </Card>
  );
};

