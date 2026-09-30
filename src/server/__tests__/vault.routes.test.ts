import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const mocks = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('../middleware/requireAuth', () => ({
  requireAuth: (req: { user?: { id: string } }, _res: unknown, next: () => void) => {
    req.user = { id: 'synthetic-owner' };
    next();
  },
}));

vi.mock('../supabase', () => ({
  getSupabase: () => mocks.client,
}));

import { vaultRouter } from '../routes/vault.routes';
import { errorHandler } from '../middleware/errorHandler';

describe('API Vaultu — zapis z kontrolą rewizji', () => {
  let server: Server;
  let baseUrl = '';

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', vaultRouter);
    app.use(errorHandler);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') baseUrl = `http://127.0.0.1:${address.port}/api/vault`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.restoreAllMocks();
  });

  it('zwraca 409 i nie udaje sukcesu, gdy snapshot ma nieaktualną rewizję', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqUpdatedAt = vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) });
    const eqOwner = vi.fn().mockReturnValue({ eq: eqUpdatedAt });
    const update = vi.fn().mockReturnValue({ eq: eqOwner });
    mocks.client = { from: vi.fn().mockReturnValue({ update }) };

    const response = await fetch(baseUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedUpdatedAt: '2026-09-30T09:00:00.000Z',
        vault: { version: '1', updatedAt: '2026-09-30T09:00:00.000Z', personalInfo: { fullName: 'Test' } },
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('zmieniło się na innym urządzeniu'),
      requestId: expect.any(String),
    });
    expect(eqOwner).toHaveBeenCalledWith('user_id', 'synthetic-owner');
    expect(eqUpdatedAt).toHaveBeenCalledWith('updated_at', '2026-09-30T09:00:00.000Z');
  });

  it('używa INSERT dla pustej bazy i zamienia duplikat w konflikt 409', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    mocks.client = { from: vi.fn().mockReturnValue({ insert }) };

    const response = await fetch(baseUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedUpdatedAt: null,
        vault: { version: '1', updatedAt: '2026-09-30T09:00:00.000Z', personalInfo: { fullName: 'Test' } },
      }),
    });

    expect(response.status).toBe(409);
    expect(insert.mock.calls[0][0]).toMatchObject({ user_id: 'synthetic-owner' });
  });
});
