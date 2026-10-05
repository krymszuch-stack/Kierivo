import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ClientErrorEvent } from '../types/contracts';
import { clientErrorEventSchema } from '../types/contracts';
import { z } from 'zod';
import { loadConfig } from './config';
import { getSupabase } from './supabase';

/**
 * Magazyn zgłoszeń błędów klienta — jedyne miejsce znające oba zaplecza.
 *
 * `cloud`  — tabela `client_errors` przez RPC `record_client_errors`: jedna
 *            grupa na fingerprint, licznik wystąpień doliczany atomowo po
 *            stronie bazy. Nawrót na grupie resolved otwiera ją ponownie
 *            (logika w migracji 0008), więc regres nie umyka bramce wdrożeniowej.
 * `local`  — plik JSONL (domyślnie `logs/client-errors.jsonl`, nadpisywany
 *            zmienną CLIENT_ERRORS_LOCAL_FILE). Tryb bez bazy musi mieć gdzie
 *            pisać, bo zgłoszenia to dane operacyjne serwera, nie przeglądarki.
 *
 * Anonimizacja została wykonana u źródła (sanityzer klienta); ta warstwa nie
 * wzbogaca zgłoszeń o nic poza znacznikiem czasu przyjęcia — celowo, żeby tu
 * nie powstał drugi kanał danych osobowych.
 */

export interface RecordResult {
  stored: number;
  mode: 'cloud' | 'local';
}

/**
 * Tryb magazynu rozpoznawany też poza procesem serwera: CLI i bramka CI nie
 * mają kompletu konfiguracji aplikacji (nie potrzebują GEMINI_API_KEY), więc
 * `loadConfig()` może się wywrócić — wtedy decyduje sama obecność kluczy
 * Supabase w środowisku. Serwer zawsze przechodzi tu przez pełną konfigurację,
 * więc dla tras nic się nie zmienia.
 */
function resolveMode(): 'cloud' | 'local' {
  try {
    return loadConfig().backendEnabled ? 'cloud' : 'local';
  } catch {
    return process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
      ? 'cloud'
      : 'local';
  }
}

export async function recordClientErrors(events: ClientErrorEvent[]): Promise<RecordResult> {
  const mode = resolveMode();

  if (mode === 'cloud') {
    const { error } = await getSupabase().rpc('record_client_errors', {
      p_events: events,
    });
    if (error) {
      // Szczegół błędu bazy zostaje w logu serwera (errorHandler), klient dostaje
      // komunikat ogólny — ta sama granica co w pozostałych trasach.
      console.error('[errorStore] RPC record_client_errors nie powiodło się:', error);
      throw new Error('Nie udało się zapisać zgłoszeń błędów.');
    }
    return { stored: events.length, mode: 'cloud' };
  }

  await appendLocalEvents(events);
  return { stored: events.length, mode: 'local' };
}

function localSinkPath(): string {
  return (
    process.env.CLIENT_ERRORS_LOCAL_FILE ||
    path.join(process.cwd(), 'logs', 'client-errors.jsonl')
  );
}

async function appendLocalEvents(events: ClientErrorEvent[]): Promise<void> {
  const file = localSinkPath();
  await mkdir(path.dirname(file), { recursive: true });
  const receivedAt = new Date().toISOString();
  const lines = events.map((event) => JSON.stringify({ ...event, receivedAt })).join('\n') + '\n';
  await appendFile(file, lines, 'utf8');
}

// ---------------------------------------------------------------------------
// Odczyt i polityka retencji — konsumenci: CLI scripts/bledy-klienta.ts
// ---------------------------------------------------------------------------

export interface ErrorGroup {
  fingerprint: string;
  kind: string;
  surface: string;
  message: string;
  occurrences: number;
  status: 'open' | 'triaged' | 'resolved';
  firstSeenAt: string;
  lastSeenAt: string;
  env?: string | null;
  uaFamily?: string | null;
  viewportBucket?: string | null;
  linearIssueUrl?: string | null;
}

/** Statusy zapisywane lokalnie obok JSONL-a, bo surowe zdarzenia ich nie niosą. */
interface LocalStatusEntry {
  status: ErrorGroup['status'];
  resolvedAt?: string;
}

const localStatusEntrySchema = z.object({
  status: z.enum(['open', 'triaged', 'resolved']),
  resolvedAt: z.iso.datetime().optional(),
});
const storedClientErrorSchema = clientErrorEventSchema.extend({
  receivedAt: z.iso.datetime().optional(),
});

function localStatusPath(): string {
  return `${localSinkPath()}.status.json`;
}

async function readLocalStatuses(): Promise<Record<string, LocalStatusEntry>> {
  try {
    const raw = await readFile(localStatusPath(), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const statuses: Record<string, LocalStatusEntry> = {};
    for (const [fingerprint, value] of Object.entries(parsed)) {
      const entry = localStatusEntrySchema.safeParse(value);
      if (/^[0-9a-f]{16}$/.test(fingerprint) && entry.success) statuses[fingerprint] = entry.data;
    }
    return statuses;
  } catch {
    return {};
  }
}

/** Agregacja lokalnego JSONL-a do tych samych grup co tabela w chmurze. */
export async function listLocalErrorGroups(): Promise<ErrorGroup[]> {
  let raw: string;
  try {
    raw = await readFile(localSinkPath(), 'utf8');
  } catch {
    return [];
  }

  const statuses = await readLocalStatuses();
  const groups = new Map<string, ErrorGroup>();

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const result = storedClientErrorSchema.safeParse(JSON.parse(trimmed));
      if (!result.success) continue;
      const event = result.data;
      const existing = groups.get(event.fingerprint);
      if (!existing) {
        const local = statuses[event.fingerprint];
        groups.set(event.fingerprint, {
          fingerprint: event.fingerprint,
          kind: event.kind,
          surface: event.surface,
          message: event.message,
          occurrences: 1,
          status: local?.status ?? 'open',
          firstSeenAt: event.receivedAt ?? event.occurredAt,
          lastSeenAt: event.receivedAt ?? event.occurredAt,
          env: event.env ?? null,
          uaFamily: event.uaFamily ?? null,
          viewportBucket: event.viewportBucket ?? null,
        });
      } else {
        existing.occurrences += 1;
        if ((event.receivedAt ?? event.occurredAt) > existing.lastSeenAt) {
          existing.lastSeenAt = event.receivedAt ?? event.occurredAt;
        }
      }
    } catch {
      // Uszkodzona linia (ucięty zapis) nie unieważnia reszty magazynu.
    }
  }

  return [...groups.values()].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function setLocalErrorStatus(
  fingerprints: string[],
  status: ErrorGroup['status']
): Promise<number> {
  if (fingerprints.length === 0) return 0;
  const statuses = await readLocalStatuses();
  for (const fingerprint of fingerprints) {
    statuses[fingerprint] = {
      status,
      ...(status === 'resolved' ? { resolvedAt: new Date().toISOString() } : {}),
    };
  }
  const file = localStatusPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(statuses, null, 2), 'utf8');
  return fingerprints.length;
}

export interface RetentionPolicy {
  /** Usuwaj grupy resolved po tylu dniach od rozwiązania. */
  resolvedDays: number;
  /** Usuwaj otwarte grupy nietykane od tylu dni (martwy szum). */
  openDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function pruneClientErrors(policy: RetentionPolicy): Promise<{ removed: number; mode: 'cloud' | 'local' }> {
  const mode = resolveMode();
  const now = Date.now();
  const resolvedCutoff = new Date(now - policy.resolvedDays * DAY_MS).toISOString();
  const openCutoff = new Date(now - policy.openDays * DAY_MS).toISOString();

  if (mode === 'cloud') {
    const supabase = getSupabase();
    let removed = 0;

    const resolvedResult = await supabase
      .from('client_errors')
      .delete({ count: 'exact' })
      .eq('status', 'resolved')
      .lt('resolved_at', resolvedCutoff);
    if (resolvedResult.error) throw new Error('Retencja (resolved) nie powiodła się.');
    removed += resolvedResult.count ?? 0;

    const staleOpenResult = await supabase
      .from('client_errors')
      .delete({ count: 'exact' })
      .in('status', ['open', 'triaged'])
      .lt('last_seen_at', openCutoff);
    if (staleOpenResult.error) throw new Error('Retencja (open) nie powiodła się.');
    removed += staleOpenResult.count ?? 0;

    return { removed, mode: 'cloud' };
  }

  // Lokalnie: przepisz plik, zostawiając tylko zdarzenia objęte polityką.
  const groupsBefore = await listLocalErrorGroups();
  const statuses = await readLocalStatuses();

  const keepFingerprint = (group: ErrorGroup): boolean => {
    if (group.status === 'resolved') {
      const resolvedAtMs = statuses[group.fingerprint]?.resolvedAt
        ? Date.parse(statuses[group.fingerprint].resolvedAt as string)
        : Date.parse(group.lastSeenAt);
      return now - resolvedAtMs < policy.resolvedDays * DAY_MS;
    }
    return now - Date.parse(group.lastSeenAt) < policy.openDays * DAY_MS;
  };

  const kept = groupsBefore.filter(keepFingerprint);
  const removed = groupsBefore.length - kept.length;
  if (removed === 0) return { removed: 0, mode: 'local' };

  const keepSet = new Set(kept.map((g) => g.fingerprint));
  const rawLines = (await readFile(localSinkPath(), 'utf8').catch(() => '')).split('\n');
  const survivingLines: string[] = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const result = storedClientErrorSchema.safeParse(JSON.parse(trimmed));
      if (result.success && keepSet.has(result.data.fingerprint)) survivingLines.push(trimmed);
    } catch {
      /* uszkodzone linie przy okazji znikają */
    }
  }

  await mkdir(path.dirname(localSinkPath()), { recursive: true });
  await writeFile(localSinkPath(), survivingLines.join('\n') + (survivingLines.length > 0 ? '\n' : ''), 'utf8');

  // Sidecar statusów czyścimy z wpisów o znikniętych grupach.
  const nextStatuses: Record<string, LocalStatusEntry> = {};
  for (const [fingerprint, entry] of Object.entries(statuses)) {
    if (keepSet.has(fingerprint)) nextStatuses[fingerprint] = entry;
  }
  await writeFile(localStatusPath(), JSON.stringify(nextStatuses, null, 2), 'utf8');

  return { removed, mode: 'local' };
}

// ---------------------------------------------------------------------------
// Lista i cykl życia grup — wspólny interfejs dla obu zapleczy (CLI)
// ---------------------------------------------------------------------------

interface CloudErrorRow {
  fingerprint: string;
  kind: string;
  surface: string;
  message: string;
  occurrences: number;
  status: ErrorGroup['status'];
  first_seen_at: string;
  last_seen_at: string;
  env: string | null;
  ua_family: string | null;
  viewport_bucket: string | null;
  linear_issue_url: string | null;
}

function rowToGroup(row: CloudErrorRow): ErrorGroup {
  return {
    fingerprint: row.fingerprint,
    kind: row.kind,
    surface: row.surface,
    message: row.message,
    occurrences: row.occurrences,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    env: row.env,
    uaFamily: row.ua_family,
    viewportBucket: row.viewport_bucket,
    linearIssueUrl: row.linear_issue_url,
  };
}

export async function listErrorGroups(limit = 30): Promise<{ mode: 'cloud' | 'local'; groups: ErrorGroup[] }> {
  const mode = resolveMode();

  if (mode === 'cloud') {
    const { data, error } = await getSupabase()
      .from('client_errors')
      .select('*')
      .order('last_seen_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error('Odczyt zgłoszeń błędów nie powiódł się.');
    return { mode, groups: ((data ?? []) as CloudErrorRow[]).map(rowToGroup) };
  }

  const groups = await listLocalErrorGroups();
  return { mode, groups: groups.slice(0, limit) };
}

/**
 * Zmiana statusu grupy. `'all'` obejmuje każdą nierozwiązaną grupę — to jest
 * właśnie polityka logów opisana w zadaniu: przyczyna ustąpiła → oznaczamy,
 * a retencja (`czysc`) usuwa rozwiązane po upływie okna.
 */
export async function setErrorStatus(
  target: string | 'all',
  status: ErrorGroup['status']
): Promise<number> {
  const mode = resolveMode();

  if (mode === 'cloud') {
    const supabase = getSupabase();
    const patch =
      status === 'resolved'
        ? { status, resolved_at: new Date().toISOString() }
        : { status, resolved_at: null };

    let query = supabase.from('client_errors').update(patch);
    query = target === 'all' ? query.neq('status', 'resolved') : query.eq('fingerprint', target);

    // `select` po update jest wymagany, żeby dostać liczbę zmienionych wierszy.
    const { data, error } = await query.select('fingerprint');
    if (error) throw new Error('Zmiana statusu nie powiodła się.');
    return data?.length ?? 0;
  }

  if (target === 'all') {
    const groups = await listLocalErrorGroups();
    const open = groups.filter((g) => g.status !== 'resolved').map((g) => g.fingerprint);
    return setLocalErrorStatus(open, status);
  }

  return setLocalErrorStatus([target], status);
}
