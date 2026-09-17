import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Entity, Relation, Proposal, EntitySchema, RelationSchema } from '../domain/types.js';
import { normalizeTerm } from '../services/normalizer.js';

/** Pojedynczy wpis słownika morfologicznego (`morph_dictionary`). */
export interface MorphEntry {
  /** Forma fleksyjna zapisana małymi literami — klucz główny wyszukiwania O(1). */
  form: string;
  /** Forma hasłowa (lemat). */
  lemma: string;
  /** Skrócony tag części mowy: `subst`, `verb`, `fin`, `praet`, `ger`, `adj`. */
  posTag: string;
}

/** Pojedynczy wpis tezaurusa umiejętności (`skill_synonyms`). */
export interface SkillSynonym {
  /** Nazwa bazowa/kanoniczna umiejętności (np. `kubernetes`). */
  canonicalName: string;
  /** Etykieta alternatywna prowadząca do nazwy bazowej (np. `k8s`). */
  altLabel: string;
  /** Kategoria źródłowa (np. `ESCO`, `IT`, `DevOps`). */
  category: string;
}

/**
 * Strategia rozstrzygania kolizji przy zapisie do `morph_dictionary`.
 *
 * - `priority` — zwycięża wpis o wyższym priorytecie części mowy (patrz `POS_PRIORITY`).
 *   Używane dla masowego korpusu (PoliMorf), gdzie ta sama forma bywa homonimem.
 * - `override` — nowy wpis zawsze nadpisuje istniejący. Używane dla kuratorowanego
 *   słownika dziedzinowego, który ma mieć pierwszeństwo nad korpusem ogólnym.
 */
export type MorphWriteMode = 'priority' | 'override';

/**
 * Prefiks kategorii oznaczający etykietę wygenerowaną maszynowo — wariant
 * etykiety źródłowej po lematyzacji („orkiestracja kontenerów” →
 * „orkiestracja kontener”).
 *
 * Takie wiersze istnieją wyłącznie po to, żeby odmieniona fraza z CV trafiała
 * w indeks `alt_label` jednym zapytaniem. Nie są poprawnymi polskimi zwrotami,
 * więc nie pokazujemy ich jako synonimów użytkownikowi.
 */
export const DERIVED_LABEL_PREFIX = 'lemma:';

/** Oznacza kategorię jako wygenerowaną maszynowo. */
export function markDerivedCategory(category: string): string {
  return category.startsWith(DERIVED_LABEL_PREFIX) ? category : `${DERIVED_LABEL_PREFIX}${category}`;
}

/** Zdejmuje znacznik z kategorii wygenerowanej maszynowo. */
export function stripDerivedCategory(category: string): string {
  return category.startsWith(DERIVED_LABEL_PREFIX) ? category.slice(DERIVED_LABEL_PREFIX.length) : category;
}

/**
 * Priorytet części mowy przy kolizji form (mniejsza liczba = wyższy priorytet).
 *
 * Rzeczowniki odczasownikowe (`ger`) mają pierwszeństwo, bo w CV interesuje nas
 * czynność, a nie jej nazwa: „wdrożenie” → „wdrożyć”, „zarządzanie” → „zarządzać”.
 * Dzięki temu zdania o różnej składni sprowadzają się do tego samego zbioru lematów.
 */
export const POS_PRIORITY: Record<string, number> = {
  ger: 0,
  subst: 1,
  praet: 2,
  fin: 3,
  verb: 4,
  adj: 5,
};

const POS_PRIORITY_SQL = (column: string): string =>
  `CASE ${column} ` +
  Object.entries(POS_PRIORITY)
    .map(([tag, rank]) => `WHEN '${tag}' THEN ${rank}`)
    .join(' ') +
  ' ELSE 9 END';

export interface GraphRepositoryOptions {
  /**
   * Tryb tylko do odczytu dla bezstanowych kontenerów.
   *
   * Kontener Cloud Run ma zapisywalny wyłącznie `/tmp`, a baza leży obok kodu
   * w obrazie. Otwarcie read-write przy pierwszym zapytaniu próbowało stworzyć
   * pliki `-wal`/`-shm` obok bazy i wywróciło by się na systemie plików tylko
   * do odczytu, mimo że czytelnikowi zapis jest zbędny. `fileMustExist`
   * dodatkowo zamienia cichy „pusta nowa baza" na jasny błąd konfiguracji —
   * brakujący plik danych to błąd wdrożenia, nie stan do obsłużenia.
   */
  readonly?: boolean;
}

export class SqliteGraphRepository {
  private readonly db: Database.Database;
  private readonly statements = new Map<string, Database.Statement>();

  constructor(dbPath: string = './data/swg.db', options: GraphRepositoryOptions = {}) {
    const isMemory = dbPath === ':memory:' || dbPath.startsWith('file::memory:');
    const readonlyMode = options.readonly === true;

    if (isMemory) {
      this.db = new Database(dbPath);
    } else {
      const resolvedPath = path.resolve(dbPath);
      const dir = path.dirname(resolvedPath);
      // W trybie odczytu katalog musi już istnieć razem z bazą; tworzenie go
      // byłobym side-efektem zapisu, którego tu być nie ma.
      if (!readonlyMode && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(resolvedPath, { readonly: readonlyMode, fileMustExist: readonlyMode });
    }

    if (readonlyMode) {
      // Podwójna zapora: sterownik nie otworzy pliku do zapisu, a silnik SQLite
      // odrzuci każde polecenie modyfikujące — także te wykonane przez przypadkowy
      // `getRawDb()` u konsumenta działającego na kopii produkcyjnej.
      this.db.pragma('query_only = ON');
    } else {
      // Write-Ahead Logging: czytelnicy nie blokują pisarza, a masowy import
      // słownika (miliony wierszy) nie przepisuje całej bazy przy każdej transakcji.
      // W trybie odczytu pomijane celowo: przełączenie journal_mode to zapis,
      // a pliki WAL i tak nie mają prawa powstać obok bazy z obrazu.
      this.db.pragma('journal_mode = WAL');
      // NORMAL: fsync tylko przy checkpointach WAL. Baza jest odtwarzalna
      // (`npm run seed:lexicon`), więc pełna trwałość FULL to zbędny koszt.
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('foreign_keys = ON');

      this.initDatabase();
    }
  }

  /** Zwraca aktualną wartość PRAGMA (wykorzystywane w testach konfiguracji). */
  public getPragma(name: string): unknown {
    return this.db.pragma(name, { simple: true });
  }

  /** Surowy uchwyt bazy — wyłącznie dla importerów potrzebujących transakcji wsadowych. */
  public getRawDb(): Database.Database {
    return this.db;
  }

  private prepare(sql: string): Database.Statement {
    let stmt = this.statements.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.statements.set(sql, stmt);
    }
    return stmt;
  }

  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        aliases TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL,
        status TEXT NOT NULL,
        confidence REAL NOT NULL,
        source TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
      CREATE INDEX IF NOT EXISTS idx_entities_status ON entities(status);

      CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY,
        fromEntityId TEXT NOT NULL,
        toEntityId TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1.0,
        confidence REAL NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        evidence TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY(fromEntityId) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY(toEntityId) REFERENCES entities(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(fromEntityId);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(toEntityId);
      CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
      CREATE INDEX IF NOT EXISTS idx_relations_status ON relations(status);

      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT NOT NULL,
        proposedBy TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

      -- Deterministyczna lematyzacja: forma fleksyjna -> forma hasłowa.
      -- Kolumna form jest kluczem głównym (WITHOUT ROWID), więc odczyt lematu
      -- to pojedynczy skok po indeksie B-drzewa — koszt niezależny od rozmiaru słownika.
      CREATE TABLE IF NOT EXISTS morph_dictionary (
        form TEXT PRIMARY KEY,
        lemma TEXT NOT NULL,
        pos_tag TEXT NOT NULL
      ) WITHOUT ROWID;

      CREATE INDEX IF NOT EXISTS idx_morph_dictionary_lemma ON morph_dictionary(lemma);

      -- Tezaurus umiejętności (ESCO + żargon branżowy): etykieta -> nazwa bazowa.
      CREATE TABLE IF NOT EXISTS skill_synonyms (
        id INTEGER PRIMARY KEY,
        canonical_name TEXT NOT NULL,
        alt_label TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'ESCO'
      );

      CREATE INDEX IF NOT EXISTS idx_skill_synonyms_alt_label ON skill_synonyms(alt_label);
      CREATE INDEX IF NOT EXISTS idx_skill_synonyms_canonical_name ON skill_synonyms(canonical_name);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_skill_synonyms_pair
        ON skill_synonyms(alt_label, canonical_name);
    `);
  }

  // ---------------------------------------------------------------------------
  // Słownik morfologiczny
  // ---------------------------------------------------------------------------

  /**
   * Wyszukuje formę hasłową dla formy fleksyjnej. Zapytanie punktowe po kluczu
   * głównym — złożoność O(1) względem rozmiaru słownika.
   */
  public lookupLemma(form: string): MorphEntry | null {
    const key = form.toLowerCase();
    const row = this.prepare('SELECT form, lemma, pos_tag FROM morph_dictionary WHERE form = ?').get(key) as
      | { form: string; lemma: string; pos_tag: string }
      | undefined;
    if (!row) return null;
    return { form: row.form, lemma: row.lemma, posTag: row.pos_tag };
  }

  /** Zwraca wszystkie znane formy fleksyjne danego lematu (indeks `idx_morph_dictionary_lemma`). */
  public getFormsForLemma(lemma: string): string[] {
    const rows = this.prepare('SELECT form FROM morph_dictionary WHERE lemma = ? ORDER BY form').all(
      lemma.toLowerCase()
    ) as Array<{ form: string }>;
    return rows.map((r) => r.form);
  }

  /**
   * Zapisuje paczkę wpisów słownika w jednej transakcji.
   * Zwraca liczbę przetworzonych wierszy.
   */
  public insertMorphBatch(entries: MorphEntry[], mode: MorphWriteMode = 'priority'): number {
    if (entries.length === 0) return 0;

    const sql =
      mode === 'override'
        ? `INSERT INTO morph_dictionary (form, lemma, pos_tag) VALUES (?, ?, ?)
           ON CONFLICT(form) DO UPDATE SET lemma = excluded.lemma, pos_tag = excluded.pos_tag`
        : `INSERT INTO morph_dictionary (form, lemma, pos_tag) VALUES (?, ?, ?)
           ON CONFLICT(form) DO UPDATE SET lemma = excluded.lemma, pos_tag = excluded.pos_tag
           WHERE ${POS_PRIORITY_SQL('excluded.pos_tag')} < ${POS_PRIORITY_SQL('morph_dictionary.pos_tag')}`;

    const stmt = this.prepare(sql);
    const runBatch = this.db.transaction((rows: MorphEntry[]) => {
      for (const row of rows) {
        stmt.run(row.form.toLowerCase(), row.lemma.toLowerCase(), row.posTag);
      }
      return rows.length;
    });

    return runBatch(entries) as number;
  }

  public countMorphEntries(): number {
    const row = this.prepare('SELECT COUNT(*) AS c FROM morph_dictionary').get() as { c: number };
    return row.c;
  }

  public clearMorphDictionary(): void {
    this.db.exec('DELETE FROM morph_dictionary');
  }

  // ---------------------------------------------------------------------------
  // Tezaurus umiejętności
  // ---------------------------------------------------------------------------

  /** Zapisuje paczkę synonimów umiejętności w jednej transakcji. */
  public insertSynonymBatch(rows: SkillSynonym[]): number {
    if (rows.length === 0) return 0;

    const stmt = this.prepare(
      `INSERT INTO skill_synonyms (canonical_name, alt_label, category) VALUES (?, ?, ?)
       ON CONFLICT(alt_label, canonical_name) DO UPDATE SET category = excluded.category`
    );

    const runBatch = this.db.transaction((batch: SkillSynonym[]) => {
      for (const row of batch) {
        stmt.run(row.canonicalName.toLowerCase(), row.altLabel.toLowerCase(), row.category);
      }
      return batch.length;
    });

    return runBatch(rows) as number;
  }

  /**
   * Zwraca nazwę bazową umiejętności dla podanej etykiety alternatywnej.
   * Preferowane jest dopasowanie do etykiety, a przy jej braku — do samej nazwy bazowej.
   */
  public findCanonicalByAltLabel(altLabel: string): string | null {
    const key = altLabel.toLowerCase().trim();
    const byAlt = this.prepare(
      'SELECT canonical_name FROM skill_synonyms WHERE alt_label = ? ORDER BY id LIMIT 1'
    ).get(key) as { canonical_name: string } | undefined;
    if (byAlt) return byAlt.canonical_name;

    const byCanonical = this.prepare(
      'SELECT canonical_name FROM skill_synonyms WHERE canonical_name = ? ORDER BY id LIMIT 1'
    ).get(key) as { canonical_name: string } | undefined;
    return byCanonical ? byCanonical.canonical_name : null;
  }

  /**
   * Zwraca posortowaną listę etykiet alternatywnych dla nazwy bazowej.
   *
   * @param includeDerived dołącza warianty zlematyzowane (patrz `DERIVED_LABEL_PREFIX`).
   *   Domyślnie pominięte — są indeksem wyszukiwania, nie treścią dla użytkownika.
   */
  public getAltLabelsForCanonical(canonicalName: string, includeDerived = false): string[] {
    const sql = includeDerived
      ? 'SELECT DISTINCT alt_label FROM skill_synonyms WHERE canonical_name = ? ORDER BY alt_label'
      : `SELECT DISTINCT alt_label FROM skill_synonyms
         WHERE canonical_name = ? AND category NOT LIKE '${DERIVED_LABEL_PREFIX}%'
         ORDER BY alt_label`;
    const rows = this.prepare(sql).all(canonicalName.toLowerCase().trim()) as Array<{ alt_label: string }>;
    return rows.map((r) => r.alt_label);
  }

  /** Kategoria przypisana nazwie bazowej (np. `ESCO`, `DevOps`). */
  public getCategoryForCanonical(canonicalName: string): string | null {
    const row = this.prepare(
      `SELECT category FROM skill_synonyms
       WHERE canonical_name = ? AND category NOT LIKE '${DERIVED_LABEL_PREFIX}%'
       ORDER BY id LIMIT 1`
    ).get(canonicalName.toLowerCase().trim()) as { category: string } | undefined;
    return row ? row.category : null;
  }

  public countSkillSynonyms(): number {
    const row = this.prepare('SELECT COUNT(*) AS c FROM skill_synonyms').get() as { c: number };
    return row.c;
  }

  public countCanonicalSkills(): number {
    const row = this.prepare('SELECT COUNT(DISTINCT canonical_name) AS c FROM skill_synonyms').get() as {
      c: number;
    };
    return row.c;
  }

  public clearSkillSynonyms(): void {
    this.db.exec('DELETE FROM skill_synonyms');
  }

  // ---------------------------------------------------------------------------
  // Graf semantyczny
  // ---------------------------------------------------------------------------

  public async upsertEntity(entity: Entity): Promise<void> {
    const validated = EntitySchema.parse(entity);
    this.prepare(
      `
      INSERT INTO entities (id, type, name, aliases, description, tags, status, confidence, source, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type=excluded.type,
        name=excluded.name,
        aliases=excluded.aliases,
        description=excluded.description,
        tags=excluded.tags,
        status=excluded.status,
        confidence=excluded.confidence,
        source=excluded.source,
        updatedAt=excluded.updatedAt
    `
    ).run(
      validated.id,
      validated.type,
      validated.name,
      JSON.stringify(validated.aliases),
      validated.description,
      JSON.stringify(validated.tags),
      validated.status,
      validated.confidence,
      validated.source,
      validated.createdAt,
      validated.updatedAt
    );
  }

  public async upsertRelation(relation: Relation): Promise<void> {
    const validated = RelationSchema.parse(relation);
    this.prepare(
      `
      INSERT INTO relations (id, fromEntityId, toEntityId, type, weight, confidence, status, source, evidence, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        fromEntityId=excluded.fromEntityId,
        toEntityId=excluded.toEntityId,
        type=excluded.type,
        weight=excluded.weight,
        confidence=excluded.confidence,
        status=excluded.status,
        source=excluded.source,
        evidence=excluded.evidence,
        updatedAt=excluded.updatedAt
    `
    ).run(
      validated.id,
      validated.fromEntityId,
      validated.toEntityId,
      validated.type,
      validated.weight,
      validated.confidence,
      validated.status,
      validated.source,
      JSON.stringify(validated.evidence),
      validated.createdAt,
      validated.updatedAt
    );
  }

  public async getEntityById(id: string): Promise<Entity | null> {
    const row = this.prepare('SELECT * FROM entities WHERE id = ?').get(id);
    if (!row) return null;
    return this.mapRowToEntity(row);
  }

  public async getEntityByName(name: string): Promise<Entity | null> {
    const norm = normalizeTerm(name).normalized;
    const rows = this.prepare('SELECT * FROM entities').all();
    for (const row of rows) {
      const e = this.mapRowToEntity(row);
      if (normalizeTerm(e.name).normalized === norm) return e;
      if (e.aliases.some((a) => normalizeTerm(a).normalized === norm)) return e;
    }
    return null;
  }

  public async getAllEntities(): Promise<Entity[]> {
    const rows = this.prepare('SELECT * FROM entities').all();
    return rows.map((r) => this.mapRowToEntity(r));
  }

  public async getAllRelations(): Promise<Relation[]> {
    const rows = this.prepare('SELECT * FROM relations').all();
    return rows.map((r) => this.mapRowToRelation(r));
  }

  public async getRelationsForEntity(entityId: string): Promise<Relation[]> {
    const rows = this.prepare(
      `SELECT * FROM relations WHERE (fromEntityId = ? OR toEntityId = ?) AND status != 'rejected'`
    ).all(entityId, entityId);
    return rows.map((r) => this.mapRowToRelation(r));
  }

  public async saveProposal(proposal: Proposal): Promise<void> {
    this.prepare(
      `
      INSERT INTO proposals (id, data, status, proposedBy, createdAt)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data=excluded.data,
        status=excluded.status
    `
    ).run(proposal.id, JSON.stringify(proposal), proposal.status, proposal.proposedBy, proposal.createdAt);
  }

  public async getPendingProposals(): Promise<Proposal[]> {
    const rows = this.prepare("SELECT data FROM proposals WHERE status = 'proposed'").all() as Array<{
      data: string;
    }>;
    return rows.map((r) => JSON.parse(r.data));
  }

  private mapRowToEntity(row: any): Entity {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      aliases: JSON.parse(row.aliases),
      description: row.description,
      tags: JSON.parse(row.tags),
      status: row.status,
      confidence: row.confidence,
      source: row.source,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapRowToRelation(row: any): Relation {
    return {
      id: row.id,
      fromEntityId: row.fromEntityId,
      toEntityId: row.toEntityId,
      type: row.type,
      weight: row.weight,
      confidence: row.confidence,
      status: row.status,
      source: row.source,
      evidence: JSON.parse(row.evidence),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  public async close(): Promise<void> {
    if (this.db.open) {
      this.statements.clear();
      this.db.close();
    }
  }
}
