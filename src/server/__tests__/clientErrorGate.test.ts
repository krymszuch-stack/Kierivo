import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';

const directory = mkdtempSync(join(tmpdir(), 'kierivo-error-gate-'));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function gate(file: string, required = false, cloud = false) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/bledy-klienta.ts', 'bramka', ...(required ? ['--required'] : []), ...(cloud ? ['--cloud'] : [])], {
    encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, BACKEND_MODE: 'local', AI_PROVIDER: 'ollama', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', CLIENT_ERRORS_LOCAL_FILE: file },
  });
  return { code: result.status, output: result.stdout + result.stderr };
}

describe('bramka zgłoszeń klienta — brak dowodu nie oznacza PASS', () => {
  it('lokalny brak pliku jest SKIPPED, bez deklaracji powodzenia', () => {
    const result = gate(join(directory, 'missing.jsonl'));
    expect(result.code).toBe(0);
    expect(result.output).toContain('SKIPPED');
    expect(result.output).not.toContain('PASS');
  });
  it('wymagany brak źródła blokuje wydanie jako UNKNOWN', () => {
    const result = gate(join(directory, 'missing.jsonl'), true);
    expect(result.code).toBe(2);
    expect(result.output).toContain('UNKNOWN');
  });
  it('uszkodzony JSONL nie daje pustej, zielonej listy', () => {
    const file = join(directory, 'corrupt.jsonl');
    writeFileSync(file, '{broken\n');
    const result = gate(file, true);
    expect(result.code).toBe(2);
    expect(result.output).toContain('UNKNOWN');
  });
  it('odczytany pusty plik potwierdza wyłącznie brak zgłoszeń w źródle', () => {
    const file = join(directory, 'empty.jsonl');
    writeFileSync(file, '');
    const result = gate(file, true);
    expect(result.code).toBe(0);
    expect(result.output).toContain('PASS');
    expect(result.output).not.toContain('wdrażanie może ruszyć');
  });
  it('pusty plik lokalny nie zastępuje wymaganego źródła chmurowego', () => {
    const file = join(directory, 'cloud-required.jsonl');
    writeFileSync(file, '');
    expect(gate(file, true, true)).toMatchObject({ code: 2, output: expect.stringContaining('UNKNOWN') });
  });
  it('nawrót po resolved znów blokuje wydanie', () => {
    const file = join(directory, 'recurrence.jsonl');
    const fingerprint = 'a1b2c3d4e5f60718';
    writeFileSync(file, JSON.stringify({ fingerprint, kind: 'cv-export', surface: 'export', message: 'Synthetic error', occurredAt: '2026-10-13T12:00:00.000Z' }) + '\n');
    writeFileSync(`${file}.status.json`, JSON.stringify({ [fingerprint]: { status: 'resolved', resolvedAt: '2026-10-12T12:00:00.000Z' } }));
    expect(gate(file, true)).toMatchObject({ code: 1, output: expect.stringContaining('FAIL') });
  });
  it('rozwiązanie późniejsze od ostatniego zdarzenia pozostaje zamknięte', () => {
    const file = join(directory, 'resolved.jsonl');
    const fingerprint = 'a1b2c3d4e5f60718';
    writeFileSync(file, JSON.stringify({ fingerprint, kind: 'cv-export', surface: 'export', message: 'Synthetic error', occurredAt: '2026-10-12T12:00:00.000Z' }) + '\n');
    writeFileSync(`${file}.status.json`, JSON.stringify({ [fingerprint]: { status: 'resolved', resolvedAt: '2026-10-13T12:00:00.000Z' } }));
    expect(gate(file, true)).toMatchObject({ code: 0, output: expect.stringContaining('PASS') });
  });
});
