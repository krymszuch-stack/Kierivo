import { describe, it, expect } from 'vitest';
import {
  DEMO_PHASE_ORDER,
  buildDurations,
  phaseAt,
  totalDuration,
  typedCharCount,
  typedText,
  scoreTone,
  finalStaticState,
  typingDuration,
  TYPING_MS_PER_CHAR,
} from '../demoTimeline';

/** Mały, ręcznie policzalny rozkład — test ma być czytelny, nie realistyczny. */
const SMALL = {
  idle: 100,
  'typing-cv': 50,
  'typing-jd': 60,
  press: 20,
  computing: 40,
  result: 70,
  hold: 110,
};

describe('kolejność i granice faz', () => {
  it('startuje z fazy idle', () => {
    expect(phaseAt(0, SMALL)).toEqual({ phase: 'idle', elapsed: 0 });
  });

  it('wchodzi w pisanie CV dopiero po idle', () => {
    expect(phaseAt(99, SMALL).phase).toBe('idle');
    expect(phaseAt(100, SMALL)).toEqual({ phase: 'typing-cv', elapsed: 0 });
    expect(phaseAt(140, SMALL)).toEqual({ phase: 'typing-cv', elapsed: 40 });
  });

  it('przechodzi przez wszystkie fazy w zadeklarowanej kolejności', () => {
    const seen: string[] = [];
    for (let t = 0; t < totalDuration(SMALL); t += 10) {
      const { phase } = phaseAt(t, SMALL);
      if (seen[seen.length - 1] !== phase) seen.push(phase);
    }
    expect(seen).toEqual([...DEMO_PHASE_ORDER]);
  });

  it('zawija cykl od nowa po hold — demo zapętla się bez stanu w komponencie', () => {
    const total = totalDuration(SMALL);
    expect(total).toBe(450);
    expect(phaseAt(total, SMALL).phase).toBe('idle');
    // 30 ms po zawinięciu to wciąż idle (trwa 100 ms), nie pisanie.
    expect(phaseAt(total + 30, SMALL)).toEqual({ phase: 'idle', elapsed: 30 });
    expect(phaseAt(total + 100, SMALL)).toEqual({ phase: 'typing-cv', elapsed: 0 });
  });
});

describe('pisanie i cięcie tekstu', () => {
  it('liczy znaki z czasu fazy: elapsed/msPerChar, obcięte do długości', () => {
    // SMALL['typing-cv'] = 50 ms, 6 ms/znak → maks. 8 znaków w tej fazie.
    expect(typedCharCount(200, 'typing-cv', 30, 'typing-cv')).toBe(5);
    expect(typedCharCount(200, 'typing-cv', 48, 'typing-cv')).toBe(8);
  });

  it('poza fazą pisania pokazuje pełny tekst — wynik nie może być ucięty', () => {
    expect(typedCharCount(200, 'hold', 10, 'typing-cv')).toBe(200);
    expect(typedCharCount(200, 'idle', 10, 'typing-jd')).toBe(200);
  });

  it('nie wychodzi poza tekst nawet przy przekroczonym czasie', () => {
    expect(typedCharCount(7, 'typing-cv', 60, 'typing-cv')).toBe(7);
    expect(typedCharCount(0, 'typing-cv', 30, 'typing-cv')).toBe(0);
  });

  it('typedText tnie bezpiecznie, w tym dla zera i nadmiaru', () => {
    expect(typedText('abcdef', 3)).toBe('abc');
    expect(typedText('abcdef', 0)).toBe('');
    expect(typedText('abc', 99)).toBe('abc');
  });
});

describe('rozkład czasów z tokenów', () => {
  it('fazy pisania wynikają z długości tekstu i kadencji', () => {
    const durations = buildDurations(100, 50);
    expect(durations['typing-cv']).toBe(100 * TYPING_MS_PER_CHAR);
    expect(durations['typing-jd']).toBe(50 * TYPING_MS_PER_CHAR);
    expect(typingDuration(0)).toBe(0);
  });

  it('kadencja 6 ms/znak trzyma cały cykl poniżej ~15 s dla realnych treści', () => {
    // CV demo ≈ 950 znaków, JD ≈ 500; pisanie ≈ 8,7 s + fazy stałe ≈ 6,3 s.
    const durations = buildDurations(950, 500);
    expect(totalDuration(durations)).toBeLessThan(15_000);
    expect(totalDuration(durations)).toBeGreaterThan(5_000);
  });
});

describe('ton wyniku i stan statyczny', () => {
  it('progi tonu: 75 / 50 — te same co scoreTone w QuickAtsCheck', () => {
    expect(scoreTone(75)).toBe('high');
    expect(scoreTone(74.9)).toBe('mid');
    expect(scoreTone(50)).toBe('mid');
    expect(scoreTone(49)).toBe('low');
  });

  it('reduced-motion → faza końcowa, bez liczenia osi czasu', () => {
    const durations = buildDurations(950, 500);
    const state = finalStaticState(durations);
    expect(state.phase).toBe('hold');
    expect(state.elapsed).toBe(durations.hold);
  });
});
