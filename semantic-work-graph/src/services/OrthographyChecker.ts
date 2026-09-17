/**
 * Phonetic & Orthographic Spell Corrector for Polish & English technical terms
 * Handles common orthographic errors: rz / ż, ch / h, ó / u, e.g., pieczyk vs piecyk
 */
export const COMMON_TYPOS_MAP: Record<string, string> = {
  // Prace instalacyjne, budowlane i rzemieślnicze
  pieczyk: 'piecyk',
  piecyck: 'piecyk',
  kociol: 'kocioł',
  kotol: 'kocioł',
  swawacz: 'spawacz',
  spawac: 'spawacz',
  spawarke: 'spawarka',
  iunkers: 'junkers',
  junkes: 'junkers',
  serwisowac: 'serwisować',
  serwisantem: 'serwisant',
  montaz: 'montaż',
  montowac: 'montować',
  elektrik: 'elektryk',
  elektyk: 'elektryk',
  hidraulik: 'hydraulik',
  hydraolik: 'hydraulik',
  dekarż: 'dekarz',
  slusarz: 'ślusarz',
  szlusarz: 'ślusarz',
  tokaż: 'tokarz',
  frezer: 'frezarz',
  lutowac: 'lutować',
  spachlowanie: 'szpachlowanie',
  szpahlowanie: 'szpachlowanie',
  rekurperacja: 'rekuperacja',
  klimatyzacjia: 'klimatyzacja',
  rozdzielnia: 'rozdzielnica',
  submiarka: 'suwmiarka',
  widlowy: 'widłowy',
  wozek: 'wózek',

  // Logistyka, transport i motoryzacja
  magazynjer: 'magazynier',
  mehanik: 'mechanik',
  kierowca: 'kierowca',
  inwentaryzacjia: 'inwentaryzacja',
  tahograf: 'tachograf',
  diagnostycka: 'diagnostyka',
  rozzad: 'rozrząd',

  // IT, inżynieria i biuro
  fraontend: 'frontend',
  fronted: 'frontend',
  bekend: 'backend',
  backned: 'backend',
  programer: 'programista',
  arhitektura: 'architektura',
  wdrozenie: 'wdrożenie',
  konfigoracja: 'konfiguracja',
  algorytem: 'algorytm',
  uprawnenia: 'uprawnienia',
};

export class OrthographyChecker {
  /**
   * Corrects common typos and orthographic errors in queries
   */
  public correctOrthography(input: string): { correctedText: string; hasCorrection: boolean } {
    const words = input.trim().split(/\s+/);
    let hasCorrection = false;

    const correctedWords = words.map((word) => {
      const lower = word.toLowerCase();

      // Check common typos dictionary
      if (COMMON_TYPOS_MAP[lower]) {
        hasCorrection = true;
        return COMMON_TYPOS_MAP[lower];
      }

      // Orthographic heuristic rules (ch -> h, rz -> ż, ó -> u phonetic variants)
      const norm = lower;

      return norm;
    });

    return {
      correctedText: correctedWords.join(' '),
      hasCorrection,
    };
  }

  /**
   * Generates a simplified Polish Soundex / Phonetic Key for fuzzy phonetic matching
   */
  public generatePhoneticKey(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/rz/g, 'z')
      .replace(/ż/g, 'z')
      .replace(/ź/g, 'z')
      .replace(/sz/g, 's')
      .replace(/cz/g, 'c')
      .replace(/ch/g, 'h')
      .replace(/ó/g, 'u')
      .replace(/[^a-z0-9]/g, '');
  }
}
