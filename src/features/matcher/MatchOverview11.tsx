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
  ChevronDown,
  ChevronUp,
  Plus,
  Check,
  Info,
  FileText,
  Briefcase,
} from 'lucide-react';
import type { MasterVault, JobOffer, AtsCheckResult, TailoredResume } from '../../types';
import type { CanonicalAtsScore } from '../../lib/canonicalAts';
import { getCanonicalScoreBand, CANONICAL_SCORE_BAND_LABELS, getUnmetBlockingRequirements, hasCareerEvidence, isRequirementUnconfirmed } from '../../lib/canonicalAts';
import { getMatchInterpretation, hasLimitedMatchEvidence, shouldDisplayMappedEvidence } from '../../lib/matchInterpretation';
import {
  mapJdKeywords,
  KeywordSuggestion,
} from '../../lib/jdKeywordMapper';
import { measureVaultCompleteness } from '../../lib/vaultCompleteness';
import { parseJobDescriptionLocal } from '../../lib/jdParser';
import { hasPreferredRequirementMention } from '../../lib/jdOptionality';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../store/useToastStore';
import { dismissUnappliedSuggestion } from '../../lib/suggestionActions';
import { OfferFactsSummary } from './OfferFactsSummary';

export interface MatchOverview11Props {
  vault: MasterVault;
  jobOffer: JobOffer;
  atsResult: AtsCheckResult;
  canonicalResult?: CanonicalAtsScore;
  tailoredResume: TailoredResume;
  onApplySuggestion?: (suggestion: KeywordSuggestion, apply: boolean) => void;
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
  const [appliedSuggestions, setAppliedSuggestions] = useState<Map<string, KeywordSuggestion>>(new Map());
  const [proposalDrafts, setProposalDrafts] = useState<Map<string, string>>(new Map());

  // 1. Dokładna analiza słów kluczowych i ukrytych kompetencji w MasterVault
  const mappingResult = useMemo(() => {
    return mapJdKeywords(jobOffer.description || '', vault, tailoredResume);
  }, [jobOffer.description, vault, tailoredResume]);

  const { keywords, suggestions, counts } = mappingResult;
  const parsedOffer = useMemo(
    () => parseJobDescriptionLocal(jobOffer.description || ''),
    [jobOffer.description]
  );
  // Atuty są informacją z oferty, a nie brakami obowiązkowymi. Pokazujemy
  // oryginalne linie pracodawcy, zamiast przerabiać je na pozornie wymagane skille.
  const niceToHaveLines = useMemo(() => {
    const lines = parsedOffer.sourceSections?.niceToHave ?? [];
    const optionalTerms = [...(parsedOffer.niceToHaveHardSkills ?? []), ...(parsedOffer.niceToHaveSoftSkills ?? [])];
    const postfixOptionalLines = (parsedOffer.sourceSections?.required ?? []).filter((line) =>
      optionalTerms.some((term) => hasPreferredRequirementMention(line, term))
    );
    return Array.from(new Set([...lines, ...postfixOptionalLines].map((line) => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)));
  }, [parsedOffer]);
  const optionalSkillTerms = useMemo(
    () => new Set([
      ...(parsedOffer.niceToHaveHardSkills ?? []),
      ...(parsedOffer.niceToHaveSoftSkills ?? []),
    ].map((term) => term.toLocaleLowerCase('pl-PL'))),
    [parsedOffer]
  );
  const visibleKeywords = useMemo(
    () => shouldDisplayMappedEvidence(canonicalResult?.state)
      ? keywords.filter((keyword) =>
          !isRequirementUnconfirmed(canonicalResult, keyword.term) &&
          !optionalSkillTerms.has(keyword.term.toLocaleLowerCase('pl-PL'))
        )
      : [],
    [canonicalResult, keywords, optionalSkillTerms]
  );

  // 2. Wynik dopasowania i wiarygodność danych
  // Wyniku legacy nie pokazujemy, gdy kanon nie ma podstaw do oceny.
  const score = canonicalResult?.state === 'SCORABLE' ? canonicalResult.score : null;
  const matchedRequirements = canonicalResult?.matchedRequirements?.length ?? counts.matchedInCv;
  const totalRequirements = canonicalResult
    ? (canonicalResult.matchedRequirements.length + canonicalResult.missingRequirements.length + canonicalResult.unconfirmedRequirements.length)
    : counts.total;
  const blockingRequirements = useMemo(
    () => getUnmetBlockingRequirements(canonicalResult),
    [canonicalResult]
  );
  const unconfirmedRequirements = useMemo(
    () => canonicalResult?.unconfirmedRequirements ?? [],
    [canonicalResult]
  );
  // Jakość profilu użytkownika
  const vaultCompleteness = useMemo(() => {
    return measureVaultCompleteness(vault).percent;
  }, [vault]);
  const limitedMatchEvidence = hasLimitedMatchEvidence({
    profileCompleteness: vaultCompleteness,
    totalRequirementCount: totalRequirements,
    fitEvidenceAvailable: hasCareerEvidence(vault),
    blockingRequirements,
    unconfirmedRequirements,
  });


  // 4. Filtrowanie aktywnych sugestii WOW (niepominiętych)
  const activeSuggestions = useMemo(() => {
    const currentSuggestions = [...suggestions];
    for (const applied of appliedSuggestions.values()) {
      if (!currentSuggestions.some((suggestion) => suggestion.id === applied.id)) {
        currentSuggestions.push(applied);
      }
    }
    return (shouldDisplayMappedEvidence(canonicalResult?.state) ? currentSuggestions : []).filter((suggestion) =>
      !dismissedSuggestionIds.has(suggestion.id) &&
      (appliedSuggestions.has(suggestion.id) ||
        visibleKeywords.some((keyword) => keyword.status === 'IN_VAULT_NOT_IN_CV' && keyword.term === suggestion.keyword))
    );
  }, [suggestions, dismissedSuggestionIds, visibleKeywords, appliedSuggestions, canonicalResult?.state]);

  // Opis wyniku odnosi się tylko do luk i sugestii obecnych w tym widoku.
  const interpretationText = useMemo(() => {
    const mainGap = canonicalResult?.missingRequirements?.[0] || visibleKeywords.find((k) => k.status === 'MISSING_IN_VAULT')?.term;
    return getMatchInterpretation({
      score,
      reason: canonicalResult?.reason,
      mainGap,
      activeSuggestionCount: activeSuggestions.length,
      profileCompleteness: vaultCompleteness,
      matchedRequirementCount: matchedRequirements,
      totalRequirementCount: totalRequirements,
      fitEvidenceAvailable: hasCareerEvidence(vault),
      blockingRequirements,
      unconfirmedRequirements,
    });
  }, [score, canonicalResult, visibleKeywords, activeSuggestions.length, vaultCompleteness, matchedRequirements, totalRequirements, blockingRequirements, unconfirmedRequirements]);

  // Grupowanie słów kluczowych do 3 sekcji
  const matchedKeywords = useMemo(() => visibleKeywords.filter((k) => k.status === 'MATCHED_IN_CV'), [visibleKeywords]);
  const hiddenInVaultKeywords = useMemo(() => visibleKeywords.filter((k) => k.status === 'IN_VAULT_NOT_IN_CV'), [visibleKeywords]);
  const missingKeywords = useMemo(() => visibleKeywords.filter((keyword) =>
    keyword.status === 'MISSING_IN_VAULT' &&
    (!canonicalResult || canonicalResult.missingRequirements.some((requirement) =>
      requirement.toLocaleLowerCase('pl-PL') === keyword.term.toLocaleLowerCase('pl-PL')
    ))
  ), [canonicalResult, visibleKeywords]);

  const handleDismiss = (id: string) => {
    setDismissedSuggestionIds((prev) => dismissUnappliedSuggestion(prev, appliedSuggestions, id));
  };

  const handleSuggestionChange = (suggestion: KeywordSuggestion) => {
    if (!onApplySuggestion) return;
    const wasApplied = appliedSuggestions.has(suggestion.id);
    const appliedSuggestion = appliedSuggestions.get(suggestion.id);
    const suggestionWithDraft = wasApplied
      ? (appliedSuggestion ?? suggestion)
      : {
          ...suggestion,
          proposedText: suggestion.sourceExperienceId
            ? proposalDrafts.get(suggestion.id) ?? suggestion.sourceEvidence
            : undefined,
        };
    onApplySuggestion(suggestionWithDraft, !wasApplied);
    setAppliedSuggestions((previous) => {
      const next = new Map(previous);
      if (wasApplied) next.delete(suggestion.id);
      else next.set(suggestion.id, suggestionWithDraft);
      return next;
    });
    showToast(wasApplied ? 'Cofnięto zmianę w wersji CV' : 'Dodano do wersji CV', {
      message: wasApplied
        ? `Usunięto „${suggestion.keyword}” z listy umiejętności tego dokumentu.`
        : `Dodano „${suggestion.keyword}” do listy umiejętności tego dokumentu. Profil źródłowy pozostał bez zmian.`,
      variant: 'success',
    });
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* ---------------------------------- NAGŁÓWEK DOPASOWANIA I INTERPRETACJA */}
      <Card tone="raised" className="p-6 sm:p-8 space-y-6 border border-line shadow-raised">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-b border-line pb-6">
          <div className="space-y-1.5">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
              Wynik zbiorczy profilu dla oferty
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl sm:text-6xl font-extrabold font-mono tracking-tight text-brand-fg">
                {score === null ? '—' : `${score}%`}
              </span>
              <div className="space-y-0.5">
                <span className="text-lg font-bold text-ink block">
                  {score === null
                    ? 'Brak podstaw do oceny'
                    : blockingRequirements.length > 0
                      ? 'Niepotwierdzony wymóg obowiązkowy'
                      : limitedMatchEvidence
                      ? 'Wynik wstępny — ograniczone dane'
                      : CANONICAL_SCORE_BAND_LABELS[getCanonicalScoreBand(score)]}
                </span>
                <span className="text-xs text-muted font-medium">
                  {score === null
                    ? 'Nie pokazujemy zastępczego wyniku ATS.'
                    : `${matchedRequirements} / ${totalRequirements} wymagań znajduje potwierdzenie w Twoim profilu`}
                </span>
                {score !== null && (
                  <span className="block max-w-xl text-xs leading-relaxed text-muted">
                    Procent łączy pokrycie wymagań, staż, strukturę CV i kryteria formalne. Licznik obok pokazuje osobno wymagania wykryte w ofercie.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Kompletność profilu pomaga ocenić zakres dostępnych danych. */}
          <div className="rounded-xl border border-line bg-surface p-4 text-xs space-y-2 min-w-[200px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted font-medium">Twój profil:</span>
              <span className="font-mono font-bold text-ink">{vaultCompleteness}% sekcji uzupełnionych</span>
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
        {vaultCompleteness < 50 && (
          <p role="note" className="rounded-xl border border-warning/30 bg-warning-soft/40 p-4 text-sm leading-relaxed text-warning-fg">
            Uzupełniono mniej niż połowę ważonych sekcji profilu. Wynik opiera się na dostępnych wpisach i może się zmienić po dodaniu brakujących informacji. Sprawdź też, czy parser poprawnie odczytał CV.
          </p>
        )}
      </Card>

      <OfferFactsSummary
        seniorityLevel={parsedOffer.seniorityLevel}
        workModel={parsedOffer.workModel}
        contractTypes={parsedOffer.contractTypes}
      />

      {niceToHaveLines.length > 0 && (
        <Card tone="flat" className="space-y-3 border border-line p-5">
          <div>
            <h3 className="text-sm font-bold text-ink">Mile widziane w ofercie ({niceToHaveLines.length})</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              To atuty wskazane przez pracodawcę. Nie zwiększają liczby brakujących wymagań.
            </p>
          </div>
          <ul className="space-y-1.5 text-sm text-ink">
            {niceToHaveLines.map((line, index) => <li key={`${index}-${line}`}>• {line}</li>)}
          </ul>
        </Card>
      )}

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
              const source = visibleKeywords.find((keyword) => keyword.term === sug.keyword);
              const isApplied = appliedSuggestions.has(sug.id);
              const proposalText = proposalDrafts.get(sug.id) ?? sug.sourceEvidence ?? '';

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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(sug.id)}
                        disabled={isApplied}
                        className="text-xs text-muted hover:text-ink cursor-pointer"
                      >
                        Pomiń
                      </Button>
                      {onApplySuggestion && sug.category !== 'LICENSE' && (
                        <Button
                          type="button"
                          variant={isApplied ? 'outline' : 'primary'}
                          size="sm"
                          icon={isApplied ? Check : Plus}
                          onClick={() => handleSuggestionChange(sug)}
                          className="font-bold cursor-pointer"
                        >
                          {isApplied ? 'Cofnij zmianę' : sug.sourceExperienceId ? 'Dodaj punkt do CV' : 'Dodaj do wersji CV'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {source?.jobRequirementEvidence && (
                    <p className="text-xs leading-relaxed text-ink-muted">
                      <strong className="text-ink">Oferta:</strong> „{source.jobRequirementEvidence}”
                    </p>
                  )}
                  {source?.foundInVaultEvidence?.map((evidence, index) => (
                    <p key={`proof-${index}`} className="text-xs leading-relaxed text-ink-muted">
                      <strong className="text-ink">Dowód w profilu:</strong> „{evidence}”
                    </p>
                  ))}
                  <p className="text-[11px] text-muted">
                    Źródło: {source?.foundInVaultLocations.join(', ') || 'brak wskazanego miejsca'}
                  </p>
                  {sug.sourceExperienceId && sug.sourceEvidence ? (
                    <div className="space-y-2 rounded-lg border border-line bg-surface-raised p-3">
                      <p className="text-xs text-muted">W bieżącym CV ten punkt nie jest pokazany. Propozycja wykorzystuje treść z profilu; możesz ją poprawić przed dodaniem.</p>
                      <label className="block text-xs font-semibold text-ink" htmlFor={`proposal-${sug.id}`}>Proponowany punkt CV</label>
                      <textarea
                        id={`proposal-${sug.id}`}
                        value={proposalText}
                        disabled={isApplied}
                        onChange={(event) => setProposalDrafts((previous) => new Map(previous).set(sug.id, event.target.value))}
                        rows={3}
                        className="w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink disabled:opacity-70"
                      />
                      <p className="text-[11px] text-muted">Profil źródłowy nie zostanie zmieniony. Cofnięcie usuwa wyłącznie ten punkt z roboczej wersji CV.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted">
                      Propozycja: dodaj „{sug.keyword}” do listy umiejętności tej wersji CV. Profil źródłowy nie zostanie zmieniony.
                    </p>
                  )}
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
                          {kw.jobRequirementEvidence && <p><strong className="text-ink">Wymóg:</strong> „{kw.jobRequirementEvidence}”</p>}
                          {kw.foundInCvEvidence?.map((evidence, index) => (
                            <p key={`cv-${index}`}><strong className="text-ink">Dowód w CV:</strong> „{evidence}”</p>
                          ))}
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
                          <p><strong className="text-ink">Oferta:</strong> {kw.jobRequirementEvidence || 'Wymaganie rozpoznane w treści oferty.'}</p>
                          <p><strong className="text-ink">Twój profil:</strong> Odnaleziono w: {kw.foundInVaultLocations.join(', ')}</p>
                          {kw.foundInVaultEvidence?.map((evidence, index) => (
                            <p key={`vault-${index}`}><strong className="text-ink">Dowód:</strong> „{evidence}”</p>
                          ))}
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
                          <p><strong className="text-ink">Oferta:</strong> {kw.jobRequirementEvidence || `Wymóg formalny (${kw.importance === 'CRITICAL' ? 'krytyczny' : 'istotny'}).`}</p>
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
