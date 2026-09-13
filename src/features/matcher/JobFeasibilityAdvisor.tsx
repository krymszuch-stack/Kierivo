import React, { useMemo } from 'react';
import type { JobOffer } from '../../types';
import type { ParsedJobDescription } from '../../lib/jdParser';
import {
  BENEFIT_ASSUMPTIONS,
  DEFAULT_MOBILITY_PREFERENCES,
  benefitSourcesFromOffer,
  buildAdvisorNote,
  calculateFeasibility,
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

/**
 * Kalkulator opłacalności oferty — doradca, nie recenzent.
 *
 * Komponent jest celowo cienki: liczby pochodzą w całości z
 * `src/lib/commuteCalculator.ts`, żeby dało się je przetestować bez DOM-u
 * (`AGENTS.md`). Tutaj zostaje układ, formularz i język.
 *
 * Konsekwentnie oznaczamy, co jest pomiarem, a co założeniem. Wycena pakietu
 * socjalnego to szacunek kalkulatora i tak jest podpisana — inaczej byłaby
 * liczbą udającą fakt.
 */

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

  const benefits = useMemo(
    () => detectBenefits(benefitSourcesFromOffer(offer, parsed)),
    [offer, parsed]
  );
  const result = useMemo(() => calculateFeasibility(prefs, benefits), [prefs, benefits]);
  const note = useMemo(() => (result ? buildAdvisorNote(result, prefs) : null), [result, prefs]);

  const patch = (changes: Partial<MobilityPreferences>) =>
    onPreferencesChange({ ...prefs, ...changes });

  const officeDays = effectiveOfficeDays(prefs);

  return (
    <section
      aria-label="Kalkulator opłacalności oferty"
      className={`rounded-2xl border border-line bg-surface/80 p-5 backdrop-blur ${className}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#155EEF]">
            Kalkulator opłacalności
          </p>
          <h2 className="text-lg font-black tracking-tight text-ink">
            Ile naprawdę zostaje z tej oferty
          </h2>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">
            Liczymy stawkę za godzinę Twojego życia, nie za godzinę na umowie. Wszystko dzieje się
            w Twojej przeglądarce — żadna z tych liczb nigdzie nie wychodzi.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------------- Karta 1: bilans czasu i dojazdu ---------------- */}
        <div className="space-y-4 rounded-2xl border border-line bg-sunken/60 p-4 lg:col-span-2">
          <h3 className="text-sm font-bold text-ink">Bilans czasu i dojazdów</h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="feasibility-salary"
                className="mb-1 block text-xs font-bold text-ink"
              >
                Wynagrodzenie miesięcznie
              </label>
              <input
                id="feasibility-salary"
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                value={prefs.salaryAmount || ''}
                onChange={(event) => patch({ salaryAmount: Number(event.target.value) || 0 })}
                placeholder={offer.salary || 'np. 10000'}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
              />
              {offer.salary && (
                <p className="mt-1 truncate font-mono text-[10px] text-subtle">
                  Z ogłoszenia: {offer.salary}
                </p>
              )}
            </div>

            <fieldset>
              <legend className="mb-1 text-xs font-bold text-ink">Forma zatrudnienia</legend>
              <div className="flex gap-2">
                {CONTRACTS.map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    aria-pressed={prefs.contract === contract.id}
                    onClick={() => patch({ contract: contract.id })}
                    className={`min-h-[2.5rem] flex-1 cursor-pointer rounded-xl border px-2 py-1.5 text-xs font-bold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                      prefs.contract === contract.id
                        ? 'border-[#155EEF] bg-[#155EEF]/10 text-ink'
                        : 'border-line text-muted hover:text-ink'
                    }`}
                  >
                    <span className="block truncate">{contract.label}</span>
                    <span className="block truncate font-mono text-[10px] font-normal text-subtle">
                      {contract.hint}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset>
            <legend className="mb-1 text-xs font-bold text-ink">Tryb pracy</legend>
            <div className="grid grid-cols-3 gap-2">
              {WORK_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={prefs.workMode === mode.id}
                  onClick={() => patch({ workMode: mode.id })}
                  className={`min-h-[2.5rem] cursor-pointer rounded-xl border px-2 py-1.5 text-xs font-bold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                    prefs.workMode === mode.id
                      ? 'border-[#155EEF] bg-[#155EEF]/10 text-ink'
                      : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  <span className="block truncate">{mode.label}</span>
                  <span className="block truncate font-mono text-[10px] font-normal text-subtle">
                    {mode.hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

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
            <>
              <Slider
                label="Dojazd w jedną stronę"
                unit="min"
                min={10}
                max={90}
                step={5}
                value={prefs.oneWayMinutes}
                onChange={(oneWayMinutes) => patch({ oneWayMinutes })}
              />

              {/* Rysowana trasa: dom → biuro. Punkt „w drodze" przesuwa się
                  razem z suwakiem, żeby czas przestał być abstrakcją. */}
              <div className="relative h-8" aria-hidden="true">
                <svg viewBox="0 0 300 32" className="h-8 w-full text-line" fill="none">
                  <path
                    d="M10 22c40-12 80 10 120-2s100 8 160-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="4 5"
                    strokeLinecap="round"
                  />
                  <circle cx="10" cy="22" r="4" fill="#1E3A5F" />
                  <circle cx="290" cy="16" r="4" fill="#155EEF" />
                </svg>
                <span className="absolute left-0 top-0 font-mono text-[10px] text-subtle">dom</span>
                <span className="absolute right-0 top-0 font-mono text-[10px] text-subtle">biuro</span>
              </div>

              <Slider
                label="Koszt dojazdu miesięcznie"
                unit="zł"
                min={0}
                max={800}
                step={50}
                value={prefs.monthlyCommuteCost}
                onChange={(monthlyCommuteCost) => patch({ monthlyCommuteCost })}
              />
            </>
          )}

          {result && officeDays > 0 && (
            <p className="rounded-xl border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-ink">
              Spędzisz w drodze około{' '}
              <strong className="font-mono">{result.commuteHours.toFixed(0)} h</strong> miesięcznie —
              to równowartość {result.commuteWorkdays.toFixed(1)} dnia roboczego.
            </p>
          )}
        </div>

        {/* ---------------- Karta 2: realna stawka ---------------- */}
        <div className="rounded-2xl border border-line bg-sunken/60 p-4">
          <h3 className="text-sm font-bold text-ink">Na rękę za godzinę życia</h3>

          {result ? (
            <>
              <p className="mt-3 font-mono text-4xl font-black leading-none text-[#155EEF]">
                {result.realHourlyRate.toFixed(2)}
                <span className="ml-1 text-base font-bold text-muted">zł/h</span>
              </p>
              <p className="mt-1 font-mono text-xs text-subtle">
                zamiast pozornych {result.nominalHourlyRate.toFixed(2)} zł/h
              </p>

              <dl className="mt-4 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="truncate text-muted">Na rękę miesięcznie</dt>
                  <dd className="shrink-0 font-mono font-bold text-ink">{zl(result.netMonthly)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="truncate text-muted">Koszt dojazdu</dt>
                  <dd className="shrink-0 font-mono font-bold text-ink">−{zl(result.commuteCost)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="truncate text-muted">Wartość pakietu (szacunek)</dt>
                  <dd className="shrink-0 font-mono font-bold text-ink">+{zl(result.benefitValue)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line pt-1.5">
                  <dt className="truncate text-muted">Z pakietem</dt>
                  <dd className="shrink-0 font-mono font-bold text-ink">
                    {result.realHourlyRateWithBenefits.toFixed(2)} zł/h
                  </dd>
                </div>
              </dl>

              {prefs.contract === 'UOP' && (
                <p className="mt-3 text-[10px] leading-relaxed text-subtle">
                  Netto liczymy według skali 12%, podstawowych kosztów uzyskania i złożonego PIT-2.
                  Przy drugim progu lub PPK realna kwota będzie niższa.
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Podaj kwotę wynagrodzenia, a policzymy resztę. Bez niej nie zgadujemy — wolimy pustkę
              niż liczbę wziętą z powietrza.
            </p>
          )}
        </div>

        {/* ---------------- Karta 3: notatka doradcy ---------------- */}
        {note && (
          <div className="rounded-2xl border border-[#155EEF]/30 bg-[#155EEF]/5 p-4 lg:col-span-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#155EEF]">
              Okiem życzliwego doradcy
            </p>
            <h3 className="mt-1 text-sm font-black text-ink">{note.headline}</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink">{note.body}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{note.tactic}</p>
          </div>
        )}

        {/* ---------------- Karta 4: matryca benefitów ---------------- */}
        <div
          className={`rounded-2xl border border-line bg-sunken/60 p-4 ${note ? '' : 'lg:col-span-3'}`}
        >
          <h3 className="text-sm font-bold text-ink">Co firma daje od siebie</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-subtle">
            Rozpoznane w treści ogłoszenia. Wyceny to założenia kalkulatora — najedź, żeby zobaczyć
            skąd się biorą.
          </p>

          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Array.isArray(benefits) ? benefits : []).filter(Boolean).map((benefit) => {
              const Icon = BADGE_ICONS[benefit.key];
              const provided = benefit?.status === 'PROVIDED';
              const assumption = BENEFIT_ASSUMPTIONS.find((item) => item.key === benefit.key);

              return (
                <li key={benefit.key}>
                  <BenefitBadgeCard
                    icon={Icon}
                    benefitKey={benefit.key}
                    brandKey={benefit.brandKey}
                    label={benefit.label}
                    provided={provided}
                    value={
                      provided
                        ? benefit.monthlyValue !== null
                          ? `ok. ${benefit.monthlyValue} zł / mies.`
                          : 'wymagane w ofercie'
                        : 'do negocjacji'
                    }
                    hint={
                      provided
                        ? `Zapewnione przez firmę. ${benefit.basis}`
                        : `Brak w ofercie — do negocjacji. ${assumption?.basis ?? ''}`
                    }
                  />
                </li>
              );
            })}
          </ul>

          <div className="mt-3 rounded-lg border border-line/60 bg-surface/40 p-2.5 text-[9px] leading-relaxed text-subtle/80">
            <span className="font-semibold text-muted">Nota prawna:</span> Wszelkie znaki towarowe, logotypy oraz nazwy handlowe (m.in. MultiSport, PZU, Lux Med, Medicover, MyBenefit, Sodexo, Edenred, Enel-Med) należą do ich prawnych właścicieli i zostały użyte wyłącznie w celach informacyjno-identyfikacyjnych w kalkulatorze opłacalności.
          </div>
        </div>
      </div>
    </section>
  );
};
