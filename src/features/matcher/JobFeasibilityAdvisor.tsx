import React, { useMemo, useState, useEffect } from 'react';
import {
  Car,
  Zap,
  Train,
  Compass,
  Lightbulb,
  Scale,
  Copy,
  Check,
  ArrowRight,
  TrendingDown,
  Gift,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import type { JobOffer } from '../../types';
import type { ParsedJobDescription } from '../../lib/jdParser';
import {
  BENEFIT_ASSUMPTIONS,
  DEFAULT_MOBILITY_PREFERENCES,
  benefitSourcesFromOffer,
  buildAdvisorNote,
  buildNegotiationTactics,
  calculateFeasibility,
  canShowFeasibilityResult,
  compareOfferWithAnother,
  detectBenefits,
  effectiveOfficeDays,
  type ContractType,
  type MobilityPreferences,
  type WorkMode,
} from '../../lib/commuteCalculator';
import { BADGE_ICONS } from '../../components/icons/HandDrawnBadges';
import { BenefitBadgeCard } from '../../components/benefits/BenefitBadgeCard';
import { Slider } from '../../components/ui/Slider';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../store/useToastStore';
import { useApplications } from '../../store/useApplications';
import { ReachableRangeMap } from '../../components/mobility/ReachableRangeMap';
import {
  fetchRouteMobility,
  fetchReachableRange,
  type RouteCalculationResult,
  type ReachableRangeResult,
} from '../../lib/mobilityClient';

export interface JobFeasibilityAdvisorProps {
  offer: JobOffer;
  parsed?: ParsedJobDescription | null;
  preferences?: MobilityPreferences;
  onPreferencesChange: (next: MobilityPreferences) => void;
  className?: string;
}

const WORK_MODES: Array<{ id: WorkMode; label: string; hint: string }> = [
  { id: 'REMOTE', label: 'Zdalna', hint: '0 dni w biurze' },
  { id: 'HYBRID', label: 'Hybrydowa', hint: 'wybierz liczbę dni' },
  { id: 'ONSITE', label: 'Stacjonarna', hint: '5 dni w biurze' },
];

const CONTRACTS: Array<{ id: ContractType; label: string; hint: string }> = [
  { id: 'UOP', label: 'UoP — brutto', hint: 'Przeliczymy na rękę' },
  { id: 'B2B', label: 'B2B — na rękę', hint: 'Kwota, która Ci zostaje' },
];

const zl = (value: number) => `${Math.round(value).toLocaleString('pl-PL')} zł`;

export const JobFeasibilityAdvisor: React.FC<JobFeasibilityAdvisorProps> = ({
  offer,
  parsed,
  preferences,
  onPreferencesChange,
  className = '',
}) => {
  const prefs = preferences ?? DEFAULT_MOBILITY_PREFERENCES;
  const { applications } = useApplications();
  const [assumptionsConfirmed, setAssumptionsConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<'MAP' | 'TACTICS' | 'COMPARE' | 'BENEFITS'>('MAP');
  const [copiedTacticId, setCopiedTacticId] = useState<string | null>(null);

  // Stan asynchroniczny Azure Maps
  const [routeResult, setRouteResult] = useState<RouteCalculationResult | null>(null);
  const [rangeResult, setRangeResult] = useState<ReachableRangeResult | null>(null);
  const [isLoadingMobility, setIsLoadingMobility] = useState(false);

  const homeCity = prefs.homeCity || 'Moja lokalizacja';
  const officeCity = prefs.officeCity || offer.location || 'Lokalizacja pracy';

  const benefits = useMemo(
    () => detectBenefits(benefitSourcesFromOffer(offer, parsed)),
    [offer, parsed]
  );

  const result = useMemo(
    () =>
      canShowFeasibilityResult(prefs, assumptionsConfirmed)
        ? calculateFeasibility(prefs, benefits)
        : null,
    [prefs, benefits, assumptionsConfirmed]
  );

  const note = useMemo(() => (result ? buildAdvisorNote(result, prefs) : null), [result, prefs]);
  const tactics = useMemo(
    () => (result ? buildNegotiationTactics(result, prefs) : []),
    [result, prefs]
  );

  const patch = (changes: Partial<MobilityPreferences>) =>
    onPreferencesChange({ ...prefs, ...changes });

  const officeDays = effectiveOfficeDays(prefs);
  const engineType = prefs.vehicleEngineType || 'combustion';
  const isPeak = prefs.trafficMode !== 'smooth';

  // Pobieranie danych z Azure Maps (lub fallbacku) po zmianie parametrów dojazdu
  useEffect(() => {
    let isCancelled = false;

    async function loadAzureMobility() {
      if (prefs.workMode === 'REMOTE' || officeDays === 0) return;
      setIsLoadingMobility(true);
      try {
        const [route, range] = await Promise.all([
          fetchRouteMobility({
            origin: homeCity,
            destination: officeCity,
            engineType,
            trafficMode: isPeak ? 'peak' : 'smooth',
          }).catch(() => null),
          fetchReachableRange({
            centerCity: homeCity,
            timeBudgetMinutes: (prefs.oneWayMinutes <= 35 ? 30 : prefs.oneWayMinutes <= 50 ? 45 : 60) as 30 | 45 | 60,
            trafficMode: isPeak ? 'peak' : 'smooth',
          }).catch(() => null),
        ]);

        if (!isCancelled) {
          if (route) {
            setRouteResult(route);
            // Jeśli użytkownik nie wpisał własnego kosztu, podpowiedz wyliczony przez model
            if (prefs.monthlyCommuteCost === 300 && route.energyConsumption.costMonthlyPln > 0) {
              patch({ monthlyCommuteCost: route.energyConsumption.costMonthlyPln });
            }
          }
          if (range) {
            setRangeResult(range);
          }
        }
      } finally {
        if (!isCancelled) setIsLoadingMobility(false);
      }
    }

    const timer = setTimeout(loadAzureMobility, 300);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [homeCity, officeCity, engineType, isPeak, prefs.oneWayMinutes, prefs.workMode, officeDays]);

  const handleCopyTactic = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTacticId(id);
    showToast('Skopiowano taktykę do schowka', {
      message: 'Możesz wkleić ten argument podczas rozmowy lub odpisywania rekruterowi.',
      variant: 'success',
    });
    setTimeout(() => setCopiedTacticId(null), 2500);
  };

  // Porównanie z inną aplikacją z Trackera
  const comparisonOptions = useMemo(() => {
    return applications
      .filter((app) => app.company && app.company.toLowerCase() !== (offer.company || '').toLowerCase())
      .slice(0, 3);
  }, [applications, offer.company]);

  const [selectedCompareAppId, setSelectedCompareAppId] = useState<string | null>(null);
  const comparisonSummary = useMemo(() => {
    if (!result || comparisonOptions.length === 0) return null;
    const target = comparisonOptions.find((a) => a.id === selectedCompareAppId) || comparisonOptions[0];
    if (!target) return null;

    // Przeliczenie uproszczone dla innej oferty
    const numericSalary = parseInt(target.salary?.replace(/\D/g, '') || '8000', 10) || 8000;
    return compareOfferWithAnother(result, {
      company: target.company,
      role: target.position,
      salaryNet: Math.round(numericSalary * 0.72),
      commuteMinutes: 25,
      officeDays: 3,
      commuteCost: 260,
    });
  }, [result, comparisonOptions, selectedCompareAppId]);

  return (
    <section
      aria-label="Kalkulator opłacalności oferty Mobility Intelligence"
      className={`space-y-4 rounded-3xl border border-line bg-surface/90 p-5 shadow-card-glass backdrop-blur-xl sm:p-6 ${className}`}
    >
      {/* ========================================================================= */}
      {/* 1. HERO CARD: Główna Karta Realnej Stawki (Zero Clutteru)               */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl border border-[#155EEF]/20 bg-gradient-to-br from-[#155EEF]/5 via-surface to-surface-raised p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#155EEF]/30 bg-[#155EEF]/10 px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-[#155EEF]">
                <Sparkles className="h-3 w-3" /> Mobility Intelligence
              </span>
              {routeResult?.source === 'azure_maps' && (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  Azure Maps API Active
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink sm:text-2xl m-0">
              Twoja realna stawka za godzinę życia
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
              Pieniądze z umowy pomniejszone o koszty paliwa/biletów, podzielone przez czas pracy
              i godziny spędzone w drodze.
            </p>
          </div>

          {/* Duża liczba z wynikiem */}
          <div className="flex flex-col items-start sm:items-end justify-center rounded-2xl border border-line/60 bg-surface/80 px-6 py-4 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Realna stawka na rękę
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-3xl sm:text-4xl font-black text-ink">
                {result ? `${result.realHourlyRate.toFixed(2)}` : '—'}
              </span>
              <span className="font-bold text-xs text-muted">zł / h</span>
            </div>
            {result && result.nominalHourlyRate > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-500">
                <TrendingDown className="h-3 w-3" />
                −{result.hourlyRateLoss.toFixed(2)} zł/h ({Math.round((result.hourlyRateLoss / result.nominalHourlyRate) * 100)}% mniej niż na umowie)
              </span>
            )}
          </div>
        </div>

        {/* 3 Kapsułki Metryk */}
        {result && (
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-3 text-xs">
              <div className="rounded-lg bg-[#155EEF]/10 p-2 text-[#155EEF]">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <span className="block font-bold text-ink">
                  {result.commuteHours.toFixed(0)} h w drodze / msc
                </span>
                <span className="text-[10px] text-muted">
                  równowartość {result.commuteWorkdays.toFixed(1)} dnia roboczego w korkach
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-3 text-xs">
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
                <Car className="h-4 w-4" />
              </div>
              <div>
                <span className="block font-bold text-ink">
                  {zl(result.commuteCost)} transport / msc
                </span>
                <span className="text-[10px] text-muted">
                  {engineType === 'electric' ? 'energia elektryczna EV' : engineType === 'transit' ? 'bilety okresowe' : 'paliwo i eksploatacja'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-3 text-xs">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                <Gift className="h-4 w-4" />
              </div>
              <div>
                <span className="block font-bold text-ink">
                  +{zl(result.benefitValue)} pakiet socjalny
                </span>
                <span className="text-[10px] text-muted">
                  wycena wykrytych benefitów (sport, opieka medyczna)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. FORMULARZ ZAŁOŻEŃ: Wynagrodzenie, Umowa, Tryb                          */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-line bg-sunken/40 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-ink">Parametry zatrudnienia i dojazdu</span>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={assumptionsConfirmed}
              onChange={(e) => setAssumptionsConfirmed(e.target.checked)}
              className="accent-[#155EEF] rounded"
            />
            <span>Zatwierdzam parametry (pokaż wynik)</span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="feasibility-salary-input" className="mb-1 block text-xs font-bold text-ink">
              Wynagrodzenie miesięcznie
            </label>
            <input
              id="feasibility-salary-input"
              type="number"
              min={0}
              step={100}
              value={prefs.salaryAmount || ''}
              onChange={(e) => patch({ salaryAmount: Number(e.target.value) || 0 })}
              placeholder={offer.salary || 'np. 9500'}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
            />
          </div>

          <fieldset>
            <legend className="mb-1 text-xs font-bold text-ink">Forma zatrudnienia</legend>
            <div className="flex gap-1.5">
              {CONTRACTS.map((contract) => (
                <button
                  key={contract.id}
                  type="button"
                  onClick={() => patch({ contract: contract.id })}
                  className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-bold transition-all ${
                    prefs.contract === contract.id
                      ? 'border-[#155EEF] bg-[#155EEF]/10 text-ink'
                      : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  {contract.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-xs font-bold text-ink">Tryb pracy</legend>
            <div className="flex gap-1.5">
              {WORK_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => patch({ workMode: mode.id })}
                  className={`flex-1 rounded-xl border px-1.5 py-1.5 text-xs font-bold transition-all ${
                    prefs.workMode === mode.id
                      ? 'border-[#155EEF] bg-[#155EEF]/10 text-ink'
                      : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink">Środek transportu</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => patch({ vehicleEngineType: 'combustion' })}
                className={`flex-1 flex items-center justify-center gap-1 rounded-xl border py-1.5 text-xs font-bold transition-all ${
                  engineType === 'combustion'
                    ? 'border-[#155EEF] bg-[#155EEF]/10 text-ink'
                    : 'border-line text-muted hover:text-ink'
                }`}
                title="Pojazd spalinowy (PB/ON)"
              >
                <Car className="h-3.5 w-3.5" /> Auto
              </button>
              <button
                type="button"
                onClick={() => patch({ vehicleEngineType: 'electric' })}
                className={`flex-1 flex items-center justify-center gap-1 rounded-xl border py-1.5 text-xs font-bold transition-all ${
                  engineType === 'electric'
                    ? 'border-[#155EEF] bg-[#155EEF]/10 text-ink'
                    : 'border-line text-muted hover:text-ink'
                }`}
                title="Pojazd elektryczny (EV)"
              >
                <Zap className="h-3.5 w-3.5" /> EV
              </button>
              <button
                type="button"
                onClick={() => patch({ vehicleEngineType: 'transit' })}
                className={`flex-1 flex items-center justify-center gap-1 rounded-xl border py-1.5 text-xs font-bold transition-all ${
                  engineType === 'transit'
                    ? 'border-[#155EEF] bg-[#155EEF]/10 text-ink'
                    : 'border-line text-muted hover:text-ink'
                }`}
                title="Transport zbiorowy / kolej"
              >
                <Train className="h-3.5 w-3.5" /> Pociąg
              </button>
            </div>
          </div>
        </div>

        {prefs.workMode === 'HYBRID' && (
          <Slider
            label="Dni w biurze w tygodniu"
            unit="dni"
            min={1}
            max={5}
            value={prefs.officeDaysPerWeek}
            onChange={(officeDaysPerWeek) => patch({ officeDaysPerWeek })}
          />
        )}

        {officeDays > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <Slider
              label="Dojazd w jedną stronę"
              unit="min"
              min={10}
              max={90}
              step={5}
              value={prefs.oneWayMinutes}
              onChange={(oneWayMinutes) => patch({ oneWayMinutes })}
            />
            <Slider
              label="Koszt miesięczny transportu"
              unit="zł"
              min={0}
              max={1000}
              step={50}
              value={prefs.monthlyCommuteCost}
              onChange={(monthlyCommuteCost) => patch({ monthlyCommuteCost })}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. ROZWIJANA ANALITYKA Z AZURE (3 SPÓJNE ZAKŁADKI)                        */}
      {/* ========================================================================= */}
      {officeDays > 0 && (
        <div className="space-y-3">
          {/* Przełącznik zakładek (Segmented Controls) */}
          <div className="flex rounded-xl bg-sunken p-1 border border-line text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('MAP')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
                activeTab === 'MAP'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Compass className="h-3.5 w-3.5 text-[#155EEF]" />
              <span>🗺️ Zasięg i Korki (Azure Maps)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('TACTICS')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
                activeTab === 'TACTICS'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <span>💡 Taktyka Negocjacyjna</span>
            </button>

            {comparisonOptions.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('COMPARE')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
                  activeTab === 'COMPARE'
                    ? 'bg-surface text-ink shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Scale className="h-3.5 w-3.5 text-indigo-500" />
                <span>⚖️ Porównaj z inną ofertą</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('BENEFITS')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
                activeTab === 'BENEFITS'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Gift className="h-3.5 w-3.5 text-emerald-500" />
              <span>🎁 Benefity ({benefits.filter((b) => b.status === 'PROVIDED').length})</span>
            </button>
          </div>

          {/* Zawartość Zakładki 1: MAPA IZOCHRONICZNA & KORKI */}
          {activeTab === 'MAP' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">
                  Trasa: <strong>{homeCity}</strong> → <strong>{officeCity}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => patch({ trafficMode: isPeak ? 'smooth' : 'peak' })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-sunken"
                >
                  <span>Warunki:</span>
                  <span className={isPeak ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
                    {isPeak ? 'Poranny szczyt (07:45)' : 'Płynny przejazd'}
                  </span>
                </button>
              </div>

              <ReachableRangeMap
                rangeData={rangeResult}
                routeData={routeResult}
                originName={homeCity}
                destinationName={officeCity}
                timeBudget={(prefs.oneWayMinutes <= 35 ? 30 : prefs.oneWayMinutes <= 50 ? 45 : 60) as 30 | 45 | 60}
                isPeakTraffic={isPeak}
                engineType={engineType}
                isLoading={isLoadingMobility}
              />
            </div>
          )}

          {/* Zawartość Zakładki 2: TAKTYKA NEGOCJACYJNA */}
          {activeTab === 'TACTICS' && (
            <div className="space-y-3">
              {note && (
                <div className="rounded-xl border border-line bg-sunken/60 p-3.5 text-xs text-ink">
                  <p className="font-bold">{note.headline}</p>
                  <p className="mt-1 leading-relaxed text-muted">{note.body}</p>
                </div>
              )}

              <div className="space-y-2.5">
                <span className="text-xs font-bold text-ink">Gotowe skrypty na rozmowę:</span>
                {tactics.map((tactic) => (
                  <div key={tactic.id} className="rounded-2xl border border-line bg-surface p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-xs text-ink m-0">{tactic.title}</h4>
                        <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          {tactic.gainDescription}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={copiedTacticId === tactic.id ? Check : Copy}
                        onClick={() => handleCopyTactic(tactic.id, tactic.script)}
                        className="text-[11px]"
                      >
                        {copiedTacticId === tactic.id ? 'Skopiowano' : 'Kopiuj'}
                      </Button>
                    </div>
                    <blockquote className="rounded-xl border border-line/50 bg-sunken/40 p-3 font-serif text-xs italic leading-relaxed text-ink/90">
                      {tactic.script}
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zawartość Zakładki 3: PORÓWNYWARKA OFERT */}
          {activeTab === 'COMPARE' && comparisonSummary && (
            <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">Porównanie z inną aplikacją z Trackera:</span>
                <select
                  value={selectedCompareAppId || ''}
                  onChange={(e) => setSelectedCompareAppId(e.target.value)}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-mono text-ink"
                >
                  {comparisonOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.company} ({opt.position})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border border-[#155EEF]/30 bg-[#155EEF]/5 p-3">
                  <span className="block text-[11px] font-bold text-[#155EEF]">Bieżąca oferta</span>
                  <span className="font-mono text-2xl font-black text-ink">
                    {result?.realHourlyRate.toFixed(2)} zł/h
                  </span>
                  <span className="block text-[10px] text-muted">{offer.company}</span>
                </div>

                <div className="rounded-xl border border-line bg-sunken/60 p-3">
                  <span className="block text-[11px] font-bold text-muted">Inna oferta</span>
                  <span className="font-mono text-2xl font-black text-ink">
                    {comparisonSummary.otherRealHourlyRate.toFixed(2)} zł/h
                  </span>
                  <span className="block text-[10px] text-muted">{comparisonSummary.otherCompanyName}</span>
                </div>
              </div>

              <div className="rounded-xl bg-[#155EEF]/10 border border-[#155EEF]/20 p-3 text-xs leading-relaxed text-ink">
                <strong>Werdykt opłacalności:</strong> {comparisonSummary.verdictText}
              </div>
            </div>
          )}

          {/* Zawartość Zakładki 4: PAKIET BENEFITÓW */}
          {activeTab === 'BENEFITS' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink">Wykryte benefity w treści ogłoszenia:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Łącznie: +{zl(result?.benefitValue || 0)}/msc
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {benefits.map((b) => (
                  <BenefitBadgeCard
                    key={b.key}
                    label={b.label}
                    value={b.monthlyValue ? `${b.monthlyValue} zł/msc` : 'w pakiecie'}
                    hint={b.basis}
                    provided={b.status === 'PROVIDED'}
                    brandKey={b.brandKey}
                    icon={BADGE_ICONS[b.key as keyof typeof BADGE_ICONS] || BADGE_ICONS.EQUIPMENT}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
