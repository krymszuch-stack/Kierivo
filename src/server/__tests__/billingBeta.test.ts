import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { errorHandler } from '../middleware/errorHandler';
import { PURCHASES_DISABLED_REASON } from '../../lib/betaConfig';

vi.mock('../middleware/requireAuth', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'test-user-id', email: 'tester@example.com' };
    next();
  },
}));

import { billingRouter } from '../routes/billing.routes';

describe('Billing Routes — Bezpłatna Beta (wyłączone zakupy)', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'mock-gemini-key';
  });

  async function callEndpoint(
    path: string,
    body: Record<string, unknown>
  ): Promise<{ status: number; json: Record<string, unknown> }> {
    const app = express();
    app.use(express.json());
    app.use('/api', billingRouter);
    app.use(errorHandler);

    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, json: (await response.json()) as Record<string, unknown> };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it('POST /api/billing/checkout-session zwraca 503 i informuje o wyłączonych zakupach w becie', async () => {
    const res = await callEndpoint('/billing/checkout-session', {
      priceId: 'price_cvelocity_pro_monthly',
    });

    expect(res.status).toBe(503);
    expect(res.json.success).toBe(false);
    expect(res.json.error).toBe(PURCHASES_DISABLED_REASON);
  });

  it('POST /api/billing/portal-session zwraca 503 i informuje o wyłączonym portalu w becie', async () => {
    const res = await callEndpoint('/billing/portal-session', {});

    expect(res.status).toBe(503);
    expect(res.json.success).toBe(false);
    expect(res.json.error).toBe(PURCHASES_DISABLED_REASON);
  });
});
