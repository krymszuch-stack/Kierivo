#!/usr/bin/env tsx
/**
 * Zasilenie bazy leksykalnej: słownik morfologiczny PoliMorf (IPI PAN)
 * oraz tezaurus umiejętności ESCO.
 *
 * Uruchomienie:
 *   npm run seed:lexicon                 # pełny przebieg (sieć + korpus dziedzinowy)
 *   npm run seed:lexicon -- --offline    # bez sieci, wyłącznie korpus kuratorowany
 *   npm run seed:lexicon -- --esco-no-alt # same nazwy bazowe ESCO (szybko)
 *   npm run seed:lexicon -- --force      # ponowne pobranie źródeł
 *   npm run seed:lexicon -- --db ./data/other.db --max-rows 200000
 *
 * Skrypt jest idempotentny: powtórne wywołanie aktualizuje istniejące wiersze
 * zamiast duplikować dane.
 */
import path from 'path';
import { SqliteGraphRepository } from '../src/repositories/SqliteGraphRepository.js';
import { LexiconImporter, DEFAULT_BATCH_SIZE, DEFAULT_SEED_DIR } from '../src/seed/LexiconImporter.js';

interface CliOptions {
  dbPath: string;
  seedDir: string;
  offline: boolean;
  force: boolean;
  batchSize: number;
  maxRows?: number;
  escoNoAlt: boolean;
  escoMax?: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dbPath: process.env.SWG_DB_PATH ?? './data/swg.db',
    seedDir: DEFAULT_SEED_DIR,
    offline: false,
    force: false,
    batchSize: DEFAULT_BATCH_SIZE,
    escoNoAlt: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--offline':
        options.offline = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--db':
        options.dbPath = argv[++i] ?? options.dbPath;
        break;
      case '--seed-dir':
        options.seedDir = argv[++i] ?? options.seedDir;
        break;
      case '--batch-size':
        options.batchSize = Number.parseInt(argv[++i] ?? '', 10) || DEFAULT_BATCH_SIZE;
        break;
      case '--max-rows':
        options.maxRows = Number.parseInt(argv[++i] ?? '', 10) || undefined;
        break;
      case '--esco-no-alt':
        options.escoNoAlt = true;
        break;
      case '--esco-max':
        options.escoMax = Number.parseInt(argv[++i] ?? '', 10) || undefined;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Nieznana opcja: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Zasilenie bazy leksykalnej (PoliMorf + ESCO)

  --offline            bez ruchu sieciowego (tylko korpus kuratorowany)
  --force              pobierz źródła ponownie, ignorując pliki w katalogu seed
  --db <ścieżka>       plik bazy SQLite (domyślnie ./data/swg.db)
  --seed-dir <kat>     katalog na zbiory źródłowe (domyślnie ${DEFAULT_SEED_DIR})
  --batch-size <n>     rozmiar paczki transakcyjnej (domyślnie ${DEFAULT_BATCH_SIZE})
  --max-rows <n>       limit importowanych form PoliMorf (przebieg kontrolny)
  --esco-no-alt        pomiń etykiety alternatywne ESCO (same nazwy bazowe,
                       skraca zaciąg z kilkudziesięciu minut do ok. minuty)
  --esco-max <n>       limit pojęć ESCO pobieranych ze szczegółami

Zmienne środowiskowe:
  SWG_DB_PATH          domyślna ścieżka bazy
  POLIMORF_URL         własny adres archiwum PoliMorf (.tab.gz)
  ESCO_CSV_URL         własny adres pakietu CSV ESCO
`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();

  console.log('=== Zasilanie leksykonu semantic-work-graph ===');
  console.log(`Baza:            ${path.resolve(options.dbPath)}`);
  console.log(`Katalog źródeł:  ${path.resolve(options.seedDir)}`);
  console.log(`Tryb:            ${options.offline ? 'offline' : 'online'}`);
  console.log('');

  const repo = new SqliteGraphRepository(options.dbPath);
  console.log(`PRAGMA journal_mode  = ${repo.getPragma('journal_mode')}`);
  console.log(`PRAGMA synchronous   = ${repo.getPragma('synchronous')}`);
  console.log('');

  try {
    const importer = new LexiconImporter(repo, {
      seedDir: options.seedDir,
      offline: options.offline,
      force: options.force,
      batchSize: options.batchSize,
      maxPolimorfRows: options.maxRows,
      escoSkipAltLabels: options.escoNoAlt,
      escoMaxConcepts: options.escoMax,
      logger: (message) => console.log(message),
    });

    const report = await importer.run();

    console.log('');
    console.log('=== Podsumowanie ===');
    console.log(`Źródło morfologii:      ${report.morphSource}${report.morphFile ? ` (${report.morphFile})` : ''}`);
    console.log(`Wiersze PoliMorf:       ${report.polimorfLinesRead.toLocaleString('pl-PL')} przeczytanych`);
    console.log(`Formy z PoliMorf:       ${report.polimorfRowsWritten.toLocaleString('pl-PL')}`);
    console.log(`Formy kuratorowane:     ${report.curatedRowsWritten.toLocaleString('pl-PL')}`);
    console.log(`morph_dictionary:       ${report.morphDictionarySize.toLocaleString('pl-PL')} wpisów`);
    console.log(`Źródło ESCO:            ${report.skillSource}${report.skillFile ? ` (${report.skillFile})` : ''}`);
    console.log(`skill_synonyms:         ${report.skillSynonymsSize.toLocaleString('pl-PL')} etykiet`);
    console.log(`Umiejętności bazowe:    ${report.canonicalSkills.toLocaleString('pl-PL')}`);
    console.log(`Czas:                   ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);

    if (report.morphDictionarySize === 0) {
      console.error('\nBaza morfologiczna jest pusta - import nie powiódł się.');
      process.exitCode = 1;
    }
  } finally {
    await repo.close();
  }
}

main().catch((error) => {
  console.error('Zasilanie leksykonu nie powiodło się:', error);
  process.exit(1);
});
