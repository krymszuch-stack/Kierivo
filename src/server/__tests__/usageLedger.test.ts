import { describe, it, expect, vi, afterEach } from 'vitest';
import { recordUsage, estimateCostUsd } from '../usageLedger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Rejestr zużycia modelu', () => {
  it('nie wpisuje do logu ani promptu, ani odpowiedzi modelu', () => {
    // Prompt to CV użytkownika. Logi serwera nie są miejscem na dane osobowe.
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    recordUsage({ context: 'parse-cv', model: 'gemini-2.5-flash-lite', promptTokens: 10, outputTokens: 5 });

    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);

    expect(parsed.type).toBe('ai_usage');
    expect(parsed.promptTokens).toBe(10);
    expect(Object.keys(parsed)).not.toContain('prompt');
    expect(Object.keys(parsed)).not.toContain('contents');
    expect(Object.keys(parsed)).not.toContain('text');
  });

  it('normalizuje niepoprawne tokeny w faktycznym zdarzeniu logu', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    recordUsage({ context: 'parse-jd', model: 'gemini-2.5-flash-lite', promptTokens: NaN, outputTokens: -5 });
    const event = JSON.parse(logSpy.mock.calls[0][0] as string);

    expect(event.promptTokens).toBe(0);
    expect(event.outputTokens).toBe(0);
    expect(event.totalTokens).toBe(0);
    expect(event.estimatedCostUsd).toBe(0);
  });

  it('wycenia znane modele wg cennika za milion tokenów', () => {
    expect(estimateCostUsd('gemini-2.5-flash-lite', 1_000_000, 0)).toBeCloseTo(0.1, 8);
    expect(estimateCostUsd('gemini-3.6-flash', 0, 1_000_000)).toBeCloseTo(3.75, 8);
    expect(estimateCostUsd('nieznany', 1_000_000, 1_000_000)).toBeNull();
  });
});
