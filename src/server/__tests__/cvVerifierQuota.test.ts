import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { aiRouter } from '../routes/ai.routes';
import { errorHandler } from '../middleware/errorHandler';
import * as supabaseModule from '../supabase';
import * as configModule from '../config';
import * as cvVerifierService from '../services/cvVerifier.service';
import { createEmptyVault } from '../../lib/sampleVault';

const WAZNY_TOKEN = 'wazny-token-sesji-cv-verifier';

let quotaAllowed = true;
let reserveQuotaCalls = 0;

function fakeSupabase() {
  return {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === WAZNY_TOKEN) {
          return {
            data: { user: { id: 'user-cv-360', email: 'spawacz@example.com' } },
            error: null,
          };
        }
        return { data: { user: null }, error: { message: 'Sesja wygasła.' } };
      }),
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'reserve_ai_quota') {
        reserveQuotaCalls++;
        return { data: { allowed: quotaAllowed, current_uses: quotaAllowed ? 1 : 25 }, error: null };
      }
      return { data: null, error: null };
    }),
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'free' }, error: null }),
    }),
  } as unknown as ReturnType<typeof supabaseModule.getSupabase>;
}

async function startApp(): Promise<{ url: (p: string) => string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
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

describe('Weryfikator CV AI 360° - egzekucja autoryzacji i kwot na backendzie (/api/ai/verify-cv)', () => {
  let verifySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    quotaAllowed = true;
    reserveQuotaCalls = 0;

    vi.spyOn(configModule, 'loadConfig').mockReturnValue({
      backendEnabled: true,
      BACKEND_MODE: 'cloud',
    } as unknown as ReturnType<typeof configModule.loadConfig>);

    vi.spyOn(supabaseModule, 'getSupabase').mockImplementation(fakeSupabase);

    verifySpy = vi.spyOn(cvVerifierService, 'verifyCvWithTripleLoop').mockResolvedValue({
      overallScore: 88,
      verdict: 'READY_TO_APPLY',
      summary: 'Profil zweryfikowany pomyślnie.',
      atsLoop: {
        atsScore: 90,
        parsedRole: 'Spawacz',
        recognizedKeywords: ['TIG', 'MIG'],
        missingCriticalKeywords: [],
        atsFormatRisks: [],
      },
      recruiterLoop: {
        recruiterScore: 85,
        headlineClarity: 'EXCELLENT',
        strengthsFound: ['Liczbowe osiągnięcia'],
        weaknessesOrFluff: [],
        achievementMetricRatePct: 80,
      },
      logicComplianceLoop: {
        complianceScore: 89,
        chronologyValid: true,
        timelineAnomalies: [],
        logicalInconsistencies: [],
        rodoCompliant: true,
        privacyRisks: [],
      },
      actionableRecommendations: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const testVault = createEmptyVault('Jan Kowalski', 'spawacz@example.com');

  it('brak tokenu → HTTP 401 przed rezerwacją kwoty', async () => {
    const app = await startApp();
    try {
      const response = await fetch(app.url('/ai/verify-cv'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vault: testVault }),
      });

      expect(response.status).toBe(401);
      const data = (await response.json()) as { success: boolean; error: string };
      expect(data.success).toBe(false);
      expect(data.error).toContain('Wymagane zalogowanie');

      // Rezerwacja kwoty nie może się odbyć bez uwierzytelnienia
      expect(reserveQuotaCalls).toBe(0);
      expect(verifySpy).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('ważny użytkownik + limit wyczerpany → HTTP 402, model nie jest wywołany', async () => {
    quotaAllowed = false;
    const app = await startApp();
    try {
      const response = await fetch(app.url('/ai/verify-cv'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WAZNY_TOKEN}`,
        },
        body: JSON.stringify({ vault: testVault }),
      });

      expect(response.status).toBe(402);
      const data = (await response.json()) as { success: boolean; error: string };
      expect(data.success).toBe(false);
      expect(data.error).toContain('Wyczerpane dzisiejsze wywołania AI');

      // Rezerwacja została podjęta, ale model NIE został uruchomiony
      expect(reserveQuotaCalls).toBe(1);
      expect(verifySpy).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('ważny użytkownik + dostępna kwota → dokładnie 1 request i 1 rezerwacja', async () => {
    quotaAllowed = true;
    const app = await startApp();
    try {
      const response = await fetch(app.url('/ai/verify-cv'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${WAZNY_TOKEN}`,
        },
        body: JSON.stringify({
          vault: testVault,
          targetRole: 'Spawacz TIG',
        }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { success: boolean; report: unknown };
      expect(data.success).toBe(true);
      expect(data.report).toBeDefined();

      // Dokładnie 1 rezerwacja kwoty i dokładnie 1 wywołanie potrójnej pętli
      expect(reserveQuotaCalls).toBe(1);
      expect(verifySpy).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
