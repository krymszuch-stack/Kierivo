import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Target,
  Sparkles,
  RotateCw,
  Clock,
  Send,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DrillQuestion,
  DrillScorecard,
  DrillAttemptRecord,
  DEFAULT_DRILL_QUESTIONS,
  getRandomDrillQuestion,
  analyzeDrillResponse,
  loadDrillHistory,
  saveDrillAttempt,
  clearDrillHistory,
} from '../../lib/drillEngine';
import { DrillAudioRecorder } from '../../components/drill/DrillAudioRecorder';
import { DrillScorecardView } from '../../components/drill/DrillScorecardView';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';
import { History, Award, Trash2 } from 'lucide-react';

export interface DrillModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customQuestions?: DrillQuestion[];
}

export const DrillModeModal: React.FC<DrillModeModalProps> = ({
  isOpen,
  onClose,
  customQuestions = DEFAULT_DRILL_QUESTIONS,
}) => {
  const pool = customQuestions.length > 0 ? customQuestions : DEFAULT_DRILL_QUESTIONS;

  const [activeModeTab, setActiveModeTab] = useState<'PRACTICE' | 'HISTORY'>('PRACTICE');
  const [history, setHistory] = useState<DrillAttemptRecord[]>([]);

  const [currentQuestion, setCurrentQuestion] = useState<DrillQuestion>(() =>
    getRandomDrillQuestion(pool)
  );

  // Stan ćwiczenia: 'DRILL' (odliczanie i odpowiadanie) lub 'REVIEW' (scorecard i notatka)
  const [phase, setPhase] = useState<'DRILL' | 'REVIEW'>('DRILL');
  const [responseMode, setResponseMode] = useState<'TEXT' | 'AUDIO'>('TEXT');
  const [responseText, setResponseText] = useState('');
  const [timeLeftSec, setTimeLeftSec] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [scorecard, setScorecard] = useState<DrillScorecard | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset stanu przy otwarciu pytania
  useEffect(() => {
    if (isOpen) {
      setPhase('DRILL');
      setTimeLeftSec(currentQuestion.targetDurationSec || 60);
      setIsTimerRunning(true);
      setResponseText('');
      setScorecard(null);
      setHistory(loadDrillHistory());
    }
  }, [isOpen, currentQuestion]);

  // Najświeższy handleFinishDrill dla interwału. Efekt odliczania celowo NIE
  // ma w zależnościach `responseText`: każde naciśnięcie klawisza rozwalało
  // interval i restartowało odliczanie od nowa, więc ciągłe pisanie zatrzymywało
  // zegar. Referencja daje interwałowi aktualny handler (i aktualny tekst)
  // bez przerywania odliczania.
  type FinishFn = () => void;
  const finishRef = useRef<FinishFn | null>(null);
  useEffect(() => {
    finishRef.current = handleFinishDrill;
  });

  // Odliczanie 60s
  useEffect(() => {
    if (isOpen && phase === 'DRILL' && isTimerRunning && activeModeTab === 'PRACTICE') {
      timerRef.current = setInterval(() => {
        setTimeLeftSec((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsTimerRunning(false);
            // Automatyczne przejście do analizy po upływie 60s
            finishRef.current?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, phase, isTimerRunning, activeModeTab]);

  const handleNextRandomQuestion = () => {
    const nextQ = getRandomDrillQuestion(pool, currentQuestion.id);
    setCurrentQuestion(nextQ);
    setPhase('DRILL');
    setTimeLeftSec(nextQ.targetDurationSec || 60);
    setIsTimerRunning(true);
    setResponseText('');
    setScorecard(null);
  };

  const handleFinishDrill = () => {
    setIsTimerRunning(false);
    const result = analyzeDrillResponse(responseText, currentQuestion.referenceNotes);
    setScorecard(result);
    setPhase('REVIEW');

    if (responseText.trim().length > 0) {
      const attempt: DrillAttemptRecord = {
        id: `drill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        questionId: currentQuestion.id,
        questionText: currentQuestion.question,
        transcript: responseText,
        durationSec: (currentQuestion.targetDurationSec || 60) - timeLeftSec,
        scorecard: result,
        recordedAt: new Date().toISOString(),
      };
      saveDrillAttempt(attempt);
      setHistory(loadDrillHistory());
    }
  };

  const handleClearHistory = () => {
    clearDrillHistory();
    setHistory([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-3xl rounded-3xl border border-line bg-elevated shadow-floating p-6 space-y-6 my-8"
      >
        {/* Header Modala */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-on-brand shadow-raised">
              <Target className="h-5 w-5" />
            </div>
            <div>
              {/* Sufiks „(mock-drill-mode-v1)" to identyfikator wewnętrzny — nie dla UI. */}
              <h3 className="text-base font-extrabold text-ink tracking-tight font-mono">
                Mock Drill
              </h3>
              <p className="text-xs text-muted">
                Trening odpowiedzi w 60s • Ewaluacja STAR & Metryk • Historia prób
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Przełącznik Zakładek Trening / Historia */}
            <div className="flex rounded-xl bg-sunken p-1 border border-line">
              <button
                type="button"
                onClick={() => setActiveModeTab('PRACTICE')}
                className={`cursor-pointer flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                  activeModeTab === 'PRACTICE'
                    ? 'bg-brand-600 text-on-brand shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Target className="h-3.5 w-3.5" />
                <span>Ćwicz</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModeTab('HISTORY')}
                className={`cursor-pointer flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                  activeModeTab === 'HISTORY'
                    ? 'bg-brand-600 text-on-brand shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>Historia ({history.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl p-2 text-muted hover:bg-sunken hover:text-ink transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Widok Zakładki Historia */}
        {activeModeTab === 'HISTORY' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-ink uppercase tracking-wider">
                Poprzednie sesje treningowe:
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="cursor-pointer flex items-center gap-1 text-xs font-mono text-muted hover:text-error transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Wyczyść historię</span>
                </button>
              )}
            </div>

            {history.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-2xl border border-line bg-surface p-4 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[10px] text-muted">
                          {new Date(record.recordedAt).toLocaleString('pl-PL')} • Czas: {record.durationSec}s
                        </span>
                        <h4 className="font-sans text-xs font-bold text-ink leading-snug">
                          „{record.questionText}”
                        </h4>
                      </div>
                      <Chip
                        variant={record.scorecard.overallScore >= 75 ? 'success' : 'brand'}
                        size="sm"
                      >
                        Wynik: {record.scorecard.overallScore}%
                      </Chip>
                    </div>

                    <p className="font-sans text-xs text-muted italic bg-sunken p-2.5 rounded-xl">
                      {record.transcript}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="font-mono text-[10px] text-muted">
                        Struktura STAR: {record.scorecard.structure.scorePercent}%
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-muted">
                        Sprawczość: {record.scorecard.ownership.ownershipPercent}% Ja
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-muted">
                        Metryki: {record.scorecard.metrics.hasMetrics ? 'Znaleziono' : 'Brak'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Award}
                title="Brak zapisanych prób w historii"
                description="Brak jeszcze prób treningowych. Uruchom tryb ćwiczeń i odpowiedz na pierwsze pytanie rekrutacyjne w 60 sekund."
                action={
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveModeTab('PRACTICE')}
                  >
                    Rozpocznij pierwszą próbę
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* Widok Zakładki Ćwicz (PRACTICE) */}
        {activeModeTab === 'PRACTICE' && (
          <>

        {/* Faza 1: DRILL (Odliczanie 60s i wprowadzanie odpowiedzi) */}
        {phase === 'DRILL' && (
          <div className="space-y-5">
            {/* Karta Pytania */}
            <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-brand-600 uppercase tracking-wider">
                  Wylosowane Pytanie Rekrutacyjne:
                </span>
                <button
                  type="button"
                  onClick={handleNextRandomQuestion}
                  className="cursor-pointer inline-flex items-center gap-1 font-mono text-meta font-bold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
                >
                  <RotateCw className="h-3 w-3" />
                  <span>Inne pytanie</span>
                </button>
              </div>

              <h2 className="text-lg font-bold text-ink leading-snug">
                „{currentQuestion.question}”
              </h2>

              {currentQuestion.hint && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Sparkles className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                  <span>Wskazówka: {currentQuestion.hint}</span>
                </div>
              )}
            </div>

            {/* Timer 60s */}
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-3.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-bold font-mono text-ink">
                  Pozostały czas próby:
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`font-mono text-2xl font-black ${
                    timeLeftSec <= 15 ? 'text-warning-fg animate-pulse' : 'text-ink'
                  }`}
                >
                  {timeLeftSec}s
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                >
                  {isTimerRunning ? 'Pauza' : 'Wznów'}
                </Button>
              </div>
            </div>

            {/* Przełącznik Tekst / Audio */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <button
                  type="button"
                  onClick={() => setResponseMode('TEXT')}
                  className={`cursor-pointer px-3 py-1 text-xs font-mono font-bold rounded-lg transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                    responseMode === 'TEXT'
                      ? 'bg-brand-600 text-on-brand'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Wpisz odpowiedź (Tekst)
                </button>
                <button
                  type="button"
                  onClick={() => setResponseMode('AUDIO')}
                  className={`cursor-pointer px-3 py-1 text-xs font-mono font-bold rounded-lg transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                    responseMode === 'AUDIO'
                      ? 'bg-brand-600 text-on-brand'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Nagraj głos (Audio)
                </button>
              </div>

              {responseMode === 'TEXT' ? (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    placeholder="Wpisz w punktach lub pełnymi zdaniami swoją odpowiedź w formacie STAR (np. W firmie X zadaniem było... zastosowałem... co przyniosło wzrost o 40%)..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface p-3.5 text-xs text-ink font-sans placeholder:text-muted focus:border-brand-500 focus:outline-none resize-none leading-relaxed"
                  />
                  <span className="text-[10px] font-mono text-muted block text-right">
                    Liczba znaków: {responseText.length}
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <DrillAudioRecorder
                    onRecordingComplete={(_blob, _duration) => {
                      // Opcjonalne powiadomienie o nagraniu
                    }}
                  />
                  {/* Ocena (analyzeDrillResponse) liczy wyłącznie tekst odpowiedzi —
                      nagranie nie wpływa na scorecard, więc mówimy to wprost,
                      zamiast udawać funkcję, której nie ma. */}
                  <p className="text-[10px] font-mono text-muted">
                    Nagranie służy tylko Twojemu odsłuchowi — ocena liczy się z tekstu odpowiedzi.
                  </p>
                </div>
              )}
            </div>

            {/* Przycisk zakończenia i oceny */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                icon={Send}
                onClick={handleFinishDrill}
              >
                Zakończ próbę i oceń odpowiedź
              </Button>
            </div>
          </div>
        )}

        {/* Faza 2: REVIEW (Scorecard, Notatka ze Ściągi i Sugestie) */}
        {phase === 'REVIEW' && scorecard && (
          <div className="space-y-5">
            {/* Wyświetlenie Scorecard */}
            <DrillScorecardView
              scorecard={scorecard}
              referenceNotes={currentQuestion.referenceNotes}
            />

            {/* Przyciski Akcji */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-line pt-4">
              <Button
                type="button"
                variant="outline"
                size="md"
                icon={RotateCcw}
                onClick={() => {
                  setPhase('DRILL');
                  setTimeLeftSec(currentQuestion.targetDurationSec || 60);
                  setIsTimerRunning(true);
                  // Powtórka to nowa próba — stary transkrypt musiał zniknąć,
                  // bo druga ocena liczyłaby się z odpowiedzią z pierwszej.
                  setResponseText('');
                }}
              >
                Powtórz to samo pytanie
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  icon={ArrowRight}
                  onClick={handleNextRandomQuestion}
                >
                  Kolejne pytanie (Drill Next) 🎯
                </Button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
      </motion.div>
    </div>
  );
};
