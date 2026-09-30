import { MasterVault } from '../types';
import { isKnownLicenseId } from '../data/licenses';
import { hasPositiveSkillEvidence } from './skillEvidence';
import { hasPreferredRequirementMarker, preferredRequirementMarkerIndex, requirementSectionContextAt } from './jdOptionality';

/**
 * Kryteria zerojedynkowe — to, co odsiewa kandydata, zanim ktokolwiek przeczyta
 * jego CV.
 *
 * Poprzednia wersja tego audytu (`jdParser.ts`) sprawdzała dokładnie dwa
 * warunki: prawo jazdy kat. B i angielski C1. Dla montera, spawacza,
 * magazyniera czy sprzątaczki obie te reguły są nietrafione — ich aplikacje
 * odpadają na SEP-ie, UDT, F-Gazie, orzeczeniu sanepidu albo dyspozycyjności
 * zmianowej, czyli na rzeczach, których tamten audyt nie widział w ogóle.
 *
 * To była luka tym dotkliwsza, że `LicenseGrid` pozwalał te uprawnienia
 * zaznaczyć, `specializations.ts` wymieniał je przy każdym zawodzie
 * technicznym, a mimo to nic ich nie porównywało z treścią ogłoszenia.
 *
 * Cała ta ścieżka liczy się lokalnie i nie kosztuje ani jednego tokenu — to
 * jest ta część produktu, która może być darmowa bez końca.
 */

export type KnockoutSeverity = 'knockout' | 'preferred' | 'information';

export interface KnockoutRule {
  id: string;
  /** Nazwa pokazywana użytkownikowi. */
  label: string;
  /** Wzorce, po których poznajemy, że ogłoszenie tego wymaga. */
  detect: RegExp[];
  /**
   * Identyfikatory z `src/data/licenses.ts`. Sprawdzane po id, a nie przez
   * przeszukiwanie całego vaultu jako tekstu — zaznaczenie „UDT wózki"
   * w profilu ma spełniać wymóg „uprawnienia na wózki widłowe", a nigdy nie
   * spełniało, bo audyt szukał dosłownego ciągu znaków w `JSON.stringify`.
   */
  satisfiedByLicenseIds: string[];
  /** Wariant zapasowy: uprawnienie opisane własnymi słowami w treści CV. */
  satisfiedByText: RegExp[];
  /**
   * `knockout` — brak tego wyklucza z rekrutacji.
   * `preferred` — mile widziane, warto dopisać, ale nie odsiewa.
   */
  severity: 'knockout' | 'preferred';
  /** Podpowiedź, co użytkownik może z tym zrobić. */
  hint?: string;
}

/**
 * Kontekst dopasowania liczymy w obrębie **jednego zdania lub punktu listy**,
 * a nie w oknie N znaków wokół trafienia.
 *
 * Okno o stałej szerokości wyglądało prościej i było błędne w obie strony.
 * W zdaniu „Wymagany certyfikat F-Gaz. Mile widziane doświadczenie z Junkers"
 * łagodziło wymaganie F-Gaz frazą, która dotyczy zupełnie innej rzeczy —
 * wystarczyło, że sąsiadowała w tekście. Ogłoszenia to w większości listy
 * punktowane, więc granica pozycji jest tu naturalną granicą znaczenia.
 */
/**
 * Skróty z kropką nie kończą zdania — kropka w `kat.` dzieliła klauzulę na
 * pół i fraza łagodząca (`mile widziane`) po niej dotyczyła tylko wymagań
 * za kropką (F9: `license_b` twardo, `sep_g1` miękko w tym samym zdaniu).
 */
const ABBREV_BEFORE_DOT = /(kat|np|tzw|mgr|inż|inz|dr|al|ul|godz|nr|r)$/i;

function isClauseBoundary(text: string, index: number): boolean {
  const ch = text[index];
  if (ch === '\n' || ch === ';' || ch === '!' || ch === '?' || ch === '•' || ch === '·') return true;
  if (ch === '.') {
    const before = text.slice(Math.max(0, index - 6), index).split(/\s+/).pop() ?? '';
    if (ABBREV_BEFORE_DOT.test(before)) return false;
    return true;
  }
  // Myślnik punktora (`- `, `– `, `— ` na początku linii lub po spacji).
  if (ch === '-' || ch === '–' || ch === '—') {
    const prev = index === 0 ? '\n' : text[index - 1];
    const next = text[index + 1] ?? '';
    if ((prev === '\n' || prev === ' ' || prev === '\t') && (next === ' ' || next === '\t')) return true;
  }
  return false;
}

function clauseAround(text: string, matchIndex: number): { before: string; whole: string } {
  let start = 0;
  let end = text.length;

  // Najbliższa granica przed dopasowaniem.
  for (let i = matchIndex - 1; i >= 0; i--) {
    if (isClauseBoundary(text, i)) {
      start = i + 1;
      break;
    }
  }

  // Najbliższa granica po dopasowaniu.
  for (let i = matchIndex; i < text.length; i++) {
    if (isClauseBoundary(text, i)) {
      end = i;
      break;
    }
  }

  return { before: text.slice(start, matchIndex), whole: text.slice(start, end) };
}

/** Nagłówek wymogu może obejmować kilka pozycji rozdzielonych przecinkami lub nową linią. */
function sentenceAround(text: string, matchIndex: number): string {
  let start = 0;
  let end = text.length;
  for (let i = matchIndex - 1; i >= 0; i--) {
    if (/[.!?;]/.test(text[i])) { start = i + 1; break; }
  }
  for (let i = matchIndex; i < text.length; i++) {
    if (/[.!?;]/.test(text[i])) { end = i; break; }
  }
  return text.slice(start, end);
}

/**
 * Wymagania bywają przeczące („nie wymagamy prawa jazdy", „bez konieczności
 * posiadania uprawnień"). Ostrzeżenie o wymaganiu, którego nie ma, kosztuje na
 * tym ekranie więcej niż przeoczenie: jedna bzdura podważa całą listę, a lista
 * jest tu całą wartością.
 *
 * Świadomie **nie ma tu** fraz w rodzaju „mile widziane" — one nie zaprzeczają
 * wymaganiu, tylko obniżają jego wagę. Trzymanie ich w tym wzorcu kasowało
 * pozycję zamiast ją złagodzić, więc użytkownik nie dowiadywał się o niej wcale.
 */
/**
 * Uzupełnione o 3. os. lp. (`nie wymaga`) i lm. (`nie wymagają`) — wcześniej
 * tylko `wymagan*` (z `n`) i dosłowne `wymagamy`, więc najczęstsze
 * `Stanowisko nie wymaga prawa jazdy` dawało fałszywy knock-out (F9).
 */
const NEGATION_PATTERN = /\b(?:nie\s+(?:jest\s+)?(?:wymagan\w*|wymaga(?:ją)?\b|konieczn\w*|musisz|wymagamy|trzeba|potrzeb\w*)|bez\s+(?:konieczno\w*|wymogu|posiadania))\b/i;
const REQUIRED_REQUIREMENT_PATTERN = /\b(?:wymagan\w*|wymaga(?:ją)?|must\s+have|required|obowi[ąa]zkow\w*|konieczn\w*)\b/i;

/** E/D to osobne stanowiska kwalifikacyjne; nie wnioskujemy jednego z drugiego. */
function createSepScopePatterns(group: 1 | 2 | 3, scope: 'e' | 'd'): RegExp[] {
  const groupPattern = '\\bg\\s*-?\\s*' + group + '\\b';
  const scopePattern = scope === 'e'
    ? '(?:\\be\\s*-?\\s*' + group + '\\b|\\beksploatacj\\w*)'
    : '(?:\\bd\\s*-?\\s*' + group + '\\b|\\bdoz[oó]r\\w*)';

  return [
    new RegExp('\\bsep\\b[^.!?;\\n]{0,50}' + groupPattern + '[^.!?;\\n]{0,35}' + scopePattern, 'i'),
    new RegExp(scopePattern + '[^.!?;\\n]{0,35}\\bsep\\b[^.!?;\\n]{0,25}' + groupPattern, 'i'),
  ];
}

/**
 * „Mile widziane" zmienia wagę wymagania, a nie jego istnienie. Traktowanie
 * takiej pozycji jak twardego knock-outu strasi użytkownika bez powodu.
 */
export const KNOCKOUT_RULES: KnockoutRule[] = [
  // ---------- Prawo jazdy ----------
  {
    id: 'license_a',
    label: 'Prawo jazdy kat. A (motocykl)',
    detect: [/prawo\s+jazdy\s+(?:(?:kat\.?|kategorii)\s*)?a\b(?!\s*[12])/i, /\bkat\.?\s*a\b(?!\s*[12])/i],
    satisfiedByLicenseIds: ['a_license'],
    satisfiedByText: [/prawo\s+jazdy\s+(?:(?:kat\.?|kategorii)\s*)?a\b(?!\s*[12])/i],
    severity: 'knockout',
  },
  {
    id: 'license_b',
    label: 'Prawo jazdy kat. B',
    detect: [/prawo\s+jazdy\s+(?:kat\.?\s*)?b\b/i, /\bkat\.?\s*b\b(?!\+)/i, /driving\s+licen[cs]e\s+b\b/i],
    satisfiedByLicenseIds: ['b_license'],
    satisfiedByText: [/prawo\s+jazdy\s+(?:kat\.?\s*)?b\b/i, /driver'?s?\s+licen[cs]e/i],
    severity: 'knockout',
    hint: 'Wpisz kategorię wprost, np. „Prawo jazdy kat. B (czynne od 2015)”.',
  },
  {
    id: 'license_c',
    label: 'Prawo jazdy kat. C',
    detect: [/\bkat\.?\s*c\b(?!\s*\+?\s*e\b)/i, /prawo\s+jazdy\s+c\b(?!\s*\+?\s*e\b)/i, /\bkierowc\w*\s+c\b(?!\s*\+?\s*e\b)/i],
    satisfiedByLicenseIds: ['c_license'],
    satisfiedByText: [/\bkat\.?\s*c\b(?!\s*\+?\s*e\b)/i, /prawo\s+jazdy\s+c\b(?!\s*\+?\s*e\b)/i],
    severity: 'knockout',
    hint: 'Prawo jazdy C+E wybierz osobno — sama kategoria C go nie potwierdza.',
  },
  {
    id: 'license_ce',
    label: 'Prawo jazdy kat. C+E',
    detect: [/\bkat\.?\s*c\s*\+?\s*e\b/i, /\bkat\.?\s*ce\b/i, /\bc\s*\+\s*e\b/i, /\bprawo\s+jazdy\s+ce\b/i, /prawo\s+jazdy\s+c\s*\+?\s*e\b/i, /\bkierowc\w*\s+c\+e\b/i],
    satisfiedByLicenseIds: ['ce_license'],
    satisfiedByText: [/\bkat\.?\s*c\s*\+?\s*e\b/i, /\bkat\.?\s*ce\b/i, /\bc\s*\+\s*e\b/i, /\bprawo\s+jazdy\s+ce\b/i, /prawo\s+jazdy\s+c\s*\+?\s*e\b/i],
    severity: 'knockout',
    hint: 'Zaznacz C+E tylko wtedy, gdy posiadasz również kategorię E.',
  },
  {
    id: 'license_d',
    label: 'Prawo jazdy kat. D (autobusy)',
    detect: [/\bkat\.?\s*d\b/i, /prawo\s+jazdy\s+d\b/i],
    satisfiedByLicenseIds: ['d_license'],
    satisfiedByText: [/kat\.?\s*d\b/i],
    severity: 'knockout',
  },

  // ---------- Uprawnienia elektryczne i energetyczne ----------
  {
    id: 'sep_g1',
    label: 'Uprawnienia SEP G1 (elektryczne do 1 kV)',
    detect: [/\bsep\b[^.]{0,30}\bg\s*-?\s*1\b/i, /\bsep\b[^.]{0,20}1\s*kv/i, /\be\s*-?\s*1\b.{0,20}dozór/i],
    satisfiedByLicenseIds: ['sep_1kv', 'sep_g1_e_1kv', 'sep_g1_d_1kv'],
    // Ogólne „uprawnienia elektryczne” nie wskazują grupy SEP ani zakresu.
    satisfiedByText: [/\bsep\b[^.]{0,30}\bg\s*-?\s*1\b/i, /\be\s*-?\s*1\b/i],
    severity: 'knockout',
    hint: 'Podaj grupę i zakres, np. „SEP G1 do 1 kV — eksploatacja i dozór”.',
  },
  {
    id: 'sep_g1_e_1kv',
    label: 'SEP G1 E1 do 1 kV — eksploatacja',
    detect: createSepScopePatterns(1, 'e'),
    satisfiedByLicenseIds: ['sep_g1_e_1kv'],
    satisfiedByText: createSepScopePatterns(1, 'e'),
    severity: 'knockout',
  },
  {
    id: 'sep_g1_d_1kv',
    label: 'SEP G1 D1 do 1 kV — dozór',
    detect: createSepScopePatterns(1, 'd'),
    satisfiedByLicenseIds: ['sep_g1_d_1kv'],
    satisfiedByText: createSepScopePatterns(1, 'd'),
    severity: 'knockout',
  },
  {
    id: 'sep_g2',
    label: 'Uprawnienia SEP G2 (cieplne)',
    detect: [/\bsep\b[^.]{0,30}\bg\s*-?\s*2\b/i],
    satisfiedByLicenseIds: ['sep_g2', 'sep_g2_e', 'sep_g2_d'],
    satisfiedByText: [/\bsep\b[^.]{0,30}\bg\s*-?\s*2\b/i],
    severity: 'knockout',
  },
  {
    id: 'sep_g2_e',
    label: 'SEP G2 E2 — eksploatacja',
    detect: createSepScopePatterns(2, 'e'),
    satisfiedByLicenseIds: ['sep_g2_e'],
    satisfiedByText: createSepScopePatterns(2, 'e'),
    severity: 'knockout',
  },
  {
    id: 'sep_g2_d',
    label: 'SEP G2 D2 — dozór',
    detect: createSepScopePatterns(2, 'd'),
    satisfiedByLicenseIds: ['sep_g2_d'],
    satisfiedByText: createSepScopePatterns(2, 'd'),
    severity: 'knockout',
  },
  {
    id: 'sep_g3',
    label: 'Uprawnienia SEP G3 (gazowe)',
    // G3 jest częścią identyfikatora, nie opcjonalnym dopiskiem „gazowe".
    // Nie zaliczamy samej wzmianki o uprawnieniach gazowych: bez grupy nie
    // wiadomo, czy chodzi o G3, a pomyłka mogłaby ukryć twardy brak kandydata.
    detect: [/\bsep\b[^.!?;\n]{0,60}\bg\s*-?\s*3\b/i],
    satisfiedByLicenseIds: ['sep_g3', 'sep_g3_e', 'sep_g3_d'],
    satisfiedByText: [/\bsep\b[^.!?;\n]{0,60}\bg\s*-?\s*3\b/i],
    severity: 'knockout',
    hint: 'Przy serwisie kotłów to podstawowe wymaganie — wypisz je osobną linią.',
  },
  {
    id: 'sep_g3_e',
    label: 'SEP G3 E3 — eksploatacja',
    detect: createSepScopePatterns(3, 'e'),
    satisfiedByLicenseIds: ['sep_g3_e'],
    satisfiedByText: createSepScopePatterns(3, 'e'),
    severity: 'knockout',
  },
  {
    id: 'sep_g3_d',
    label: 'SEP G3 D3 — dozór',
    detect: createSepScopePatterns(3, 'd'),
    satisfiedByLicenseIds: ['sep_g3_d'],
    satisfiedByText: createSepScopePatterns(3, 'd'),
    severity: 'knockout',
  },
  {
    id: 'fgas',
    label: 'Certyfikat F-Gaz',
    detect: [/\bf\s*-?\s*gaz\w*\b/i, /\bf\s*-?\s*gas\b/i],
    satisfiedByLicenseIds: ['fgas'],
    satisfiedByText: [/\bf\s*-?\s*ga[zs]\w*\b/i],
    severity: 'knockout',
  },

  // ---------- UDT ----------
  {
    id: 'udt_forklift',
    label: 'Uprawnienia UDT — wózki widłowe',
    detect: [/w[óo]z(?:ek|ki|ka|k[óo]w)\s+wid[łl]ow\w*/i, /\budt\b[^.]{0,30}w[óo]z\w*/i, /operator\w*\s+w[óo]zk\w*/i, /\bwjo\b/i],
    satisfiedByLicenseIds: ['udt_forklift'],
    satisfiedByText: [/w[óo]z\w*\s+wid[łl]ow\w*/i, /\budt\b[^.]{0,30}w[óo]z\w*/i],
    severity: 'knockout',
    hint: 'Podaj kategorię i termin ważności, np. „UDT II WJO, ważne do 2028”.',
  },
  {
    id: 'udt_crane',
    label: 'Uprawnienia UDT — urządzenia dźwigowe bez wskazanego typu',
    detect: [/urz[ąa]dzeni\w*\s+d[źz]wigow\w*/i],
    satisfiedByLicenseIds: ['udt_crane', 'udt_suwnice', 'udt_dzwigi', 'udt_hds', 'udt_zurawie'],
    satisfiedByText: [/urz[ąa]dzeni\w*\s+d[źz]wigow\w*/i],
    severity: 'knockout',
  },
  ...([
    ['suwnice', /\bsuwnic\w*/i],
    ['dzwigi', /\bd[źz]wig\w*/i],
    ['hds', /\bhds\b/i],
    // JS \b nie traktuje „ż” jako litery, więc granica przed polskim ż
    // odcinała prawidłową wzmiankę „żurawie”.
    ['zurawie', /[żz]uraw\w*/i],
  ] as const).map(([type, pattern]) => ({
    id: `udt_${type}`,
    label: `Uprawnienia UDT — ${type === 'dzwigi' ? 'dźwigi' : type === 'zurawie' ? 'żurawie' : type}`,
    detect: [pattern],
    satisfiedByLicenseIds: [`udt_${type}`],
    satisfiedByText: [pattern],
    severity: 'knockout' as const,
  })),
  {
    id: 'udt_lift',
    label: 'Uprawnienia UDT — podesty ruchome',
    detect: [/podest\w*\s+ruchom\w*/i, /\bpodno[śs]nik\w*\s+koszow\w*/i, /\bzwy[żz]k\w*/i],
    satisfiedByLicenseIds: ['udt_lift'],
    satisfiedByText: [/podest\w*\s+ruchom\w*/i, /\bzwy[żz]k\w*/i],
    severity: 'knockout',
  },
  {
    id: 'udt_pressure',
    label: 'Uprawnienia UDT — urządzenia ciśnieniowe',
    detect: [/urz[ąa]dzeni\w*\s+ci[śs]nieniow\w*/i, /\bkocioł\w*\s+parow\w*/i],
    satisfiedByLicenseIds: ['udt_pressure'],
    satisfiedByText: [/urz[ąa]dzeni\w*\s+ci[śs]nieniow\w*/i],
    severity: 'knockout',
  },

  // ---------- Spawalnictwo ----------
  {
    id: 'welding',
    label: 'Uprawnienia spawalnicze (metoda wymagana w ogłoszeniu)',
    detect: [/\bspawa\w*/i, /\btig\b/i, /\bmag\b\s*13[15]/i, /\bmig\b/i, /\b14[19]\b/, /\b13[15]\b/],
    satisfiedByLicenseIds: ['welding_tig_mig', 'welding_tig', 'welding_mag', 'welding_mig'],
    satisfiedByText: [/\bspawa\w*/i, /\btig\b/i, /\bmag\b/i, /\bmig\b/i],
    severity: 'knockout',
    hint: 'Wypisz metody i numery, np. „TIG 141, MAG 135 — książeczka spawacza UDT”.',
  },

  // ---------- Sanitarne i medyczne ----------
  {
    id: 'sanepid',
    label: 'Orzeczenie sanepidu / książeczka sanitarno-epidemiologiczna',
    detect: [/\bsanepid\w*/i, /ksi[ąa][żz]eczk\w*\s+sanit\w*/i, /bada\w*\s+sanitarno/i, /do\s+cel[óo]w\s+sanitarno/i],
    satisfiedByLicenseIds: ['sanepid'],
    satisfiedByText: [/\bsanepid\w*/i, /ksi[ąa][żz]eczk\w*\s+sanit\w*/i],
    severity: 'knockout',
    hint: 'Przy sprzątaniu, gastronomii i produkcji spożywczej to warunek wstępny.',
  },
  {
    id: 'haccp',
    label: 'HACCP / GMP',
    detect: [/\bhaccp\b/i, /\bgmp\b/i, /\bgh?p\b\s*\/\s*\bgmp\b/i],
    satisfiedByLicenseIds: ['haccp'],
    satisfiedByText: [/\bhaccp\b/i, /\bgmp\b/i],
    severity: 'preferred',
  },
  {
    id: 'medical_clearance',
    label: 'Aktualne orzeczenie lekarskie',
    detect: [/orzeczeni\w*\s+lekarsk\w*/i, /bada\w*\s+lekarsk\w*/i, /zdolno[śs][ćc]\s+do\s+pracy/i],
    satisfiedByLicenseIds: ['medical_clearance'],
    satisfiedByText: [/orzeczeni\w*\s+lekarsk\w*/i, /bada\w*\s+lekarsk\w*/i],
    severity: 'preferred',
    hint: 'Zwykle opłaca je pracodawca — wystarczy zaznaczyć gotowość do badań.',
  },
  {
    id: 'height_work',
    label: 'Uprawnienia do pracy na wysokości',
    detect: [/prac\w*\s+na\s+wysoko[śs]ci/i, /powy[żz]ej\s+3\s*m/i, /\bwysoko[śs]ciow\w*/i],
    satisfiedByLicenseIds: ['height_work'],
    satisfiedByText: [/prac\w*\s+na\s+wysoko[śs]ci/i],
    severity: 'knockout',
  },

  // ---------- Warunki zatrudnienia ----------
  {
    id: 'shift_work',
    label: 'Dyspozycyjność zmianowa',
    detect: [/\bsystem\w*\s+zmianow\w*/i, /prac\w*\s+zmianow\w*/i, /\b(?:dwu|trzy)zmianow\w*/i, /\b3\s*zmian\w*/i, /\bnocn\w*\s+zmian\w*/i],
    satisfiedByLicenseIds: [],
    satisfiedByText: [/zmianow\w*/i, /dyspozycyjno[śs][ćc]/i, /gotowo[śs][ćc]\s+do\s+prac\w*\s+zmianow\w*/i],
    severity: 'knockout',
    hint: 'Napisz wprost „Gotowość do pracy zmianowej”. Rekruterzy filtrują po tym zdaniu.',
  },
  {
    id: 'own_transport',
    label: 'Własny transport do miejsca pracy',
    detect: [/w[łl]asn\w*\s+(?:transport\w*|samoch[óo]d)/i, /dojazd\w*\s+we\s+w[łl]asnym\s+zakresie/i],
    // Prawo jazdy nie dowodzi posiadania samochodu ani innego transportu.
    satisfiedByLicenseIds: [],
    satisfiedByText: [/w[łl]asn\w*\s+(?:transport\w*|samoch[óo]d)/i],
    severity: 'preferred',
  },

  // ---------- Języki ----------
  {
    id: 'language_advanced',
    label: 'Język obcy na poziomie zaawansowanym (C1+)',
    detect: [/\bc1\b/i, /\bc2\b/i, /\bbieg[łl]\w*\s+(?:znajomo[śs][ćc]|j[ęe]zyk\w*)/i, /\bfluent\b/i],
    satisfiedByLicenseIds: [],
    satisfiedByText: [/\bc1\b/i, /\bc2\b/i, /bieg[łl]\w*/i, /\bfluent\b/i, /\bnative\b/i],
    severity: 'knockout',
  },
  // ---------- Certyfikaty IT ----------
  {
    id: 'cloud_cert',
    label: 'Certyfikat chmurowy — dostawca nieokreślony',
    detect: [/certyfikat\w*\s+chmurow\w*/i, /cloud\s+certification/i],
    satisfiedByLicenseIds: ['cloud_cert', 'cloud_cert_aws', 'cloud_cert_azure', 'cloud_cert_gcp'],
    satisfiedByText: [/certyfikat\w*\s+chmurow\w*/i, /cloud\s+certification/i],
    severity: 'preferred',
  },
  ...([
    ['aws', 'AWS', /(?:certyfikat\w*|certification|certified)\s+aws\b/i, /\baws\b[^.!?;\n]{0,30}\bcertyfikat\w*/i, /\baws\s+certified\b/i],
    ['azure', 'Microsoft Azure', /(?:certyfikat\w*|certification|certified)\s+(?:microsoft\s+)?azure\b/i, /\bazure\b[^.!?;\n]{0,30}\bcertyfikat\w*/i, /\bazure\s+certified\b/i],
    ['gcp', 'Google Cloud', /(?:certyfikat\w*|certification|certified)\s+(?:google\s+cloud|gcp)\b/i, /\b(?:google\s+cloud|gcp)\b[^.!?;\n]{0,30}\bcertyfikat\w*/i, /\bgoogle\s+cloud\s+certified\b/i],
  ] as const).map(([provider, label, ...detect]) => ({
    id: `cloud_cert_${provider}`,
    label: `Certyfikat ${label}`,
    detect,
    satisfiedByLicenseIds: [`cloud_cert_${provider}`],
    satisfiedByText: detect,
    severity: 'preferred' as const,
  })),
  {
    id: 'scrum_master',
    label: 'Certyfikat Scrum Master (PSM / CSM)',
    detect: [/certyfikat\w*\s+scrum\s+master\b/i, /\b(?:psm\s*i{1,3}|csm)\b/i],
    satisfiedByLicenseIds: ['scrum_master'],
    satisfiedByText: [/certyfikat\w*\s+scrum\s+master\b/i, /\b(?:psm\s*i{1,3}|csm)\b/i],
    severity: 'preferred',
  },
  {
    id: 'cisco_ccna',
    label: 'Certyfikat Cisco CCNA',
    detect: [/\bccna\b/i, /cisco\s+certified\s+network\s+associate/i],
    satisfiedByLicenseIds: ['cisco_ccna'],
    satisfiedByText: [/\bccna\b/i, /cisco\s+certified\s+network\s+associate/i],
    severity: 'preferred',
  },
];

export interface KnockoutFinding {
  ruleId: string;
  label: string;
  severity: KnockoutSeverity;
  /** `true`, gdy profil spełnia wymaganie. */
  satisfied: boolean;
  /** Skąd wiemy, że spełnia — przydaje się w interfejsie i w testach. */
  matchedVia: 'license' | 'text' | null;
  hint?: string;
}

const EXPERIENCE_CONTEXT = /\b(?:do[śs]wiadczen\w*|pracowa\w*|obs[łl]ug\w*|monta[żz]\w*|serwis\w*|spawa\w*|wykonywa\w*)\b/i;
const CREDENTIAL_CONTEXT = /\b(?:upraw(?:nien\w*|ien\w*)|certyfikat\w*|kwalifikacj\w*|licencj\w*|ksi[ąa][żz]eczk\w*|[śs]wiadectw\w*|orzeczeni\w*|posiadam|posiadane|wa[żz]ne\s+do)\b/i;
/** Fakty o CV kandydata wklejone do treści oferty nie stają się wymaganiami. */
const CANDIDATE_PROFILE_FACT = /\b(?:kandydat\w*\s+(?:w\s+(?:swoim\s+)?(?:cv|profil\w*)\s+)?(?:ma|posiada)|(?:cv|profil\w*)\s+kandydata\s+(?:zawiera|wymienia|wskazuje|potwierdza)|(?:w\s+)?(?:cv|profil\w*)\s+(?:kandydata\s+)?(?:wpisano|wymieniono|zaznaczono))\b/i;

/** Sam opis wykonywania pracy nie jest dowodem posiadania wymaganego dokumentu. */
function isExperienceWithoutCredential(text: string, matchIndex: number): boolean {
  const { whole } = clauseAround(text, matchIndex);
  return EXPERIENCE_CONTEXT.test(whole) && !CREDENTIAL_CONTEXT.test(whole);
}

/** Regex uprawnienia znajduje wzmiankę, ale dopiero matcher dowodów rozstrzyga,
 * czy kandydat ją potwierdza, czy tylko opisuje brak/naukę. */
function hasPositiveTextEvidence(patterns: RegExp[], text: string, requireCredentialEvidence = false): boolean {
  return patterns.some((pattern) => {
    const flags = pattern.flags.replace(/[gy]/g, '');
    const matcher = new RegExp(pattern.source, `${flags}g`);
    for (const match of text.matchAll(matcher)) {
      if (requireCredentialEvidence && isExperienceWithoutCredential(text, match.index)) continue;
      const { before, whole } = clauseAround(text, match.index);
      // Wzmianka po „bez certyfikatu / książeczki / uprawnień” nie jest
      // dowodem posiadania. Kanoniczny matcher umiejętności nie zna tych
      // nazw dokumentów, więc odrzucamy bezpośrednie zaprzeczenie tutaj.
      const beforeMatch = before.slice(-80);
      if (/\b(?:bez|brak(?:u)?|brakuje|nie\s+(?:mam|posiadam))\b[^.!?;\n]{0,60}$/i.test(beforeMatch)) continue;
      const relativeIndex = before.length;
      const after = whole.slice(relativeIndex + match[0].length, relativeIndex + match[0].length + 60);
      if (/^\s*[^.!?;\n]{0,40}\b(?:bez|brak(?:u)?|brakuje|nie\s+(?:mam|posiadam))\b/i.test(after)) continue;
      if (hasPositiveSkillEvidence(text, match[0])) return true;
    }
    return false;
  });
}

/** Wymieniona w ofercie metoda spawania musi być potwierdzona tą samą metodą. */
function hasPositiveWeldingEvidence(jobDescription: string, vaultText: string): boolean {
  const methods = extractWeldingMethods(jobDescription);
  if (methods.length === 0) {
    const rule = KNOCKOUT_RULES.find((item) => item.id === 'welding');
    return rule ? hasPositiveTextEvidence(rule.satisfiedByText, vaultText, true) : false;
  }
  return methods.every((method) => hasPositiveTextEvidence([new RegExp(`\\b${method}\\b`, 'i')], vaultText, true));
}

function extractWeldingMethods(text: string): string[] {
  const methods = new Set(text.match(/\b(?:tig|mag|mig)\b/gi)?.map((method) => method.toLowerCase()) ?? []);
  if (/\b141\b/.test(text)) methods.add('tig');
  if (/\b135\b/.test(text)) methods.add('mag');
  if (/\b131\b/.test(text)) methods.add('mig');
  return [...methods];
}

/** A nazwa certyfikatu bezpośrednio zanegowana nie potwierdza kwalifikacji. */
function hasPositiveCertificateEvidence(patterns: RegExp[], text: string): boolean {
  const certificateNegation = /\b(?:bez|brak|brakuje|nie\s+(?:mam|posiadam))\b[^.!?;\n]{0,40}\b(?:certyfikat\w*|credential\w*|certification)\b|\b(?:certyfikat\w*|credential\w*|certification)\b[^.!?;\n]{0,40}\b(?:bez|brak|brakuje|nie\s+(?:mam|posiadam))\b|\b(?:aws|azure|gcp|google\s+cloud)\b[^.!?;\n]{0,40}\b(?:bez|brak|brakuje|nie\s+(?:mam|posiadam))\b[^.!?;\n]{0,20}(?:certyfikat\w*|credential\w*|certification)/i;

  for (const pattern of patterns) {
    const matcher = new RegExp(pattern.source, `${pattern.flags.replace(/[gy]/g, '')}g`);
    for (const match of text.matchAll(matcher)) {
      if (isExperienceWithoutCredential(text, match.index)) continue;
      const { whole } = clauseAround(text, match.index);
      if (certificateNegation.test(whole)) continue;
      if (hasPositiveSkillEvidence(text, match[0])) return true;
    }
  }
  return false;
}

/**
 * Grupa G3 może być podana w nawiasie („SEP (bez G3)”). Zwykłe sprawdzenie
 * kontekstu przed trafieniem uznałoby wtedy obecność numeru za potwierdzenie.
 * Odrzucamy przeczenie związane bezpośrednio z numerem; sam skrót SEP bez
 * jawnej grupy i tak nie dopasowuje reguły.
 */
function hasPositiveSepG3Evidence(text: string): boolean {
  const matcher = /\bsep\b[^.!?;\n]{0,60}\bg\s*-?\s*3\b/gi;
  for (const match of text.matchAll(matcher)) {
    if (isExperienceWithoutCredential(text, match.index)) continue;
    const clauseStart = Math.max(
      text.lastIndexOf('\n', match.index),
      text.lastIndexOf(';', match.index),
      text.lastIndexOf('.', match.index),
      text.lastIndexOf('!', match.index),
      text.lastIndexOf('?', match.index),
    ) + 1;
    const clauseEndCandidates = ['\n', ';', '.', '!', '?']
      .map((boundary) => text.indexOf(boundary, match.index))
      .filter((index) => index >= 0);
    const clauseEnd = clauseEndCandidates.length > 0 ? Math.min(...clauseEndCandidates) : text.length;
    const clause = text.slice(clauseStart, clauseEnd);
    if (/\b(?:bez|brak|brakuje|nie\s+(?:mam|posiadam|ma|posiada))\b[^.!?;\n]{0,30}\bg\s*-?\s*3\b/i.test(clause)) {
      continue;
    }
    if (hasPositiveSkillEvidence(text, match[0])) return true;
  }
  return false;
}

export interface KnockoutReport {
  findings: KnockoutFinding[];
  /** Twarde wymagania, których profil nie spełnia — to jest lista do działania. */
  blocking: KnockoutFinding[];
  /** Mile widziane, których brakuje. */
  optional: KnockoutFinding[];
  /** Wzmianki o kwalifikacji bez sygnału, że jest wymagana lub mile widziana. */
  unclassified: KnockoutFinding[];
  satisfiedCount: number;
  /** `0`, gdy ogłoszenie nie stawia żadnych wymagań formalnych. */
  requirementCount: number;
}

/** Zbiera tekst vaultu tam, gdzie użytkownik mógł opisać uprawnienie własnymi słowami. */
function collectVaultText(vault: MasterVault | Partial<MasterVault> | undefined | null): string {
  if (!vault) return '';
  const parts: string[] = [
    vault.personalInfo?.summary || '',
    vault.personalInfo?.title || '',
    ...(vault.skillsMatrix?.hardSkills ?? []),
    ...(vault.skillsMatrix?.toolsAndTech ?? []),
    ...(vault.skillsMatrix?.certifications ?? []).flatMap((cert) => [cert?.name || '', cert?.issuer || '']),
    ...(vault.history ?? []).flatMap((exp) => [
      exp?.role || '',
      exp?.description ?? '',
      ...(exp?.highlights ?? []).map((highlight) => typeof highlight === 'string' ? highlight : (highlight?.text || '')),
    ]),
    ...(vault.education ?? []).flatMap((edu) => [edu?.degree || '', edu?.fieldOfStudy || '', edu?.description ?? '']),
    ...(vault.profiler?.languages ?? []).map((lang) => `${lang?.language || ''} ${lang?.level || ''}`),
  ];

  return parts.filter(Boolean).join(' \n ');
}

/**
 * Sprawdza, czy ogłoszenie stawia dane wymaganie.
 *
 * Zwraca też pozycję dopasowania, bo bez niej nie da się odróżnić „wymagamy
 * prawa jazdy" od „nie wymagamy prawa jazdy" — a te dwa zdania różnią się
 * dla użytkownika wszystkim.
 */
function detectRequirement(
  rule: KnockoutRule,
  jdText: string
): { required: boolean; softened: boolean; explicitlyRequired: boolean; mentioned: boolean } {
  let softenedMatch = false;
  let unclassifiedMatch = false;

  for (const pattern of rule.detect) {
    // `matchAll` na wypadek, gdy ta sama rzecz pada w ogłoszeniu dwa razy —
    // raz w zdaniu przeczącym, raz jako realne wymaganie.
    for (const match of jdText.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))) {
      const { before, whole } = clauseAround(jdText, match.index);

      if (NEGATION_PATTERN.test(before)) continue;
      // Parser nie może zamienić wzmianki „kandydat ma SEP G1” w wymóg SEP G1.
      // Gdy zdanie zawiera jawny nakaz/wymóg, zachowujemy go — odrzucamy tylko
      // opis profilu, który nie stawia kwalifikacji jako warunku oferty.
      if (CANDIDATE_PROFILE_FACT.test(whole) && !REQUIRED_REQUIREMENT_PATTERN.test(whole)) continue;

      // G1/G2/G3 jest wymogiem ogólnym tylko wtedy, gdy oferta nie podała
      // stanowiska E/D. Wymóg szczegółowy zastępuje ogólny, żeby nie pokazać
      // dwóch wierszy za tę samą kwalifikację ani nie zaliczyć starego wpisu
      // bez określonego stanowiska.
      if (/^sep_g[123]$/.test(rule.id)) {
        const hasRequiredSpecificScope = KNOCKOUT_RULES
          .filter((candidate) => candidate.id.startsWith(rule.id + '_'))
          .some((candidate) => {
            const scope = detectRequirement(candidate, jdText);
            return scope.required && !scope.softened;
          });
        if (hasRequiredSpecificScope) continue;
      }

      // Opcjonalność dotyczy trafienia po znaczniku, nie całego zdania.
      // „Wymagane Windows 11, mile widziane Entra ID” ma dwa różne statusy.
      let optionalForThisMatch = hasPreferredRequirementMarker(before);
      if (/^sep_g[123]_[ed](?:_1kv)?$/.test(rule.id)) {
        // Wymóg obejmujący SEP i E1/D1 może mieć znacznik opcjonalności
        // między grupą a stanowiskiem, np. „Wymagane G1, mile widziane D1”.
        const scopeLetter = rule.id.includes('_e') ? 'e' : 'd';
        const scopeGroup = rule.id.match(/^sep_g([123])/)?.[1] ?? '';
        const scopePattern = scopeLetter === 'e'
          ? new RegExp('\\b(?:e\\s*-?\\s*' + scopeGroup + '\\b|eksploatacj\\w*)', 'ig')
          : new RegExp('\\b(?:d\\s*-?\\s*' + scopeGroup + '\\b|doz[oó]r\\w*)', 'ig');
        const scopeOffset = [...match[0].matchAll(scopePattern)].at(-1)?.index;
        const markerOffset = preferredRequirementMarkerIndex(whole);
        if (scopeOffset !== undefined) {
          optionalForThisMatch = markerOffset >= 0 && markerOffset < before.length + scopeOffset;
        }
      }
      if (/^sep_g[123]$/.test(rule.id)) {
        // Wzorzec SEP G3 zaczyna dopasowanie od „SEP”, nawet gdy w klauzuli
        // wcześniej wystąpiło obowiązkowe SEP G1. Rozstrzygaj przy numerze grupy.
        const groupDigit = rule.id.slice(-1);
        const groupPattern = new RegExp(`\\bg\\s*-?\\s*${groupDigit}\\b`, 'ig');
        const groupMatches = [...match[0].matchAll(groupPattern)];
        const groupOffset = groupMatches.at(-1)?.index;
        const markerOffset = preferredRequirementMarkerIndex(whole);
        if (groupOffset !== undefined) {
          optionalForThisMatch = markerOffset >= 0 && markerOffset < before.length + groupOffset;
        }
      }

      if (optionalForThisMatch) {
        // Zapamiętujemy, ale szukamy dalej: twarde wystąpienie tego samego
        // wymagania w innym miejscu ogłoszenia ma pierwszeństwo.
        softenedMatch = true;
        continue;
      }

      const sectionContext = requirementSectionContextAt(jdText, match.index);
      const explicitlyRequired = sectionContext === 'required' ||
        REQUIRED_REQUIREMENT_PATTERN.test(whole) ||
        REQUIRED_REQUIREMENT_PATTERN.test(sentenceAround(jdText, match.index));
      if (sectionContext === 'optional' && !explicitlyRequired) {
        softenedMatch = true;
        continue;
      }
      if (!explicitlyRequired) {
        // Obowiązki, opis firmy i swobodna wzmianka nie dowodzą, że dokument
        // jest warunkiem rekrutacji. Zachowujemy wzmiankę do wyjaśnienia,
        // ale nie tworzymy z niej braku ani kary w wyniku.
        unclassifiedMatch = true;
        continue;
      }

      return {
        required: true,
        softened: false,
        explicitlyRequired,
        mentioned: true,
      };
    }
  }

  return softenedMatch
    ? { required: true, softened: true, explicitlyRequired: false, mentioned: true }
    : unclassifiedMatch
      ? { required: false, softened: false, explicitlyRequired: false, mentioned: true }
      : { required: false, softened: false, explicitlyRequired: false, mentioned: false };
}

/**
 * Rozszerza jedynie relacje, które są jednoznaczne w danych aplikacji.
 * Stanowisko SEP E/D nie jest automatycznie wyprowadzane z ogólnego wpisu.
 */
function expandHeldLicensesWithHierarchy(heldLicenses: Set<string>): Set<string> {
  const expanded = new Set(heldLicenses);

  // C+E implikuje C i B. Kategoria C sama nie potwierdza C+E.
  if (expanded.has('ce_license') || expanded.has('driving_c_plus_e') || expanded.has('driving_ce')) {
    expanded.add('c_license');
    expanded.add('b_license');
    expanded.add('driving_b');
    expanded.add('driving_license_b');
  }
  if (expanded.has('c_license') || expanded.has('driving_c')) {
    expanded.add('b_license');
    expanded.add('driving_b');
    expanded.add('driving_license_b');
  }

  // UDT: kwalifikacje dotyczą konkretnych typów urządzeń. Suwnica nie
  // potwierdza wózka widłowego; zachowujemy jedynie znany alias I WJO.
  if (expanded.has('udt_i_wjo')) {
    expanded.add('udt_forklift');
    expanded.add('udt_ii_wjo');
  }

  return expanded;
}

/**
 * Porównuje wymagania ogłoszenia z profilem kandydata.
 *
 * Wyłącznie lokalnie, bez sieci i bez modelu — dlatego ta funkcja może stać za
 * darmową checklistą bez żadnego limitu.
 */
export function auditKnockouts(jobDescription: string, vault: MasterVault): KnockoutReport {
  const jdText = jobDescription ?? '';
  const vaultText = collectVaultText(vault);
  const rawLicenses = new Set(vault.profiler?.licenses ?? []);
  const heldLicenses = expandHeldLicensesWithHierarchy(rawLicenses);

  const findings: KnockoutFinding[] = [];

  for (const rule of KNOCKOUT_RULES) {
    const { required, softened, explicitlyRequired, mentioned } = detectRequirement(rule, jdText);
    if (!required && !mentioned) continue;

    const severity: KnockoutSeverity = !required
      ? 'information'
      : softened
        ? 'preferred'
        : explicitlyRequired
          ? 'knockout'
          : rule.severity;

    if (severity === 'information') {
      findings.push({
        ruleId: rule.id,
        label: rule.label,
        severity,
        satisfied: false,
        matchedVia: null,
      });
      continue;
    }

    // Uprawnienie zaznaczone w profilu liczy się przed tekstem: to jest
    // deklaracja wprost, a nie domysł z opisu stanowiska.
    const weldingMethods = rule.id === 'welding' ? extractWeldingMethods(jdText) : [];
    const applicableLicenseIds = rule.id === 'welding' && weldingMethods.length === 0
      ? ['welding_tig_mig', ...rule.satisfiedByLicenseIds]
      : rule.id === 'welding'
        ? weldingMethods.map((method) => `welding_${method}`)
        : rule.satisfiedByLicenseIds;
    // Kilka metod w ofercie oznacza kilka osobnych warunków. `some()` dawało
    // fałszywe zaliczenie, gdy kandydat zaznaczył np. TIG, a oferta wymagała
    // jednocześnie TIG i MAG. Przy ogólnym wymogu nadal wystarcza dowolny
    // konkretny wpis spawalniczy.
    const byLicense = rule.id === 'welding' && weldingMethods.length > 0
      ? weldingMethods.every((method) => heldLicenses.has(`welding_${method}`))
      : applicableLicenseIds.some((id) => heldLicenses.has(id));
    // Historia pracy nie dowodzi, że wymagane uprawnienie nadal jest ważne.
    // Dotyczy to także prawa jazdy opisanego przy nazwie stanowiska kierowcy.
    const formalQualification = rule.id.startsWith('license_') || rule.id.startsWith('sep_') || rule.id.startsWith('udt_') ||
      ['fgas', 'welding', 'sanepid', 'haccp', 'medical_clearance', 'height_work'].includes(rule.id);
    const byText = !byLicense && (rule.id === 'sep_g3'
      ? hasPositiveSepG3Evidence(vaultText)
      : rule.id === 'welding'
        ? hasPositiveWeldingEvidence(jdText, vaultText)
        : (rule.id.startsWith('cloud_cert') || ['scrum_master', 'cisco_ccna', 'fgas'].includes(rule.id))
        ? hasPositiveCertificateEvidence(rule.satisfiedByText, vaultText)
        : hasPositiveTextEvidence(rule.satisfiedByText, vaultText, formalQualification));

    findings.push({
      ruleId: rule.id,
      label: rule.label,
      // „Mile widziane” w treści ogłoszenia obniża wagę nawet wtedy, gdy sama
      // reguła jest twarda — inaczej straszylibyśmy użytkownika wymaganiem,
      // którego pracodawca sam nie traktuje jako obowiązkowe.
      severity,
      satisfied: byLicense || byText,
      matchedVia: byLicense ? 'license' : byText ? 'text' : null,
      hint: rule.hint,
    });
  }

  const unmet = findings.filter((finding) => !finding.satisfied);

  return {
    findings,
    blocking: unmet.filter((finding) => finding.severity === 'knockout'),
    optional: unmet.filter((finding) => finding.severity === 'preferred'),
    unclassified: findings.filter((finding) => finding.severity === 'information'),
    satisfiedCount: findings.filter((finding) => finding.severity !== 'information' && finding.satisfied).length,
    requirementCount: findings.filter((finding) => finding.severity !== 'information').length,
  };
}

/** Identyfikatory uprawnień użyte w regułach, ale nieistniejące w katalogu. */
export function findDanglingLicenseIds(): string[] {
  return KNOCKOUT_RULES.flatMap((rule) => rule.satisfiedByLicenseIds).filter(
    (id) => !isKnownLicenseId(id)
  );
}

export const evaluateKnockouts = auditKnockouts;
