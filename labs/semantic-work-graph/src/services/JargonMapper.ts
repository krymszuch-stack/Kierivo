import { SqliteGraphRepository } from '../repositories/SqliteGraphRepository.js';
import { getDefaultLexiconRepository } from '../repositories/defaultLexicon.js';

/**
 * Bilingual Polish/English Industry Jargon, Acronym & Anglicism Normalizer
 */
export interface JargonMapping {
  canonical: string;
  category: string;
  synonyms: string[];
}

export const JARGON_DICTIONARY: Record<string, JargonMapping> = {
  // IT & Software Engineering Jargon
  frontend: { canonical: 'Frontend', category: 'IT', synonyms: ['front-end', 'front end', 'fe', 'interfejs użytkownika', 'frontendu'] },
  backend: { canonical: 'Backend', category: 'IT', synonyms: ['back-end', 'back end', 'be', 'serwer', 'backendu'] },
  fullstack: { canonical: 'Fullstack', category: 'IT', synonyms: ['full-stack', 'full stack', 'programista wszechstronny'] },
  devops: { canonical: 'DevOps', category: 'IT', synonyms: ['dev-ops', 'inżynier operacyjny', 'sysadmin cloud'] },
  sysadmin: { canonical: 'Administrator sieci i systemów', category: 'IT', synonyms: ['admin', 'admin sieci', 'systemowiec'] },
  bug: { canonical: 'błąd oprogramowania', category: 'IT', synonyms: ['usterka', 'defekt', 'bugi'] },
  debugowanie: { canonical: 'debugowanie i optymalizacja', category: 'IT', synonyms: ['szukanie błędów', 'debugin', 'debugowanie'] },
  deploy: { canonical: 'wdrożenie produkcyjne', category: 'IT', synonyms: ['deployowanie', 'deploj', 'publikacja systemowa'] },
  api: { canonical: 'interfejs programistyczny API', category: 'IT', synonyms: ['rest api', 'usługi sieciowe', 'endpointy'] },
  cicd: { canonical: 'ciągła integracja i ciągłe wdrażanie (CI/CD)', category: 'IT', synonyms: ['ci/cd', 'ci cd', 'pipeline wdrożeniowy'] },
  kubernetes: { canonical: 'orkiestracja kontenerów Kubernetes', category: 'IT', synonyms: ['k8s', 'k8', 'kube', 'klaster k8s'] },
  refaktor: { canonical: 'refaktoryzacja i czyszczenie kodu', category: 'IT', synonyms: ['refaktoring', 'refactoring', 'porządkowanie kodu'] },
  pull_request: { canonical: 'prośba o włączenie zmian (Pull Request)', category: 'IT', synonyms: ['pr', 'pull request', 'merge request', 'mr'] },
  code_review: { canonical: 'przegląd kodu (Code Review)', category: 'IT', synonyms: ['review', 'recenzja kodu', 'code-review'] },
  qa: { canonical: 'zapewnienie jakości i testowanie oprogramowania', category: 'IT', synonyms: ['quality assurance', 'testerka', 'kontrola jakości it'] },

  // Construction, HVAC & Plumbing Jargon
  co: { canonical: 'centralne ogrzewanie', category: 'Budownictwo', synonyms: ['c.o.', 'co', 'instalacja co', 'ogrzewanie centralne'] },
  cwu: { canonical: 'ciepła woda użytkowa', category: 'Budownictwo', synonyms: ['c.w.u.', 'cwu', 'woda użytkowa'] },
  hvac: { canonical: 'HVAC i Klimatyzacja', category: 'Budownictwo', synonyms: ['hvac', 'klimatyzacja', 'wentylacja', 'klima'] },
  junkers: { canonical: 'kocioł gazowy / piecyk gazowy', category: 'Budownictwo', synonyms: ['junkers', 'junkersy', 'piecyk gazowy', 'terma gazowa'] },
  podlogowka: { canonical: 'ogrzewanie podłogowe', category: 'Budownictwo', synonyms: ['podłogówka', 'instalacja podłogowa', 'ogrzewanie płaszczyznowe'] },
  sep: { canonical: 'uprawnienia elektryczne SEP (E+D)', category: 'Elektryka', synonyms: ['sep', 'uprawnienia sep', 'sep do 1kv', 'grupa g1'] },
  udt: { canonical: 'uprawnienia Urzędu Dozoru Technicznego (UDT)', category: 'Technika', synonyms: ['udt', 'uprawnienia udt', 'dozór techniczny'] },
  fgaz: { canonical: 'certyfikat F-Gazy (substancje zubożające)', category: 'Instalacje', synonyms: ['f-gaz', 'fgazy', 'f-gazy', 'uprawnienia chłodnicze'] },
  rekuperacja: { canonical: 'wentylacja mechaniczna z odzyskiem ciepła', category: 'Budownictwo', synonyms: ['rekuperator', 'rekuperatory', 'odzysk ciepła'] },
  pompa_ciepla: { canonical: 'pompa ciepła powietrze-woda / gruntowa', category: 'Budownictwo', synonyms: ['pompa ciepła', 'pompy ciepła', 'pc'] },
  rozdzielnica: { canonical: 'rozdzielnica elektryczna nN', category: 'Elektryka', synonyms: ['rozdzielnia', 'skrzynka bezpiecznikowa', 'tablica rozdzielcza'] },
  bezpiecznik: { canonical: 'wyłącznik nadprądowy / bezpiecznik', category: 'Elektryka', synonyms: ['esy', 'bezpieczniki', 'nadprądówka', 'różnicówka', 'rcd'] },
  pex: { canonical: 'rury wielowarstwowe PEX/Al/PEX', category: 'Instalacje', synonyms: ['pex', 'rura pex', 'instalacja pex'] },
  geberit: { canonical: 'podtynkowy stelaż sanitarny', category: 'Instalacje', synonyms: ['geberit', 'stelaż podtynkowy', 'spłuczka podtynkowa'] },
  szpachla: { canonical: 'szpachlowanie i gładź gipsowa', category: 'Budownictwo', synonyms: ['gładzie', 'szpachlowanie ścian', 'szpachla'] },
  regips: { canonical: 'sucha zabudowa z płyt gipsowo-kartonowych (G-K)', category: 'Budownictwo', synonyms: ['g-k', 'regipsy', 'płyta gipsowa', 'kartongips'] },
  peszel: { canonical: 'rura osłonowa karbowana (peszel)', category: 'Elektryka', synonyms: ['peszel', 'peszle', 'rura osłonowa'] },
  dylatacja: { canonical: 'szczelina dylatacyjna', category: 'Budownictwo', synonyms: ['dylatacja', 'szczeliny dylatacyjne', 'taśma dylatacyjna'] },

  // Welding & Industrial Jargon
  tig: { canonical: 'spawanie TIG (metoda 141)', category: 'Technika', synonyms: ['tig', 'spawanie nietopliwą', 'metoda 141'] },
  mag: { canonical: 'spawanie MAG (metoda 135)', category: 'Technika', synonyms: ['mag', 'mig', 'migomat', 'półautomat', 'metoda 135'] },
  mma: { canonical: 'spawanie elektrodą otuloną (metoda 111)', category: 'Technika', synonyms: ['mma', 'spawanie elektrodą', 'metoda 111'] },
  cnc: { canonical: 'obrabiarki sterowane numerycznie CNC', category: 'Technika', synonyms: ['cnc', 'maszyny cnc', 'frezarka cnc', 'tokarka cnc'] },
  plc: { canonical: 'programowalny sterownik logiczny PLC', category: 'Automatyka', synonyms: ['plc', 'sterowniki plc', 'automatyka przemysłowa'] },
  scada: { canonical: 'system nadzoru i wizualizacji SCADA', category: 'Automatyka', synonyms: ['scada', 'system scada', 'wizualizacja procesów'] },
  dtr: { canonical: 'Dokumentacja Techniczno-Ruchowa (DTR)', category: 'Technika', synonyms: ['dtr', 'dokumentacja dtr', 'instrukcja stanowiskowa'] },
  widlak: { canonical: 'wózek jezdniowy podnośnikowy (widłowy)', category: 'Logistyka', synonyms: ['widlak', 'wózek widłowy', 'wózki widłowe', 'sztaplarka'] },
  suwnica: { canonical: 'suwnica pomostowa sterowana z poziomu roboczego', category: 'Technika', synonyms: ['suwnica', 'obsługa suwnic', 'suwnice'] },
  tpm: { canonical: 'Total Productive Maintenance (TPM)', category: 'Produkcja', synonyms: ['tpm', 'utrzymanie ruchu', 'prewencyjne utrzymanie maszyn'] },
  mikrometr: { canonical: 'mikrometr i przyrządy mikrometryczne', category: 'Technika', synonyms: ['mikromierz', 'śruba mikrometryczna'] },
  suwmiarka: { canonical: 'suwmiarka noniuszowa / cyfrowa', category: 'Technika', synonyms: ['suwmiarki', 'pomiar suwmiarką'] },

  // Automotive Jargon
  obd: { canonical: 'diagnostyka komputerowa OBD2', category: 'Motoryzacja', synonyms: ['obd2', 'obd', 'komputer diagnostyczny'] },
  rozrzad: { canonical: 'układ rozrządu', category: 'Motoryzacja', synonyms: ['rozrząd', 'wymiana rozrządu', 'pasek rozrządu'] },
  dpf: { canonical: 'filtr cząstek stałych DPF/FAP', category: 'Motoryzacja', synonyms: ['dpf', 'fap', 'czyszczenie dpf', 'wypalanie dpf'] },
  egr: { canonical: 'zawór recyrkulacji spalin (EGR)', category: 'Motoryzacja', synonyms: ['egr', 'zawór egr', 'recyrkulacja spalin'] },
  dwumasa: { canonical: 'koło dwumasowe ze sprzęgłem', category: 'Motoryzacja', synonyms: ['dwumasa', 'koło zamachowe dwumasowe'] },
  can_bus: { canonical: 'magistrala komunikacyjna CAN', category: 'Motoryzacja', synonyms: ['can', 'szyna can', 'can bus'] },

  // Logistics & Transport Jargon
  wms: { canonical: 'magazynowy system informatyczny (WMS)', category: 'Logistyka', synonyms: ['wms', 'system wms', 'oprogramowanie magazynowe'] },
  adr: { canonical: 'przewóz towarów niebezpiecznych (ADR)', category: 'Transport', synonyms: ['adr', 'uprawnienia adr', 'przewóz adr'] },
  tachograf: { canonical: 'tachograf cyfrowy i czas pracy kierowcy', category: 'Transport', synonyms: ['tacho', 'karta kierowcy', 'odczyt tacho'] },
  picker: { canonical: 'kompletacja zamówień (order picking)', category: 'Logistyka', synonyms: ['picker', 'zbieracz', 'kompletator'] },
  paleciak: { canonical: 'ręczny / elektryczny wózek paletowy', category: 'Logistyka', synonyms: ['paleciak', 'wózek paletowy', 'transpaleta'] },
  fifo: { canonical: 'zasada rotacji zapasów FIFO (First In, First Out)', category: 'Logistyka', synonyms: ['fifo', 'metoda fifo', 'rotacja towaru'] },
  cross_docking: { canonical: 'przeładunek kompletacyjny (Cross-docking)', category: 'Logistyka', synonyms: ['cross-docking', 'crossdocking', 'przeładunek bezmagazynowy'] },
  cmr: { canonical: 'międzynarodowy list przewozowy CMR', category: 'Transport', synonyms: ['cmr', 'list cmr', 'dokument przewozowy'] },

  // Medical, Lab & Diagnostics Jargon
  ekg: { canonical: 'elektrokardiografia (badanie EKG)', category: 'Medycyna', synonyms: ['ekg', 'zapis ekg', 'aparat ekg'] },
  usg: { canonical: 'badanie ultrasonograficzne (USG)', category: 'Medycyna', synonyms: ['usg', 'ultrasonograf', 'badanie usg'] },
  rtg: { canonical: 'badanie rentgenowskie (RTG)', category: 'Medycyna', synonyms: ['rtg', 'rentgen', 'zdjęcie rtg'] },
  wklucie: { canonical: 'kaniulacja żył obwodowych (wenflon)', category: 'Medycyna', synonyms: ['wenflon', 'wkłucie dożylne', 'kaniula'] },
  sterylizacja: { canonical: 'sterylizacja i autoklawowanie narzędzi', category: 'Medycyna', synonyms: ['autoklaw', 'sterylizator', 'dekontaminacja'] },
  aseptyka: { canonical: 'zasady aseptyki i antyseptyki medycznej', category: 'Medycyna', synonyms: ['antyseptyka', 'pole operacyjne aseptyczne'] },

  // Finance, Administration & Quality Jargon
  kpi: { canonical: 'kluczowe wskaźniki efektywności (KPI)', category: 'Zarządzanie', synonyms: ['kpi', 'wskaźniki kpi', 'mierniki efektywności'] },
  crm: { canonical: 'system zarządzania relacjami z klientami (CRM)', category: 'Sprzedaż', synonyms: ['crm', 'system crm', 'baza crm'] },
  erp: { canonical: 'zintegrowany system zarządzania przedsiębiorstwem (ERP)', category: 'Zarządzanie', synonyms: ['erp', 'system erp', 'oprogramowanie erp'] },
  iso9001: { canonical: 'system zarządzania jakością ISO 9001', category: 'Jakość', synonyms: ['iso 9001', 'iso9001', 'norma iso'] },
};

/** Maksymalna długość frazy (w tokenach) sprawdzana w tezaurusie. */
const MAX_PHRASE_TOKENS = 5;

export class JargonMapper {
  private readonly explicitRepo: SqliteGraphRepository | null;

  constructor(repo?: SqliteGraphRepository) {
    this.explicitRepo = repo ?? null;
  }

  private get repo(): SqliteGraphRepository | null {
    return this.explicitRepo ?? getDefaultLexiconRepository();
  }

  /**
   * Sprowadza frazę do postaci porównywalnej z kolumną `alt_label`:
   * małe litery, bez interpunkcji, pojedyncze spacje. Znaki diakrytyczne
   * zostają — tezaurus przechowuje etykiety w zapisie ortograficznym.
   */
  private normalizePhrase(term: string): string {
    return term
      .toLowerCase()
      .replace(/[,;:!?()[\]{}"'«»„”…]/g, ' ')
      .replace(/\.(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Wariant frazy po lematyzacji każdego tokenu: „konteneryzacji dockerowej”
   * → „konteneryzacja dockerowy”. Importer zapisuje ten sam wariant obok
   * etykiety źródłowej, więc dopasowanie odmienionej frazy pozostaje O(1).
   */
  public lemmatizePhrase(term: string): string {
    const repo = this.repo;
    const normalized = this.normalizePhrase(term);
    if (!repo || !normalized) return normalized;

    return normalized
      .split(' ')
      .map((token) => repo.lookupLemma(token)?.lemma ?? token)
      .join(' ');
  }

  /**
   * Mapuje frazę na nazwę bazową umiejętności.
   *
   * Kolejność prób: dokładna etykieta → etykieta po lematyzacji → słownik
   * żargonu w pamięci → najdłuższa pasująca podfraza. Zwraca `null`, gdy nic
   * nie pasuje — brak dopasowania nigdy nie jest zgadywany.
   */
  public findCanonicalSkill(term: string): string | null {
    const normalized = this.normalizePhrase(term);
    if (!normalized) return null;

    const repo = this.repo;

    if (repo) {
      const direct = repo.findCanonicalByAltLabel(normalized);
      if (direct) return direct;

      const lemmatized = this.lemmatizePhrase(normalized);
      if (lemmatized !== normalized) {
        const byLemma = repo.findCanonicalByAltLabel(lemmatized);
        if (byLemma) return byLemma;
      }
    }

    const fromDictionary = this.findInJargonDictionary(normalized);
    if (fromDictionary) return fromDictionary;

    return this.findLongestSubPhrase(normalized);
  }

  /**
   * Najdłuższa podfraza wejścia, która ma odpowiednik w tezaurusie.
   * Pozwala wydobyć „kubernetes” ze zdania „migracja klastrów kubernetes na aws”.
   */
  private findLongestSubPhrase(normalized: string): string | null {
    const repo = this.repo;
    const tokens = normalized.split(' ').filter(Boolean);
    if (tokens.length < 2) return null;

    const maxLen = Math.min(MAX_PHRASE_TOKENS, tokens.length);
    for (let len = maxLen; len >= 1; len--) {
      for (let start = 0; start + len <= tokens.length; start++) {
        const phrase = tokens.slice(start, start + len).join(' ');
        if (repo) {
          const hit = repo.findCanonicalByAltLabel(phrase);
          if (hit) return hit;
          const lemmaPhrase = this.lemmatizePhrase(phrase);
          if (lemmaPhrase !== phrase) {
            const lemmaHit = repo.findCanonicalByAltLabel(lemmaPhrase);
            if (lemmaHit) return lemmaHit;
          }
        }
        const dictHit = this.findInJargonDictionary(phrase);
        if (dictHit) return dictHit;
      }
    }
    return null;
  }

  private findInJargonDictionary(phrase: string): string | null {
    const direct = JARGON_DICTIONARY[phrase];
    if (direct) return direct.canonical;

    for (const entry of Object.values(JARGON_DICTIONARY)) {
      if (entry.canonical.toLowerCase() === phrase) return entry.canonical;
      if (entry.synonyms.includes(phrase)) return entry.canonical;
    }
    return null;
  }

  /**
   * Zwraca etykiety alternatywne dla umiejętności — również wtedy, gdy podano
   * jeden z synonimów zamiast nazwy bazowej. Sama nazwa bazowa nie jest
   * powtarzana na liście synonimów.
   */
  public getSynonymsForSkill(skill: string): string[] {
    const canonical = this.findCanonicalSkill(skill);
    if (!canonical) return [];

    const repo = this.repo;
    const fromDb = repo ? repo.getAltLabelsForCanonical(canonical) : [];

    const fromDictionary = Object.values(JARGON_DICTIONARY)
      .filter((entry) => entry.canonical.toLowerCase() === canonical.toLowerCase())
      .flatMap((entry) => entry.synonyms);

    const canonicalKey = canonical.toLowerCase();
    const unique = new Set<string>();
    for (const label of [...fromDb, ...fromDictionary]) {
      const value = label.toLowerCase().trim();
      if (value && value !== canonicalKey) unique.add(value);
    }

    return [...unique].sort();
  }

  /** Kategoria dziedzinowa przypisana umiejętności (np. `Chmura`, `DevOps`). */
  public getCategoryForSkill(skill: string): string | null {
    const canonical = this.findCanonicalSkill(skill);
    if (!canonical) return null;

    const fromDb = this.repo?.getCategoryForCanonical(canonical) ?? null;
    if (fromDb) return fromDb;

    for (const entry of Object.values(JARGON_DICTIONARY)) {
      if (entry.canonical.toLowerCase() === canonical.toLowerCase()) return entry.category;
    }
    return null;
  }

  /**
   * Normalizuje zapytanie względem słownika żargonu i tezaurusa ESCO.
   * Token po tokenie — zachowuje kolejność wyrazów w zdaniu.
   */
  public normalizeJargon(input: string): { canonicalText: string; matchedCategory?: string; isJargonMatched: boolean } {
    const tokens = input.toLowerCase().trim().split(/[\s,.-]+/);
    let matchedCategory: string | undefined;
    let isJargonMatched = false;

    const normalizedTokens = tokens.map((token) => {
      if (!token) return token;

      // Słownik w pamięci ma pierwszeństwo: zawiera wielowyrazowe rozwinięcia
      // („deploy” -> „wdrożenie produkcyjne”), których tezaurus nie przechowuje.
      if (JARGON_DICTIONARY[token]) {
        isJargonMatched = true;
        matchedCategory = JARGON_DICTIONARY[token].category;
        return JARGON_DICTIONARY[token].canonical;
      }

      for (const entry of Object.values(JARGON_DICTIONARY)) {
        if (entry.synonyms.includes(token)) {
          isJargonMatched = true;
          matchedCategory = entry.category;
          return entry.canonical;
        }
      }

      const repo = this.repo;
      if (repo) {
        const canonical = repo.findCanonicalByAltLabel(token);
        if (canonical && canonical !== token) {
          isJargonMatched = true;
          matchedCategory = repo.getCategoryForCanonical(canonical) ?? matchedCategory;
          return canonical;
        }
      }

      return token;
    });

    return {
      canonicalText: normalizedTokens.join(' '),
      matchedCategory,
      isJargonMatched,
    };
  }
}
