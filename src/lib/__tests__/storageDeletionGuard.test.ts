import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.resetModules());

describe('Blokada zapisu na czas usuwania danych', () => {
  it('zwolnienie jednej z nakładających się operacji nie kończy drugiej', async () => {
    const guard = await import('../storageDeletionGuard');
    const first = guard.beginStorageDeletion(['profil', 'profil']);
    const second = guard.beginStorageDeletion(['profil']);
    expect(guard.isStorageWriteBlocked('profil')).toBe(true);
    expect(guard.isStorageWriteBlocked('inny profil')).toBe(false);
    first();
    first();
    expect(guard.isStorageWriteBlocked('profil')).toBe(true);
    second();
    expect(guard.isStorageWriteBlocked('profil')).toBe(false);
  });

  it('czyszczenie całej bazy i zakresu profilu zwalniają swoje blokady niezależnie', async () => {
    const guard = await import('../storageDeletionGuard');
    const global = guard.beginStorageDeletion();
    const scoped = guard.beginStorageDeletion(['profil']);
    expect(guard.isStorageWriteBlocked('inny profil')).toBe(true);
    global();
    expect(guard.isStorageWriteBlocked('inny profil')).toBe(false);
    expect(guard.isStorageWriteBlocked('profil')).toBe(true);
    scoped();
    expect(guard.isStorageWriteBlocked('profil')).toBe(false);
  });
});
