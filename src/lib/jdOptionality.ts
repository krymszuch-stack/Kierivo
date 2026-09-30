/**
 * Wspólne rozpoznawanie opcjonalnych kryteriów z treści ofert.
 *
 * „Mile widziane” może wystąpić jako nagłówek sekcji albo w środku zdania
 * („Mile widziane Entra ID.”). Silniki dopasowania i checklista formalna muszą
 * używać tych samych znaczników, żeby opcjonalne kryterium nie obniżało wyniku
 * w jednym widoku i nie było obowiązkowe w drugim.
 */
const OPTIONAL_MARKER_SOURCE = String.raw`(?:mile\s+widzian\w*|nice\s+to\s+have|preferred|dodatkowym\s+atutem|atutem|opcjonalnie|nieobowi[ąa]zkow\w*|optional|not\s+required)`;

const NEXT_SECTION_SOURCE = String.raw`(?:wymagania|wymagane|requirements?|must\s+have|zakres\s+obowiązków|obowiązki|zadania|responsibilities|oferujemy|we\s+offer|benefity|benefits)`;

const OPTIONAL_MARKER = new RegExp(String.raw`\b${OPTIONAL_MARKER_SOURCE}\b`, 'i');

export type RequirementSectionContext = 'required' | 'optional' | 'non_requirement' | 'unknown';

const REQUIRED_SECTION_HEADERS = new Set([
  'wymagania', 'nasze wymagania', 'twoje wymagania', 'wymagania obowiazkowe',
  'wymagania i kwalifikacje', 'wymagania na stanowisku',
  'czego oczekujemy', 'oczekujemy', 'wymagamy', 'nasze oczekiwania',
  'od kandydatow oczekujemy', 'od kandydata oczekujemy', 'czego oczekujemy od kandydata',
  'kogo szukamy', 'kogo szukamy do zespolu', 'profil kandydata', 'idealny kandydat',
  'wymagane', 'wymagane kwalifikacje', 'kwalifikacje', 'kwalifikacje wymagane',
  'requirements', 'required qualifications', 'minimum qualifications',
  'must have', 'must haves', 'must-haves', 'your qualifications', 'what you will bring',
  'what we are looking for', 'what we’re looking for', 'what were looking for',
]);

const OPTIONAL_SECTION_HEADERS = new Set([
  'mile widziane', 'mile widziane kwalifikacje', 'dodatkowe atuty',
  'dodatkowym atutem', 'atutem bedzie', 'mile widziane bedzie',
  'nice to have', 'nice to haves', 'preferred',
  'preferred qualifications', 'bonus points',
]);

const NON_REQUIREMENT_SECTION_HEADERS = new Set([
  'zakres obowiazkow', 'obowiazki', 'twoj zakres obowiazkow', 'zadania',
  'twoje obowiazki', 'twoje zadania', 'czym bedziesz sie zajmowac', 'zakres zadan',
  'responsibilities', 'key responsibilities', 'your responsibilities', 'job responsibilities',
  'what you will do', 'about the role',
  'oferujemy', 'benefity', 'benefits', 'perks', 'o firmie', 'about us',
]);

function normalizeSectionHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[•*-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pl-PL');
}

function classifySectionHeader(value: string): RequirementSectionContext | null {
  const normalized = normalizeSectionHeader(value.replace(/\s*:\s*$/, ''));
  if (REQUIRED_SECTION_HEADERS.has(normalized)) return 'required';
  if (OPTIONAL_SECTION_HEADERS.has(normalized)) return 'optional';
  if (NON_REQUIREMENT_SECTION_HEADERS.has(normalized)) return 'non_requirement';
  return null;
}

/**
 * Ustala kontekst sekcji dla wzmianki. Sama obecność „TIG” w obowiązkach nie
 * dowodzi, że pracodawca wymaga uprawnień; z kolei krótka linia pod nagłówkiem
 * „Wymagania” jest obowiązkowa mimo braku słowa „wymagane” w tej linii.
 */
export function requirementSectionContextAt(text: string, index: number): RequirementSectionContext {
  let context: RequirementSectionContext = 'unknown';
  const source = text ?? '';
  const lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = lines.exec(source)) !== null) {
    if (match[0].length === 0) break;
    const lineStart = match.index;
    if (lineStart > index) break;
    const line = match[0].replace(/[\r\n]+$/, '');
    const localIndex = Math.min(line.length, Math.max(0, index - lineStart));
    const prefix = line.slice(0, localIndex + 1);
    const colonPattern = /:/g;
    let colon: RegExpExecArray | null;
    let sawRecognizedHeader = false;
    while ((colon = colonPattern.exec(prefix)) !== null) {
      const beforeColon = prefix.slice(0, colon.index);
      const lastBoundary = Math.max(beforeColon.lastIndexOf(':'), beforeColon.lastIndexOf('.'), beforeColon.lastIndexOf(';'), beforeColon.lastIndexOf('!'), beforeColon.lastIndexOf('?'));
      const classified = classifySectionHeader(beforeColon.slice(lastBoundary + 1));
      if (classified) {
        context = classified;
        sawRecognizedHeader = true;
      }
    }
    if (!sawRecognizedHeader && !line.includes(':')) {
      const classified = classifySectionHeader(line);
      if (classified) context = classified;
    }
  }

  return context;
}

export function hasPreferredRequirementMarker(text: string): boolean {
  return OPTIONAL_MARKER.test(text ?? '');
}

/** Pozycja znacznika potrzebna, gdy wzorzec obejmuje nazwę i zakres, np. SEP G3. */
export function preferredRequirementMarkerIndex(text: string): number {
  return (text ?? '').search(OPTIONAL_MARKER);
}

/** Usuwa wyłącznie opcjonalną frazę/sekcję przed dalszą ekstrakcją umiejętności. */
export function stripPreferredRequirementText(text: string): string {
  const optionalSegment = new RegExp(
    String.raw`\b${OPTIONAL_MARKER_SOURCE}\b\s*:?\s*[\s\S]*?(?=(?:\b${NEXT_SECTION_SOURCE}\b\s*:)|[.!?;](?=\s|$)|$)`,
    'gi',
  );

  return (text ?? '').replace(optionalSegment, ' ');
}
