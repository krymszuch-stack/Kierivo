import fs from 'fs';
import path from 'path';
import readline from 'readline';
import zlib from 'zlib';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import {
  markDerivedCategory,
  MorphEntry,
  SkillSynonym,
  SqliteGraphRepository,
} from '../repositories/SqliteGraphRepository.js';
import { buildOfflineMorphCorpus } from './lexicon/PolishMorphology.js';
import { buildOfflineSkillThesaurus, technologyLemmas, SkillSeed } from './lexicon/TechThesaurus.js';

/**
 * Części mowy zapisywane do słownika. PoliMorf rozróżnia kilkadziesiąt tagów;
 * do dopasowywania CV do ogłoszeń potrzebujemy rzeczowników, czasowników
 * (formy osobowe i przeszłe), rzeczowników odczasownikowych i przymiotników.
 */
export const ALLOWED_POS_TAGS = new Set(['subst', 'verb', 'fin', 'praet', 'ger', 'adj']);

/** Rozmiar paczki transakcyjnej przy imporcie strumieniowym. */
export const DEFAULT_BATCH_SIZE = 25_000;

/** Katalog na pobrane zbiory źródłowe. */
export const DEFAULT_SEED_DIR = './data/seed';

/**
 * Adresy wydania PoliMorf w kolejności prób.
 *
 * Pierwszy pochodzi z pierwotnej specyfikacji zadania; drugim jest katalog wydań
 * SGJP/IPI PAN, w którym nazwa pliku zawiera datę wydania — dlatego zamiast
 * zaszywać wersję, odczytujemy najnowszy katalog z indeksu (patrz
 * `discoverSgjpPoliMorfUrl`).
 */
export const POLIMORF_URL_CANDIDATES = [
  'https://raw.githubusercontent.com/morfologik/polimorf-tab/master/PoliMorf-0.6.7.tab.gz',
];

/** Indeks wydań słownika Morfeusz/PoliMorf utrzymywany przez SGJP. */
export const SGJP_RELEASE_INDEX = 'http://download.sgjp.pl/morfeusz/';

/** Publiczne API taksonomii ESCO (Komisja Europejska). */
export const ESCO_API_SEARCH = 'https://ec.europa.eu/esco/api/search';

/**
 * Rodzaje pojęć ESCO zaciągane do tezaurusa.
 *
 * `skill` to filar umiejętności (~13,5 tys. pojęć), `occupation` to filar zawodów
 * (~2,9 tys.). Zawody są tu istotne, bo tytuł stanowiska z CV („starszy technik
 * serwisu”) trafia w graf profesji tego pakietu.
 */
export const ESCO_CONCEPT_TYPES = ['skill', 'occupation'] as const;
export type EscoConceptType = (typeof ESCO_CONCEPT_TYPES)[number];

/** Punkt wejścia do zasobów ESCO (pojęcia i schematy klasyfikacji). */
export const ESCO_API_RESOURCE = 'https://ec.europa.eu/esco/api/resource';

/** Schematy klasyfikacji odpowiadające filarom ESCO. */
export const ESCO_CONCEPT_SCHEMES: Record<EscoConceptType, string> = {
  skill: 'http://data.europa.eu/esco/concept-scheme/skills',
  occupation: 'http://data.europa.eu/esco/concept-scheme/occupations',
};

/**
 * Liczba równoległych żądań przy pobieraniu szczegółów pojęć.
 *
 * Etykiety alternatywne wymagają jednego żądania na pojęcie (ok. 16 tys. łącznie),
 * więc bez zrównoleglenia zaciąg trwałby godzinę. Ośmiu równoległych klientów
 * mieści się w limitach serwisu i nie generuje odpowiedzi 429.
 */
export const ESCO_CONCURRENCY = 8;

/** Liczba ponowień pojedynczego żądania przed uznaniem go za nieudane. */
export const ESCO_PAGE_RETRIES = 3;

/**
 * Ile razy powtórzyć rundę odkrywania pojęć zagnieżdżonych.
 *
 * Dwie rundy domykają hierarchię zawodów (grupa -> zawód -> specjalizacja);
 * kolejne nie wnoszą już nowych pojęć, a kosztują pełny przebieg żądań.
 */
export const ESCO_DISCOVERY_ROUNDS = 3;

export type SourceStatus = 'download' | 'cache' | 'offline-fallback' | 'skipped';

export interface LexiconImportOptions {
  /** Katalog na pliki źródłowe (domyślnie `./data/seed`). */
  seedDir?: string;
  /** Rozmiar paczki transakcyjnej (domyślnie 25 000). */
  batchSize?: number;
  /** Pomija ruch sieciowy i korzysta wyłącznie z plików lokalnych + korpusu offline. */
  offline?: boolean;
  /** Pobiera źródła ponownie, nawet jeśli są już w katalogu seed. */
  force?: boolean;
  /** Limit wierszy PoliMorf (do szybkich przebiegów kontrolnych). */
  maxPolimorfRows?: number;
  /** Limit czasu pojedynczego żądania HTTP w milisekundach. */
  requestTimeoutMs?: number;
  /** Pomija pobieranie etykiet alternatywnych ESCO (zostają same nazwy bazowe). */
  escoSkipAltLabels?: boolean;
  /** Limit pojęć ESCO, dla których pobierane są szczegóły (przebieg kontrolny). */
  escoMaxConcepts?: number;
  logger?: (message: string) => void;
}

export interface LexiconImportReport {
  morphSource: SourceStatus;
  morphFile: string | null;
  polimorfLinesRead: number;
  polimorfRowsWritten: number;
  curatedRowsWritten: number;
  morphDictionarySize: number;

  skillSource: SourceStatus;
  skillFile: string | null;
  skillRowsWritten: number;
  skillSynonymsSize: number;
  canonicalSkills: number;

  durationMs: number;
}

const noopLogger = (): void => {};

export class LexiconImporter {
  private readonly seedDir: string;
  private readonly batchSize: number;
  private readonly requestTimeoutMs: number;
  private readonly log: (message: string) => void;

  constructor(
    private readonly repo: SqliteGraphRepository,
    private readonly options: LexiconImportOptions = {}
  ) {
    this.seedDir = path.resolve(options.seedDir ?? DEFAULT_SEED_DIR);
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 120_000;
    this.log = options.logger ?? noopLogger;
  }

  /** Tworzy katalog na zbiory źródłowe, jeśli jeszcze nie istnieje. */
  public ensureSeedDir(): string {
    if (!fs.existsSync(this.seedDir)) {
      fs.mkdirSync(this.seedDir, { recursive: true });
      this.log(`Utworzono katalog na dane źródłowe: ${this.seedDir}`);
    }
    return this.seedDir;
  }

  // ---------------------------------------------------------------------------
  // Pobieranie
  // ---------------------------------------------------------------------------

  private async fetchWithTimeout(url: string, accept?: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: accept ? { Accept: accept } : undefined,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Ustala adres najnowszego wydania PoliMorf w repozytorium SGJP.
   * Nazwa pliku zawiera datę wydania, więc czytamy indeks zamiast zgadywać wersję.
   */
  public async discoverSgjpPoliMorfUrl(): Promise<string | null> {
    try {
      const indexResponse = await this.fetchWithTimeout(SGJP_RELEASE_INDEX);
      if (!indexResponse.ok) return null;
      const indexHtml = await indexResponse.text();

      const releaseDirs = [...indexHtml.matchAll(/href="(\d{8})\/"/g)].map((m) => m[1]).sort();
      if (releaseDirs.length === 0) return null;

      const latest = releaseDirs[releaseDirs.length - 1];
      const releaseUrl = `${SGJP_RELEASE_INDEX}${latest}/`;
      const releaseResponse = await this.fetchWithTimeout(releaseUrl);
      if (!releaseResponse.ok) return null;
      const releaseHtml = await releaseResponse.text();

      const fileMatch = releaseHtml.match(/href="(polimorf-\d+\.tab\.gz)"/);
      if (!fileMatch) return null;

      return `${releaseUrl}${fileMatch[1]}`;
    } catch (error) {
      this.log(`Nie udało się odczytać indeksu wydań SGJP: ${(error as Error).message}`);
      return null;
    }
  }

  private async downloadToFile(url: string, destination: string): Promise<boolean> {
    try {
      this.log(`Pobieranie: ${url}`);
      const response = await this.fetchWithTimeout(url);
      if (!response.ok || !response.body) {
        this.log(`  -> odpowiedź HTTP ${response.status}, pomijam to źródło.`);
        return false;
      }

      const tempPath = `${destination}.part`;
      await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(tempPath));
      fs.renameSync(tempPath, destination);

      const sizeMb = (fs.statSync(destination).size / 1024 / 1024).toFixed(1);
      this.log(`  -> zapisano ${destination} (${sizeMb} MB)`);
      return true;
    } catch (error) {
      this.log(`  -> błąd pobierania: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Pobiera archiwum PoliMorf do katalogu seed.
   * @returns ścieżka pliku oraz sposób jego pozyskania.
   */
  public async acquirePoliMorf(): Promise<{ filePath: string | null; status: SourceStatus }> {
    this.ensureSeedDir();
    const destination = path.join(this.seedDir, 'PoliMorf.tab.gz');

    if (fs.existsSync(destination) && !this.options.force) {
      this.log(`PoliMorf już pobrany: ${destination}`);
      return { filePath: destination, status: 'cache' };
    }

    if (this.options.offline) {
      this.log('Tryb offline - pomijam pobieranie PoliMorf.');
      return { filePath: null, status: 'skipped' };
    }

    const candidates = [...POLIMORF_URL_CANDIDATES];
    const envUrl = process.env.POLIMORF_URL;
    if (envUrl) candidates.unshift(envUrl);

    const discovered = await this.discoverSgjpPoliMorfUrl();
    if (discovered) candidates.push(discovered);

    for (const url of candidates) {
      if (await this.downloadToFile(url, destination)) {
        return { filePath: destination, status: 'download' };
      }
    }

    this.log('Żadne ze źródeł PoliMorf nie odpowiedziało - używam korpusu offline.');
    return { filePath: null, status: 'offline-fallback' };
  }

  // ---------------------------------------------------------------------------
  // Import strumieniowy PoliMorf
  // ---------------------------------------------------------------------------

  /**
   * Importuje słownik PoliMorf strumieniowo.
   *
   * Plik (kilkaset MB po rozpakowaniu) nigdy nie trafia w całości do pamięci:
   * gzip jest dekompresowany w locie, `readline` wydaje wiersz po wierszu,
   * a zapisy lecą paczkami po `batchSize` w jednej transakcji.
   */
  public async importPoliMorfStream(filePath: string): Promise<{ linesRead: number; rowsWritten: number }> {
    const readStream = fs.createReadStream(filePath);
    const input = filePath.endsWith('.gz') ? readStream.pipe(zlib.createGunzip()) : readStream;

    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    let linesRead = 0;
    let rowsWritten = 0;
    let batch: MorphEntry[] = [];
    const limit = this.options.maxPolimorfRows ?? Infinity;

    const flush = (): void => {
      if (batch.length === 0) return;
      rowsWritten += this.repo.insertMorphBatch(batch, 'priority');
      batch = [];
    };

    try {
      for await (const rawLine of rl) {
        linesRead++;

        const line = rawLine.trimEnd();
        if (!line || line.startsWith('#')) continue;

        const parts = line.split('\t');
        if (parts.length < 3) continue; // nagłówek licencyjny i puste wiersze

        const form = parts[0].trim();
        // Lematy homonimiczne bywają znakowane sufiksem (np. "bez:s1").
        const lemma = parts[1].split(':')[0].trim();
        const posTag = parts[2].split(':')[0].trim();

        if (!form || !lemma || !ALLOWED_POS_TAGS.has(posTag)) continue;
        if (form.length > 64 || form.includes(' ')) continue;

        batch.push({ form, lemma, posTag });

        if (batch.length >= this.batchSize) {
          flush();
          if (rowsWritten % (this.batchSize * 20) === 0) {
            this.log(`  ... zaimportowano ${rowsWritten.toLocaleString('pl-PL')} form`);
          }
        }

        if (rowsWritten >= limit) break;
      }

      flush();
    } finally {
      rl.close();
      readStream.destroy();
    }

    return { linesRead, rowsWritten };
  }

  /**
   * Zapisuje kuratorowany korpus dziedzinowy.
   *
   * Uruchamiany **po** PoliMorf i w trybie nadpisywania: słownictwo IT
   * ("mikroserwis", "konteneryzacja", nazwy technologii) jest nadrzędne wobec
   * korpusu ogólnego, dzięki czemu wynik lematyzacji nie zależy od tego, czy
   * pobranie PoliMorf się powiodło.
   */
  public importCuratedCorpus(): number {
    const corpus = buildOfflineMorphCorpus(technologyLemmas());
    let written = 0;
    for (let i = 0; i < corpus.length; i += this.batchSize) {
      written += this.repo.insertMorphBatch(corpus.slice(i, i + this.batchSize), 'override');
    }
    this.log(`Zapisano kuratorowany korpus dziedzinowy: ${written.toLocaleString('pl-PL')} form.`);
    return written;
  }

  // ---------------------------------------------------------------------------
  // Taksonomia ESCO
  // ---------------------------------------------------------------------------

  /**
   * Pobiera polskie etykiety umiejętności z publicznego API ESCO i zapisuje je
   * jako CSV w katalogu seed. Zapytania budujemy z nazw bazowych tezaurusa
   * offline, więc pokrycie odpowiada słownictwu, którego faktycznie używamy.
   */
  public async acquireEscoCsv(): Promise<{ filePath: string | null; status: SourceStatus }> {
    this.ensureSeedDir();
    // Nowa nazwa pliku: eksport obejmuje teraz oba filary (umiejętności i zawody)
    // i inne wartości w kolumnie `category` niż zaciąg wyszukiwarkowy sprzed
    // stronicowania. Stary `esco-skills.pl.csv` nie zostanie użyty jako pamięć
    // podręczna, bo miałby niezgodną treść przy tej samej strukturze kolumn.
    const destination = path.join(this.seedDir, 'esco-taxonomy.pl.csv');

    if (fs.existsSync(destination) && !this.options.force) {
      this.log(`Taksonomia ESCO już pobrana: ${destination}`);
      return { filePath: destination, status: 'cache' };
    }

    if (this.options.offline) {
      this.log('Tryb offline - pomijam pobieranie ESCO.');
      return { filePath: null, status: 'skipped' };
    }

    // Oficjalny pakiet CSV ESCO wymaga rejestracji; gdy użytkownik ma własny
    // adres (np. kopię w wewnętrznym repozytorium), użyjemy go wprost.
    const csvUrl = process.env.ESCO_CSV_URL;
    if (csvUrl && (await this.downloadToFile(csvUrl, destination))) {
      return { filePath: destination, status: 'download' };
    }

    const collected = new Map<string, SkillSynonym>();

    for (const conceptType of ESCO_CONCEPT_TYPES) {
      const rows = await this.harvestEscoConcepts(conceptType);
      for (const row of rows) {
        collected.set(`${row.canonicalName}\u0000${row.altLabel}`, row);
      }
    }

    if (collected.size === 0) {
      this.log('API ESCO nie zwróciło danych - używam tezaurusa offline.');
      return { filePath: null, status: 'offline-fallback' };
    }

    const csv = [
      'canonical_name,alt_label,category',
      ...[...collected.values()].map((row) =>
        [row.canonicalName, row.altLabel, row.category].map(csvEscape).join(',')
      ),
    ].join('\n');

    fs.writeFileSync(destination, `${csv}\n`, 'utf-8');
    this.log(`Zapisano ${collected.size.toLocaleString('pl-PL')} etykiet ESCO do ${destination}`);
    return { filePath: destination, status: 'download' };
  }

  /**
   * Zaciąga komplet pojęć jednego filaru ESCO, obchodząc hierarchię klasyfikacji.
   *
   * Endpoint `/search` **nie nadaje się** do eksportu zbiorczego: niezależnie od
   * rozmiaru strony oddaje tylko pierwsze ~200 trafień (`offset=300` zwraca już
   * pustą listę), bo służy wyszukiwaniu, a nie pobieraniu całego filaru.
   *
   * Zamiast tego schodzimy po `narrowerConcept` od korzenia schematu. Odsyłacze
   * do liści niosą komplet identyfikatorów i polskich nazw preferowanych, więc
   * nazwy bazowe kosztują kilkaset żądań. Etykiety alternatywne wymagają już
   * jednego żądania na pojęcie i są pobierane równolegle.
   */
  public async harvestEscoConcepts(conceptType: EscoConceptType): Promise<SkillSynonym[]> {
    const category = conceptType === 'occupation' ? 'ESCO/zawód' : 'ESCO/umiejętność';
    const rows: SkillSynonym[] = [];
    const knownUris = new Set<string>();

    let pending = await this.traverseEscoHierarchy(conceptType);
    if (pending.size === 0) return [];

    // Pojęcia bywają zagnieżdżone głębiej niż sięga obchód grup: zawód ma
    // specjalizacje pod `narrowerOccupation`. Żądania po etykiety alternatywne
    // i tak odwiedzają każde pojęcie, więc zbieramy przy tej okazji potomków
    // i domykamy zbiór w kolejnej rundzie - bez dodatkowych żądań na obchód.
    for (let round = 1; round <= ESCO_DISCOVERY_ROUNDS && pending.size > 0; round++) {
      const fresh = [...pending.entries()].filter(([uri]) => !knownUris.has(uri));
      if (fresh.length === 0) break;

      this.log(
        `ESCO ${conceptType}: runda ${round} - ${fresh.length.toLocaleString('pl-PL')} nowych pojęć.`
      );

      for (const [uri, title] of fresh) {
        knownUris.add(uri);
        const canonical = title.toLowerCase().trim();
        if (canonical) rows.push({ canonicalName: canonical, altLabel: canonical, category });
      }

      if (this.options.escoSkipAltLabels) {
        this.log(`ESCO ${conceptType}: pominięto etykiety alternatywne (--esco-no-alt).`);
        break;
      }

      const { synonyms, discovered } = await this.fetchEscoDetails(
        fresh.map(([uri]) => uri),
        conceptType
      );
      appendAll(rows, synonyms);

      pending = new Map([...discovered].filter(([uri]) => !knownUris.has(uri)));
    }

    this.log(
      `ESCO ${conceptType}: ${knownUris.size.toLocaleString('pl-PL')} pojęć, ` +
        `${rows.length.toLocaleString('pl-PL')} etykiet.`
    );
    return rows;
  }

  /**
   * Schodzi po hierarchii schematu klasyfikacji i zwraca mapę
   * `URI pojęcia -> polska nazwa preferowana` dla wszystkich liści.
   */
  public async traverseEscoHierarchy(conceptType: EscoConceptType): Promise<Map<string, string>> {
    const leaves = new Map<string, string>();
    const visited = new Set<string>();

    const schemeUrl =
      `${ESCO_API_RESOURCE}/taxonomy?uri=${encodeURIComponent(ESCO_CONCEPT_SCHEMES[conceptType])}` +
      '&language=pl';
    const root = await this.fetchEscoJson(schemeUrl);
    if (!root) {
      this.log(`ESCO ${conceptType}: nie udało się odczytać schematu klasyfikacji.`);
      return leaves;
    }

    const topConcepts = root._links?.hasTopConcept;
    const queue: string[] = (Array.isArray(topConcepts) ? topConcepts : [])
      .map((link) => link.uri)
      .filter((uri): uri is string => Boolean(uri));
    let groupsVisited = 0;

    while (queue.length > 0) {
      const batch = queue.splice(0, ESCO_CONCURRENCY).filter((uri) => !visited.has(uri));
      if (batch.length === 0) continue;
      batch.forEach((uri) => visited.add(uri));

      const payloads = await Promise.all(
        batch.map((uri) =>
          this.fetchEscoJson(`${ESCO_API_RESOURCE}/concept?uri=${encodeURIComponent(uri)}&language=pl`)
        )
      );

      for (const payload of payloads) {
        if (!payload) continue;
        groupsVisited++;

        for (const [key, links] of Object.entries(payload._links ?? {})) {
          if (!key.startsWith('narrower') || !Array.isArray(links)) continue;

          for (const link of links) {
            if (!link?.uri) continue;
            if (key === 'narrowerConcept') {
              // Węzeł grupujący - schodzimy głębiej.
              if (!visited.has(link.uri)) queue.push(link.uri);
            } else {
              // Liść (narrowerSkill / narrowerOccupation) - nazwa jest w odsyłaczu.
              if (link.title) leaves.set(link.uri, link.title);
            }
          }
        }
      }

      if (groupsVisited % 50 === 0) {
        this.log(
          `  ... obeszto ${groupsVisited} grup, zebrano ${leaves.size.toLocaleString('pl-PL')} pojęć`
        );
      }
    }

    return leaves;
  }

  /**
   * Pobiera szczegóły pojęć pulą równoległych żądań.
   *
   * Zwraca zarówno wiersze tezaurusa (etykiety alternatywne), jak i pojęcia
   * odkryte w odsyłaczach `narrower*` odpowiedzi - te ostatnie domykają zbiór
   * tam, gdzie hierarchia sięga głębiej niż węzły grupujące. Pojęcia, których
   * nie udało się pobrać, są pomijane; ich nazwa bazowa jest już zapisana.
   */
  private async fetchEscoDetails(
    uris: string[],
    conceptType: EscoConceptType
  ): Promise<{ synonyms: SkillSynonym[]; discovered: Map<string, string> }> {
    const synonyms: SkillSynonym[] = [];
    const discovered = new Map<string, string>();
    const limit = this.options.escoMaxConcepts ?? uris.length;
    const targets = uris.slice(0, limit);
    let done = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i += ESCO_CONCURRENCY) {
      const batch = targets.slice(i, i + ESCO_CONCURRENCY);
      const payloads = await Promise.all(
        batch.map((uri) =>
          this.fetchEscoJson(`${ESCO_API_RESOURCE}/concept?uri=${encodeURIComponent(uri)}&language=pl`)
        )
      );

      for (const payload of payloads) {
        if (!payload) {
          failed++;
          continue;
        }

        appendAll(synonyms, escoResultToSynonyms(payload as EscoSearchResult, conceptType));

        for (const [key, links] of Object.entries(payload._links ?? {})) {
          if (!key.startsWith('narrower') || !Array.isArray(links)) continue;
          for (const link of links) {
            if (link?.uri && link.title) discovered.set(link.uri, link.title);
          }
        }
      }

      done += batch.length;
      if (done % 2000 === 0) {
        this.log(`  ... ${done.toLocaleString('pl-PL')} / ${targets.length.toLocaleString('pl-PL')}`);
      }
    }

    if (failed > 0) this.log(`  (nie pobrano szczegółów dla ${failed} pojęć)`);
    return { synonyms, discovered };
  }

  /** Pobiera zasób JSON, ponawiając próbę po błędzie sieci lub 5xx. */
  private async fetchEscoJson(url: string): Promise<EscoResourceResponse | null> {
    for (let attempt = 1; attempt <= ESCO_PAGE_RETRIES; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, 'application/json');
        if (response.ok) return (await response.json()) as EscoResourceResponse;
        if (response.status < 500) return null;
      } catch {
        // Zerwane połączenie - próbujemy ponownie.
      }
    }
    return null;
  }

  /** Wczytuje wiersze tezaurusa z pliku CSV (strumieniowo, wiersz po wierszu). */
  public async readSkillCsv(filePath: string): Promise<SkillSynonym[]> {
    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
    const rows: SkillSynonym[] = [];
    let header: string[] | null = null;

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;
        const fields = parseCsvLine(line);

        if (!header) {
          header = fields.map((f) => f.trim().toLowerCase());
          continue;
        }

        const record: Record<string, string> = {};
        header.forEach((column, index) => {
          record[column] = fields[index] ?? '';
        });

        // Obsługujemy zarówno nasz format eksportu, jak i oryginalne kolumny ESCO.
        const canonicalName = (record['canonical_name'] || record['preferredlabel'] || '').trim();
        if (!canonicalName) continue;
        const category = (record['category'] || record['concepttype'] || 'ESCO').trim();

        const altLabelField = record['alt_label'] ?? record['altlabels'] ?? '';
        const altLabels = altLabelField
          .split(/[\n|]/)
          .map((value) => value.trim())
          .filter(Boolean);

        rows.push({ canonicalName, altLabel: canonicalName, category });
        for (const altLabel of altLabels) {
          rows.push({ canonicalName, altLabel, category });
        }
      }
    } finally {
      rl.close();
    }

    return rows;
  }

  /**
   * Zapisuje tezaurus umiejętności paczkami transakcyjnymi.
   *
   * Obok etykiety źródłowej zapisujemy jej wariant zlematyzowany
   * ("konteneryzacji dockerowej" -> "konteneryzacja dockerowy"), dzięki czemu
   * odmieniona fraza z CV trafia w indeks bez przeszukiwania tabeli.
   */
  public importSkillThesaurus(rows: SkillSynonym[]): number {
    const expanded = new Map<string, SkillSynonym>();

    for (const row of rows) {
      const canonicalName = row.canonicalName.toLowerCase().trim();
      const altLabel = row.altLabel.toLowerCase().trim();
      if (!canonicalName || !altLabel) continue;

      expanded.set(`${canonicalName} ${altLabel}`, { canonicalName, altLabel, category: row.category });

      const lemmatized = altLabel
        .split(/\s+/)
        .map((token) => this.repo.lookupLemma(token)?.lemma ?? token)
        .join(' ');

      if (lemmatized !== altLabel) {
        expanded.set(`${canonicalName} ${lemmatized}`, {
          canonicalName,
          altLabel: lemmatized,
          // Znacznik kategorii: wiersz jest indeksem wyszukiwania,
          // a nie zwrotem, który wolno pokazać jako synonim.
          category: markDerivedCategory(row.category),
        });
      }
    }

    const all = [...expanded.values()];
    let written = 0;
    for (let i = 0; i < all.length; i += this.batchSize) {
      written += this.repo.insertSynonymBatch(all.slice(i, i + this.batchSize));
    }
    return written;
  }

  // ---------------------------------------------------------------------------
  // Orkiestracja
  // ---------------------------------------------------------------------------

  /** Pełny przebieg: pobranie źródeł, import morfologii, import tezaurusa. */
  public async run(): Promise<LexiconImportReport> {
    const startedAt = Date.now();
    this.ensureSeedDir();

    // 1. Słownik morfologiczny -------------------------------------------------
    const { filePath: morphFile, status: morphStatus } = await this.acquirePoliMorf();

    let polimorfLinesRead = 0;
    let polimorfRowsWritten = 0;

    if (morphFile) {
      this.log(`Import PoliMorf (strumieniowo, paczki po ${this.batchSize.toLocaleString('pl-PL')})...`);
      const result = await this.importPoliMorfStream(morphFile);
      polimorfLinesRead = result.linesRead;
      polimorfRowsWritten = result.rowsWritten;
      this.log(
        `PoliMorf: przeczytano ${polimorfLinesRead.toLocaleString('pl-PL')} wierszy, ` +
          `zapisano ${polimorfRowsWritten.toLocaleString('pl-PL')} form.`
      );
    }

    const curatedRowsWritten = this.importCuratedCorpus();

    // 2. Tezaurus umiejętności -------------------------------------------------
    const { filePath: skillFile, status: skillStatus } = await this.acquireEscoCsv();

    const skillRows: SkillSynonym[] = buildOfflineSkillThesaurus();
    if (skillFile) {
      appendAll(skillRows, await this.readSkillCsv(skillFile));
    }

    const skillRowsWritten = this.importSkillThesaurus(skillRows);
    this.log(`Tezaurus umiejętności: zapisano ${skillRowsWritten.toLocaleString('pl-PL')} etykiet.`);

    return {
      morphSource: morphStatus,
      morphFile,
      polimorfLinesRead,
      polimorfRowsWritten,
      curatedRowsWritten,
      morphDictionarySize: this.repo.countMorphEntries(),

      skillSource: skillStatus,
      skillFile,
      skillRowsWritten,
      skillSynonymsSize: this.repo.countSkillSynonyms(),
      canonicalSkills: this.repo.countCanonicalSkills(),

      durationMs: Date.now() - startedAt,
    };
  }

  /**
   * Import bez sieci - wyłącznie kuratorowany korpus i tezaurus offline.
   * Używany w testach jednostkowych na bazie w pamięci.
   */
  public seedOfflineCorpus(): { morphRows: number; skillRows: number } {
    const morphRows = this.importCuratedCorpus();
    const skillRows = this.importSkillThesaurus(buildOfflineSkillThesaurus());
    return { morphRows, skillRows };
  }
}

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

interface EscoSearchResult {
  className?: string;
  title?: string;
  preferredLabel?: Record<string, string | string[] | undefined>;
  alternativeLabel?: Record<string, string[] | undefined>;
}

interface EscoSearchResponse {
  total?: number;
  _embedded?: { results?: EscoSearchResult[] };
}

interface EscoLink {
  uri?: string;
  title?: string;
}

interface EscoResourceResponse extends EscoSearchResult {
  _links?: Record<string, EscoLink[] | EscoLink | undefined>;
}

/**
 * Dopisuje wszystkie elementy `source` na koniec `target`.
 *
 * Naturalne `target.push(...source)` przekazuje każdy element jako osobny
 * argument wywołania, więc przy tablicach rzędu stu tysięcy pozycji przepełnia
 * stos (`RangeError: Maximum call stack size exceeded`). Taksonomia ESCO ma
 * ponad 150 tysięcy etykiet, czyli dokładnie ten rząd wielkości.
 */
export function appendAll<T>(target: T[], source: readonly T[]): T[] {
  for (const item of source) target.push(item);
  return target;
}

function firstLabel(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Zamienia rekord ESCO na wiersze tezaurusa.
 *
 * Nazwą bazową jest polska etykieta preferowana. Synonimami stają się:
 *  - polskie etykiety alternatywne (ma je ok. 10% pojęć),
 *  - angielska etykieta preferowana i jej warianty - w polskich CV z branży IT
 *    nazwy kompetencji zostają po angielsku, więc bez tego mostu „project
 *    management” nie trafiłby w „zarządzanie projektami”.
 *
 * Kategoria rozróżnia filary, żeby dało się odpytać sam zbiór zawodów.
 */
export function escoResultToSynonyms(
  result: EscoSearchResult,
  conceptType: EscoConceptType = 'skill'
): SkillSynonym[] {
  const canonical = (firstLabel(result.preferredLabel?.pl) ?? result.title ?? '').toLowerCase().trim();
  if (!canonical) return [];

  const category = conceptType === 'occupation' ? 'ESCO/zawód' : 'ESCO/umiejętność';
  const rows: SkillSynonym[] = [{ canonicalName: canonical, altLabel: canonical, category }];

  const alternatives = [
    ...(result.alternativeLabel?.pl ?? []),
    firstLabel(result.preferredLabel?.en) ?? '',
    ...(result.alternativeLabel?.en ?? []),
  ];

  const seen = new Set<string>([canonical]);
  for (const alternative of alternatives) {
    const altLabel = (alternative ?? '').toLowerCase().trim();
    if (!altLabel || seen.has(altLabel)) continue;
    seen.add(altLabel);
    rows.push({ canonicalName: canonical, altLabel, category });
  }

  return rows;
}

/** Minimalny parser wiersza CSV (RFC 4180: cudzysłowy i podwojone cudzysłowy). */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') {
      fields.push(current);
      current = '';
    } else current += char;
  }

  fields.push(current);
  return fields;
}

export function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export type { SkillSeed };
