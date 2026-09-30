/**
 * MatchOverview11 — Główny widok analizy dopasowania 11/10.
 *
 * Realizuje filozofię „Zero bullshit AI” oraz docelowy WOW moment:
 * 1. Wynik z natychmiastową interpretacją słowną i wskaźnikiem wiarygodności (confidence).
 * 2. Blok WOW: „Znaleźliśmy X rzeczy, które już potrafisz, ale których nie pokazuje obecne CV”.
 * 3. Rachunek dowodowy: Masz (✓), Warto podkreślić (◐), Brakuje (×) z rozwinięciem „Dlaczego?”.
 * 4. Pojedyncze, cofane akcje [ Zastosuj ] [ Pomiń ].
 */

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Plus,
  Check,
  Info,
  FileText,
  Briefcase,
} from 'lucide-react';
import type { MasterVault, JobOffer, AtsCheckResult, TailoredResume } from '../../types';
import type { CanonicalAtsScore } from '../../lib/canonicalAts';
import {
  mapJdKeywords,
  ExtractedKeyword,
  KeywordSuggestion,
  KeywordMatchStatus,
} from '../../lib/jdKeywordMapper';
import { measureVaultCompleteness } from '../../lib/vaultCompleteness';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../store/useToastStore';

export interface MatchOverview11Props {
  vault: MasterVault;
  jobOffer: JobOffer;
  atsResult: AtsCheckResult;
  canonicalResult?: CanonicalAtsScore;
  tailoredResume: TailoredResume;
  onApplySuggestion?: (suggestion: KeywordSuggestion) => void;
  onGoToCv?: () => void;
  onSaveApplication?: () => void;
  className?: string;
}

export const MatchOverview11: React.FC<MatchOverview11Props> = ({
  vault,
  jobOffer,
  atsResult,
  canonicalResult,
  tailoredResume,
  onApplySuggestion,
  onGoToCv,
  onSaveApplication,
  className = '',
}) => {
  // Stan rozwinięcia dowodów „Dlaczego?” per słowo kluczowe
  const [expandedKeywordId, setExpandedKeywordId] = useState<string | null>(null);
  // Lista pominiętych lub zastosowanych sugestii (lokalny stan widoku)
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<Set<string>>(new Set());
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(new Set());

  // 1. Dokładna analiza słów kluczowych i ukrytych kompetencji w MasterVault
  const mappingResult = useMemo(() => {
    return mapJdKeywords(jobOffer.description || '', vault, tailoredResume);
  }, [jobOffer.description, vault, tailoredResume]);

  const { keywords, suggestions, counts } = mappingResult;

  // 2. Wynik dopasowania i wiarygodność danych
  const score = canonicalResult?.score ?? atsResult.overallScore;
  const matchedRequirements = canonicalResult?.matchedRequirements?.length ?? counts.matchedInCv ?? 8;
  const totalRequirements = canonicalResult
    ? (canonicalResult.matchedRequirements.length + canonicalResult.missingRequirements.length)
    : (counts.total ?? 10);

  // Jakość profilu użytkownika
  const vaultCompleteness = useMemo(() => {
    return measureVaultCompleteness(vault).percent;
  }, [vault]);

  const confidenceLevel = vaultCompleteness >= 80 ? 'wysoka' : vaultCompleteness >= 50 ? 'średnia' : 'wstępna';

  // 3. Spójna interpretacja biznesowa procentu
  const interpretationText = useMemo(() => {
    const mainGap = canonicalResult?.missingRequirements?.[0] || keywords.find((k) => k.status === 'MISSING_IN_VAULT')?.term;
    if (score >= 85) {
      return mainGap
        ? `Możesz śmiało aplikować bez dużych zmian. Największą luką do zaadresowania jest ${mainGap}.`
        : 'Świetne dopasowanie! Twój profil pokrywa kluczowe wymagania pracodawcy.';
    }
    if (score >= 70) {
      return mainGap
        ? `Dobre dopasowanie. Warto przed wysłaniem podkreślić w CV doświadczenie z: ${mainGap}.`
        : 'Dobre dopasowanie. Zastosuj poniższe sugestie, aby zwiększyć szanse na rozmowę.';
    }
    return mainGap
      ? `Widoczne luki w wymaganiach formalnych (np. ${mainGap}). Rozważ most kompetencyjny lub uzupełnienie profilu.`
      : 'Uzupełnij profil o brakujące technologie lub uprawnienia przed wysłaniem CV.';
  }, [score, canonicalResult, keywords]);

  // 4. Filtrowanie aktywnych sugestii WOW (niepominiętych)
  const activeSuggestions = useMemo(() => {
    return suggestions.filter((s) => !dismissedSuggestionIds.has(s.id));
  }, [suggestions, dismissedSuggestionIds]);

  // Grupowanie słów kluczowych do 3 sekcji
  const matchedKeywords = useMemo(() => keywords.filter((k) => k.status === 'MATCHED_IN_CV'), [keywords]);
  const hiddenInVaultKeywords = useMemo(() => keywords.filter((k) => k.status === 'IN_VAULT_NOT_IN_CV'), [keywords]);
  const missingKeywords = useMemo(() => keywords.filter((k) => k.status === 'MISSING_IN_VAULT'), [keywords]);

  const handleApply = (sug: KeywordSuggestion) => {
    setAppliedSuggestionIds((prev) => new Set(prev).add(sug.id));
    if (onApplySuggestion) {
      onApplySuggestion(sug);
    }
    showToast('Zastosowano sugestię w dokumencie', {
      message: `Dodano „${sug.keyword}” do CV.`,
      variant: 'success',
    });
  };

  const handleDismiss = (id: string) => {
    setDismissedSuggestionIds((prev) => new Set(prev).add(id));
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* ---------------------------------- NAGŁÓWEK DOPASOWANIA I INTERPRETACJA */}
      <Card tone="raised" className="p-6 sm:p-8 space-y-6 border border-line shadow-raised">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-b border-line pb-6">
          <div className="space-y-1.5">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
              Ocena zgodności profilu z ofertą
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl sm:text-6xl font-extrabold font-mono tracking-tight text-brand-fg">
                {score}%
              </span>
              <div className="space-y-0.5">
                <span className="text-lg font-bold text-ink block">
                  {score >= 80 ? 'Dobre dopasowanie' : score >= 60 ? 'Umiarkowane dopasowanie' : 'Wymaga uzupełnienia'}
                </span>
                <span className="text-xs text-muted font-medium">
                  {matchedRequirements} / {totalRequirements} wymagań znajduje potwierdzenie w Twoim profilu
                </span>
              </div>
            </div>
          </div>

          {/* Jakość danych & pewność */}
          <div className="rounded-xl border border-line bg-surface p-4 text-xs space-y-2 min-w-[200px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted font-medium">Twój profil:</span>
              <span className="font-mono font-bold text-ink">{vaultCompleteness}% kompletny</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted font-medium">Pewność analizy:</span>
              <span className={`font-bold capitalize ${
                confidenceLevel === 'wysoka' ? 'text-success-fg' : 'text-warning-fg'
              }`}>
                {confidenceLevel}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${vaultCompleteness}%` }}
              />
            </div>
          </div>
        </div>

        {/* Interpretacja słowna zamiast suchej liczby */}
        <div className="rounded-xl border border-line bg-surface-raised p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed text-ink font-medium">
            {interpretationText}
          </p>
        </div>
      </Card>

      {/* ---------------------------------- BLOK WOW: UKRYTE KOMPETENCJE W MASTERVAULT */}
      {activeSuggestions.length > 0 && (
        <Card tone="raised" className="relative overflow-hidden border-brand-500/40 p-6 sm:p-8 space-y-5 bg-gradient-to-br from-brand-500/[0.04] to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-fg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-ink sm:text-xl">
                Odkryliśmy {activeSuggestions.length} {activeSuggestions.length === 1 ? 'rzecz' : activeSuggestions.length < 5 ? 'rzeczy' : 'rzeczy'}, które już potrafisz!
              </h3>
              <p className="text-xs text-muted font-medium">
                Masz te umiejętności w swoim profilu, ale Twoje obecne CV ich nie eksponuje.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {activeSuggestions.map((sug) => {
              const isApplied = appliedSuggestionIds.has(sug.id);

              return (
                <div
                  key={sug.id}
                  className="rounded-xl border border-line bg-surface p-4 transition-all duration-150 hover:border-brand-500/30 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-fg">
                        {sug.keyword}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-50 text-brand-fg border border-brand-200">
                        w Twoim profilu
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isApplied ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-success-fg">
                          <Check className="h-3.5 w-3.5" />
                          Zastosowano
                        </span>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismiss(sug.id)}
                            className="text-xs text-muted hover:text-ink cursor-pointer"
                          >
                            Pomiń
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            icon={Plus}
                            onClick={() => handleApply(sug)}
                            className="font-bold cursor-pointer"
                          >
                            Zastosuj w CV
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-ink-muted">
                    {sug.message}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ---------------------------------- RACHUNEK DOWODOWY: MASZ / WARTO PODKREŚLIĆ / BRAKUJE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
            Rachunek wymagań i dowodów (Zero bullshit AI)
          </h3>
          <span className="text-[11px] text-muted">
            Kliknij pozycję, aby zobaczyć źródło
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. MASZ (✓) */}
          <Card tone="flat" className="p-4 space-y-3 border border-success/30 bg-success-soft/20">
            <div className="flex items-center justify-between border-b border-success/20 pb-2">
              <span className="text-xs font-bold text-success-fg uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                Masz w CV ({matchedKeywords.length})
              </span>
            </div>

            <div className="space-y-2">
              {matchedKeywords.length === 0 ? (
                <p className="text-xs text-muted">Brak bezpośrednich dopasowań.</p>
              ) : (
                matchedKeywords.map((kw) => {
                  const isExpanded = expandedKeywordId === kw.id;
                  return (
                    <div
                      key={kw.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedKeywordId(isExpanded ? null : kw.id)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpandedKeywordId(isExpanded ? null : kw.id)}
                      className="cursor-pointer rounded-lg border border-line bg-surface p-2.5 text-xs transition-colors hover:border-success/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">{kw.term}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
                      </div>

                      {isExpanded && (
                        <div className="pt-2 border-t border-line/60 space-y-1.5 text-[11px] text-ink-muted">
                          <p><strong className="text-ink">Oferta:</strong> Wymagana fraza kluczowa ({kw.occurrencesInJd} wystąpień w ogłoszeniu)</p>
                          <p><strong className="text-ink">Twoje CV:</strong> Potwierdzone w: {kw.foundInCvLocations?.join(', ') || 'Treść dokumentu'}</p>
                          <p className="text-success-fg font-semibold">Wniosek: potwierdzone</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* 2. WARTO PODKREŚLIĆ (◐) */}
          <Card tone="flat" className="p-4 space-y-3 border border-brand-500/30 bg-brand-500/[0.04]">
            <div className="flex items-center justify-between border-b border-brand-500/20 pb-2">
              <span className="text-xs font-bold text-brand-fg uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-brand-fg shrink-0" />
                W profilu, brak w CV ({hiddenInVaultKeywords.length})
              </span>
            </div>

            <div className="space-y-2">
              {hiddenInVaultKeywords.length === 0 ? (
                <p className="text-xs text-muted">Brak ukrytych kompetencji.</p>
              ) : (
                hiddenInVaultKeywords.map((kw) => {
                  const isExpanded = expandedKeywordId === kw.id;
                  return (
                    <div
                      key={kw.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedKeywordId(isExpanded ? null : kw.id)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpandedKeywordId(isExpanded ? null : kw.id)}
                      className="cursor-pointer rounded-lg border border-line bg-surface p-2.5 text-xs transition-colors hover:border-brand-500/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">{kw.term}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
                      </div>

                      {isExpanded && (
                        <div className="pt-2 border-t border-line/60 space-y-1.5 text-[11px] text-ink-muted">
                          <p><strong className="text-ink">Oferta:</strong> Wymóg ogłoszenia</p>
                          <p><strong className="text-ink">Twój profil:</strong> Odnaleziono w: {kw.foundInVaultLocations.join(', ')}</p>
                          <p className="text-brand-fg font-semibold">Wniosek: częściowe potwierdzenie — warto dodać do CV</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* 3. BRAKUJE (×) */}
          <Card tone="flat" className="p-4 space-y-3 border border-danger/30 bg-danger-soft/20">
            <div className="flex items-center justify-between border-b border-danger/20 pb-2">
              <span className="text-xs font-bold text-danger-fg uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-danger shrink-0" />
                Brakuje ({missingKeywords.length})
              </span>
            </div>

            <div className="space-y-2">
              {missingKeywords.length === 0 ? (
                <p className="text-xs text-muted">Brak zidentyfikowanych braków.</p>
              ) : (
                missingKeywords.map((kw) => {
                  const isExpanded = expandedKeywordId === kw.id;
                  return (
                    <div
                      key={kw.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedKeywordId(isExpanded ? null : kw.id)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpandedKeywordId(isExpanded ? null : kw.id)}
                      className="cursor-pointer rounded-lg border border-line bg-surface p-2.5 text-xs transition-colors hover:border-danger/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">{kw.term}</span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
                      </div>

                      {isExpanded && (
                        <div className="pt-2 border-t border-line/60 space-y-1.5 text-[11px] text-ink-muted">
                          <p><strong className="text-ink">Oferta:</strong> Wymóg formalny ({kw.importance === 'CRITICAL' ? 'krytyczny' : 'istotny'})</p>
                          <p><strong className="text-ink">Twój profil:</strong> Brak wzmianki w MasterVault</p>
                          <p className="text-danger-fg font-semibold">Wniosek: brak potwierdzenia — przygotuj odpowiedź lub uzupełnij profil</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ---------------------------------- PRZYCISKI AKCJI KOŃCOWEJ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-line">
        <div className="flex items-center gap-2">
          {onGoToCv && (
            <Button
              type="button"
              variant="primary"
              size="md"
              icon={FileText}
              onClick={onGoToCv}
              className="font-bold cursor-pointer"
            >
              Przejdź do Generatora CV →
            </Button>
          )}

          {onSaveApplication && (
            <Button
              type="button"
              variant="outline"
              size="md"
              icon={Briefcase}
              onClick={onSaveApplication}
              className="font-semibold cursor-pointer"
            >
              Zapisz w moich aplikacjach
            </Button>
          )}
        </div>

        <p className="text-xs text-muted">
          Wszystkie analizy są oparte wyłącznie na Twoich rzeczywistych wpisach.
        </p>
      </div>
    </div>
  );
};

export default MatchOverview11;
