import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { mobilityEndpointsLimiter } from '../middleware/rateLimiter';

describe('limiter tras Azure Maps', () => {
  beforeEach(() => {
    mobilityEndpointsLimiter.reset();
  });

  it('blokuje kolejne wywoĹ‚ania po 30 zapytaniach z tego samego adresu IP', () => {
    const req = {
      ip: '192.0.2.15',
      socket: { remoteAddress: '192.0.2.15' },
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    for (let i = 0; i < 30; i++) {
      mobilityEndpointsLimiter(req, res, next);
    }
    mobilityEndpointsLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(30);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'Zbyt wiele zapytań o dojazd. Spróbuj ponownie za chwilę.',
    }));
  });

  it('prowadzi osobny licznik dla kaĹĽdego adresu IP', () => {
    const req = (ip: string) => ({
      ip,
      socket: { remoteAddress: ip },
    }) as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    for (let i = 0; i < 30; i++) {
      mobilityEndpointsLimiter(req('192.0.2.15'), res, next);
    }
    mobilityEndpointsLimiter(req('192.0.2.16'), res, next);

    expect(next).toHaveBeenCalledTimes(31);
    expect(res.status).not.toHaveBeenCalled();
  });
});
