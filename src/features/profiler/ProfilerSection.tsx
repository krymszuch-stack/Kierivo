import React, { useState } from 'react';
import {
  MapPin,
  Globe,
  Sliders,
  CheckCircle2,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Award,
  Plus,
  X,
  ShieldCheck,
  Compass,
  TrendingUp,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { ProfilerState, CareerGoal, LocationPreferences } from '../../types';
import { CAREER_GOALS, resolveSeniorityFromCareerModel } from '../../data/careerGoals';
import { ALL_LICENSES } from '../../data/licenses';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Slider } from '../../components/ui/Slider';
import { Toggle } from '../../components/ui/Toggle';
import { LicenseModal } from './LicenseModal';

export interface ProfilerSectionProps {
  profiler: ProfilerState;
  onChange: (updated: ProfilerState) => void;
  className?: string;
}

const GOAL_ICONS: Record<CareerGoal, React.ComponentType<{ className?: string }>> = {
  FIRST_JOB: Compass,
  EXPERIENCED_ROLE: Briefcase,
  MORE_RESPONSIBLE: TrendingUp,
  CAREER_CHANGE: Sparkles,
  SIDE_OR_CASUAL: Briefcase,
  UNDECIDED: HelpCircle,
};

const GOAL_SIMPLE_TITLES: Partial<Record<CareerGoal, string>> = {
  FIRST_JOB: 'Pierwsza praca',
  EXPERIENCED_ROLE: 'Praca zgodna z doświadczeniem',
  MORE_RESPONSIBLE: 'Bardziej odpowiedzialna praca',
  CAREER_CHANGE: 'Zmiana zawodu lub branży',
  UNDECIDED: 'Nie wiem jeszcze',
};

export const ProfilerSection: React.FC<ProfilerSectionProps> = ({
  profiler,
  onChange,
  className = '',
}) => {
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const currentLicenses = profiler.licenses || [];
  const radiusKm = profiler.location.commuteRadiusKm || profiler.location.radiusKm || 30;

  // 1. Krótkie podsumowanie ustawień na samej górze
  const distanceText = profiler.location.remoteOnly ? '100% zdalnie' : `${radiusKm} km`;
  const workModeText = profiler.location.remoteOnly
    ? 'praca zdalna'
    : profiler.location.hybridWork
    ? 'praca hybrydowa'
    : 'praca lokalna';
  const relocationText = profiler.location.relocationReady ? 'z relokacją' : 'bez relokacji';

  const certCount = currentLicenses.length;
  const certPlural =
    certCount === 1 ? 'certyfikat' : certCount >= 2 && certCount <= 4 ? 'certyfikaty' : 'certyfikatów';
  const summaryText = `${distanceText} · ${workModeText} · ${relocationText} · ${certCount} ${certPlural}.`;

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

  const handleSelectGoal = (goalId: CareerGoal) => {
    const nextState: ProfilerState = {
      ...profiler,
      careerGoal: goalId,
    };
    if (nextState.autoDetermineSeniority !== false) {
      nextState.experienceLevel = resolveSeniorityFromCareerModel(nextState);
    }
    onChange(nextState);
  };

  const handleToggleLicense = (licenseId: string) => {
    const isPresent = currentLicenses.includes(licenseId);
    const updated = isPresent
      ? currentLicenses.filter((id) => id !== licenseId)
      : [...currentLicenses, licenseId];

    onChange({
      ...profiler,
      licenses: updated,
    });
  };

  // Mapowanie wybranych licencji na etykiety
  const selectedLicenseDefs = ALL_LICENSES.filter((lic) => currentLicenses.includes(lic.id));

  // Filtrowanie opcji celu według wytycznych promptu (prosty język)
  const displayGoals = CAREER_GOALS.filter((g) =>
    ['FIRST_JOB', 'EXPERIENCED_ROLE', 'MORE_RESPONSIBLE', 'CAREER_CHANGE', 'UNDECIDED'].includes(g.id)
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <PageHeader
        title="Filtry, Uprawnienia & Dealbreakery"
        description="Skonfiguruj kryteria selekcji ofert. Dopasowanie Kierivo automatycznie uwzględnia Twoje preferencje lokalizacyjne i kwalifikacje."
        badge="Kryteria selekcji"
      />

      {/* Podsumowanie ustawień na górze */}
      <div className="rounded-2xl border border-line/70 bg-surface px-4 py-3 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2 text-muted">
          <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
          <span className="text-muted">Podsumowanie ustawień:</span>
          <strong className="font-mono text-ink font-semibold">{summaryText}</strong>
        </div>
      </div>

      {/* 1. GŁÓWNA SEKCJA: Twój cel zawodowy */}
      <Card tone="raised" className="space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
            Twój cel zawodowy
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Wybierz sytuację, która najlepiej oddaje Twój obecny moment na rynku pracy.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {displayGoals.map((item) => {
            const isSelected = profiler.careerGoal === item.id;
            const Icon = GOAL_ICONS[item.id] || Briefcase;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectGoal(item.id)}
                className={`flex flex-col items-start rounded-2xl p-3.5 text-left transition-all cursor-pointer border relative ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/30 text-ink shadow-sm ring-2 ring-brand-500/20'
                    : 'border-line bg-surface hover:border-brand-300 text-ink'
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

                <span className="text-xs font-bold leading-tight text-ink">
                  {GOAL_SIMPLE_TITLES[item.id] || item.title}
                </span>
                <span
                  className={`mt-1 text-[11px] leading-snug ${
                    isSelected ? 'text-ink/85' : 'text-muted'
                  }`}
                >
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 2 & 3. GŁÓWNE SEKCJE: Lokalizacja i Sposób pracy */}
      <Card tone="raised" className="space-y-6">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
            Lokalizacja i Sposób Pracy
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Określ miejscowość bazową, maksymalny promień dojazdu oraz preferowany model pracy.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Miejscowość bazowa"
            icon={MapPin}
            value={profiler.location.city || ''}
            onChange={(e) => handleUpdateLocation('city', e.target.value)}
            placeholder="np. Warszawa, Kraków, Poznań, Katowice..."
          />

          <div className="flex flex-col justify-center gap-3 pt-2">
            <Toggle
              checked={profiler.location.remoteOnly}
              onChange={(checked) => handleUpdateLocation('remoteOnly', checked)}
              label="Tylko praca w 100% zdalna"
              description="Wyklucz oferty z wymogiem dojazdów do biura lub zakładu"
            />

            <Toggle
              checked={profiler.location.hybridWork}
              onChange={(checked) => handleUpdateLocation('hybridWork', checked)}
              label="Akceptuję model hybrydowy"
              description="Możliwość łączenia pracy z domu z dojazdem kilka razy w miesiącu"
            />
          </div>
        </div>

        {/* Promień dojazdu z dyskretnym radarem */}
        {!profiler.location.remoteOnly && (
          <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
            <Slider
              label="Maksymalny promień dojazdu"
              value={radiusKm}
              onChange={(val) => {
                handleUpdateLocation('commuteRadiusKm', val);
                handleUpdateLocation('radiusKm', val);
              }}
              min={5}
              max={100}
              step={5}
              unit="km"
            />

            <div className="flex items-center justify-between text-xs text-muted pt-1">
              <span className="font-mono text-[11px]">
                Obszar: do <b>{radiusKm} km</b> wokół: {profiler.location.city || 'miejscowości bazowej'}
              </span>
              <span className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold">
                Strefa aktywna
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* 4. GŁÓWNA SEKCJA: Podróże i relokacja */}
      <Card tone="raised" className="space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
            Podróże i Relokacja
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Wskaż swoją otwartość na wyjazdy służbowe lub zmianę miejsca zamieszkania.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Toggle
            checked={profiler.location.willingnessToTravel}
            onChange={(checked) => handleUpdateLocation('willingnessToTravel', checked)}
            label="Gotowość do podróży służbowych (delegacje)"
            description="Wyjazdy serwisowe, terenowe lub do innych oddziałów firmy"
          />

          <Toggle
            checked={profiler.location.relocationReady || false}
            onChange={(checked) => handleUpdateLocation('relocationReady', checked)}
            label="Gotowość do relokacji (przeprowadzka)"
            description="Otwartość na oferty z budżetem relokacyjnym lub zapewnionym zakwaterowaniem"
          />
        </div>
      </Card>

      {/* 5. SEKCJA DRUGORZĘDNA & OPCJONALNA: Uprawnienia i certyfikaty */}
      <Card tone="raised" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line/60 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                Uprawnienia i certyfikaty
              </h3>
              <span className="rounded-full bg-sunken border border-line px-2 py-0.5 text-[10px] font-semibold text-muted">
                Opcjonalne
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Dodaj tylko uprawnienia, które rzeczywiście posiadasz (np. UDT, SEP, prawo jazdy).
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Plus}
            onClick={() => setIsLicenseModalOpen(true)}
            className="self-start sm:self-auto"
          >
            Dodaj lub wyszukaj
          </Button>
        </div>

        {/* Stan pusty lub lista wybranych */}
        {currentLicenses.length === 0 ? (
          <div className="rounded-2xl border border-line/60 bg-sunken/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Award className="w-4 h-4 text-muted shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-ink">
                  0 wybranych. Dodaj tylko uprawnienia, które rzeczywiście posiadasz.
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  Brak certyfikatów nie blokuje wyszukiwania większości ofert pracy.
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => setIsLicenseModalOpen(true)}
            >
              Dodaj lub wyszukaj
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted flex items-center justify-between">
              <span>Liczba wybranych uprawnień: <strong className="text-ink">{currentLicenses.length}</strong></span>
              <button
                type="button"
                onClick={() => setIsLicenseModalOpen(true)}
                className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
              >
                Edytuj listę
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedLicenseDefs.map((lic) => (
                <div
                  key={lic.id}
                  className="flex items-center gap-2 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/70 dark:bg-brand-950/30 px-3 py-1.5 text-xs text-ink"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span className="font-medium">{lic.label}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleLicense(lic.id)}
                    className="text-muted hover:text-danger-fg p-0.5 rounded transition-colors ml-1 cursor-pointer"
                    title="Usuń uprawnienie"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 6. ZWIJANA SEKCJA: Filtry dodatkowe i kryteria ATS */}
      <div className="border-t border-line/60 pt-2">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
          className="flex items-center justify-between w-full text-left py-3 px-2 text-xs text-muted hover:text-ink transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Sliders className="w-3.5 h-3.5 text-brand-600" />
            Filtry dodatkowe
          </span>
          {isAdvancedOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {isAdvancedOpen && (
          <Card tone="sunken" className="p-4 rounded-2xl space-y-4 mt-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                Dopasowanie do skanerów ogłoszeń
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                Kierivo w tle wylicza techniczny profil dopasowania na podstawie Twojego celu i doświadczenia,
                aby skanery ATS prawidłowo klasyfikowały Twoje zgłoszenie.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-3 text-xs flex items-center justify-between">
              <div>
                <div className="font-semibold text-ink">Wewnętrzny poziom algorytmiczny ATS</div>
                <div className="text-[11px] text-muted">
                  Aktualnie przypisany: <strong className="text-brand-600">{profiler.experienceLevel}</strong>
                </div>
              </div>
              <span className="text-[10px] font-mono text-muted bg-sunken px-2 py-1 rounded">
                Auto-synced
              </span>
            </div>
          </Card>
        )}
      </div>

      {/* Modal wyboru uprawnień i certyfikatów */}
      <LicenseModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        selectedLicenses={currentLicenses}
        onToggleLicense={handleToggleLicense}
      />
    </div>
  );
};

