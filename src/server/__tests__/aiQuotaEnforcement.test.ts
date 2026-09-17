import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { aiRouter } from '../routes/ai.routes';
import { errorHandler } from '../middleware/errorHandler';
import * as supabaseModule from '../supabase';
import * as configModule from '../config';
import { aiService } from '../services/ai.service';

/**
 * Blokada curl-a z pominięciem UI po wyczerpaniu limitu dziennego.
 *
 * Licznik w przeglądarce (`useEntitlements`) leży w `localStorage` i da się go
 * przestawić z konsoli, więc sam nie rozstrzyga. Ten test jedzie prawdziwą
 * trasą `POST /api/parse-jd` przez prawdziwe `requireAuth` i prawdziwe
 * `executeAiOperation` — podstawione są tylko granice zewnętrzne: weryfikacja
 * tokenu i rezerwacja kwoty (RPC) oraz sam model (`aiService.parseJd`).
 * Dzięki temu 402 dowodzi okablowania trasy, a nie tego, że atrapa zwraca 402.
 *
 * `parse-jd` jest reprezentantem wszystkich pięciu płatnych tras w `ai.routes.ts`:
 * każda idzie przez ten sam potok `requireAuth → aiEndpointsLimiter →
 * executeAiOperation`, więc dziura w jednej oznaczałaby dziurę we wzorcu.
 */

const WAZNY_TOKEN = 'wazny-token-sesji';

// Przełącznik scenariusza podszywający się pod odpowiedź `reserve_ai_quota` z bazy.
let quotaAllowed = true;

function fakeSupabase() {
  return {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === WAZNY_TOKEN) {
          return {
            data: { user: { id: 'user-123', email: 'monter@example.com' } },
            error: null,
          };
        }
        return { data: { user: null }, error: { message: 'Sesja wygasła.' } };
      }),
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'reserve_ai_quota') {
        return { data: { allowed: quotaAllowed, current_uses: quotaAllowed ? 1 : 25 }, error: null };
      }
      return { data: null, error: null };
    }),
    // Poza betą `executeAiOperation` sprawdza tu status subskrypcji — w becie
    // zwarcie na `FREE_BETA_ACTIVE` omija to zapytanie, ale atrapa zostaje na
    // wypadek zmiany flagi, żeby test nie zaczął sypać z innego powodu niż kwota.
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'free' }, error: null }),
    }),
  } as unknown as ReturnType<typeof supabaseModule.getSupabase>;
}

async function startApp(): Promise<{ url: (p: string) => string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  app.use('/api', aiRouter);
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

// Ogłoszenie z domeny prac fizycznych (monter), nie IT — reguła 8: limity mają
// bronić każdej ścieżki, nie tylko tej testowanej na deweloperach.
const PRZYKLADOWE_OGLOSZENIE =
  'Szukamy montera instalacji sanitarnych z uprawnieniami SEP. Praca stacjonarna w Krakowie, wymagane prawo jazdy B.';

describe('Egzekucja limitu AI po stronie serwera (curl z pominięciem UI)', () => {
  beforeEach(() => {
    quotaAllowed = true;
    vi.spyOn(configModule, 'loadConfig').mockReturnValue({
      backendEnabled: true,
      BACKEND_MODE: 'cloud',
    } as unknown as ReturnType<typeof configModule.loadConfig>);
    vi.spyOn(supabaseModule, 'getSupabase').mockImplementation(fakeSupabase);
    vi.spyOn(aiService, 'parseJd').mockResolvedValue({ jobTitle: 'Monter' } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('czysty curl z ważnym tokenem po wyczerpaniu limitu dostaje 402, a model w ogóle nie jest wołany', async () => {
    quotaAllowed = false;
    const app = await startApp();
    try {
      const response = await fetch(app.url('/parse-jd'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WAZNY_TOKEN}`,
        },
        body: JSON.stringify({ rawJdText: PRZYKLADOWE_OGLOSZENIE }),
      });

      expect(response.status).toBe(402);
      const payload = (await response.json()) as {
        success: boolean;
        error: string;
        requestId?: string;
      };
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('Wyczerpane dzisiejsze wywołania AI');
      expect(typeof payload.requestId).toBe('string');
      expect(aiService.parseJd).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('ten sam curl z dostępnym limitem przechodzi i woła model dokładnie raz', async () => {
    quotaAllowed = true;
    const app = await startApp();
    try {
      const response = await fetch(app.url('/parse-jd'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WAZNY_TOKEN}`,
        },
        body: JSON.stringify({ rawJdText: PRZYKLADOWE_OGLOSZENIE }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as { success: boolean; parsedJd: unknown };
      expect(payload.success).toBe(true);
      expect(payload.parsedJd).toBeDefined();
      expect(aiService.parseJd).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('curl bez tokenu odpada na uwierzytelnieniu (401), zanim cokolwiek policzy limit albo model', async () => {
    quotaAllowed = true;
    const app = await startApp();
    try {
      const response = await fetch(app.url('/parse-jd'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawJdText: PRZYKLADOWE_OGLOSZENIE }),
      });

      expect(response.status).toBe(401);
      expect(aiService.parseJd).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
