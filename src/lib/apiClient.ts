import { clientEnv } from './clientEnv';

/**
 * Jedno wejście do API.
 *
 * Wcześniej `fetch` był wpisany wprost w `JobMatcher`, dwa razy, z osobną
 * obsługą błędów przy każdym wywołaniu. Przy dokładaniu uwierzytelnienia
 * oznaczałoby to dopisywanie nagłówka `Authorization` w każdym miejscu z osobna
 * — i pominięcie go w tym jednym, o którym nikt nie pamiętał.
 *
 * Serwer odpowiada spójnym kształtem (`{ success, error, requestId, ... }`),
 * ustalonym w `src/server/middleware/errorHandler.ts`, więc obsługa błędów da
 * się zamknąć tutaj raz.
 */

export interface ApiErrorPayload {
  success: false;
  error?: string;
  /** Identyfikator do skorelowania z logiem serwera. Wart pokazania w UI. */
  requestId?: string;
  /** Zwracane przez limiter zapytań przy 429. */
  retryAfterMs?: number;
  /** Zwracane przez `/api/fetch-jd-url`, gdy portal blokuje pobieranie. */
  requiresManualPaste?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly retryAfterMs?: number;
  readonly requiresManualPaste: boolean;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error || 'Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie za chwilę.');
    this.name = 'ApiError';
    this.status = status;
    this.requestId = payload.requestId;
    this.retryAfterMs = payload.retryAfterMs;
    this.requiresManualPaste = payload.requiresManualPaste === true;
  }

  /** Limit wyczerpany — interfejs pokazuje wtedy cennik, nie komunikat o błędzie. */
  get isQuotaExceeded(): boolean {
    return this.status === 402;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/**
 * Dostawca tokenu sesji. Ustawiany raz przez warstwę uwierzytelnienia, żeby ten
 * moduł nie musiał importować Supabase — dzięki temu `apiClient` działa również
 * w trybie bez backendu i nie wciąga zależności do pakietu, gdy nie ma po co.
 */
type TokenProvider = () => string | null | Promise<string | null>;

let getAccessToken: TokenProvider = () => null;

export function setAccessTokenProvider(provider: TokenProvider): void {
  getAccessToken = provider;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${clientEnv.apiUrl}${path}`, { ...init, headers });
  } catch {
    // Brak sieci, zatrzymany serwer, przerwane żądanie. Rozróżnianie tych
    // przypadków po stronie klienta nic nie daje — działanie użytkownika jest
    // takie samo.
    throw new ApiError(0, { success: false, error: 'Brak połączenia z serwerem.' });
  }

  // 204 nie ma ciała, a `res.json()` wywróciłby się na pustej odpowiedzi.
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));

  if (!response.ok || (payload as { success?: boolean }).success === false) {
    throw new ApiError(response.status, payload as ApiErrorPayload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
