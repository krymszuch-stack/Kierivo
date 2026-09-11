import { MasterVault } from '../types';
import { isKnownLicenseId } from '../data/licenses';

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

export type KnockoutSeverity = 'knockout' | 'preferred';

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
  severity: KnockoutSeverity;
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

/**
 * „Mile widziane" zmienia wagę wymagania, a nie jego istnienie. Traktowanie
 * takiej pozycji jak twardego knock-outu strasi użytkownika bez powodu.
 */
const SOFTENING_PATTERN = /\b(?:mile\s+widzian\w*|atutem|dodatkowym\s+atutem|opcjonalnie|nieobowi[ąa]zkow\w*)\b/i;

export const KNOCKOUT_RULES: KnockoutRule[] = [
  // ---------- Prawo jazdy ----------
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
    label: 'Prawo jazdy kat. C / C+E',
    detect: [/\bkat\.?\s*c\s*\+?\s*e\b/i, /\bkat\.?\s*c\b/i, /prawo\s+jazdy\s+c\b/i, /\bkierowc\w*\s+c\+e\b/i],
    satisfiedByLicenseIds: ['c_license'],
    satisfiedByText: [/kat\.?\s*c\s*\+?\s*e?\b/i],
    severity: 'knockout',
    hint: 'Dopisz też kartę kierowcy i świadectwo kwalifikacji, jeśli je masz.',
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
    detect: [/\bsep\b[^.]{0,30}\bg\s*-?\s*1\b/i, /\bsep\b[^.]{0,20}1\s*kv/i, /uprawnieni\w*\s+elektryczn\w*/i, /\be\s*-?\s*1\b.{0,20}dozór/i],
    satisfiedByLicenseIds: ['sep_1kv'],
    satisfiedByText: [/\bsep\b[^.]{0,30}\bg\s*-?\s*1\b/i, /uprawnieni\w*\s+elektryczn\w*/i],
    severity: 'knockout',
    hint: 'Podaj grupę i zakres, np. „SEP G1 do 1 kV — eksploatacja i dozór”.',
  },
  {
    id: 'sep_g2',
    label: 'Uprawnienia SEP G2 (cieplne)',
    detect: [/\bsep\b[^.]{0,30}\bg\s*-?\s*2\b/i, /uprawnieni\w*\s+ciepln\w*/i, /uprawnieni\w*\s+energetyczn\w*/i],
    satisfiedByLicenseIds: ['sep_g2'],
    satisfiedByText: [/\bsep\b[^.]{0,30}\bg\s*-?\s*2\b/i],
    severity: 'knockout',
  },
  {
    id: 'sep_g3',
    label: 'Uprawnienia SEP G3 (gazowe)',
    detect: [/\bsep\b[^.]{0,30}\bg\s*-?\s*3\b/i, /uprawnieni\w*\s+gazow\w*/i],
    satisfiedByLicenseIds: ['sep_g3'],
    satisfiedByText: [/\bsep\b[^.]{0,30}\bg\s*-?\s*3\b/i, /uprawnieni\w*\s+gazow\w*/i],
    severity: 'knockout',
    hint: 'Przy serwisie kotłów to podstawowe wymaganie — wypisz je osobną linią.',
  },
  {
    id: 'fgas',
    label: 'Certyfikat F-Gaz',
    detect: [/\bf\s*-?\s*gaz\w*\b/i, /\bf\s*-?\s*gas\b/i, /czynnik\w*\s+ch[łl]odnicz\w*/i],
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
    label: 'Uprawnienia UDT — suwnice / dźwigi',
    detect: [/\bsuwnic\w*/i, /\bd[źz]wig\w*/i, /\bhds\b/i, /\b[żz]uraw\w*/i],
    satisfiedByLicenseIds: ['udt_crane'],
    satisfiedByText: [/\bsuwnic\w*/i, /\bhds\b/i, /\b[żz]uraw\w*/i],
    severity: 'knockout',
  },
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
    label: 'Uprawnienia spawalnicze (TIG / MAG / MIG)',
    detect: [/\bspawa\w*/i, /\btig\b/i, /\bmag\b\s*13[15]/i, /\bmig\b/i, /\b14[19]\b/, /\b13[15]\b/],
    satisfiedByLicenseIds: ['welding_tig_mig'],
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
    satisfiedByLicenseIds: ['b_license'],
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

export interface KnockoutReport {
  findings: KnockoutFinding[];
  /** Twarde wymagania, których profil nie spełnia — to jest lista do działania. */
  blocking: KnockoutFinding[];
  /** Mile widziane, których brakuje. */
  optional: KnockoutFinding[];
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
): { required: boolean; softened: boolean } {
  let softenedMatch = false;

  for (const pattern of rule.detect) {
    // `matchAll` na wypadek, gdy ta sama rzecz pada w ogłoszeniu dwa razy —
    // raz w zdaniu przeczącym, raz jako realne wymaganie.
    for (const match of jdText.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))) {
      const { before, whole } = clauseAround(jdText, match.index);

      if (NEGATION_PATTERN.test(before)) continue;

      if (SOFTENING_PATTERN.test(whole)) {
        // Zapamiętujemy, ale szukamy dalej: twarde wystąpienie tego samego
        // wymagania w innym miejscu ogłoszenia ma pierwszeństwo.
        softenedMatch = true;
        continue;
      }

      return { required: true, softened: false };
    }
  }

  return softenedMatch ? { required: true, softened: true } : { required: false, softened: false };
}

/**
 * Rozszerza zbiór posiadanych uprawnień o uprawnienia podrzędne implikowane przez hierarchię
 * (np. prawo jazdy C+E implikuje kat. B i C, SEP dozorowy implikuje eksploatacyjny).
 */
function expandHeldLicensesWithHierarchy(heldLicenses: Set<string>): Set<string> {
  const expanded = new Set(heldLicenses);

  // Prawo jazdy: C/C+E implikuje B
  if (
    expanded.has('c_license') ||
    expanded.has('driving_c_plus_e') ||
    expanded.has('driving_ce') ||
    expanded.has('driving_c')
  ) {
    expanded.add('b_license');
    expanded.add('driving_b');
    expanded.add('driving_license_b');
  }

  // SEP: powyżej 1kV / dozór implikuje do 1kV
  if (
    expanded.has('sep_above_1kv') ||
    expanded.has('sep_15kv') ||
    expanded.has('sep_g1_15kv') ||
    expanded.has('sep_g1_d') ||
    expanded.has('sep_g1')
  ) {
    expanded.add('sep_1kv');
    expanded.add('sep_g1_e');
  }

  if (expanded.has('sep_g2_d')) {
    expanded.add('sep_g2');
  }

  if (expanded.has('sep_g3_d')) {
    expanded.add('sep_g3');
  }

  // UDT: nadrzędne kategorie wózków / suwnic
  if (expanded.has('udt_i_wjo') || expanded.has('udt_crane')) {
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
    const { required, softened } = detectRequirement(rule, jdText);
    if (!required) continue;

    // Uprawnienie zaznaczone w profilu liczy się przed tekstem: to jest
    // deklaracja wprost, a nie domysł z opisu stanowiska.
    const byLicense = rule.satisfiedByLicenseIds.some((id) => heldLicenses.has(id));
    const byText = !byLicense && rule.satisfiedByText.some((pattern) => pattern.test(vaultText));

    findings.push({
      ruleId: rule.id,
      label: rule.label,
      // „Mile widziane” w treści ogłoszenia obniża wagę nawet wtedy, gdy sama
      // reguła jest twarda — inaczej straszylibyśmy użytkownika wymaganiem,
      // którego pracodawca sam nie traktuje jako obowiązkowe.
      severity: softened ? 'preferred' : rule.severity,
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
    satisfiedCount: findings.filter((finding) => finding.satisfied).length,
    requirementCount: findings.length,
  };
}

/** Identyfikatory uprawnień użyte w regułach, ale nieistniejące w katalogu. */
export function findDanglingLicenseIds(): string[] {
  return KNOCKOUT_RULES.flatMap((rule) => rule.satisfiedByLicenseIds).filter(
    (id) => !isKnownLicenseId(id)
  );
}

export const evaluateKnockouts = auditKnockouts;
