import { JargonMapper } from './JargonMapper.js';
import { OrthographyChecker } from './OrthographyChecker.js';
import { SqliteGraphRepository } from '../repositories/SqliteGraphRepository.js';
import { getDefaultLexiconRepository } from '../repositories/defaultLexicon.js';

export interface VerbalTransformation {
  actionVerb: string;
  actionNoun: string;
  actorProfession: string;
}

export const VERBAL_NOUN_MAP: VerbalTransformation[] = [
  { actionVerb: 'serwisować', actionNoun: 'serwisowanie', actorProfession: 'serwisant' },
  { actionVerb: 'montować', actionNoun: 'montaż', actorProfession: 'monter' },
  { actionVerb: 'spawać', actionNoun: 'spawanie', actorProfession: 'spawacz' },
  { actionVerb: 'naprawiać', actionNoun: 'naprawa', actorProfession: 'mechanik' },
  { actionVerb: 'programować', actionNoun: 'programowanie', actorProfession: 'programista' },
  { actionVerb: 'projektować', actionNoun: 'projektowanie', actorProfession: 'projektant' },
  { actionVerb: 'zarządzać', actionNoun: 'zarządzanie', actorProfession: 'administrator' },
  { actionVerb: 'diagnozować', actionNoun: 'diagnostyka', actorProfession: 'diagnosta' },
  { actionVerb: 'instalować', actionNoun: 'instalacja', actorProfession: 'instalator' },
  { actionVerb: 'toczyć', actionNoun: 'toczenie', actorProfession: 'tokarz' },
  { actionVerb: 'frezować', actionNoun: 'frezowanie', actorProfession: 'frezarz' },
  { actionVerb: 'szlifować', actionNoun: 'szlifowanie', actorProfession: 'szlifierz' },
  { actionVerb: 'lakierować', actionNoun: 'lakierowanie', actorProfession: 'lakiernik' },
  { actionVerb: 'tynkować', actionNoun: 'tynkowanie', actorProfession: 'tynkarz' },
  { actionVerb: 'murować', actionNoun: 'murowanie', actorProfession: 'murarz' },
  { actionVerb: 'brukować', actionNoun: 'brukowanie', actorProfession: 'brukarz' },
  { actionVerb: 'lutować', actionNoun: 'lutowanie', actorProfession: 'lutowacz' },
  { actionVerb: 'magazynować', actionNoun: 'magazynowanie', actorProfession: 'magazynier' },
  { actionVerb: 'kompletować', actionNoun: 'kompletacja', actorProfession: 'kompletator' },
  { actionVerb: 'kierować', actionNoun: 'prowadzenie', actorProfession: 'kierowca' },
  { actionVerb: 'dysponować', actionNoun: 'dyspozycja', actorProfession: 'dyspozytor' },
  { actionVerb: 'analizować', actionNoun: 'analiza', actorProfession: 'analityk' },
  { actionVerb: 'audytować', actionNoun: 'audyt', actorProfession: 'audytor' },
  { actionVerb: 'kontrolować', actionNoun: 'kontrola', actorProfession: 'kontroler' },
  { actionVerb: 'koordynować', actionNoun: 'koordynacja', actorProfession: 'koordynator' },
  { actionVerb: 'doradzać', actionNoun: 'doradztwo', actorProfession: 'doradca' },
  { actionVerb: 'szkolić', actionNoun: 'szkolenie', actorProfession: 'trener' },
  { actionVerb: 'rehabilitować', actionNoun: 'rehabilitacja', actorProfession: 'fizjoterapeuta' },
  { actionVerb: 'pielęgnować', actionNoun: 'pielęgnacja', actorProfession: 'pielęgniarz' },
  { actionVerb: 'księgować', actionNoun: 'księgowość', actorProfession: 'księgowy' },
  { actionVerb: 'testować', actionNoun: 'testowanie', actorProfession: 'tester' },
  { actionVerb: 'obsługiwać', actionNoun: 'obsługa', actorProfession: 'operator' },
  { actionVerb: 'konserwować', actionNoun: 'konserwacja', actorProfession: 'konserwator' },
  { actionVerb: 'rekrutować', actionNoun: 'rekrutacja', actorProfession: 'rekruter' },
];

/** Maksymalny rozmiar pamięci podręcznej lematów (liczba wpisów). */
export const LEMMA_CACHE_LIMIT = 20_000;

/**
 * Polskie słowa funkcyjne pomijane przy liczeniu pokrycia. Bez tego zdania
 * o różnej składni („w oparciu o”, „przy użyciu”) dostawałyby punkty za spójniki,
 * a nie za treść.
 */
export const POLISH_STOPWORDS = new Set([
  'i', 'oraz', 'a', 'ale', 'lub', 'albo', 'że', 'w', 'we', 'z', 'ze', 'na', 'do', 'od', 'po', 'przy',
  'przez', 'dla', 'o', 'u', 'za', 'nad', 'pod', 'bez', 'jako', 'to', 'te', 'ten', 'ta', 'tych', 'tego',
  'się', 'nie', 'jest', 'są', 'był', 'była', 'było', 'były', 'być', 'jak', 'co', 'który', 'która',
  'które', 'których', 'ich', 'jego', 'jej', 'mój', 'moje', 'moich', 'nasz', 'nasze', 'naszych',
  'wraz', 'także', 'również', 'czy', 'aby', 'żeby', 'gdzie', 'kiedy', 'już', 'tylko', 'bardzo',
]);

export class LinguisticEngine {
  private readonly jargonMapper: JargonMapper;
  private readonly orthographyChecker: OrthographyChecker;
  private readonly explicitRepo: SqliteGraphRepository | null;

  /**
   * Pamięć podręczna lematów w porządku LRU.
   *
   * `Map` w JavaScripcie zachowuje kolejność wstawiania, więc najstarszy klucz
   * jest zawsze pierwszy w iteracji — to wystarcza do eksmisji O(1) bez listy
   * dwukierunkowej. Odczyt trafiony przesuwa klucz na koniec (delete + set).
   */
  private readonly lemmaCache = new Map<string, string>();

  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * @param repo repozytorium ze słownikiem morfologicznym. Pominięty oznacza
   *   domyślną bazę (`SWG_DB_PATH` lub `./data/swg.db`) otwieraną leniwie —
   *   jeśli baza nie istnieje, lematyzacja działa w trybie tożsamościowym.
   */
  constructor(repo?: SqliteGraphRepository) {
    this.explicitRepo = repo ?? null;
    this.jargonMapper = new JargonMapper(repo);
    this.orthographyChecker = new OrthographyChecker();
  }

  private get repo(): SqliteGraphRepository | null {
    return this.explicitRepo ?? getDefaultLexiconRepository();
  }

  // ---------------------------------------------------------------------------
  // Lematyzacja
  // ---------------------------------------------------------------------------

  /**
   * Sprowadza formę fleksyjną do formy hasłowej.
   *
   * Zamiast heurystycznego obcinania końcówek wykonuje pojedyncze zapytanie
   * punktowe do `morph_dictionary` (klucz główny → koszt O(1)), poprzedzone
   * odczytem z pamięci podręcznej LRU. Słowo nieznane słownikowi zwracamy bez
   * zmian (małymi literami) — deterministycznie i bez zgadywania.
   */
  public lemmatize(word: string): string {
    const key = word.trim().toLowerCase();
    if (!key) return '';

    const cached = this.lemmaCache.get(key);
    if (cached !== undefined) {
      this.cacheHits++;
      // Odświeżenie pozycji: klucz wraca na koniec kolejki eksmisji.
      this.lemmaCache.delete(key);
      this.lemmaCache.set(key, cached);
      return cached;
    }

    this.cacheMisses++;
    const entry = this.repo?.lookupLemma(key) ?? null;
    const lemma = entry ? entry.lemma : key;
    this.rememberLemma(key, lemma);
    return lemma;
  }

  private rememberLemma(key: string, lemma: string): void {
    if (this.lemmaCache.size >= LEMMA_CACHE_LIMIT) {
      const oldest = this.lemmaCache.keys().next();
      if (!oldest.done) this.lemmaCache.delete(oldest.value);
    }
    this.lemmaCache.set(key, lemma);
  }

  /** Statystyki pamięci podręcznej — używane w testach i diagnostyce. */
  public getCacheStats(): { size: number; limit: number; hits: number; misses: number } {
    return {
      size: this.lemmaCache.size,
      limit: LEMMA_CACHE_LIMIT,
      hits: this.cacheHits,
      misses: this.cacheMisses,
    };
  }

  public clearCache(): void {
    this.lemmaCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // ---------------------------------------------------------------------------
  // Normalizacja zdań
  // ---------------------------------------------------------------------------

  /**
   * Tokenizuje i lematyzuje zdanie.
   *
   * Polskie znaki diakrytyczne są **zachowywane** — to one niosą informację
   * fleksyjną, a słownik indeksuje formy w zapisie ortograficznym. Usuwana jest
   * interpunkcja, z wyjątkiem znaków należących do nazw technologii (`c++`, `c#`,
   * `node.js`, `ci/cd`). Słowa funkcyjne i tokeny jednoliterowe odpadają.
   */
  public normalizeSentence(text: string): string[] {
    if (!text) return [];

    const cleaned = text
      .toLowerCase()
      .replace(/[‘’‚‛′]/g, "'")
      .replace(/[“”„‟″]/g, '"')
      // Interpunkcja zdaniowa i cudzysłowy -> spacja. Kropka, plus, krzyżyk,
      // ukośnik i myślnik zostają, bo współtworzą nazwy technologii.
      .replace(/[,;:!?()[\]{}"'«»„”…]/g, ' ')
      // Kropka na końcu tokenu to koniec zdania, nie część nazwy.
      .replace(/\.(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return [];

    const tokens = cleaned
      .split(' ')
      .map((token) => token.replace(/^[-/]+|[-/]+$/g, ''))
      .filter((token) => token.length > 1)
      .filter((token) => /[a-ząćęłńóśźż0-9]/.test(token))
      .filter((token) => !POLISH_STOPWORDS.has(token));

    return tokens.map((token) => this.lemmatize(token));
  }

  /**
   * Pokrycie leksykalne dwóch zdań, niezależne od składni.
   *
   * Oba zdania sprowadzamy do zbiorów lematów i liczymy współczynnik Jaccarda
   * (część wspólna / suma). Dzięki lematyzacji „Zarządzałem zespołem
   * programistów” i „Zarządzanie zespołem programistów” dają identyczne zbiory,
   * czyli wynik 1.0, mimo zupełnie innej konstrukcji gramatycznej.
   *
   * @returns wartość z przedziału [0, 1] zaokrąglona do czterech miejsc.
   */
  public calculateLemmaOverlap(sentenceA: string, sentenceB: string): number {
    const setA = new Set(this.normalizeSentence(sentenceA));
    const setB = new Set(this.normalizeSentence(sentenceB));

    if (setA.size === 0 && setB.size === 0) return 0;
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const lemma of setA) {
      if (setB.has(lemma)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : Math.round((intersection / union) * 10_000) / 10_000;
  }

  /**
   * Udział lematów zdania `required` pokrytych przez zdanie `candidate`.
   * Miara niesymetryczna — odpowiada na pytanie „ile wymagań z ogłoszenia
   * pokrywa to CV”, w przeciwieństwie do symetrycznego `calculateLemmaOverlap`.
   */
  public calculateLemmaCoverage(required: string, candidate: string): number {
    const requiredSet = new Set(this.normalizeSentence(required));
    const candidateSet = new Set(this.normalizeSentence(candidate));
    if (requiredSet.size === 0) return 0;

    let covered = 0;
    for (const lemma of requiredSet) {
      if (candidateSet.has(lemma)) covered++;
    }
    return Math.round((covered / requiredSet.size) * 10_000) / 10_000;
  }

  // ---------------------------------------------------------------------------
  // Pełny potok zapytania
  // ---------------------------------------------------------------------------

  /**
   * Kompletny potok morfologiczno-językowy:
   * 1. korekta ortograficzna,
   * 2. mapowanie żargonu i anglicyzmów na nazwy bazowe,
   * 3. lematyzacja i transformacje czasownikowo-rzeczownikowe.
   */
  public processQuery(rawInput: string): {
    original: string;
    corrected: string;
    canonicalJargon: string;
    lemmas: string[];
    canonicalSkill: string | null;
    verbalNouns: string[];
    actorProfessions: string[];
    phoneticKey: string;
  } {
    const { correctedText } = this.orthographyChecker.correctOrthography(rawInput);
    const { canonicalText } = this.jargonMapper.normalizeJargon(correctedText);

    const lemmas = this.normalizeSentence(canonicalText);
    const canonicalSkill = this.jargonMapper.findCanonicalSkill(correctedText);

    const verbalNouns: string[] = [];
    const actorProfessions: string[] = [];

    // Do reguł czasownikowych podstawiamy zarówno oryginalne tokeny, jak i ich
    // lematy — „serwisowaniem” trafia w regułę przez lemat „serwisować”.
    const probes = new Set<string>([...canonicalText.toLowerCase().split(/\s+/), ...lemmas]);

    probes.forEach((token) => {
      VERBAL_NOUN_MAP.forEach((rule) => {
        if (
          token.includes(rule.actionVerb) ||
          token.includes(rule.actionNoun) ||
          token.includes(rule.actorProfession) ||
          rule.actionVerb === token
        ) {
          if (!verbalNouns.includes(rule.actionNoun)) verbalNouns.push(rule.actionNoun);
          if (!actorProfessions.includes(rule.actorProfession)) actorProfessions.push(rule.actorProfession);
        }
      });
    });

    const phoneticKey = this.orthographyChecker.generatePhoneticKey(canonicalText);

    return {
      original: rawInput,
      corrected: correctedText,
      canonicalJargon: canonicalText,
      lemmas,
      canonicalSkill,
      verbalNouns,
      actorProfessions,
      phoneticKey,
    };
  }
}
