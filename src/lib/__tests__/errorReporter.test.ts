import { beforeEach, describe, expect, it } from 'vitest';
import { createErrorReporter, viewportBucket, detectUaFamily } from '../errorReporter';
import type { ClientErrorEvent } from '../../types/contracts';
import { MemoryStorage } from './helpers/memoryStorage';
import { resetLastGoodCache } from '../storage';

/**
 * Reporter jest fabryką z wstrzykiwanymi zależnościami właśnie po to, żeby
 * testy biegnące w Node nie potrzebowały ani `navigator.sendBeacon`, ani sieci.
 * Konwencja atrap: jak w `localProfile.test.ts` — ręczne podstawienie schowka.
 */

interface Harness {
  sent: Array<{ events: ClientErrorEvent[] }>;
  state: { failNext: boolean };
}

function createHarness(overrides: Record<string, unknown> = {}): { reporter: ReturnType<typeof createErrorReporter>; harness: Harness } {
  const harness: Harness = {
    sent: [],
    state: { failNext: false },
  };

  const reporter = createErrorReporter({
    now: () => 1_000_000,
    env: () => 'prod',
    sendBatch: async (payload) => {
      if (harness.state.failNext) return false;
      harness.sent.push(payload);
      return true;
    },
    loadBuffered: () => [],
    persistBuffered: () => undefined,
    ...overrides,
  });

  return { reporter, harness };
}

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  resetLastGoodCache();
});

describe('createErrorReporter', () => {
  it('buduje zdarzenie zgodne z kontraktem i wysyła partię przy flushu', async () => {
    const { reporter, harness } = createHarness();
    reporter.report({ kind: 'cv-export', surface: 'docxExporter', error: new TypeError('boom at 42') });

    expect(reporter.pendingCount()).toBe(1);
    await reporter.flush();

    expect(harness.sent).toHaveLength(1);
    const event = harness.sent[0].events[0];
    expect(event.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(event.kind).toBe('cv-export');
    expect(event.surface).toBe('docxExporter');
    expect(event.env).toBe('prod');
    expect(event.occurredAt).toContain('T');
    // Sanityzacja działa również na tej ścieżce — cyfra z komunikatu znika.
    expect(event.message).not.toContain('42');
  });

  it('throttling per fingerprint: powtórka w krótkim odstępie nie trafia do kolejki', () => {
    let fakeNow = 1_000_000;
    const { reporter } = createHarness({ now: () => fakeNow });
    const input = { kind: 'uncaught' as const, surface: 'global:error', message: 'ten sam błąd' };

    reporter.report(input);
    reporter.report(input);
    expect(reporter.pendingCount()).toBe(1);

    fakeNow += 61_000;
    reporter.report(input);
    expect(reporter.pendingCount()).toBe(2);
  });

  it('limit sesyjny zatrzymuje przyjmowanie zgłoszeń — pętla awarii nie zasypie API', () => {
    const { reporter } = createHarness();
    for (let i = 0; i < 40; i++) {
      reporter.report({ kind: 'uncaught', surface: 'global:error', message: `unikowy błąd numer ${i}` });
    }
    // Kapitał sesyjny to 25 zdarzeń.
    expect(reporter.pendingCount()).toBeLessThanOrEqual(25 + 1);
  });

  it('nieudana wysyłka zwraca zdarzenia do kolejki — nic nie ginie między flushami', async () => {
    const persisted: ClientErrorEvent[][] = [];
    const { reporter, harness } = createHarness({
      persistBuffered: (events: ClientErrorEvent[]) => persisted.push([...events]),
    });

    reporter.report({ kind: 'uncaught', surface: 'global:error', message: 'awaria sieci' });
    harness.state.failNext = true;
    await reporter.flush();

    expect(harness.sent).toHaveLength(0);
    expect(reporter.pendingCount()).toBe(1);
    // Bufor utrwalony mimo porażki — reguła 9: odłożenie wymaga gwarancji dosłania.
    expect(persisted.at(-1)).toHaveLength(1);

    harness.state.failNext = false;
    await reporter.flush();
    expect(harness.sent).toHaveLength(1);
  });

  it('bufor z poprzedniej sesji wraca do kolejki przy tworzeniu reportera', async () => {
    const stale: ClientErrorEvent[] = [
      {
        fingerprint: 'aaaaaaaaaaaaaaaa',
        kind: 'ui-crash',
        surface: 'ui-crash:AppErrorBoundary',
        message: '(brak komunikatu) ui-crash',
        occurredAt: new Date(0).toISOString(),
      },
    ];
    const harnessSent: Array<{ events: ClientErrorEvent[] }> = [];
    const reporter = createErrorReporter({
      sendBatch: async (payload) => {
        harnessSent.push(payload);
        return true;
      },
      loadBuffered: () => stale,
      persistBuffered: () => undefined,
    });

    expect(reporter.pendingCount()).toBe(1);
    await reporter.flush();
    expect(harnessSent[0].events[0].fingerprint).toBe('aaaaaaaaaaaaaaaa');
  });

  it('odrzuca uszkodzone zdarzenia z bufora i utrwala oczyszczoną kolejkę', async () => {
    const valid: ClientErrorEvent = {
      fingerprint: 'bbbbbbbbbbbbbbbb', kind: 'ui-crash', surface: 'ui-crash:Boundary',
      message: 'synthetic failure', occurredAt: new Date(0).toISOString(),
    };
    const persisted: ClientErrorEvent[][] = [];
    const { reporter, harness } = createHarness({
      loadBuffered: () => [valid, null, { ...valid, userEmail: 'private@example.test' }],
      persistBuffered: (events: ClientErrorEvent[]) => persisted.push([...events]),
    });

    expect(reporter.pendingCount()).toBe(1);
    expect(persisted).toEqual([[valid]]);
    await reporter.flush();

    expect(harness.sent).toEqual([{ events: [valid] }]);
    expect(reporter.pendingCount()).toBe(0);
  });

  it('report nigdy nie rzuca — nawet gdy budowa zdarzenia się wywróci', () => {
    const { reporter } = createHarness();
    expect(() =>
      reporter.report({
        kind: 'uncaught',
        surface: 'global:error',
        error: Symbol('nieserializowalny'),
      })
    ).not.toThrow();
  });
});

describe('heurystyki środowiska', () => {
  it('rozpoznaje rodzinę przeglądarki z pełnego UA — Edge przed Chrome, bo UA Edge zawiera oba tokeny', () => {
    const edge =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.3285.1';
    expect(detectUaFamily(edge)).toBe('Edge 140');

    const chrome = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36';
    expect(detectUaFamily(chrome)).toBe('Chrome 139');
  });

  it('sprowadza szerokość okna do widełek', () => {
    expect(viewportBucket(360)).toBe('w<480');
    expect(viewportBucket(1920)).toBe('w>=1536');
  });
});
