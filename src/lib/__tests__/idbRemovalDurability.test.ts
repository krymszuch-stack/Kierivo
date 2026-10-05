import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('Potwierdzane usuwanie kopii IndexedDB', () => {
  it.each(['complete', 'abort'])('wynik zależy od zakończenia transakcji: %s', async ending => {
    vi.resetModules();
    const deleteKey = vi.fn((_key: string) => ({ onerror: null as (() => void) | null }));
    const tx = {
      objectStore: () => ({ delete: deleteKey }),
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const transaction = vi.fn(() => {
      queueMicrotask(() => ending === 'complete' ? tx.oncomplete?.() : tx.onabort?.());
      return tx;
    });
    vi.stubGlobal('indexedDB', { open: () => {
      const request = { result: { transaction }, onsuccess: null as (() => void) | null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    } });
    const { idbBackupRemoveDurably } = await import('../idbFallback');
    expect(await idbBackupRemoveDurably(['profile', 'profile:last-good'])).toBe(ending === 'complete');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(deleteKey.mock.calls).toEqual([['profile'], ['profile:last-good']]);
  });
});
