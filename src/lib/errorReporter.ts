import type { ClientErrorEvent } from '../types/contracts';
import { clientEnv } from './clientEnv';
import {
  buildFingerprint,
  parseStack,
  sanitizeError,
  sanitizeMessage,
  type ClientErrorKind,
  type SanitizedStackFrame,
} from './errorSanitizer';
import { readJson, StorageKeys, writeJson } from './storage';
import { parseClientErrorBuffer } from './clientErrorBuffer';

/**
 * Kolejka zgłoszeń błędów klienta do `/api/errors`.
 *
 * Dwie twarde zasady wynikają z historii tego repo:
 *
 * 1. **Telemetria nigdy nie może psuć aplikacji.** Każda ścieżka reportera jest
 *    obłożona try/catch połykającym wyjątki; awaria wysyłki to dla użytkownika
 *    no-op. Reporter nie może też raportować sam siebie — brak takiej pętli jest
 *    pilnowany konstrukcją (żadna funkcja tutaj nie rzuca).
 *
 * 2. **Odłożenie zapisu wymaga gwarancji dosłania** (reguła 9). Zdarzenia czekają
 *    w localStorage pod kluczem z rejestru `storage.ts`, więc przeżyją zamknięcie
 *    karty. Wysyłka idzie przez `navigator.sendBeacon` przy ukryciu karty
 *    (`visibilitychange`) i zamknięciu strony (`pagehide` — Safari/iOS nie wołają
 *    `beforeunload`). Nieudane partie wracają do kolejki i lecą przy następnym
 *    flushu albo dopiero w kolejnej sesji.
 *
 * Ograniczanie hałasu: limit sesyjny, throttling per fingerprint i twardy limit
 * kolejki sprawiają, że awaryjna pętla w przeglądarce nie potrafi zasypać API.
 */

/** Partia = maksimum akceptowane przez kontrakt serwera (`clientErrorBatchSchema`). */
const MAX_BATCH = 20;
const MAX_QUEUE = 50;
const SESSION_CAP = 25;
const FINGERPRINT_REPEAT_MS = 60_000;
const FLUSH_INTERVAL_MS = 15_000;

export interface ReportClientErrorInput {
  kind: ClientErrorKind;
  /** Miejsce wystąpienia, np. `docxExporter`, `global:error`, `ui-crash:AppErrorBoundary`. */
  surface: string;
  /** Złapana wartość z try/catch — dowolnego typu. */
  error?: unknown;
  /** Tekstowy opis, gdy nie ma obiektu błędu. Ignorowany, gdy podano `error`. */
  message?: string;
  /** Stack komponentów Reacta z ErrorBoundary — ramki nazw komponentów. */
  componentStack?: string;
}

export interface ErrorReporterDeps {
  now?: () => number;
  env?: () => 'dev' | 'prod';
  detectUaFamily?: () => string | undefined;
  detectViewportBucket?: () => string | undefined;
  sendBatch: (payload: { events: ClientErrorEvent[] }) => Promise<boolean>;
  loadBuffered: () => unknown;
  persistBuffered: (events: ClientErrorEvent[]) => void;
}

export interface ErrorReporter {
  report(input: ReportClientErrorInput): void;
  flush(): Promise<void>;
  pendingCount(): number;
}

function buildEvent(input: ReportClientErrorInput, deps: Required<Pick<ErrorReporterDeps, 'now' | 'env' | 'detectUaFamily' | 'detectViewportBucket'>>): ClientErrorEvent {
  const sanitized =
    input.error !== undefined
      ? sanitizeError(input.kind, input.error)
      : { message: sanitizeMessage(input.kind, input.message), stack: [] as SanitizedStackFrame[] };

  // Ramki komponentów Reacta stawiamy przed stosem JS: to one mówią, *gdzie*
  // w drzewie wywrócił się interfejs, a stos minifikowanego bundle'a bywa
  // mniej czytelny. Razem maksymalnie 5 ramek.
  const componentFrames = input.componentStack ? parseStack(input.componentStack) : [];
  const stack = [...componentFrames, ...sanitized.stack].slice(0, 5);

  return {
    fingerprint: buildFingerprint(input.kind, sanitized.message, stack),
    kind: input.kind,
    surface: input.surface.slice(0, 60),
    message: sanitized.message,
    stack: stack.length > 0 ? stack : undefined,
    env: deps.env(),
    uaFamily: deps.detectUaFamily(),
    viewportBucket: deps.detectViewportBucket(),
    occurredAt: new Date(deps.now()).toISOString(),
  };
}

export function createErrorReporter(deps: Partial<ErrorReporterDeps> = {}): ErrorReporter {
  const now = deps.now ?? (() => Date.now());
  const env = deps.env ?? (() => (import.meta.env.DEV ? 'dev' : 'prod'));

  const queue: ClientErrorEvent[] = [];
  let acceptedThisSession = 0;
  let flushInFlight = false;
  // Throttling per fingerprint jest stanem instancji: dwa reportery w jednym
  // procesie (aplikacja + testy) nie mogą sobie zabierać zdarzeń.
  const lastAcceptedByFingerprint = new Map<string, number>();

  // Bufor z poprzednich sesji wraca do kolejki od razu — gwarancja dosłania
  // obejmuje zdarzenia sprzed restartu przeglądarki.
  try {
    const rawBuffered = deps.loadBuffered?.() ?? [];
    const buffered = parseClientErrorBuffer(rawBuffered, MAX_QUEUE);
    queue.push(...buffered.events);
    if (buffered.invalidCount > 0) {
      // Wadliwy rekord nie może zatruć każdej kolejnej partii; zachowujemy tylko zdarzenia zgodne z API.
      deps.persistBuffered?.(queue);
    }
  } catch {
    /* Uszkodzony bufor nie może zablokować raportowania nowych zdarzeń. */
  }

  function persist(): void {
    try {
      deps.persistBuffered?.(queue);
    } catch {
      /* jw. */
    }
  }

  return {
    report(input: ReportClientErrorInput): void {
      try {
        if (acceptedThisSession >= SESSION_CAP) return;
        if (queue.length >= MAX_QUEUE) queue.shift();

        const event = buildEvent(input, {
          now,
          env,
          detectUaFamily: deps.detectUaFamily ?? (() => undefined),
          detectViewportBucket: deps.detectViewportBucket ?? (() => undefined),
        });

        // Throttling per fingerprint: ta sama usterka w krótkim odstępie nic
        // nie wnosi — licznik wystąpień doliczy serwer.
        const lastAcceptedAt = lastAcceptedByFingerprint.get(event.fingerprint);
        if (lastAcceptedAt !== undefined && now() - lastAcceptedAt < FINGERPRINT_REPEAT_MS) return;

        lastAcceptedByFingerprint.set(event.fingerprint, now());
        acceptedThisSession += 1;
        queue.push(event);
        persist();
      } catch {
        /* Telemetria nigdy nie rzuca. */
      }
    },

    async flush(): Promise<void> {
      if (flushInFlight || queue.length === 0) return;
      flushInFlight = true;
      try {
        while (queue.length > 0) {
          const batch = queue.splice(0, MAX_BATCH);
          let delivered = false;
          try {
            // Transport jest opcjonalny (instalacja bez endpointu telemetrii):
            // brak kanału znaczy „niedoręczone", więc partia zostaje w buforze.
            delivered = (await deps.sendBatch?.({ events: batch })) ?? false;
          } catch {
            delivered = false;
          }
          if (!delivered) {
            // Nieudana partia wraca na początek kolejki — zachowuje kolejność
            // względem zdarzeń młodszych i zostaje utrwalona w buforze LS.
            queue.unshift(...batch);
            break;
          }
          persist();
        }
      } finally {
        flushInFlight = false;
      }
    },

    pendingCount(): number {
      return queue.length;
    },
  };
}

/**
 * Transport domyślny: beacon gdy dostępny (ognioodporny na zamykanie karty),
 * w przeciwnym razie fetch z `keepalive`. Celowo nie przez `apiClient`:
 * błąd transportu telemetrii musiałby trafić do reportera i reporter raportowałby
 * własne niepowodzenie — zapętlona telemetria to klasyczny sposób zabicia
 * aplikacji; do tego beacon nie pozwala ustawić nagłówków, którymi `apiClient`
 * się posługuje.
 */
async function defaultSendBatch(payload: { events: ClientErrorEvent[] }): Promise<boolean> {
  const body = JSON.stringify(payload);
  const endpoint = `${clientEnv.apiUrl}/api/errors`;

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const queued = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      if (queued) return true;
    } catch {
      /* Spadamy do fetch. */
    }
  }

  if (typeof fetch !== 'function') return false;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

let installed = false;

/**
 * Podpina globalne łapyacze i cykl flushowania. Idempotentna — wołana raz
 * z `main.tsx`, ale wielokrotne wywołanie nie zdubluje listenerów.
 *
 * Handler `error` celowo odsiewa zdarzenia bez obiektu `Error`: tak wyglądają
 * błędy zasobów (obrazek, skrypt), które nie mają treści, oraz przekłamany
 * „Script error." z iframe'ów innych originów — nic z tego nie da się sensownie
 * zgrupować.
 */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const reporter = getBrowserReporter();

  window.addEventListener('error', (event) => {
    const err = (event as ErrorEvent).error;
    if (!(err instanceof Error)) return;
    reporter.report({ kind: 'uncaught', surface: 'global:error', error: err });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reporter.report({
      kind: 'unhandledrejection',
      surface: 'global:promise',
      error: (event as PromiseRejectionEvent).reason,
    });
  });

  // Reguła 9: domknięcie okna dostawy przy ukryciu karty i jej zamknięciu.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void reporter.flush();
  });
  window.addEventListener('pagehide', () => {
    void reporter.flush();
  });

  window.setInterval(() => {
    if (reporter.pendingCount() > 0) void reporter.flush();
  }, FLUSH_INTERVAL_MS);
}

let browserReporter: ErrorReporter | null = null;

/** Leniwy singleton dla instrumentacji w modułach aplikacji. */
export function getBrowserReporter(): ErrorReporter {
  if (!browserReporter) {
    browserReporter = createErrorReporter({
      sendBatch: defaultSendBatch,
      loadBuffered: () => readJson<unknown>(StorageKeys.errorReportBuffer, []),
      persistBuffered: (events) => writeJson(StorageKeys.errorReportBuffer, events),
      detectUaFamily: () => {
        if (typeof navigator === 'undefined') return undefined;
        return detectUaFamily(navigator.userAgent);
      },
      detectViewportBucket: () => {
        if (typeof window === 'undefined') return undefined;
        return viewportBucket(window.innerWidth);
      },
    });
  }
  return browserReporter;
}

/** Wygodny punkt wejścia dla miejsc instrumentacji. Nigdy nie rzuca. */
export function reportClientError(input: ReportClientErrorInput): void {
  try {
    if (typeof window === 'undefined') return;
    getBrowserReporter().report(input);
  } catch {
    /* Telemetria nigdy nie rzuca. */
  }
}

/**
 * Rodzina przeglądarki + wersja główna. Kolejność sprawdzeń ma znaczenie:
 * Edge i Opera deklarują się również jako Chrome, więc ich tokeny muszą być
 * pytane pierwsze. Wersja główna wystarcza do triage'u — pełny UA bywa
 * identyfikującym odciskiem palca, którego tu nie chcemy.
 */
export function detectUaFamily(userAgent: string): string {
  const families: Array<[RegExp, string]> = [
    [/Edg(?:e|A|iOS)?\/(\d+)/, 'Edge'],
    [/OPR\/(\d+)/, 'Opera'],
    [/Firefox\/(\d+)/, 'Firefox'],
    [/Chrome\/(\d+)/, 'Chrome'],
    [/(?:Version\/(\d+)[^)]*?)?Safari\//, 'Safari'],
  ];
  for (const [pattern, name] of families) {
    const match = userAgent.match(pattern);
    if (match) return `${name} ${match[1] ?? '?'}`;
  }
  return 'Inna';
}

/** Szerokość okna sprowadzona do szerokich widełek — dokładne piksele nic nie wnoszą. */
export function viewportBucket(width: number): string {
  if (width < 480) return 'w<480';
  if (width < 768) return 'w<768';
  if (width < 1024) return 'w<1024';
  if (width < 1280) return 'w<1280';
  if (width < 1536) return 'w<1536';
  return 'w>=1536';
}
