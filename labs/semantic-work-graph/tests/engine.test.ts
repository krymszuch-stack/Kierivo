import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteGraphRepository } from '../src/repositories/SqliteGraphRepository.js';
import { normalizeTerm, stemPolishWord, calculateHybridSimilarity } from '../src/services/normalizer.js';
import { SearchEngine } from '../src/services/SearchEngine.js';
import { PathFinder } from '../src/services/PathFinder.js';
import { SeedImporter } from '../src/seed/SeedImporter.js';
import { LinguisticEngine } from '../src/services/LinguisticEngine.js';
import { JargonMapper } from '../src/services/JargonMapper.js';
import { OrthographyChecker } from '../src/services/OrthographyChecker.js';
import fs from 'fs';
import path from 'path';

import { resetDefaultLexiconRepository } from '../src/repositories/defaultLexicon.js';

const TEST_DB_PATH = './data/test_swg_bilingual.db';

describe('Bilingual Polish/English & Morphological Linguistic Suite', () => {
  let repo: SqliteGraphRepository;

  beforeEach(async () => {
    resetDefaultLexiconRepository();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    repo = new SqliteGraphRepository(TEST_DB_PATH);
  });

  afterEach(async () => {
    resetDefaultLexiconRepository();
    await repo.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('powinien przemapować angielski anglicyzm branżowy "frontend" oraz "deployowanie" na kanoniczny termin PL', () => {
    const mapper = new JargonMapper();
    const res = mapper.normalizeJargon('deployowanie frontendu');

    expect(res.isJargonMatched).toBe(true);
    expect(res.canonicalText).toContain('wdrożenie produkcyjne');
  });

  it('powinien poprawiać literówki i błędną ortografię', () => {
    const checker = new OrthographyChecker();
    const res = checker.correctOrthography('pieczyk gazowy');

    expect(res.hasCorrection).toBe(true);
    expect(res.correctedText).toBe('piecyk gazowy');

    const resTrades = checker.correctOrthography('hidraulik i dekarż wykonali spachlowanie oraz montaz');
    expect(resTrades.hasCorrection).toBe(true);
    expect(resTrades.correctedText).toBe('hydraulik i dekarz wykonali szpachlowanie oraz montaż');
  });

  it('powinien dokonać transformacji czasownikowo-przypadkowej (np. serwisowanie -> serwisant)', () => {
    const lingEngine = new LinguisticEngine();
    const res = lingEngine.processQuery('serwisowanie kotłów gazowych');

    expect(res.actorProfessions).toContain('serwisant');
    expect(res.verbalNouns).toContain('serwisowanie');
  });

  it('powinien znaleźć profesję "Serwisant kotłów gazowych" po wpisaniu odmienionego zwrotu czasownikowego "serwisowanie kotłów"', async () => {
    const importer = new SeedImporter(repo);
    const seedPath = path.resolve(__dirname, '../data/seed/professions-top-100.pl.json');
    await importer.importSeedFile(seedPath);

    const engine = new SearchEngine(repo);
    const searchRes = await engine.search('serwisowanie kotłów');

    expect(searchRes.length).toBeGreaterThan(0);
    expect(searchRes[0].entity.name).toBe('Serwisant kotłów gazowych');
    expect(searchRes[0].matchType).toBe('verbal');
  });
});
