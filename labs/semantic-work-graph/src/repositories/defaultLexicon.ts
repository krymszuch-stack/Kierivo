import fs from 'fs';
import path from 'path';
import { SqliteGraphRepository } from './SqliteGraphRepository.js';

/**
 * Leniwy dostęp do domyślnej bazy leksykalnej.
 *
 * Serwisy językowe (`LinguisticEngine`, `JargonMapper`) bywają tworzone bez
 * wstrzykniętego repozytorium — np. wewnątrz `SearchEngine`. Zamiast otwierać
 * (i tym samym tworzyć) plik bazy przy każdej takiej instancji, dzielimy jedno
 * połączenie na proces i otwieramy je dopiero przy pierwszym zapytaniu.
 *
 * Gdy plik bazy nie istnieje, zwracamy `null` — wtedy lematyzacja pracuje
 * w trybie tożsamościowym zamiast zakładać pustą bazę w losowym katalogu.
 */
let cachedRepo: SqliteGraphRepository | null = null;
let resolved = false;

/** Ścieżka domyślnej bazy: zmienna `SWG_DB_PATH` albo `./data/swg.db`. */
export function defaultLexiconPath(): string {
  return process.env.SWG_DB_PATH ?? './data/swg.db';
}

export function getDefaultLexiconRepository(): SqliteGraphRepository | null {
  if (resolved) return cachedRepo;
  resolved = true;

  const resolvedPath = path.resolve(defaultLexiconPath());
  if (!fs.existsSync(resolvedPath)) {
    cachedRepo = null;
    return null;
  }

  try {
    cachedRepo = new SqliteGraphRepository(resolvedPath);
  } catch {
    // Baza uszkodzona lub zajęta wyłącznym blokiem — pracujemy bez słownika.
    cachedRepo = null;
  }
  return cachedRepo;
}

/**
 * Zamyka i zapomina współdzielone połączenie. Wołane po zasianiu bazy oraz
 * w testach, żeby kolejne wywołanie zobaczyło świeży stan pliku.
 */
export function resetDefaultLexiconRepository(): void {
  const repo = cachedRepo;
  cachedRepo = null;
  resolved = false;
  if (repo) void repo.close();
}
