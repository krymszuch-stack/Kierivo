import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  Target,
  Trophy,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Award,
} from 'lucide-react';
import { MasterVault } from '../../types';
import { api, ApiError } from '../../lib/apiClient';
import { Button } from '../../components/ui/Button';
import { useEntitlements, consumeAiLocally } from '../../store/useEntitlements';
import { ModelQuotaCounter } from '../../components/ui/ModelQuotaCounter';
import {
  InterviewQuestionItem,
  StarAnswerEvaluation,
} from '../../server/services/interviewCoach.service';

export interface StarCoachSectionProps {
  vault: MasterVault;
}

const DEFAULT_QUESTIONS: InterviewQuestionItem[] = [
  {
    id: 'def-1',
    category: 'behavioral',
    question:
      'Opowiedz o sytuacji, w której projekt napotkał krytyczną przeszkodę lub opóźnienie tuż przed wdrożeniem. Jak zareagowałeś?',
    recruiterIntent:
      'Rekruter bada Twoją odporność na stres, umiejętność priorytetyzacji i to, czy szukasz winnych, czy natychmiast bierzesz odpowiedzialność za rozwiązanie problemu.',
    suggestedStarTips:
      'S: krótki kontekst (maks. 20s); T: Twoja rola w zespole; A: konkretne działania naprawcze "ja zoptymalizowałem/wdrożyłem"; R: uratowany termin lub wdrożenie bez przestoju.',
  },
  {
    id: 'def-2',
    category: 'situational',
    question:
      'Opisz sytuację, gdy musiałeś przekonać nieprzychylnego interesariusza lub zespół do zmiany podejścia technologicznego lub procesowego.',
    recruiterIntent:
      'Sprawdzenie umiejętności perswazji opartej na twardych danych i metrykach (ROI, czas realizacji, dług techniczny), a nie na autorytecie czy emocjach.',
    suggestedStarTips:
      'Wskaż, jakich argumentów liczbowych użyłeś i jak pokazałeś korzyść biznesową, która ostatecznie zjednoczyła zespół.',
  },
  {
    id: 'def-3',
    category: 'competency',
    question:
      'Podaj przykład wdrożenia lub projektu, z którego jesteś najbardziej dumny – jaki był problem wyjściowy i jaki konkretny wynik liczbowy osiągnąłeś?',
    recruiterIntent:
      'Szansa na zaprezentowanie Twojego flagowego projektu – rekruter ocenia poziom skomplikowania i to, czy myślisz kategoriami wartości biznesowej.',
    suggestedStarTips:
      'Zastosuj formułę Google X-Y-Z: Osiągnąłem [X], mierzone przez [Y], poprzez wdrożenie [Z]. Koniecznie podaj twardy % lub kwotę.',
  },
];

export const StarCoachSection: React.FC<StarCoachSectionProps> = ({ vault }) => {
  const { usage, refresh: refreshEntitlements } = useEntitlements();

  const [targetRole, setTargetRole] = useState(
    () => vault.personalInfo?.title || 'Senior Software Engineer'
  );
  const [targetCompany, setTargetCompany] = useState('');
  const [questions, setQuestions] = useState<InterviewQuestionItem[]>(DEFAULT_QUESTIONS);
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestionItem>(DEFAULT_QUESTIONS[0]);
  const [customQuestionInput, setCustomQuestionInput] = useState('');

  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<StarAnswerEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Stoper
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const wordCount = candidateAnswer.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSpeakingTime = Math.round((wordCount / 130) * 60);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGenerateQuestions = async () => {
    if (usage.aiUses <= 0 || !consumeAiLocally()) {
      setError('Wykorzystano dzisiejszy limit zapytań AI (odnowi się o północy). Możesz swobodnie trenować na gotowej liście pytań rekrutacyjnych poniżej.');
      return;
    }

    setIsGeneratingQuestions(true);
    setError(null);
    try {
      const data = await api.post<{ questions?: InterviewQuestionItem[] }>(
        '/api/ai/coach-star/generate-questions',
        {
          vault,
          targetRole,
          targetCompany: targetCompany.trim() || undefined,
        }
      );

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setSelectedQuestion(data.questions[0]);
      }
      refreshEntitlements();
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setError('Limit zapytań AI na dziś wyczerpany. Pula odnowi się o północy. Możesz dalej korzystać z bazy pytań predefiniowanych.');
        refreshEntitlements();
      } else {
        setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas generowania pytań.');
      }
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleEvaluateAnswer = async () => {
    if (!candidateAnswer.trim()) {
      setError('Wpisz swoją odpowiedź przed uruchomieniem analizy trenera.');
      return;
    }

    if (usage.aiUses <= 0 || !consumeAiLocally()) {
      setError('Wykorzystano dzisiejszy limit analiz AI (odnowi się o północy). Skorzystaj ze stopera i samodzielnej checklisty STAR.');
      return;
    }

    setIsEvaluating(true);
    setError(null);
    try {
      const data = await api.post<{ evaluation?: StarAnswerEvaluation }>(
        '/api/ai/coach-star/evaluate-answer',
        {
          question: selectedQuestion.question,
          answer: candidateAnswer,
          targetRole,
          vault,
        }
      );

      if (data.evaluation) {
        setEvaluation(data.evaluation);
      }
      refreshEntitlements();
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setError('Limit analiz AI na dziś wyczerpany. Pula odnowi się o północy.');
        refreshEntitlements();
      } else {
        setError(err instanceof Error ? err.message : 'Wystąpił błąd podczas oceny odpowiedzi.');
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCopyExemplary = () => {
    if (!evaluation?.exemplaryResponse) return;
    navigator.clipboard.writeText(evaluation.exemplaryResponse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getVerdictBadge = (verdict: StarAnswerEvaluation['verdict']) => {
    switch (verdict) {
      case 'EXCELLENT':
        return {
          label: 'Mocna odpowiedź (Wysoka perswazja)',
          bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
          icon: Trophy,
        };
      case 'SOLID':
        return {
          label: 'Dobra baza (Wymaga doprecyzowania)',
          bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
          icon: Target,
        };
      case 'NEEDS_REFINEMENT':
      default:
        return {
          label: 'Zbyt ogólna (Brak twardych liczb)',
          bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
          icon: AlertTriangle,
        };
    }
  };

  return (
    <div className="space-y-8" data-testid="star-coach-section">
      {/* Baner informacyjny */}
      <div className="rounded-3xl border border-brand-500/20 bg-brand-50/50 dark:bg-brand-950/20 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-grad text-on-brand shadow-sm">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-sans text-base font-bold text-ink sm:text-lg">
                  Trener Rozmowy STAR (AI Coach)
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-brand-100 dark:bg-brand-900/40 dark:border-brand-700 px-2.5 py-0.5 text-xs font-semibold text-brand-800 dark:text-brand-300">
                  <Sparkles className="h-3 w-3" /> Azure OpenAI gpt-4o
                </span>
                <ModelQuotaCounter variant="badge" feature="coach" />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm">
                Ćwicz odpowiedzi metodą <strong>STAR</strong> (Situation, Task, Action, Result).
                Model ocenia czy nie spędzasz zbyt wiele czasu na wstępie, czy mówisz o własnych działaniach
                zamiast ogólnego „my”, i bezlitośnie weryfikuje obecność <strong>twardych liczb i metryk</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Formuła STAR ściągawka */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-3 text-xs">
            <span className="font-bold text-brand-fg">S — Situation (20%)</span>
            <p className="mt-1 text-muted">Krótkie tło, stawka i skala projektu.</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 text-xs">
            <span className="font-bold text-brand-fg">T — Task (15%)</span>
            <p className="mt-1 text-muted">Twoja konkretna rola i wyzwanie.</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 text-xs">
            <span className="font-bold text-brand-fg">A — Action (50%)</span>
            <p className="mt-1 text-muted">Konkretne decyzje „Ja zrobiłem”, narzędzia.</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-3 text-xs">
            <span className="font-bold text-brand-fg">R — Result (15%)</span>
            <p className="mt-1 text-muted">Twarde liczby, %, oszczędności, czas.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KROK 1: Konfiguracja roli i wybór pytania */}
      <div className="rounded-3xl border border-line bg-surface p-6 space-y-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-fg dark:bg-brand-950 font-bold text-xs">
              1
            </div>
            <h4 className="font-sans text-sm font-bold text-ink">
              Wybierz lub wygeneruj pytanie rekrutacyjne
            </h4>
          </div>
        </div>

        {/* Pola konfiguracji roli */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Stanowisko docelowe
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="np. Senior Product Designer, Java Tech Lead"
              className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2 text-sm text-ink placeholder:text-subtle focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Firma docelowa (opcjonalnie)
            </label>
            <input
              type="text"
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              placeholder="np. Allegro, Google, Snowflake"
              className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2 text-sm text-ink placeholder:text-subtle focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted">
            Generuj pytania w oparciu o Twoje doświadczenie z Master Vault.
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleGenerateQuestions}
            disabled={isGeneratingQuestions || usage.aiUses <= 0}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isGeneratingQuestions ? 'animate-spin' : ''}`} />
            {isGeneratingQuestions
              ? 'Generowanie pytań...'
              : usage.aiUses <= 0
                ? 'Limit AI wyczerpany'
                : 'Generuj nowe pytania (AI)'}
          </Button>
        </div>

        {/* Lista pytań do wyboru */}
        <div className="space-y-3 pt-2">
          {questions.map((q) => {
            const isSelected = selectedQuestion.id === q.id;
            return (
              <div
                key={q.id}
                onClick={() => setSelectedQuestion(q)}
                className={`cursor-pointer rounded-2xl border p-4 transition-all duration-150 ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/30 ring-1 ring-brand-500 shadow-xs'
                    : 'border-line bg-elevated/60 hover:border-line-hover hover:bg-elevated'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted border border-line">
                        {q.category === 'behavioral'
                          ? 'Behawioralne'
                          : q.category === 'situational'
                          ? 'Sytuacyjne'
                          : 'Kompetencyjne'}
                      </span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-fg">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aktywne do ćwiczenia
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-sm font-semibold text-ink leading-snug">
                      {q.question}
                    </p>
                    <p className="text-xs text-muted flex items-start gap-1.5 pt-1">
                      <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-subtle" />
                      <span>{q.recruiterIntent}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Opcja wpisania własnego pytania */}
        <div className="pt-2">
          <details className="text-xs text-muted group">
            <summary className="cursor-pointer font-semibold text-brand-fg hover:underline">
              Chcesz przećwiczyć inne pytanie ze swojej branży? Kliknij tutaj.
            </summary>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={customQuestionInput}
                onChange={(e) => setCustomQuestionInput(e.target.value)}
                placeholder="Wpisz własne pytanie rekrutacyjne..."
                className="flex-1 rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-ink focus:border-brand-500 focus:outline-none"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (customQuestionInput.trim()) {
                    const customQ: InterviewQuestionItem = {
                      id: `custom-${Date.now()}`,
                      category: 'competency',
                      question: customQuestionInput.trim(),
                      recruiterIntent: 'Pytanie zdefiniowane przez kandydata.',
                      suggestedStarTips: 'Zastosuj pełną strukturę STAR z twardymi metrykami.',
                    };
                    setQuestions((prev) => [customQ, ...prev]);
                    setSelectedQuestion(customQ);
                    setCustomQuestionInput('');
                  }
                }}
              >
                Dodaj i ćwicz
              </Button>
            </div>
          </details>
        </div>
      </div>

      {/* KROK 2: Trening i wpisywanie odpowiedzi */}
      <div className="rounded-3xl border border-line bg-surface p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-fg dark:bg-brand-950 font-bold text-xs">
              2
            </div>
            <div>
              <h4 className="font-sans text-sm font-bold text-ink">
                Twoja odpowiedź na żywo
              </h4>
              <p className="text-xs text-muted">
                Mów na głos mierząc czas stoperem, a następnie wklej lub wpisz treść do oceny AI.
              </p>
            </div>
          </div>

          {/* Stoper */}
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-elevated px-3.5 py-1.5">
            <Clock className="h-4 w-4 text-muted" />
            <span className="font-mono text-sm font-bold text-ink">
              {formatTime(timerSeconds)}
            </span>
            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-ink hover:bg-elevated border border-line"
                title={isTimerRunning ? 'Pauza' : 'Start'}
              >
                {isTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(0);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-ink hover:bg-elevated border border-line"
                title="Reset"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Aktywne pytanie - banner */}
        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/30 dark:bg-brand-950/20 p-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-fg">
            Wybrane pytanie:
          </span>
          <p className="mt-1 font-sans text-sm font-bold text-ink">
            {selectedQuestion.question}
          </p>
          {selectedQuestion.suggestedStarTips && (
            <p className="mt-2 text-xs text-muted border-t border-line/50 pt-2">
              💡 <strong>Wskazówka taktyczna:</strong> {selectedQuestion.suggestedStarTips}
            </p>
          )}
        </div>

        {/* Textarea odpowiedzi */}
        <div className="space-y-2">
          <textarea
            rows={7}
            value={candidateAnswer}
            onChange={(e) => setCandidateAnswer(e.target.value)}
            placeholder="Wpisz lub podyktuj swoją odpowiedź... Pamiętaj: Sytuacja (maks. 2-3 zdania) -> Zadanie/Wyzwanie -> Konkretne działania [Ja] -> Wynik liczbowy (np. skróciłem czas o 40%, uratowałem 150k zł budżetu)."
            className="w-full rounded-2xl border border-line bg-elevated p-4 text-sm text-ink placeholder:text-subtle focus:border-brand-500 focus:outline-none leading-relaxed font-sans"
          />

          <div className="flex flex-wrap items-center justify-between text-xs text-muted px-1">
            <div className="flex items-center gap-4">
              <span>
                Słów: <strong className="text-ink">{wordCount}</strong>
              </span>
              <span>
                Szacowany czas mowy: <strong className="text-ink">{estimatedSpeakingTime} s</strong>{' '}
                {estimatedSpeakingTime > 0 && estimatedSpeakingTime <= 120 && (
                  <span className="text-emerald-600 font-semibold">(Optymalny)</span>
                )}
                {estimatedSpeakingTime > 120 && (
                  <span className="text-amber-600 font-semibold">(Uwaga: za długo, powyżej 2 min)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-fg" />
              <span>Zero PII: dane osobowe są usuwane przed analizą AI</span>
            </div>
          </div>
        </div>

          <ModelQuotaCounter variant="banner" feature="coach" className="my-2" />

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleEvaluateAnswer}
              disabled={isEvaluating || !candidateAnswer.trim() || usage.aiUses <= 0}
              className="flex items-center gap-2"
            >
              <Sparkles className={`h-4 w-4 ${isEvaluating ? 'animate-spin' : ''}`} />
              {isEvaluating
                ? 'Analiza w schemacie STAR...'
                : usage.aiUses <= 0
                  ? 'Limit AI wyczerpany na dziś'
                  : 'Oceń odpowiedź (AI STAR Coach)'}
            </Button>
          </div>
      </div>

      {/* KROK 3: Raport z oceny STAR i wzorcowa odpowiedź */}
      {evaluation && (
        <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 space-y-6 shadow-md animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-6">
            <div>
              <div className="flex items-center gap-2">
                <Award className="h-6 w-6 text-brand-fg" />
                <h4 className="font-sans text-lg font-bold text-ink">
                  Raport Taktyczny Trenera STAR
                </h4>
              </div>
              <p className="mt-1 text-xs text-muted">
                Wielowymiarowa analiza siły perswazji i obecności twardych metryk liczbowych.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-xs font-semibold text-muted">Wynik ogólny</span>
                <span className="font-mono text-3xl font-black text-ink">
                  {evaluation.overallScore}
                  <span className="text-base font-normal text-muted">/10</span>
                </span>
              </div>
              {(() => {
                const badge = getVerdictBadge(evaluation.verdict);
                const IconComponent = badge.icon;
                return (
                  <div
                    className={`flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold ${badge.bg}`}
                  >
                    <IconComponent className="h-4 w-4" />
                    <span>{badge.label}</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 4 Komponenty STAR */}
          <div>
            <h5 className="font-sans text-xs font-bold uppercase tracking-wider text-muted mb-3">
              Rozbicie komponentów STAR:
            </h5>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Situation */}
              <div className="rounded-2xl border border-line bg-elevated p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-ink">S — Situation</span>
                  <span className="font-mono text-xs font-black rounded-lg bg-surface px-2 py-0.5 border border-line text-ink">
                    {evaluation.starBreakdown.situation.score}/10
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {evaluation.starBreakdown.situation.feedback}
                </p>
              </div>

              {/* Task */}
              <div className="rounded-2xl border border-line bg-elevated p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-ink">T — Task</span>
                  <span className="font-mono text-xs font-black rounded-lg bg-surface px-2 py-0.5 border border-line text-ink">
                    {evaluation.starBreakdown.task.score}/10
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {evaluation.starBreakdown.task.feedback}
                </p>
              </div>

              {/* Action */}
              <div className="rounded-2xl border border-line bg-elevated p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-ink">A — Action</span>
                  <span className="font-mono text-xs font-black rounded-lg bg-surface px-2 py-0.5 border border-line text-ink">
                    {evaluation.starBreakdown.action.score}/10
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {evaluation.starBreakdown.action.feedback}
                </p>
              </div>

              {/* Result */}
              <div className="rounded-2xl border border-line bg-elevated p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-ink">R — Result</span>
                  <span className="font-mono text-xs font-black rounded-lg bg-surface px-2 py-0.5 border border-line text-ink">
                    {evaluation.starBreakdown.result.score}/10
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {evaluation.starBreakdown.result.feedback}
                </p>
              </div>
            </div>
          </div>

          {/* Plusy i Minusy */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="h-4 w-4" />
                <span>Mocne strony wypowiedzi</span>
              </div>
              <ul className="space-y-1.5 text-xs text-ink">
                {evaluation.strengths.map((str, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                <AlertTriangle className="h-4 w-4" />
                <span>Luki do wyeliminowania przed rozmową</span>
              </div>
              <ul className="space-y-1.5 text-xs text-ink">
                {evaluation.improvements.map((imp, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Wzorcowa odpowiedź STAR */}
          {evaluation.exemplaryResponse && (
            <div className="rounded-2xl border border-brand-500/30 bg-brand-50/50 dark:bg-brand-950/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-fg" />
                  <h5 className="font-sans text-xs font-bold text-ink uppercase tracking-wider">
                    Wzorcowa, ulepszona odpowiedź STAR (oparta na Twoich faktach):
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={handleCopyExemplary}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-fg hover:underline bg-surface px-2.5 py-1 rounded-lg border border-line"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Skopiowano!' : 'Kopiuj'}
                </button>
              </div>

              <div className="rounded-xl border border-line bg-surface p-4 text-xs font-sans text-ink leading-relaxed whitespace-pre-wrap">
                {evaluation.exemplaryResponse}
              </div>

              <p className="text-[11px] text-muted flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-fg shrink-0" />
                Wersja wzorcowa łączy fakty z Twojej wypowiedzi i profilu z rygorem formuły STAR i wzorem Google X-Y-Z.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
