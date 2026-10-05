import React, { useRef, useState } from 'react';
import {
  FileText,
  Briefcase,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  UploadCloud,
  Layers,
  HelpCircle,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { Textarea } from '../../components/ui/Field';
import { extractTextFromAnyFile, InvalidDocxError, UnsupportedLegacyDocFormatError, UnsupportedMasterVaultJsonCvError } from '../../lib/cvUniversalParser';
import {
  runQuickAtsCheck,
  QuickCheckError,
  extractTopThreeProblems,
  type QuickCheckResult,
  type TopProblem,
} from '../../lib/quickAtsCheck';
import { inferPastedOfferHeader } from '../../lib/jobOfferPreprocessor';
import { measureVaultCompleteness } from '../../lib/vaultCompleteness';
import { showToast } from '../../store/useToastStore';
import { JobOffer, MasterVault } from '../../types';
import { QuickCheckFindings } from './QuickCheckFindings';
import { getCanonicalScoreBand, CANONICAL_SCORE_BAND_LABELS, getUnmetBlockingRequirements, hasCareerEvidence } from '../../lib/canonicalAts';
import { getCanonicalScoreMetricLabel, hasLimitedMatchEvidence } from '../../lib/matchInterpretation';
import { getScoreRingTrackDashArray } from '../../lib/scoreRingPresentation';
import { useAnalysisClock } from '../../hooks/useAnalysisClock';
import { getCalculationTimeFreshness } from '../../lib/analysisPeriod';
import { AnalysisTimeNotice } from '../../components/ui/AnalysisTimeNotice';

export interface QuickOnboardingFlowProps {
  /** Wywołanie po kliknięciu „Pokaż szczegóły” — przekazuje wyekstrahowany profil i ofertę do trybu zaawansowanego */
  onShowDetails: (vault: MasterVault, jobOffer: JobOffer, quickResult: QuickCheckResult) => void;
  /** Bezpośrednie przełączenie do trybu zaawansowanego */
  onSwitchToAdvanced?: () => void;
  initialCvText?: string;
  initialJdText?: string;
  className?: string;
}

function getTone(score: number): { text: string; bg: string; border: string; ring: string; label: string } {
  const band = getCanonicalScoreBand(score);
  if (band === 'high') {
    return {
      text: 'text-success-fg',
      bg: 'bg-success-soft',
      border: 'border-success/30',
      ring: 'stroke-success-fg',
      label: CANONICAL_SCORE_BAND_LABELS[band],
    };
  }
  if (band === 'moderate') {
    return {
      text: 'text-warning-fg',
      bg: 'bg-warning-soft',
      border: 'border-warning/30',
      ring: 'stroke-warning-fg',
      label: CANONICAL_SCORE_BAND_LABELS[band],
    };
  }
  return {
    text: 'text-danger-fg',
    bg: 'bg-danger-soft',
    border: 'border-danger/30',
    ring: 'stroke-danger-fg',
    label: CANONICAL_SCORE_BAND_LABELS[band],
  };
}

interface StatusMeta {
  statusLabel: string;
  headline: string;
  subline: string;
  cardClass: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
  tips: Array<{ title: string; desc: string }>;
}

function getResultStatusMeta(score: number, topProblems: TopProblem[], limitedEvidence = false, requirementCount = 0, careerEvidenceAvailable = true, blockingRequirements: string[] = [], unconfirmedRequirements: string[] = []): StatusMeta {
  const band = getCanonicalScoreBand(score);
  const hasFormalIssue = topProblems.some((p) => p.category === 'formal');

  if (blockingRequirements.length > 0) {
    return {
      statusLabel: 'Wymóg obowiązkowy niepotwierdzony',
      headline: 'Sprawdź wymagane uprawnienie przed oceną aplikacji',
      subline: `Profil nie potwierdza: ${blockingRequirements.join(', ')}. Wynik nie oznacza spełnienia tego warunku.`,
      cardClass: 'bg-warning-soft border-warning/30 text-warning-fg',
      badgeClass: 'bg-warning-soft text-warning-fg',
      icon: AlertTriangle,
      tips: [{
        title: 'Sprawdź uprawnienie i treść oferty',
        desc: 'Dodaj je do profilu tylko wtedy, gdy faktycznie je posiadasz. W przeciwnym razie traktuj je jako brak blokujący.',
      }],
    };
  }

  if (unconfirmedRequirements.length > 0) {
    return {
      statusLabel: 'Wynik wstępny — wymóg niepotwierdzony',
      headline: 'Nie wszystkie wymagania da się potwierdzić',
      subline: `Nie można potwierdzić: ${unconfirmedRequirements.join(', ')}. Uzupełnij wiarygodne dane w profilu; te wymogi nie są liczone ani jako zaliczone, ani jako braki.`,
      cardClass: 'bg-warning-soft border-warning/30 text-warning-fg',
      badgeClass: 'bg-warning-soft text-warning-fg',
      icon: AlertTriangle,
      tips: [{
        title: 'Sprawdź niepotwierdzony wymóg',
        desc: 'Dodaj do profilu daty lub inne brakujące dane wyłącznie wtedy, gdy możesz je potwierdzić.',
      }],
    };
  }

  if (limitedEvidence) {
    return {
      statusLabel: 'Wynik wstępny — ograniczone dane',
      headline: 'Za mało danych, by kategorycznie ocenić dopasowanie',
      subline: careerEvidenceAvailable
        ? `Rozpoznano ${requirementCount} ${requirementCount === 1 ? 'wymaganie' : 'wymagania'}. Sprawdź odczyt oferty i CV przed wyciągnięciem wniosku.`
        : 'Brakuje zapisanej historii doświadczenia lub projektu; ten wynik nie potwierdza dopasowania zawodowego.',
      cardClass: 'bg-warning-soft border-warning/30 text-warning-fg',
      badgeClass: 'bg-warning-soft text-warning-fg',
      icon: AlertTriangle,
      tips: [
        {
          title: 'Sprawdź rozpoznane wymagania',
          desc: 'Porównaj listę wymagań z oryginalną ofertą. Wynik może być wstępny, jeśli parser pominął część treści.',
        },
        {
          title: 'Zweryfikuj odczyt CV',
          desc: 'Upewnij się, że wklejony tekst zawiera doświadczenie i umiejętności, na których ma opierać się dopasowanie.',
        },
      ],
    };
  }

  if (band === 'high') {
    return {
      statusLabel: CANONICAL_SCORE_BAND_LABELS[band],
      headline: 'Wysoka zgodność wykrytych wymagań z treścią CV',
      subline: 'To wynik reguł Kierivo dla tej oferty. Sprawdź rozpoznane dane i wymagania przed wysłaniem CV.',
      cardClass: 'bg-success-soft border-success/30 text-success-fg',
      badgeClass: 'bg-success-soft text-success-fg',
      icon: CheckCircle2,
      tips: [
        {
          title: 'Zweryfikuj wykryte frazy',
          desc: 'Porównaj listę dopasowań i braków z oryginalną ofertą oraz CV.',
        },
        {
          title: 'Wzbogać opisy o liczby',
          desc: 'Podaj mierzalne rezultaty (np. liczbę projektów, budżet, oszczędność czasu) przy punktach doświadczenia.',
        },
        {
          title: 'Czysty format pliku',
          desc: 'Zapisz dokument jako klasyczny jednokolumnowy PDF, bez skomplikowanych tabel i grafik.',
        },
      ],
    };
  }

  if (band === 'moderate') {
    return {
      statusLabel: CANONICAL_SCORE_BAND_LABELS[band],
      headline: 'Wykryto częściową zgodność CV z ogłoszeniem',
      subline: 'Sprawdź, czy wskazane braki rzeczywiście nie występują w Twoim CV. Parser może pominąć fragmenty dokumentu.',
      cardClass: 'bg-warning-soft border-warning/30 text-warning-fg',
      badgeClass: 'bg-warning-soft text-warning-fg',
      icon: AlertTriangle,
      tips: [
        {
          title: hasFormalIssue ? 'Uzupełnij uprawnienia formalne' : 'Nazwij narzędzia dosłownie',
          desc: hasFormalIssue
            ? 'Jeśli masz wymagane uprawnienia, wpisz je wyraźnie w CV. Nie dopisuj uprawnień, których nie posiadasz.'
            : 'Użyj w treści dokładnie takiego samego nazewnictwa narzędzi, jakie występuje w ogłoszeniu.',
        },
        {
          title: 'Dopasuj tytuł zawodowy',
          desc: 'Ustaw nagłówek podsumowania zawodowego tak, aby odpowiadał stanowisku z ogłoszenia.',
        },
        {
          title: 'Zadbaj o czytelne sekcje',
          desc: 'Użyj standardowych nagłówków sekcji (Doświadczenie, Umiejętności, Wykształcenie), aby ułatwić odczyt.',
        },
      ],
    };
  }

  return {
    statusLabel: CANONICAL_SCORE_BAND_LABELS[band],
    headline: 'Wykryto istotne luki lub nierozpoznane dane',
    subline: 'Porównaj wynik z oryginalnym CV i ogłoszeniem. Niski wynik może też wynikać z błędnego odczytu treści.',
    cardClass: 'bg-danger-soft border-danger/30 text-danger-fg',
    badgeClass: 'bg-danger-soft text-danger-fg',
    icon: AlertCircle,
    tips: [
      {
        title: hasFormalIssue ? 'Krytyczny brak uprawnień' : 'Kluczowe kompetencje',
        desc: hasFormalIssue
          ? 'Jeśli posiadasz wymagane uprawnienia, wpisz je wprost i sprawdź wynik ponownie.'
          : 'Uzupełnij opis o kompetencje, które rzeczywiście posiadasz, a których aplikacja nie znalazła.',
      },
      {
        title: 'Przejdź do trybu edycji',
        desc: 'Kliknij przycisk „Pokaż szczegóły” poniżej, aby skorzystać z generatora i uzupełnić luki w CV.',
      },
      {
        title: 'Uprość strukturę dokumentu',
        desc: 'Zastosuj prosty, chronologiczny układ tekstu – wymyślne szablony graficzne są często nieczytelne dla maszyn.',
      },
    ],
  };
}

export const QuickOnboardingFlow: React.FC<QuickOnboardingFlowProps> = ({
  onShowDetails,
  onSwitchToAdvanced,
  initialCvText = '',
  initialJdText = '',
  className = '',
}) => {
  const [cvText, setCvText] = useState(initialCvText);
  const [jdText, setJdText] = useState(initialJdText);
  const [cvFormat, setCvFormat] = useState('TXT');
  const [storedResult, setResult] = useState<QuickCheckResult | null>(null);
  const now = useAnalysisClock();
  const result = storedResult && getCalculationTimeFreshness(storedResult.canonicalResult, now) === 'current' ? storedResult : null;
  const [error, setError] = useState<{ message: string; field: 'cv' | 'jd' } | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setIsReadingFile(true);
    setError(null);

    try {
      const { text, format } = await extractTextFromAnyFile(file);
      setCvText(text);
      setCvFormat(format);
      showToast('Wczytano treść CV', {
        message: `Plik odczytany lokalnie (${format}).`,
        variant: 'success',
      });
    } catch (error) {
      setError({
        message: error instanceof InvalidDocxError || error instanceof UnsupportedLegacyDocFormatError || error instanceof UnsupportedMasterVaultJsonCvError
          ? error.message
          : 'Nie udało się odczytać tego pliku. Wklej treść CV bezpośrednio w pole tekstowe.',
        field: 'cv',
      });
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleCheck = () => {
    setError(null);
    setIsAnalyzing(true);

    try {
      const quickResult = runQuickAtsCheck(cvText, jdText, { format: cvFormat });
      setResult(quickResult);
    } catch (err) {
      if (err instanceof QuickCheckError) {
        setError({ message: err.message, field: err.field });
        return;
      }
      setError({
        message: 'Wystąpił błąd podczas analizy. Upewnij się, że wklejono pełną treść dokumentów.',
        field: 'cv',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setCvText('');
    setJdText('');
    setCvFormat('TXT');
    setResult(null);
    setError(null);
  };

  const handleProceedToDetails = () => {
    if (!result) return;

    // Budujemy ofertę z tekstu wklejonego przez użytkownika.
    // Samodzielny nagłówek można przenieść dosłownie. Gdy użytkownik wkleił
    // opis w jednym akapicie, nie zgadujemy tytułu z taksonomii ani z treści zdania.
    const { title: inferredTitle, company } = inferPastedOfferHeader(jdText);

    const jobOffer: JobOffer = {
      id: `job-quick-${Date.now()}`,
      title: inferredTitle,
      company,
      salary: '',
      location: '',
      description: jdText.trim(),
      requirements: result.missingSkills,
    };

    onShowDetails(result.vault, jobOffer, result);
  };

  const topProblems: TopProblem[] = result ? extractTopThreeProblems(result) : [];
  const canonicalScore = result?.canonicalResult.state === 'SCORABLE'
    ? result.canonicalResult.score
    : null;
  const profileCoverage = result ? measureVaultCompleteness(result.vault).percent : null;
  const detectedRequirementCount = result
    ? result.canonicalResult.matchedRequirements.length + result.canonicalResult.missingRequirements.length + result.canonicalResult.unconfirmedRequirements.length
    : undefined;
  const limitedMatchEvidence = hasLimitedMatchEvidence({
    profileCompleteness: profileCoverage ?? undefined,
    totalRequirementCount: detectedRequirementCount,
    fitEvidenceAvailable: result ? hasCareerEvidence(result.vault) : undefined,
    blockingRequirements: getUnmetBlockingRequirements(result?.canonicalResult),
    unconfirmedRequirements: result?.canonicalResult.unconfirmedRequirements,
  });
  const careerEvidenceAvailable = result ? hasCareerEvidence(result.vault) : true;
  const tone = canonicalScore === null ? null : getTone(canonicalScore);
  const statusMeta = canonicalScore === null
    ? null
    : getResultStatusMeta(canonicalScore, topProblems, limitedMatchEvidence, detectedRequirementCount, careerEvidenceAvailable, getUnmetBlockingRequirements(result?.canonicalResult), result?.canonicalResult.unconfirmedRequirements);
  const circumference = 2 * Math.PI * 42;

  return (
    <div className={`space-y-6 ${className}`}>
      {storedResult && !result && <AnalysisTimeNotice score={storedResult.canonicalResult.score} onRefresh={handleCheck} />}
      <AnimatePresence mode="wait">
        {!result ? (
          /* ============================================================
             KROK 1: MINIMALNY HAPPY PATH — DWA POLA + PRZYCISK SPRAWDŹ
             ============================================================ */
          <motion.div
            key="input-step"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card variant="elevated" className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50/80 px-2.5 py-0.5 font-mono text-[11px] font-bold text-brand-fg">
                    <Sparkles className="h-3 w-3" />
                    Szybki start w 30 sekund
                  </span>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">
                    Sprawdź dopasowanie CV do oferty
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Wklej treść swojego CV oraz ogłoszenia o pracę. Analiza odbywa się lokalnie w Twojej przeglądarce.
                  </p>
                </div>

                {onSwitchToAdvanced && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={Layers}
                    onClick={onSwitchToAdvanced}
                    className="self-start sm:self-auto text-xs"
                  >
                    Tryb zaawansowany
                  </Button>
                )}
              </div>

              {/* Dwa jedyne pola formularza */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {/* Pole 1: CV */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="onboarding-cv" className="flex items-center gap-1.5 text-xs font-bold text-ink">
                      <FileText className="h-4 w-4 text-brand-fg" />
                      Treść Twojego CV
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isReadingFile}
                      className="flex items-center gap-1 text-[11px] font-semibold text-brand-fg hover:underline disabled:opacity-50"
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      {isReadingFile ? 'Odczytywanie pliku…' : 'Wgraj plik (PDF / DOCX)'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.rtf,.txt"
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                  </div>
                  <Textarea
                    id="onboarding-cv"
                    rows={10}
                    value={cvText}
                    onChange={(e) => setCvText(e.target.value)}
                    placeholder="Wklej treść swojego CV (doświadczenie, umiejętności, uprawnienia)…"
                    className="font-mono text-xs leading-relaxed"
                    aria-invalid={error?.field === 'cv' || undefined}
                  />
                </div>

                {/* Pole 2: Ogłoszenie */}
                <div className="space-y-2">
                  <label htmlFor="onboarding-jd" className="flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Briefcase className="h-4 w-4 text-brand-fg" />
                    Treść ogłoszenia o pracę
                  </label>
                  <Textarea
                    id="onboarding-jd"
                    rows={10}
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Wklej treść oferty pracy (wymagania, opis stanowiska, obowiązki)…"
                    className="font-mono text-xs leading-relaxed"
                    aria-invalid={error?.field === 'jd' || undefined}
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-xs text-danger-fg">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error.message}</span>
                </div>
              )}

              {/* Główny przycisk akcji */}
              <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted">
                  Brak wymyślonych danych. Żadne dane nie opuszczają Twojego urządzenia bez Twojej zgody.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  icon={ArrowRight}
                  iconPosition="right"
                  onClick={handleCheck}
                  disabled={isAnalyzing || isReadingFile}
                  className="w-full sm:w-auto font-bold px-7"
                >
                  {isAnalyzing ? 'Sprawdzanie…' : 'Sprawdź'}
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          /* ============================================================
             KROK 2: JEDEN EKRAN Z WYNIKIEM — HUMAN-READABLE
             ============================================================ */
          <motion.div
            key="result-step"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            data-testid="quick-onboarding-result"
          >
            <Card variant="elevated" className="space-y-6 p-6 sm:p-8">
              {/* 1. Jasno wyróżniony kolorystycznie nagłówek z wynikiem i 2–3 wskazówkami */}
              {statusMeta && (
                <div data-testid="quick-onboarding-status" className={`rounded-2xl border p-5 sm:p-6 transition-all ${statusMeta.cardClass}`}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3.5">
                      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${statusMeta.badgeClass}`}>
                        <statusMeta.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-lg px-2.5 py-0.5 text-xs font-bold ${statusMeta.badgeClass}`}>
                            {statusMeta.statusLabel}
                          </span>
                          <span className="font-mono text-xs font-semibold opacity-90">
                            {getCanonicalScoreMetricLabel(limitedMatchEvidence, 'Wynik dopasowania')}: <strong className="font-bold">{canonicalScore}%</strong>
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-lg font-bold sm:text-xl leading-snug">
                          {statusMeta.headline}
                        </h3>
                        <p className="mt-1 text-xs opacity-85 leading-relaxed max-w-2xl">
                          {statusMeta.subline}
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={RotateCcw}
                      onClick={handleReset}
                      className="self-start sm:self-center text-xs shrink-0 bg-surface/60 hover:bg-surface border border-line/40"
                    >
                      Sprawdź inne ogłoszenie
                    </Button>
                  </div>

                  {/* 2–3 krótkie wskazówki (Actionable Tips) */}
                  <div className="mt-5 pt-4 border-t border-current/15">
                    <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider opacity-90 mb-2.5">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Wskazówki, jak podnieść wynik przed wysłaniem aplikacji:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {statusMeta.tips.map((tip, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-xl bg-surface/90 border border-line/70 p-3 text-xs text-ink shadow-2xs backdrop-blur-xs"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-fg">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <strong className="text-ink font-semibold block text-xs">{tip.title}</strong>
                            <p className="text-[11px] leading-relaxed text-muted mt-0.5">{tip.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Sekcja wskaźnika dopasowania z tooltipem wyjaśniającym filtr ATS */}
              {/* role="status" + aria-label: wynik wstawiany jest dynamicznie po kliknięciu
                  „Sprawdź", więc bez tego czytnik ekranu go nie ogłasza, a test E2E nie ma
                  stabilnego selektora semantycznego (testid jest tylko hakiem technicznym). */}
              <div
                role="status"
                aria-label={canonicalScore === null
                  ? 'Nie wyliczono wyniku dopasowania Kierivo'
                  : `${getCanonicalScoreMetricLabel(limitedMatchEvidence, 'Wynik dopasowania')} Kierivo ${canonicalScore} procent`}
                className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-5">
                  {/* Pierścień graficzny */}
                  <div className="relative h-[88px] w-[88px] shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="stroke-line"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={getScoreRingTrackDashArray(canonicalScore)}
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="42"
                        className={tone?.ring}
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: circumference * (1 - (canonicalScore ?? 0) / 100) }}
                        transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
                        style={{ strokeDasharray: circumference }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`font-mono text-2xl font-bold ${tone?.text}`}>
                        {canonicalScore === null ? '—' : `${canonicalScore}%`}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-muted">
                        WYNIK
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-ink sm:text-base">
                        Wynik analizy Kierivo dla tej oferty
                      </h4>
                      <Tooltip
                        content="Wynik opiera się na regułach Kierivo i danych rozpoznanych z wklejonego tekstu. Nie mierzy prawdopodobieństwa decyzji konkretnego systemu ATS ani rekrutera."
                        side="top"
                      >
                        <button
                          type="button"
                          aria-label="Informacja o wyniku analizy Kierivo"
                          className="inline-flex items-center justify-center text-muted hover:text-ink transition-colors cursor-help"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Zgodność wymaganych umiejętności: <strong className="text-ink font-semibold">{result.canonicalResult.components.skills === null ? '—' : `${result.canonicalResult.components.skills}%`}</strong> ·
                      Struktura tekstu CV (reguły Kierivo): <strong className="text-ink font-semibold">{result.ats.structureScore === null ? 'brak danych' : `${result.ats.structureScore}%`}</strong>
                    </p>
                    <p className="text-[11px] text-muted">
                      To heurystyka nagłówków i sygnałów w tekście. Nie ocenia wyglądu PDF ani wyniku konkretnego systemu ATS.
                    </p>
                    {profileCoverage !== null && (
                      <p className="text-[11px] text-muted">
                        Pokrycie sekcji profilu: <strong className="text-ink font-semibold">{profileCoverage}%</strong> (obecność sekcji, nie jakość ich treści).
                      </p>
                    )}
                    {profileCoverage !== null && profileCoverage < 50 && (
                      <p role="note" className="text-xs text-warning-fg">
                        Rozpoznano mniej niż połowę ważonych sekcji profilu. Wynik dotyczy tylko znalezionych danych; sprawdź, czy parser poprawnie odczytał CV.
                      </p>
                    )}
                    {result.canonicalResult.unconfirmedRequirements.length > 0 && (
                      <p role="note" className="text-xs text-warning-fg">
                        Nie można potwierdzić: {result.canonicalResult.unconfirmedRequirements.join(', ')}. Te wymogi nie są zaliczone ani traktowane jako braki bez wiarygodnych danych.
                      </p>
                    )}
                    {canonicalScore !== null && detectedRequirementCount !== undefined && detectedRequirementCount > 0 && detectedRequirementCount < 3 && (
                      <p role="note" className="text-xs text-warning-fg">
                        Rozpoznano tylko {detectedRequirementCount} {detectedRequirementCount === 1 ? 'wymaganie' : 'wymagania'}. Sprawdź, czy parser objął całą ofertę.
                      </p>
                    )}
                    {canonicalScore === null && (
                      <p role="note" className="text-xs text-warning-fg">
                        Nie wyliczono wyniku głównego. {result.canonicalResult.reason}
                      </p>
                    )}
                  </div>
                </div>

                {statusMeta && (
                  <div className="hidden sm:block text-right">
                    <span className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${statusMeta.badgeClass}`}>
                      <statusMeta.icon className="h-4 w-4" />
                      {statusMeta.statusLabel}
                    </span>
                  </div>
                )}
              </div>

              <QuickCheckFindings problems={topProblems} />

              {/* 4. Stopka: Przycisk POKAŻ SZCZEGÓŁY */}
              <div className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-ink">
                    Chcesz sprawdzić rozpoznane dane i poprawić CV?
                  </p>
                  <p className="text-[11px] text-muted">
                    Przejdź do edytora i podglądu. Przed eksportem sprawdź każdą pozycję przeniesioną z tekstu CV.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  icon={ArrowRight}
                  iconPosition="right"
                  onClick={handleProceedToDetails}
                  className="font-bold px-6 shrink-0"
                >
                  Pokaż szczegóły
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
