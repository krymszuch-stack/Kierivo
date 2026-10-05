import {
  OccupationalProfessionEntry,
  OccupationalGraphPayload,
  OccupationalSearchResult,
} from './types';
import { INITIAL_OCCUPATIONAL_DATA } from './seedData';
import { RoleKnowledgeNode } from '../experienceEngine/types';

/**
 * Silnik grafu zawodowego łączący definicje stanowisk, odwrócony indeks słów-kluczy
 * oraz synsety polskiej Słowosieci (plWordNet).
 */
export class OccupationalGraphDB {
  public professions: Record<string, OccupationalProfessionEntry> = {};
  public word_index: Record<string, string[]> = {};
  public slowosiec_index: Record<string, string> = {};

  constructor(initialData?: OccupationalProfessionEntry[] | OccupationalGraphPayload) {
    if (initialData) {
      if (Array.isArray(initialData)) {
        this.addOrUpdateProfessions(initialData);
      } else {
        this.loadDatabase(initialData);
      }
    } else {
      // Domyślna inicjalizacja fabryczną bazą wiedzy
      this.addOrUpdateProfessions(INITIAL_OCCUPATIONAL_DATA);
    }
  }

  /**
   * Wczytuje bazę z gotowego payloadu lub ciągu JSON i odbudowuje indeksy.
   */
  public loadDatabase(payload: OccupationalGraphPayload | string): void {
    try {
      const parsed: OccupationalGraphPayload =
        typeof payload === 'string' ? JSON.parse(payload) : payload;

      this.professions = parsed.professions || {};
      this.word_index = parsed.word_index || {};
      this.slowosiec_index = parsed.slowosiec_index || {};

      // Jeśli payload nie miał gotowych indeksów, odbuduj je w locie
      if (
        Object.keys(this.word_index).length === 0 ||
        Object.keys(this.slowosiec_index).length === 0
      ) {
        this.rebuildIndexes();
      }
    } catch {
      this.professions = {};
      this.rebuildIndexes();
    }
  }

  /**
   * Dodaje nowe zawody lub aktualizuje i scala istniejące wpisy bez powielania danych.
   */
  public addOrUpdateProfessions(
    newEntries: (Partial<OccupationalProfessionEntry> & { id: string })[]
  ): void {
    const listFields: (keyof Pick<
      OccupationalProfessionEntry,
      'osoby' | 'obiekty' | 'czynnosci' | 'narzedzia' | 'miejsce'
    >)[] = ['osoby', 'obiekty', 'czynnosci', 'narzedzia', 'miejsce'];

    for (const rawEntry of newEntries) {
      const profId = rawEntry.id.trim().toLowerCase();
      if (!profId) continue;

      if (this.professions[profId]) {
        // SCALANIE: Jeśli zawód już istnieje, dodajemy nowe słowa do istniejących zbiorów
        const existing = this.professions[profId];

        for (const key of listFields) {
          if (rawEntry[key] && Array.isArray(rawEntry[key])) {
            const existingList = existing[key] || [];
            const combinedSet = new Set<string>([...existingList, ...rawEntry[key]!]);
            existing[key] = Array.from(combinedSet).sort((a, b) =>
              a.localeCompare(b, 'pl')
            );
          }
        }

        // Aktualizacja metadanych
        if (rawEntry.profesja) existing.profesja = rawEntry.profesja;
        if (rawEntry.branza) existing.branza = rawEntry.branza;
        if (rawEntry.slowosiec_sense_id)
          existing.slowosiec_sense_id = rawEntry.slowosiec_sense_id;
        if (rawEntry.slowosiec_data) {
          existing.slowosiec_data = {
            ...existing.slowosiec_data,
            ...rawEntry.slowosiec_data,
          };
        }
      } else {
        // DODANIE NOWEGO: Zawód nie istniał w bazie
        const newEntry: OccupationalProfessionEntry = {
          id: profId,
          profesja: rawEntry.profesja || profId,
          branza: rawEntry.branza,
          slowosiec_sense_id: rawEntry.slowosiec_sense_id,
          slowosiec_data: rawEntry.slowosiec_data,
        };

        for (const key of listFields) {
          if (rawEntry[key] && Array.isArray(rawEntry[key])) {
            newEntry[key] = Array.from(new Set(rawEntry[key]!)).sort((a, b) =>
              a.localeCompare(b, 'pl')
            );
          } else {
            newEntry[key] = [];
          }
        }

        this.professions[profId] = newEntry;
      }
    }

    // Po dodaniu/aktualizacji zawsze odświeżamy indeksy wyszukiwania
    this.rebuildIndexes();
  }

  /**
   * Odbudowuje odwrócone indeksy (Słowo -> Zawód oraz UUID Słowosieci -> Zawód).
   */
  public rebuildIndexes(): void {
    const newWordIndex: Record<string, Set<string>> = {};
    const newSlowosiecIndex: Record<string, string> = {};

    const listFields: (keyof Pick<
      OccupationalProfessionEntry,
      'osoby' | 'obiekty' | 'czynnosci' | 'narzedzia' | 'miejsce'
    >)[] = ['osoby', 'obiekty', 'czynnosci', 'narzedzia', 'miejsce'];

    for (const [profId, entry] of Object.entries(this.professions)) {
      // 1. Indeksowanie UUID ze Słowosieci
      if (entry.slowosiec_sense_id) {
        newSlowosiecIndex[entry.slowosiec_sense_id] = profId;
      }

      // 2. Zbiorczy zbiór słów do indeksowania
      const keywords = new Set<string>();

      // Nazwa profesji i id
      keywords.add(entry.profesja);
      keywords.add(profId.replace(/_/g, ' '));

      for (const key of listFields) {
        if (entry[key]) {
          for (const item of entry[key]!) {
            keywords.add(item);
          }
        }
      }

      // Dodanie lematu i hiperonimów Słowosieci
      if (entry.slowosiec_data) {
        const sd = entry.slowosiec_data;
        if (sd.lemma) keywords.add(sd.lemma);
        if (sd.hiperonimy) {
          for (const hip of sd.hiperonimy) {
            if (hip.lemma) keywords.add(hip.lemma);
          }
        }
      }

      // Wpisanie do odwróconego indeksu
      for (const word of keywords) {
        const cleanWord = word.toLowerCase().trim();
        if (cleanWord) {
          if (!newWordIndex[cleanWord]) {
            newWordIndex[cleanWord] = new Set<string>();
          }
          newWordIndex[cleanWord].add(profId);

          // Indeksujemy także pojedyncze człony wielowyrazowych fraz (np. "szczotka kominiarska" -> "szczotka", "kominiarska")
          const tokens = cleanWord.split(/[\s,/-]+/).filter((t) => t.length > 2);
          for (const token of tokens) {
            if (!newWordIndex[token]) {
              newWordIndex[token] = new Set<string>();
            }
            newWordIndex[token].add(profId);
          }
        }
      }
    }

    // Zamiana Set na posortowane tablice
    this.word_index = {};
    for (const [word, profSet] of Object.entries(newWordIndex)) {
      this.word_index[word] = Array.from(profSet).sort();
    }
    this.slowosiec_index = newSlowosiecIndex;
  }

  /**
   * Wyszukuje pasujące zawody po zapytaniu tekstowym na podstawie odwróconego indeksu.
   */
  public search(query: string, limit = 10): OccupationalSearchResult[] {
    if (!query || typeof query !== 'string') return [];
    const norm = query.toLowerCase().trim();
    if (!norm) return [];

    const queryTokens = norm.split(/[\s,/-]+/).filter((t) => t.length > 1);
    const scoreMap: Record<string, { score: number; matchedKeywords: Set<string> }> = {};

    // 1. Dokładne dopasowanie całej frazy w odwróconym indeksie
    if (this.word_index[norm]) {
      for (const profId of this.word_index[norm]) {
        if (!scoreMap[profId]) scoreMap[profId] = { score: 0, matchedKeywords: new Set() };
        scoreMap[profId].score += 15;
        scoreMap[profId].matchedKeywords.add(norm);
      }
    }

    // 2. Dopasowanie tokenów zapytania
    for (const token of queryTokens) {
      if (this.word_index[token]) {
        for (const profId of this.word_index[token]) {
          if (!scoreMap[profId]) scoreMap[profId] = { score: 0, matchedKeywords: new Set() };
          scoreMap[profId].score += 8;
          scoreMap[profId].matchedKeywords.add(token);
        }
      }

      // 3. Dopasowanie prefiksowe / podciągowe w indeksie słów
      for (const [indexedWord, profList] of Object.entries(this.word_index)) {
        if (indexedWord.includes(token) || token.includes(indexedWord)) {
          for (const profId of profList) {
            if (!scoreMap[profId]) scoreMap[profId] = { score: 0, matchedKeywords: new Set() };
            scoreMap[profId].score += 3;
            scoreMap[profId].matchedKeywords.add(indexedWord);
          }
        }
      }
    }

    // Sortowanie wyników wg punktacji
    const results: OccupationalSearchResult[] = Object.entries(scoreMap)
      .map(([profId, data]) => ({
        profession: this.professions[profId],
        score: data.score,
        matchedKeywords: Array.from(data.matchedKeywords),
      }))
      .filter((res) => Boolean(res.profession))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  /**
   * Zwraca zawód po UUID Słowosieci.
   */
  public lookupBySenseId(senseId: string): OccupationalProfessionEntry | undefined {
    const profId = this.slowosiec_index[senseId];
    return profId ? this.professions[profId] : undefined;
  }

  /**
   * Zwraca zawód po identyfikatorze id.
   */
  public lookupById(id: string): OccupationalProfessionEntry | undefined {
    const clean = id.toLowerCase().trim();
    return this.professions[clean];
  }

  /**
   * Zwraca listę wszystkich zawodów w bazie.
   */
  public getAllProfessions(): OccupationalProfessionEntry[] {
    return Object.values(this.professions);
  }

  /**
   * Eksportuje stan bazy do obiektu JSON-ready.
   */
  public exportDatabase(): OccupationalGraphPayload {
    return {
      meta: {
        total_professions: Object.keys(this.professions).length,
        total_indexed_words: Object.keys(this.word_index).length,
        last_updated: new Date().toISOString(),
      },
      professions: this.professions,
      word_index: this.word_index,
      slowosiec_index: this.slowosiec_index,
    };
  }

  /**
   * Przekształca wpis z bazy OccupationalGraphDB w węzeł RoleKnowledgeNode
   * gotowy do natychmiastowego użycia w Kreatorze Doświadczenia (Career Experience Wizard).
   */
  public toRoleKnowledgeNode(entry: OccupationalProfessionEntry): RoleKnowledgeNode {
    const areas: { id: string; label: string; description?: string }[] = [];
    const actions: Record<string, string[]> = {};
    const objects: Record<string, string[]> = {};
    const outcomes: Record<string, string[]> = {};
    const defaultTech: Record<string, string[]> = {};

    const czynnosci = entry.czynnosci || ['realizowałem', 'prowadziłem'];
    const obiekty = entry.obiekty || ['zadania operacyjne'];
    const narzedzia = entry.narzedzia || [];
    const miejsca = entry.miejsce || [];

    // Podział na 2-4 logiczne obszary na podstawie czynności i obiektów
    const area1Id = 'main_operations';
    areas.push({
      id: area1Id,
      label: `Główne Prace: ${entry.profesja}`,
      description: `Wykonywanie zadań kluczowych: ${czynnosci.slice(0, 3).join(', ')}`,
    });
    actions[area1Id] = czynnosci;
    objects[area1Id] = obiekty;
    outcomes[area1Id] = [
      'uwzględniając wymagania branżowe i dostępne procedury',
      'planując kolejność zadań oraz zgłaszając przeszkody w ich realizacji',
    ];
    defaultTech[area1Id] = narzedzia;

    if (miejsca.length > 0) {
      const area2Id = 'site_operations';
      areas.push({
        id: area2Id,
        label: `Środowisko & Prace Terenowe (${miejsca.slice(0, 2).join(', ')})`,
        description: `Organizacja stanowiska pracy i procedury bezpieczeństwa`,
      });
      actions[area2Id] = czynnosci;
      objects[area2Id] = miejsca.map((m) => `stanowisko pracy: ${m}`).concat(obiekty);
      outcomes[area2Id] = [
        'z zachowaniem rygorystycznych procedur BHP',
        'koordynując przekazywanie zadań i informacji o przerwach w pracy',
      ];
      defaultTech[area2Id] = narzedzia;
    }

    return {
      roleId: entry.id,
      label: entry.profesja,
      category: entry.branza || 'Rzemiosło & Przemysł',
      description: `Obszar zawodowy: ${entry.profesja}. Narzędzia: ${narzedzia.slice(0, 4).join(', ')}`,
      aliases: entry.osoby,
      areas,
      actions,
      objects,
      outcomes,
      defaultTech,
    };
  }
}

// Globalna instancja singletona
let globalOccupationalGraphDBInstance: OccupationalGraphDB | null = null;

export function getGlobalOccupationalGraphDB(): OccupationalGraphDB {
  if (!globalOccupationalGraphDBInstance) {
    globalOccupationalGraphDBInstance = new OccupationalGraphDB();
  }
  return globalOccupationalGraphDBInstance;
}
