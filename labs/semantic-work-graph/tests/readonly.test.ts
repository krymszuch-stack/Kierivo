import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteGraphRepository } from '../src/repositories/SqliteGraphRepository.js';
import fs from 'fs';
import path from 'path';

/**
 * Tryb odczytu dla bezstanowych kontenerów.
 *
 * Kontener produkcyjny ma system plików tylko do odczytu obok kodu, więc baza
 * musi się otworzyć bez tworzenia czegokolwiek obok siebie: bez plików WAL,
 * bez inicjalizacji schematu, bez prawa do zapisu na poziomie silnika.
 */

const READONLY_DB_PATH = './data/test_readonly.db';
const sidecarFiles = () =>
  [`${READONLY_DB_PATH}-wal`, `${READONLY_DB_PATH}-shm`].filter((p) => fs.existsSync(p));

describe('SqliteGraphRepository w trybie readonly', () => {
  let writable: SqliteGraphRepository;

  beforeEach(() => {
    for (const stale of [
      READONLY_DB_PATH,
      `${READONLY_DB_PATH}-wal`,
      `${READONLY_DB_PATH}-shm`,
    ]) {
      if (fs.existsSync(stale)) fs.unlinkSync(stale);
    }
    writable = new SqliteGraphRepository(READONLY_DB_PATH);
  });

  afterEach(async () => {
    await writable.close();
    for (const leftover of sidecarFiles().concat(READONLY_DB_PATH)) {
      if (fs.existsSync(leftover)) fs.unlinkSync(leftover);
    }
  });

  it('otwiera istniejącą bazę z PRAGMA query_only = ON', async () => {
    // Stan „baza do wysyłki": tryb WAL jest trwały w nagłówku pliku i czytelnik
    // takiej bazy musiałby odtworzyć pliki -shm/-wal obok siebie — dokładnie
    // tego, czego nie ma prawa zrobić w kontenerze tylko-do-odczytu. Pakowanie
    // obrazu robi więc najpierw checkpoint i powrót do journal_mode = DELETE
    // (patrz komentarz konstruktora).
    writable.getRawDb().pragma('journal_mode = DELETE');
    await writable.close();

    const repo = new SqliteGraphRepository(READONLY_DB_PATH, { readonly: true });
    try {
      expect(repo.getPragma('query_only')).toBe(1);

      // Odczyt na pustej bazie przechodzi — schema istnieje z fazy zapisu.
      expect(repo.countMorphEntries()).toBe(0);
      // Po odczycie nie powstał żaden plik boczny (-wal/-shm).
      expect(sidecarFiles()).toEqual([]);
    } finally {
      await repo.close();
    }
  });

  it('silnik odrzuca zapis także u konsumenta surowego uchwytu', async () => {
    await writable.close();

    const repo = new SqliteGraphRepository(READONLY_DB_PATH, { readonly: true });
    try {
      expect(() => repo.getRawDb().exec("INSERT INTO morph_dictionary VALUES ('a','b','subst')")).toThrow();
      expect(repo.countMorphEntries()).toBe(0);
    } finally {
      await repo.close();
    }
  });

  it('brak pliku bazy to jasny błąd konfiguracji, nie cicho utworzona pusta baza', async () => {
    const missing = path.join(path.dirname(READONLY_DB_PATH), 'test_nie_istnieje.db');
    if (fs.existsSync(missing)) fs.unlinkSync(missing);

    expect(() => new SqliteGraphRepository(missing, { readonly: true })).toThrow();
    // Błąd nie zostawił po sobie świeżo utworzonego pliku.
    expect(fs.existsSync(missing)).toBe(false);
  });
});
