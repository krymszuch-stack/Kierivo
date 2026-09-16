import React, { useState, useEffect } from 'react';
import {
  Mic,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Play,
  RotateCcw,
  Trophy,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { StarCoachSection } from './StarCoachSection';
import { MasterVault } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { generateElevatorPitch, hasVaultEvidence } from '../../lib/elevatorPitchEngine';
import { findOrGenerateBridge, getCommonSkillsList } from '../../lib/skillBridgeEngine';
import {
  CockpitSectionId,
  getNegotiationTrapScripts,
  getRedFlagQuestions,
  loadCockpitProgress,
  toggleLessonCompletion,
  CockpitProgressState,
} from '../../lib/interviewCockpitEngine';
import { loadDrillHistory } from '../../lib/drillEngine';

export interface InterviewCockpitViewProps {
  vault: MasterVault;
  onOpenDrill?: () => void;
  /**
   * Elevator Pitch. Stał tu wcześniej przycisk teleprompteru (HUD) — narzędzia
   * używanego **w trakcie** rozmowy, nie podczas przygotowań. Przeniósł się do
   * Zasobnika Rozmowy w Pipeline, gdzie jest karta konkretnej rozmowy; tutaj
   * został pitch, który jest ćwiczeniem i do sekcji TRENUJ należy.
   */
  onOpenPitch?: () => void;
  className?: string;
}

export const InterviewCockpitView: React.FC<InterviewCockpitViewProps> = ({
  vault,
  onOpenDrill,
  onOpenPitch,
  className = '',
}) => {
  const [activeSection, setActiveSection] = useState<CockpitSectionId>('pitch');
  const [progress, setProgress] = useState<CockpitProgressState>(() => loadCockpitProgress());

  // Pitch state
  const [pitchVariant, setPitchVariant] = useState<'oneLiner' | 'thirtySeconds' | 'ninetySeconds'>('thirtySeconds');
  const [isPitchTimerRunning, setIsPitchTimerRunning] = useState(false);
  const [pitchSeconds, setPitchSeconds] = useState(0);

  // Skill Bridge simulator state
  const [missingSkillInput, setMissingSkillInput] = useState('');
  const [customBridgeSkill, setCustomBridgeSkill] = useState('');

  // Checklists
  const [preCallItems, setPreCallItems] = useState<{ id: string; label: string; checked: boolean }[]>([
    { id: 'tech_check', label: 'Test mikrofonu, słuchawek i kamery (jakość dźwięku > jakość wideo)', checked: false },
    { id: 'pitch_ready', label: 'Przećwiczony 30-sekundowy Elevator Pitch z 1 twardą liczbą', checked: false },
    { id: 'metrics_sheet', label: 'Otwarty Live HUD lub podgląd kluczowych liczb (Twoje kluczowe liczby z ostatniego projektu)', checked: false },
    { id: 'red_flags_ready', label: 'Wybrane min. 2 pytania do zadania rekruterowi (Tech Debt, Proces)', checked: false },
    { id: 'env_ready', label: 'Woda pod ręką, wyciszone powiadomienia, zamknięte zbędne karty', checked: false },
  ]);

  const pitchData = generateElevatorPitch(vault);
  // Etykieta proweniencji: generator zawsze zwraca tekst, więc bez tego
  // sprawdzenia obiecywał fakty nawet przy pustym profilu (reguła 1).
  const pitchFromVault = hasVaultEvidence(vault);
  const currentPitchText = pitchData[pitchVariant] || '';
  const wordCount = currentPitchText.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.round((wordCount / 130) * 60);

  const activeBridge = findOrGenerateBridge(missingSkillInput, vault);
  const commonSkills = getCommonSkillsList().slice(0, 10);

  const trapScripts = getNegotiationTrapScripts();
  const redFlagQuestions = getRedFlagQuestions();
  const drillHistory = loadDrillHistory();

  // Pitch timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPitchTimerRunning) {
      interval = setInterval(() => {
        setPitchSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPitchTimerRunning]);

  const handleToggleLesson = (lessonId: string) => {
    const updated = toggleLessonCompletion(lessonId);
    setProgress(updated);
  };

  const navTabs = [
    { id: 'pitch' as CockpitSectionId, label: '1. Elevator Pitch', icon: Mic },
    { id: 'ai_coach' as CockpitSectionId, label: '2. Trener STAR (AI Coach)', icon: Sparkles },
    { id: 'bridging' as CockpitSectionId, label: '3. Most kompetencyjny', icon: Zap },
    { id: 'traps' as CockpitSectionId, label: '4. Trudne Pytania & Stawki', icon: ShieldCheck },
    { id: 'questions' as CockpitSectionId, label: '5. Twoje Pytania (Red Flags)', icon: AlertTriangle },
    { id: 'tracker' as CockpitSectionId, label: '6. Live Tracker & Pamiętnik', icon: Clock },
  ];

  return (
    <div className={`space-y-8 pb-16 ${className}`}>
      {/* Top Banner / Page Header */}
      <PageHeader
        title="Kokpit Rozmowy — Przygotuj się jak pro"
        description="Samodzielny program taktyczny: od 30-sekundowego pitcha i obrony brakujących technologii, po negocjacje stawek i demaskowanie red flagów w zespole."
        badge="Interview Tactical OS"
      />

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-soft text-success-fg">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-sans text-sm font-bold text-ink">Narzędzia treningowe</h2>
            <p className="text-xs text-muted">Przećwicz odpowiedź na czas albo dopracuj swój pitch.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenDrill && (
            <Button type="button" variant="secondary" size="sm" onClick={onOpenDrill}>
              ⏱️ Drill (60s)
            </Button>
          )}
          {onOpenPitch && (
            <Button type="button" variant="secondary" size="sm" onClick={onOpenPitch}>
              🎤 Elevator Pitch
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-line pb-2">
        <Tabs<CockpitSectionId>
          items={navTabs}
          active={activeSection}
          onChange={setActiveSection}
          variant="underline"
        />
      </div>

      {/* SECTION 1: ELEVATOR PITCH */}
      {activeSection === 'pitch' && (
        <div className="space-y-6">
          {/* Tactical Theory Alert */}
          <div className="rounded-2xl border border-brand-500/20 bg-brand-50/50 dark:bg-brand-950/20 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-grad text-on-brand">
                <Mic className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-sans text-sm font-bold text-ink">
                  Taktyka 1: Jak zacząć rozmowę? (Zasada Past → Present → Future)
                </h4>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Pytanie „Opowiedz coś o sobie” to nie zaproszenie do streszczenia całego życiorysu.
                  To Twój 30-sekundowy hak sprzedażowy. Wpleć <strong>dokładnie jedną twardą metrykę</strong> w pierwszych 20 sekundach, aby natychmiast skierować dyskusję na Twoje najmocniejsze wdrożenie.
                </p>
              </div>
            </div>
          </div>

          {/* Variant Selector */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPitchVariant('oneLiner');
                setPitchSeconds(0);
                setIsPitchTimerRunning(false);
              }}
              className={`cursor-pointer rounded-xl px-3.5 py-2 text-label font-semibold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                pitchVariant === 'oneLiner'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'border border-line bg-surface text-ink hover:border-brand-500'
              }`}
            >
              🚀 1-Liner (~15s)
            </button>
            <button
              type="button"
              onClick={() => {
                setPitchVariant('thirtySeconds');
                setPitchSeconds(0);
                setIsPitchTimerRunning(false);
              }}
              className={`cursor-pointer rounded-xl px-3.5 py-2 text-label font-semibold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                pitchVariant === 'thirtySeconds'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'border border-line bg-surface text-ink hover:border-brand-500'
              }`}
            >
              ⏱️ Standard 30s (Rekomendowany)
            </button>
            <button
              type="button"
              onClick={() => {
                setPitchVariant('ninetySeconds');
                setPitchSeconds(0);
                setIsPitchTimerRunning(false);
              }}
              className={`cursor-pointer rounded-xl px-3.5 py-2 text-label font-semibold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                pitchVariant === 'ninetySeconds'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'border border-line bg-surface text-ink hover:border-brand-500'
              }`}
            >
              📖 Pełna narracja 90s
            </button>
          </div>

          {/* Teleprompter Display Card */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-muted">
                  Słowa: <strong className="text-ink">{wordCount}</strong> (~130 WPM)
                </span>
                <span className="font-mono text-xs font-bold text-muted">
                  Szacowany czas: <strong className="text-brand-600">{estimatedSeconds}s</strong>
                </span>
              </div>

              {/* Live Timer Controls */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-ink bg-sunken px-2.5 py-1 rounded-lg">
                  {Math.floor(pitchSeconds / 60)}:{(pitchSeconds % 60).toString().padStart(2, '0')}
                </span>
                <Button
                  type="button"
                  variant={isPitchTimerRunning ? 'danger' : 'primary'}
                  size="sm"
                  icon={isPitchTimerRunning ? Clock : Play}
                  onClick={() => setIsPitchTimerRunning(!isPitchTimerRunning)}
                >
                  {isPitchTimerRunning ? 'Pauza' : 'Mów na głos (Start)'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => {
                    setPitchSeconds(0);
                    setIsPitchTimerRunning(false);
                  }}
                />
              </div>
            </div>

            {/* Script Text */}
            {currentPitchText ? (
              <div className="p-4 rounded-xl bg-sunken text-sm md:text-base font-sans text-ink leading-relaxed whitespace-pre-wrap selection:bg-brand-500/20">
                {currentPitchText}
              </div>
            ) : (
              <EmptyState
                icon={Mic}
                title="Brak danych do wygenerowania pitcha"
                description="MasterVault nie ma jeszcze wystarczających informacji o Twoim profilu i doświadczeniu. Uzupełnij je, aby wygenerować spersonalizowany Elevator Pitch."
              />
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-muted">
                {pitchFromVault ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-success-fg" />
                    <span>Wygenerowano z faktów i metryk MasterVault</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-warning-fg" />
                    <span>Szablon zastępczy — uzupełnij profil w PROFIL, aby spersonalizować</span>
                  </>
                )}
              </div>
              <Button
                type="button"
                variant={progress.completedLessons.includes('pitch_completed') ? 'ghost' : 'secondary'}
                size="sm"
                onClick={() => handleToggleLesson('pitch_completed')}
              >
                {progress.completedLessons.includes('pitch_completed') ? '✓ Ukończono lekcję' : 'Oznacz jako opanowane'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TRENER STAR (AI COACH) */}
      {activeSection === 'ai_coach' && (
        <StarCoachSection vault={vault} />
      )}

      {/* SECTION 3: SKILL BRIDGING */}
      {activeSection === 'bridging' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-accent/20 bg-accent-soft/30 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-sans text-sm font-bold text-ink">
                  Taktyka 2: Jak odpowiadać na luki w CV? (Most kompetencyjny)
                </h4>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Rekruter pyta o technologię X, której nie znasz? <strong>Nigdy nie zgaduj ani nie udawaj.</strong> Zamiast tego zastosuj most kompetencyjny:
                  uczciwie przyznaj brak X, wykaż ekwiwalencję pojęciową z narzędziem Y, wskaż dowód wdrożenia z MasterVault i podaj realistyczny czas adaptacji (np. 3-5 dni).
                </p>
              </div>
            </div>
          </div>

          {/* Quick Skill Selector */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs space-y-4">
            <label className="text-label font-bold uppercase tracking-wider text-muted">
              Wybierz lub wpisz brakującą technologię (o którą pyta rekruter):
            </label>
            <div className="flex flex-wrap gap-2">
              {commonSkills.map((sk: string) => (
                <button
                  key={sk}
                  type="button"
                  onClick={() => setMissingSkillInput(sk)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-label font-semibold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                    missingSkillInput.toLowerCase() === sk.toLowerCase()
                      ? 'bg-brand-600 text-white'
                      : 'border border-line bg-sunken text-ink hover:border-brand-500'
                  }`}
                >
                  {sk}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Wpisz dowolną inną technologię (np. Terraform, Rust, Next.js, SEP)..."
                value={customBridgeSkill}
                onChange={(e) => setCustomBridgeSkill(e.target.value)}
                className="flex-1 rounded-xl border border-line bg-sunken px-3.5 py-2 text-xs text-ink focus:border-brand-500 focus:outline-none"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  if (customBridgeSkill.trim()) {
                    setMissingSkillInput(customBridgeSkill.trim());
                  }
                }}
              >
                Generuj most
              </Button>
            </div>
          </div>

          {/* Generated Bridge Card */}
          {activeBridge && (
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-danger-soft px-2.5 py-1 font-mono text-xs font-bold text-danger-fg">
                    Brak: {activeBridge.missingSkill}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted" />
                  <span className="rounded-md bg-success-soft px-2.5 py-1 font-mono text-xs font-bold text-success-fg">
                    Most: {activeBridge.adjacentSkill}
                  </span>
                </div>
                {/* Czas renderowany tylko, gdy silnik go policzył: silnik ma
                    własny default (7), a wpisanie tu drugiego (5) pokazywało
                    liczbę, której nikt nie wyliczył (audyt treści §2.2). */}
                {typeof activeBridge.learningCurveDays === 'number' && (
                  <span className="font-mono text-xs font-bold text-brand-600">
                    Czas wdrożenia: ~{activeBridge.learningCurveDays} dni
                  </span>
                )}
              </div>

              {/* Ready Script */}
              <div className="space-y-2">
                <p className="text-label font-bold uppercase tracking-wider text-muted">
                  Gotowa riposta do wypowiedzenia na głos:
                </p>
                <div className="rounded-xl bg-sunken p-4 text-sm text-ink leading-relaxed font-sans border-l-4 border-brand-500">
                  „{activeBridge.talkingPoint}”
                </div>
              </div>

              {/* Underlying Logic */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs text-muted pt-2">
                <div className="p-3 rounded-lg bg-surface border border-line">
                  <strong className="text-ink block mb-1">🔗 Ekwiwalencja pojęciowa:</strong>
                  {activeBridge.conceptualEquivalence}
                </div>
                <div className="p-3 rounded-lg bg-surface border border-line">
                  <strong className="text-ink block mb-1">📁 Dowód z MasterVault:</strong>
                  {activeBridge.evidenceFromVault || 'Brak jawnego projektu — wykorzystaj ogólne doświadczenie.'}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant={progress.completedLessons.includes('bridging_completed') ? 'ghost' : 'secondary'}
                  size="sm"
                  onClick={() => handleToggleLesson('bridging_completed')}
                >
                  {progress.completedLessons.includes('bridging_completed') ? '✓ Ukończono lekcję' : 'Oznacz jako opanowane'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: TRAPS & NEGOTIATION */}
      {activeSection === 'traps' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-warning/20 bg-warning-soft/30 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning text-on-warning">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-sans text-sm font-bold text-ink">
                  Taktyka 3: Typowe Pułapki i Trudne Pytania (Zarobki, Porażki, Zmiana pracy)
                </h4>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Rekrutacja to negocjacje partnerskie. Twoim celem nie jest podanie idealnej odpowiedzi według szablonu, ale obrona swojej wartości rynkowej i pokazanie dojrzałości inżynierskiej.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {trapScripts.map((trap) => (
              <div key={trap.id} className="rounded-2xl border border-line bg-surface p-6 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-fg">
                      {trap.topic}
                    </span>
                    <h2 className="font-sans text-sm md:text-base font-bold text-ink mt-1">
                      {trap.recruiterQuestion}
                    </h2>
                  </div>
                </div>

                <div className="rounded-lg bg-danger-soft/40 p-3 text-xs text-danger-fg">
                  <strong>⚠️ Gdzie tkwi pułapka?</strong> {trap.dangerReason}
                </div>

                <div className="space-y-3">
                  {trap.variants.map((v, i) => (
                    <div key={i} className="rounded-xl border border-line bg-sunken p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-ink">{v.title}</span>
                        <span className="text-[10px] font-mono font-semibold text-muted bg-surface px-2 py-0.5 rounded">
                          {v.badge}
                        </span>
                      </div>
                      <p className="text-xs md:text-sm text-ink leading-relaxed font-sans">
                        {v.script}
                      </p>
                      <p className="text-meta text-muted italic">
                        Dlaczego to działa: {v.rationale}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-brand-50/50 dark:bg-brand-950/20 text-xs text-brand-fg">
                  💡 <strong>Pro Tip:</strong> {trap.proTip}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant={progress.completedLessons.includes('traps_completed') ? 'ghost' : 'secondary'}
              size="sm"
              onClick={() => handleToggleLesson('traps_completed')}
            >
              {progress.completedLessons.includes('traps_completed') ? '✓ Ukończono lekcję' : 'Oznacz jako opanowane'}
            </Button>
          </div>
        </div>
      )}

      {/* SECTION 4: RED FLAGS & YOUR QUESTIONS */}
      {activeSection === 'questions' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-danger/20 bg-danger-soft/30 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger text-on-danger">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-sans text-sm font-bold text-ink">
                  Taktyka 4: Pytania, które TY zadajesz (Demaskowanie Red Flags)
                </h4>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Końcowe 10 minut rozmowy to moment, w którym Ty rekrutujesz firmę. Zadaj pytania o dług technologiczny, proces decyzyjny i powód rekrutacji, aby uniknąć projektów z toksyczną kulturą lub paraliżem wdrożeniowym.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {redFlagQuestions.map((q) => (
              <div key={q.id} className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] font-bold text-muted">
                    {q.categoryLabel}
                  </span>
                  <h4 className="font-sans text-sm font-bold text-ink">
                    {q.question}
                  </h4>
                  <p className="text-xs text-muted leading-relaxed">
                    🔍 <strong>Co badasz?</strong> {q.intentExplanation}
                  </p>
                </div>

                <div className="space-y-2 text-xs pt-2 border-t border-line">
                  <div className="rounded-lg bg-success-soft/50 p-2.5 text-success-fg">
                    <strong>🟢 Zielona flaga:</strong> {q.greenFlagAnswer}
                  </div>
                  <div className="rounded-lg bg-danger-soft/50 p-2.5 text-danger-fg">
                    <strong>🔴 Czerwona flaga:</strong> {q.redFlagWarning}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant={progress.completedLessons.includes('questions_completed') ? 'ghost' : 'secondary'}
              size="sm"
              onClick={() => handleToggleLesson('questions_completed')}
            >
              {progress.completedLessons.includes('questions_completed') ? '✓ Ukończono lekcję' : 'Oznacz jako opanowane'}
            </Button>
          </div>
        </div>
      )}

      {/* SECTION 5: LIVE TRACKER & CHECKLIST */}
      {activeSection === 'tracker' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-xs space-y-5">
            <h2 className="font-sans text-base font-bold text-ink flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-600" />
              Pre-Call Checklist (15 minut przed połączeniem)
            </h2>

            <div className="space-y-2">
              {preCallItems.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-line bg-sunken hover:bg-elevated cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => {
                      setPreCallItems((prev) =>
                        prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
                      );
                    }}
                    className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
                  />
                  <span className={`text-xs md:text-sm font-medium ${item.checked ? 'text-muted line-through' : 'text-ink'}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Drill Practice History Summary */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-sm font-bold text-ink">
                Historia treningów (Mock Drill)
              </h2>
              <span className="text-xs text-muted">
                Łącznie prób: <strong>{drillHistory.length}</strong>
              </span>
            </div>

            {drillHistory.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="Brak historii treningów"
                description="Nie przeprowadzono jeszcze żadnego szybkiego treningu w Mock Drill. Wykonaj pierwszą 60-sekundową próbę, aby zobaczyć tu wyniki."
                action={
                  onOpenDrill ? (
                    <Button type="button" variant="primary" size="sm" onClick={onOpenDrill}>
                      Rozpocznij pierwszy trening (60s)
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-2">
                {drillHistory.slice(0, 5).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-sunken border border-line text-xs"
                  >
                    <div>
                      <strong className="text-ink block">{attempt.questionText}</strong>
                      <span className="text-muted text-meta">
                        {new Date(attempt.recordedAt).toLocaleDateString('pl-PL')} • {attempt.durationSec}s
                      </span>
                    </div>
                    <span className="font-mono font-bold text-brand-600">
                      {attempt.scorecard.overallScore}/100 pkt
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
