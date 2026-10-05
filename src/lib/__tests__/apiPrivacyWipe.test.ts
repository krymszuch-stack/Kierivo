import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memoryStorage';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('API po rozpoczęciu usuwania danych', () => {
  it('nie pobiera tokenu i nie wysyła żądania po rozpoczęciu wymazania', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', new MemoryStorage());
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetch);
    const { api, setAccessTokenProvider } = await import('../apiClient');
    const token = vi.fn(() => 'synthetic-token');
    setAccessTokenProvider(token);
    (await import('../storage')).beginPrivacyWipe();
    await expect(api.post('/api/synthetic', { marker: 'syntetyczne dane' })).rejects.toMatchObject({ status: 403 });
    expect(token).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('blokuje żądanie czekające na token, gdy wymazanie zaczęło się w trakcie oczekiwania', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', new MemoryStorage());
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ success: true }) }));
    vi.stubGlobal('fetch', fetch);
    const { api, setAccessTokenProvider } = await import('../apiClient');
    let release: (value: string) => void = () => undefined;
    const token = new Promise<string>(resolve => { release = resolve; });
    setAccessTokenProvider(() => token);
    const pending = api.get('/api/synthetic');
    (await import('../storage')).beginPrivacyWipe();
    release('synthetic-token');
    await expect(pending).rejects.toMatchObject({ status: 403 });
    expect(fetch).not.toHaveBeenCalled();
  });
});
