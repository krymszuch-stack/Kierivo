import React, { useRef, useState } from 'react';
import {
  FileText,
  Briefcase,
  AlertCircle,
  AlertTriangle,
  Info,
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
import { extractTextFromAnyFile } from '../../lib/cvUniversalParser';
import {
  runQuickAtsCheck,
  QuickCheckError,
  extractTopThreeProblems,
  type QuickCheckResult,
  type TopProblem,
} from '../../lib/quickAtsCheck';
import { showToast } from '../../store/useToastStore';
import { JobOffer, MasterVault } from '../../types';

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
  if (score >= 75) {
    return {
      text: 'text-success-fg',
      bg: 'bg-success-soft',
      border: 'border-success/30',
      ring: 'stroke-success-fg',
      label: 'Wysokie dopasowanie',
    };
  }
  if (score >= 50) {
    return {
      text: 'text-warning-fg',
      bg: 'bg-warning-soft',
      border: 'border-warning/30',
      ring: 'stroke-warning-fg',
      label: 'Umiarkowane dopasowanie',
    };
  }
  return {
    text: 'text-danger-fg',
    bg: 'bg-danger-soft',
    border: 'border-danger/30',
    ring: 'stroke-danger-fg',
    label: 'Wymaga optymalizacji',
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

function getResultStatusMeta(score: number, topProblems: TopProblem[]): StatusMeta {
  const hasFormalIssue = topProblems.some((p) => p.category === 'formal');

  if (score >= 75) {
    return {
      statusLabel: 'Wysokie dopasowanie',
      headline: 'Twoje CV ma bardzo wysoką szansę pomyślnego przejścia selekcji ATS',
      subline: 'Twój profil w przeważającej mierze odpowiada wymaganiom z oferty pracy. Zastosuj poniższe wskazówki, aby znaleźć się na szczycie listy kandydatów.',
      cardClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100',
      badgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
      icon: CheckCircle2,
      tips: [
        {
          title: 'Dopisz brakujące frazy',
          desc: 'Uzupełnij 1–2 pojęcia techniczne wykazane w analizie poniżej, aby uzyskać pełną zgodność słów kluczowych.',
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

  if (score >= 50) {
    return {
      statusLabel: 'Wymaga drobnych uzupełnień',
      headline: 'Dobra baza, ale system selekcji może zatrzymać Twoje CV na wstępnym etapie',
      subline: 'W Twoim dokumencie brakuje kilku ważnych pojęć lub uprawnień, na które automatyczne skanery rekrutacyjne zwracają kluczową uwagę.',
      cardClass: 'bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100',
      badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
      icon: AlertTriangle,
      tips: [
        {
          title: hasFormalIssue ? 'Uzupełnij uprawnienia formalne' : 'Nazwij narzędzia dosłownie',
          desc: hasFormalIssue
            ? 'Wpisz brakujące certyfikaty (np. SEP, UDT, kat. prawa jazdy) na samej górze CV – bez nich system może odrzucić aplikację.'
            : 'Użyj w treści dokładnie takiego samego nazewnictwa narzędzi, jakie występuje w ogłoszeniu.',
        },
        {
          title: 'Dopasuj tytuł zawodowy',
          desc: 'Ustaw nagłówek podsumowania zawodowego tak, aby odpowiadał stanowisku z ogłoszenia.',
        },
        {
          title: 'Zadbaj o czytelne sekcje',
          desc: 'Użyj standardowych nagłówków sekcji (Doświadczenie, Umiejętności, Wykształcenie), które systemy rozpoznają bezbłędnie.',
        },
      ],
    };
  }

  return {
    statusLabel: 'Wysokie ryzyko odrzucenia',
    headline: 'Filtr ATS może zablokować to CV przed przekazaniem do rekrutera',
    subline: 'Wykryto istotne rozbieżności między treścią CV a ofertą pracy. Dokument wymaga pilnego dopisania kluczowych kompetencji.',
    cardClass: 'bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100',
    badgeClass: 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
    icon: AlertCircle,
    tips: [
      {
        title: hasFormalIssue ? 'Krytyczny brak uprawnień' : 'Kluczowe kompetencje',
        desc: hasFormalIssue
          ? 'Jeśli posiadasz uprawnienia wymagane w ofercie, koniecznie wpisz je wprost. Ich brak powoduje natychmiastowe odrzucenie.'
          : 'Dopisz w podsumowaniu i sekcji umiejętności kluczowe pojęcia wymienione w ogłoszeniu.',
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
  const [result, setResult] = useState<QuickCheckResult | null>(null);
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
    } catch {
      setError({
        message: 'Nie udało się odczytać tego pliku. Wklej treść CV bezpośrednio w pole tekstowe.',
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

    // Budujemy obiekt JobOffer na podstawie wklejonego ogłoszenia i rozpoznanej roli
    const inferredTitle =
      result.detectedSubRole?.subRole.title ||
      jdText
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 4 && l.length < 60) ||
      'Stanowisko z ogłoszenia';

    const jobOffer: JobOffer = {
      id: `job-quick-${Date.now()}`,
      title: inferredTitle,
      company: 'Pracodawca z ogłoszenia',
      salary: '',
      location: '',
      description: jdText.trim(),
      requirements: result.missingSkills,
    };

    onShowDetails(result.vault, jobOffer, result);
  };

  const topProblems: TopProblem[] = result ? extractTopThreeProblems(result) : [];
  const tone = result ? getTone(result.ats.overallScore) : null;
  const statusMeta = result ? getResultStatusMeta(result.ats.overallScore, topProblems) : null;
  const circumference = 2 * Math.PI * 42;

  return (
    <div className={`space-y-6 ${className}`}>
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
                      accept=".pdf,.docx,.doc,.rtf,.txt"
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
                <div className={`rounded-2xl border p-5 sm:p-6 transition-all ${statusMeta.cardClass}`}>
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
                            Szacunek: <strong className="font-bold">{result.ats.overallScore}%</strong>
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
                aria-label={`Szacowany wynik przejścia filtra ATS ${result.ats.overallScore} procent`}
                className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-5">
                  {/* Pierścień graficzny */}
                  <div className="relative h-[88px] w-[88px] shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="42" className="stroke-line" strokeWidth="8" fill="none" />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="42"
                        className={tone?.ring}
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: circumference * (1 - result.ats.overallScore / 100) }}
                        transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
                        style={{ strokeDasharray: circumference }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`font-mono text-2xl font-bold ${tone?.text}`}>
                        {result.ats.overallScore}%
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-muted">
                        SZANSA
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-ink sm:text-base">
                        Szacowany wynik przejścia filtra ATS
                      </h4>
                      <Tooltip
                        content="System ATS (Applicant Tracking System) to program komputerowy używany przez rekruterów i firmy do wstępnego przesiewania setek nadesłanych CV. Szacujemy, z jakim prawdopodobieństwem Twoje CV zostanie zakwalifikowane do przeczytania przez człowieka na podstawie słów kluczowych, uprawnień i czytelności formatu."
                        side="top"
                      >
                        <button
                          type="button"
                          aria-label="Informacja o szacowanym wyniku filtra ATS"
                          className="inline-flex items-center justify-center text-muted hover:text-ink transition-colors cursor-help"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Zgodność wymaganych umiejętności: <strong className="text-ink font-semibold">{result.ats.keywordCoverageScore}%</strong> ·
                      Czytelność układu dla rekrutera: <strong className="text-ink font-semibold">{result.ats.structureScore}%</strong>
                    </p>
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

              {/* 3. Sekcja: 3 kluczowe kwestie do poprawy w CV */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-ink uppercase tracking-wide font-mono">
                    3 najważniejsze rzeczy do poprawy w Twoim CV
                  </h4>
                  <span className="text-[11px] text-muted">
                    Najważniejsze powody, dla których filtr może odrzucić aplikację
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {topProblems.map((problem, idx) => {
                    const isCritical = problem.severity === 'critical';
                    const isWarning = problem.severity === 'warning';

                    return (
                      <div
                        key={problem.id || idx}
                        className={`flex items-start gap-3.5 rounded-2xl border p-4 transition-colors ${
                          isCritical
                            ? 'border-danger/40 bg-danger-soft/60 text-danger-fg'
                            : isWarning
                            ? 'border-warning/40 bg-warning-soft/60 text-ink'
                            : 'border-line bg-surface text-ink'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isCritical ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-danger/20 text-danger-fg">
                              <AlertCircle className="h-4 w-4" />
                            </span>
                          ) : isWarning ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-warning/20 text-warning-fg">
                              <AlertTriangle className="h-4 w-4" />
                            </span>
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-fg">
                              <Info className="h-4 w-4" />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                              Punkt #{idx + 1}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase ${
                                isCritical
                                  ? 'bg-danger text-white'
                                  : isWarning
                                  ? 'bg-warning/30 text-warning-fg'
                                  : 'bg-sunken text-muted'
                              }`}
                            >
                              {isCritical ? 'Krytyczny wymóg' : isWarning ? 'Brakująca umiejętność' : 'Wskazówka jakościowa'}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-bold text-ink">
                            {problem.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted">
                            {problem.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Stopka: Przycisk POKAŻ SZCZEGÓŁY */}
              <div className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-ink">
                    Chcesz automatycznie uzupełnić te braki i przygotować gotowe CV?
                  </p>
                  <p className="text-[11px] text-muted">
                    Przejdź do pełnego widoku z edytorem dokumentu, generatorem gotowego CV i listem motywacyjnym.
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
