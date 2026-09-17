/**
 * Czysta maszyna stanów osi czasu demo na stronie startowej.
 *
 * Wydzielona do `src/lib` z tego samego powodu co `animationMath.ts`: logika
 * animacji bez DOM-u da się przetestować w Vitestcie bez atrapy przeglądarki,
 * a komponent zostaje cienkim spięciem (wzorzec `deferredWriter.ts`).
 *
 * Liczby czasów pochodzą z tokenów rytmu animacji (`tokens.css`):
 * --duration-fast 150 / --duration-ui 200 / --duration-state 400 /
 * --duration-data 700. Fazy pisania zależą od długości tekstu, więc są
 * policzone, nie zmyślone.
 */

export const DEMO_PHASE_ORDER = [
  'idle',
  'typing-cv',
  'typing-jd',
  'press',
  'computing',
  'result',
  'hold',
] as const;

export type DemoPhase = (typeof DEMO_PHASE_ORDER)[number];

export type DemoDurations = Record<DemoPhase, number>;

/** Klasa wyniku przypisana do progu — ta sama zasada co w QuickAtsCheck. */
export type DemoScoreTone = 'high' | 'mid' | 'low';

export interface DemoPhaseState {
  phase: DemoPhase;
  /** Milisekundy od początku bieżącej fazy. */
  elapsed: number;
}

export const DEFAULT_STEP_DURATIONS: Omit<DemoDurations, 'typing-cv' | 'typing-jd'> = {
  idle: 800,
  press: 200,
  computing: 400,
  result: 700,
  // 3,8 s na przeczytanie wyniku: przy 4,2 s cały cykl wychodził równo 15 s
  // i bez sensu obijał się o granicę, którą demo ma zmieścić.
  hold: 3800,
};

/**
 * Kadencja pisania. 6 ms/znak (~165 znaków/s) to tempo „przyspieszonej ręki”:
 * wolniejsze tempo wydłużałoby cykl demo na stronie startowej ponad ~15 s
 * (przy ~950 znakach CV 14 ms/znak oznacza 13 s samego pisania), a demo ma
 * zapętliać się zanim odwiedzający zdąży się znudzić.
 */
export const TYPING_MS_PER_CHAR = 6;

export function typingDuration(charCount: number, msPerChar = TYPING_MS_PER_CHAR): number {
  return Math.max(0, Math.round(charCount * msPerChar));
}

/** Składa pełny rozkład faz dla konkretnych długości tekstów. */
export function buildDurations(cvChars: number, jdChars: number): DemoDurations {
  return {
    ...DEFAULT_STEP_DURATIONS,
    'typing-cv': typingDuration(cvChars),
    'typing-jd': typingDuration(jdChars),
  };
}

/**
 * Faza w chwili `t`. Czas wykraczający poza cykl zawija się od nowa —
 * demo zapętla się samo, bez dodatkowego stanu w komponencie.
 */
export function phaseAt(t: number, durations: DemoDurations): DemoPhaseState {
  const total = totalDuration(durations);
  if (total <= 0) return { phase: 'hold', elapsed: 0 };

  let remaining = ((t % total) + total) % total;
  for (const phase of DEMO_PHASE_ORDER) {
    const d = durations[phase];
    if (remaining < d) return { phase, elapsed: remaining };
    remaining -= d;
  }
  // Nieosiliwe przy poprawnym rozkładzie; awaryjnie koniec cyklu.
  return { phase: 'hold', elapsed: 0 };
}

export function totalDuration(durations: DemoDurations): number {
  return DEMO_PHASE_ORDER.reduce((sum, phase) => sum + Math.max(0, durations[phase]), 0);
}

/**
 * Ile znaków tekstu jest widocznych w fazie pisania. Poza fazą pisania zwraca
 * pełną długość (wynik musi pokazywać to, co „wpisano”), dla ujemnych — zero.
 */
export function typedCharCount(
  textLength: number,
  phase: DemoPhase,
  elapsed: number,
  typingPhase: Extract<DemoPhase, 'typing-cv' | 'typing-jd'>,
  msPerChar = TYPING_MS_PER_CHAR
): number {
  if (phase !== typingPhase) return textLength;
  if (msPerChar <= 0) return textLength;
  return Math.max(0, Math.min(textLength, Math.floor(elapsed / msPerChar)));
}

/** Skrót tekstu do n znaków widocznych w danej chwili. */
export function typedText(text: string, visibleChars: number): string {
  if (visibleChars <= 0) return '';
  return text.slice(0, Math.min(text.length, visibleChars));
}

/** Próg tonu wyniku — zgodnie z scoreTone() z QuickAtsCheck (≥75 / ≥50 / niżej). */
export function scoreTone(score: number): DemoScoreTone {
  if (score >= 75) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

/**
 * Stan końcowy dla `prefers-reduced-motion`: cały tekst widoczny, faza
 * wynikowa — nic nie biega, wszystko jest czytelne statycznie.
 */
export function finalStaticState(durations: DemoDurations): DemoPhaseState {
  return { phase: 'hold', elapsed: durations.hold };
}
