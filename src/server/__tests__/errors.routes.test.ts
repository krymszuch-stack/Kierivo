import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { errorsRouter } from '../routes/errors.routes';
import {
  listLocalErrorGroups,
  pruneClientErrors,
} from '../errorStore';
import * as supabaseModule from '../supabase';
import * as configModule from '../config';
import { errorHandler } from '../middleware/errorHandler';

/**
 * Wzorzec jak w `stripeWebhook.test.ts`: prawdziwy Express na losowym porcie,
 * zależności podstawiane per test. Magazyn lokalny kierujemy do katalogu
 * tymczasowego przez CLIENT_ERRORS_LOCAL_FILE — to jest produkcyjna zmienna
 * konfiguracyjna magazynu, nie atrapa tylko na potrzeby testów.
 */

const rpcMock = vi.fn();

function fakeSupabase() {
  return {
    rpc: rpcMock,
    from: () => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn(),
      delete: vi.fn(),
    }),
  } as unknown as ReturnType<typeof supabaseModule.getSupabase>;
}

let tmpDir: string;
let sinkFile: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'bledy-'));
  sinkFile = path.join(tmpDir, 'client-errors.jsonl');
  process.env.CLIENT_ERRORS_LOCAL_FILE = sinkFile;
  delete process.env.SUPABASE_URL;
  process.env.BACKEND_MODE = 'local';

  rpcMock.mockReset();
  vi.spyOn(configModule, 'loadConfig').mockReturnValue({
    backendEnabled: false,
    BACKEND_MODE: 'local',
  } as unknown as ReturnType<typeof configModule.loadConfig>);
  vi.spyOn(supabaseModule, 'getSupabase').mockImplementation(fakeSupabase);
});

afterEach(async () => {
  delete process.env.CLIENT_ERRORS_LOCAL_FILE;
  await rm(tmpDir, { recursive: true, force: true });
});

async function startApp(): Promise<{ url: (p: string) => string; close: () => Promise<void> }> {
  const app = express();
  app.use('/api', express.json({ limit: '200kb' }), errorsRouter);
  app.use(errorHandler);

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    url: (p: string) => `http://127.0.0.1:${port}/api${p}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Zgłoszenie poprawne wg kontraktu — fingerprint 16 hex, pola w limitach. */
function validEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fingerprint: 'a1b2c3d4e5f60718',
    kind: 'cv-export',
    surface: 'docxExporter',
    message: 'Cannot read properties of # (reading fullName)',
    env: 'prod',
    uaFamily: 'Chrome #',
    viewportBucket: 'w>=1536',
    occurredAt: '2026-08-26T10:00:00.000Z',
    ...overrides,
  };
}

describe('POST /api/errors', () => {
  it('tryb lokalny dopisuje zdarzenia do JSONL i odpowiada spójnym kształtem', async () => {
    const app = await startApp();
    try {
      const response = await fetch(app.url('/errors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [validEvent()] }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, mode: 'local' });

      const raw = await readFile(sinkFile, 'utf8');
      const line = JSON.parse(raw.trim()) as Record<string, unknown>;
      expect(line.fingerprint).toBe('a1b2c3d4e5f60718');
      // Znacznik przyjęcia dodaje magazyn; żadnych innych pól nie dorabia.
      expect(typeof line.receivedAt).toBe('string');
    } finally {
      await app.close();
    }
  });

  it('tryb cloud idzie przez RPC agregującego — jedna podróż na partię', async () => {
    process.env.BACKEND_MODE = 'cloud';
    vi.spyOn(configModule, 'loadConfig').mockReturnValue({
      backendEnabled: true,
      BACKEND_MODE: 'cloud',
    } as unknown as ReturnType<typeof configModule.loadConfig>);
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    const app = await startApp();
    try {
      const response = await fetch(app.url('/errors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [validEvent(), validEvent({ fingerprint: 'ffffffffffffffff', kind: 'ui-crash', surface: 'ui-crash:AppErrorBoundary' })],
        }),
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, mode: 'cloud' });
      expect(rpcMock).toHaveBeenCalledWith('record_client_errors', { p_events: expect.any(Array) });
    } finally {
      await app.close();
    }
  });

  it('odrzuca pole spoza kontraktu — strictObject jest częścią polityki anonimizacji', async () => {
    const app = await startApp();
    try {
      const response = await fetch(app.url('/errors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [validEvent({ user_id: 'próba przemycenia identyfikatora' })],
        }),
      });
      expect(response.status).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('odrzuca złe kind i zbyt dużą partię', async () => {
    const app = await startApp();
    try {
      const badKind = await fetch(app.url('/errors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [validEvent({ kind: 'cos-innego' })] }),
      });
      expect(badKind.status).toBe(400);

      const tooMany = await fetch(app.url('/errors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: Array.from({ length: 21 }, (_, i) => validEvent({ fingerprint: i.toString(16).padStart(16, '0') })),
        }),
      });
      expect(tooMany.status).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('awaria magazynu daje 500 bez wycieku szczegółów błędu bazy', async () => {
    process.env.BACKEND_MODE = 'cloud';
    vi.spyOn(configModule, 'loadConfig').mockReturnValue({
      backendEnabled: true,
      BACKEND_MODE: 'cloud',
    } as unknown as ReturnType<typeof configModule.loadConfig>);
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'connection refused 127.0.0.1:5432 sekret' } });

    const app = await startApp();
    try {
      const response = await fetch(app.url('/errors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [validEvent()] }),
      });

      expect(response.status).toBe(500);
      const json = (await response.json()) as { error: string };
      expect(json.error).not.toContain('127.0.0.1');
      expect(json.error).not.toContain('sekret');
    } finally {
      await app.close();
    }
  });

  it('dedykowany limiter odcina serię zgłoszeń z jednego IP (20/min)', async () => {
    const app = await startApp();
    try {
      let saw429 = false;
      for (let i = 0; i < 25; i++) {
        const response = await fetch(app.url('/errors'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: [validEvent()] }),
        });
        if (response.status === 429) saw429 = true;
      }
      expect(saw429).toBe(true);
    } finally {
      await app.close();
    }
  });
});

describe('magazyn lokalny — agregacja grup i retencja', () => {
  // Funkcje magazynu czytają CLIENT_ERRORS_LOCAL_FILE przy każdym wywołaniu,
  // więc podstawienie w beforeEach obejmuje też ten blok.
  it('agreguje zdarzenia po fingerprintzie do grup z licznikiem', async () => {
    const eventA = validEvent({ fingerprint: 'aaaaaaaaaaaaaaaa', receivedAt: undefined });
    const line = (event: Record<string, unknown>, receivedAt: string) =>
      JSON.stringify({ ...event, receivedAt }) + '\n';
    await writeFile(
      sinkFile,
      line(eventA, '2026-08-25T08:00:00.000Z') +
        line(eventA, '2026-08-25T09:00:00.000Z') +
        line(validEvent({ fingerprint: 'bbbbbbbbbbbbbbbb', surface: 'engine:linkedin' }), '2026-08-25T10:00:00.000Z'),
      'utf8'
    );

    const groups = await listLocalErrorGroups();
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.fingerprint === 'aaaaaaaaaaaaaaaa');
    expect(a?.occurrences).toBe(2);
    expect(a?.lastSeenAt).toBe('2026-08-25T09:00:00.000Z');
  });

  it('pomija poprawny składniowo, ale niezgodny kształtem JSONL i uszkodzony sidecar statusów', async () => {
    const valid = { ...validEvent({ fingerprint: 'eeeeeeeeeeeeeeee' }), receivedAt: '2026-08-26T10:00:00.000Z' };
    await writeFile(sinkFile, `${JSON.stringify(null)}\n${JSON.stringify({ fingerprint: 'bad' })}\n${JSON.stringify(valid)}\n`, 'utf8');
    await writeFile(sinkFile + '.status.json', 'null', 'utf8');

    const groups = await listLocalErrorGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ fingerprint: 'eeeeeeeeeeeeeeee', status: 'open', occurrences: 1 });
  });

  it('izoluje błędny wpis statusu sidecara i zachowuje pozostałe poprawne wpisy', async () => {
    const valid = { ...validEvent({ fingerprint: 'ffffffffffffffff' }), receivedAt: '2026-08-26T10:00:00.000Z' };
    await writeFile(sinkFile, `${JSON.stringify(valid)}\n`, 'utf8');
    await writeFile(sinkFile + '.status.json', JSON.stringify({
      ffffffffffffffff: { status: 'resolved', resolvedAt: '2026-08-25T10:00:00.000Z' },
      aaaaaaaaaaaaaaaa: { status: 'invented' },
    }), 'utf8');

    const groups = await listLocalErrorGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].status).toBe('resolved');
  });

  it('retencja usuwa rozwiązane po oknie i martwe otwarte, a statusy przechodzi w sidecarze', async () => {
    const nowIso = '2026-08-26T12:00:00.000Z';
    const oldResolved = validEvent({ fingerprint: 'cccccccccccccccc', occurredAt: nowIso });
    const freshOpen = validEvent({ fingerprint: 'dddddddddddddddd', occurredAt: nowIso });

    await writeFile(
      sinkFile,
      JSON.stringify({ ...oldResolved, receivedAt: '2026-07-01T00:00:00.000Z' }) + '\n' +
        JSON.stringify({ ...freshOpen, receivedAt: nowIso }) + '\n',
      'utf8'
    );
    // Sidecar piszemy bezpośrednio z „przestarzałą" datą rozwiązania: w realu
    // `rozwiaz` stawia resolved_at na moment oznaczenia, a starzenie dzieje się
    // dopiero po upływie okna retencji.
    await writeFile(
      sinkFile + '.status.json',
      JSON.stringify({ cccccccccccccccc: { status: 'resolved', resolvedAt: '2026-08-01T00:00:00.000Z' } }),
      'utf8'
    );

    const { removed, mode } = await pruneClientErrors({ resolvedDays: 14, openDays: 90 });
    // resolved 25 dni temu → poza oknem 14 dni; open świeży → zostaje.
    expect(mode).toBe('local');
    expect(removed).toBe(1);

    const groups = await listLocalErrorGroups();
    expect(groups.map((g) => g.fingerprint)).toEqual(['dddddddddddddddd']);
  });
});
