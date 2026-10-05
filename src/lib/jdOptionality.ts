/**
 * Wspólne rozpoznawanie opcjonalnych kryteriów z treści ofert.
 *
 * „Mile widziane” może wystąpić jako nagłówek sekcji albo w środku zdania
 * („Mile widziane Entra ID.”). Silniki dopasowania i checklista formalna muszą
 * używać tych samych znaczników, żeby opcjonalne kryterium nie obniżało wyniku
 * w jednym widoku i nie było obowiązkowe w drugim.
 */
const OPTIONAL_MARKER_SOURCE = String.raw`(?:mile\s+widzian\w*|nice[-\s]+to[-\s]+have|preferred(?:\s+qualifications?)?|desirable(?:\s+qualifications?|\s+skills?)?|dodatkowym\s+atutem|atutem|opcjonalnie|nieobowi[ąa]zkow\w*|optional|not\s+required)`;

const NEXT_SECTION_SOURCE = String.raw`(?:wymagania|wymagane|requirements?|must\s+have|zakres\s+obowiązków|obowiązki|zadania|responsibilities|oferujemy|we\s+offer|benefity|benefits)`;

const REQUIRED_MARKER_SOURCE = String.raw`(?:wymagan[\p{L}]*|wymaga(?:j[ąa])?|must\s+have|(?<!not\s)required|obowi[ąa]zkow[\p{L}]*|konieczn[\p{L}]*)`;
const REQUIRED_MARKER_PATTERN_SOURCE = String.raw`(?<![\p{L}\p{N}_])${REQUIRED_MARKER_SOURCE}(?![\p{L}\p{N}_])`;
const NEGATED_REQUIREMENT_BEFORE_SOURCE = String.raw`(?:nie\s+(?:jest\s+)?(?:wymagan[\p{L}]*|wymaga(?:j[ąa])?|konieczn[\p{L}]*|potrzebn[\p{L}]*|musisz|wymagamy|trzeba|potrzeb[\p{L}]*)|not\s+(?:required|mandatory|necessary|needed|essential)|no\s+(?:requirement|need)\s+(?:for|to)|(?:do|does)\s+not\s+require|doesn't\s+require|don't\s+require|without\s+requiring|bez\s+(?:konieczno[\p{L}]*|wymogu|potrzeb[\p{L}]*|posiadania)|nie\s+ma\s+(?:wymogu|potrzeby))`;
const NEGATED_REQUIREMENT_AFTER_SOURCE = String.raw`(?:nie\s+(?:jest\s+)?(?:wymagan\w*|konieczn\w*|potrzebn\w*|obowi[ąa]zkow\w*)|(?:is|are)\s+not\s+(?:required|mandatory|necessary|needed|essential|a\s+requirement)|isn't\s+(?:required|mandatory|necessary|needed|essential)|aren't\s+(?:required|mandatory|necessary|needed|essential)|(?:is|are)\s+(?:unnecessary|not\s+needed))`;

export type RequirementSectionContext = 'required' | 'optional' | 'non_requirement' | 'unknown';

function requirementContextText(text: string): string {
  // Kropka w nazwie, liczbie oraz skrócie min./max./kat. nie zamyka klauzuli.
  // Zachowujemy długość tekstu i pozycje nazw znalezionych przez konsumentów.
  return (text ?? '').replace(/(?<=\d)[.,](?=\d)|\.(?=[\p{L}\p{N}])|(?<=\b(?:min|max|maks|kat))\.(?=[ \t]*[\p{L}\p{N}])/giu, '·');
}

/** Jedno rozpoznanie jawnego znacznika wymagania dla wszystkich silników. */
export function hasExplicitRequiredMarker(text: string): boolean {
  return new RegExp(REQUIRED_MARKER_PATTERN_SOURCE, 'iu').test(text ?? '');
}

const REQUIRED_SECTION_HEADERS = new Set([
  'wymagania', 'nasze wymagania', 'twoje wymagania', 'wymagania obowiazkowe',
  'wymagania i kwalifikacje', 'wymagania na stanowisku',
  'wymagane',
  'czego oczekujemy', 'czego oczekujemy od ciebie', 'czego oczekujemy od kandydata', 'czego oczekujemy od kandydatow',
  'czego oczekujemy od naszych pracownikow', 'oczekiwania', 'oczekujemy', 'wymagamy',
  'nasze oczekiwania', 'nasze oczekiwania od kandydata', 'nasze oczekiwania od kandydatow',
  'nasze oczekiwania od naszych pracownikow', 'czego szukamy',
  'czego szukamy od ciebie', 'czego szukamy od kandydatow',
  'czego szukamy od naszych pracownikow',
  'od kandydatow oczekujemy', 'od kandydata oczekujemy',
  'kogo szukamy', 'kogo szukamy do zespolu', 'profil kandydata', 'idealny kandydat',
  'wymagane kwalifikacje', 'kwalifikacje', 'kwalifikacje wymagane',
  'requirement', 'requirements', 'required', 'required requirement', 'required requirements',
  'required qualification', 'required qualifications',
  'minimum', 'minimum qualification', 'minimum qualifications', 'minimum requirement', 'minimum requirements',
  'basic', 'basic qualification', 'basic qualifications', 'basic requirement', 'basic requirements',
  'what we expect', 'what we require', 'what we need',
  'qualification', 'qualifications', 'must have', 'must haves', 'your qualifications',
  "what you’ll bring", "what you'll bring", 'what you will bring', 'your profile', 'who you are',
  'what we are looking for', 'what we’re looking for', 'what were looking for',
]);

const OPTIONAL_SECTION_HEADERS = new Set([
  'mile widziane', 'mile widziane kwalifikacje', 'dodatkowe atuty',
  'dodatkowym atutem', 'atutem bedzie', 'mile widziane bedzie',
  'nice to have', 'nice to haves', 'preferred',
  'preferred qualification', 'preferred qualifications', 'desirable',
  'desirable qualification', 'desirable qualifications', 'desirable skill',
  'desirable skills', 'bonus points',
]);

const NON_REQUIREMENT_SECTION_HEADERS = new Set([
  'forma zatrudnienia', 'rodzaj zatrudnienia', 'rodzaj umowy', 'warunki zatrudnienia',
  'employment type', 'type of employment', 'contract type', 'employment terms',
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

/** Jedno źródło klasyfikacji nagłówków wymaganych używane też przez parser JD. */
export function isRequiredSectionHeader(value: string): boolean {
  return classifySectionHeader(value) === 'required';
}

/** Wspólne rozpoznawanie nagłówków sekcji z atutami opcjonalnymi. */
export function isOptionalSectionHeader(value: string): boolean {
  return classifySectionHeader(value) === 'optional';
}

/** Czy nagłówek należy do znanej sekcji, która może zamknąć bieżący blok. */
export function isKnownSectionHeader(value: string): boolean {
  return classifySectionHeader(value) !== null;
}

/**
 * Rozpoznaje jawne zaprzeczenie wymogu po obu stronach jego nazwy.
 * Oferty używają zarówno „nie wymagamy prawa jazdy”, jak i „prawo jazdy nie
 * jest wymagane”; sprawdzenie wyłącznie tekstu przed dopasowaniem gubi drugi
 * zapis i potrafi stworzyć fałszywy warunek odrzucający.
 */
export function isNegatedRequirementAt(text: string, index: number): boolean {
  const source = requirementContextText(text);
  const before = source.slice(Math.max(0, index - 100), Math.max(0, index));
  const negativeBefore = new RegExp(`[^.!?;\\n]{0,80}(?<![\\p{L}\\p{N}_])${NEGATED_REQUIREMENT_BEFORE_SOURCE}(?![\\p{L}\\p{N}_])[^.!?;\\n]{0,80}$`, 'iu').exec(before);
  if (negativeBefore) {
    // W jednym wierszu mogą wystąpić dwa kryteria: „not required Entra ID,
    // required ServiceNow”. Jawny późniejszy wymóg rozpoczyna nową klauzulę;
    // nie wolno rozciągać na niego wcześniejszego zaprzeczenia.
    const positiveMarkers = [...before.matchAll(new RegExp(REQUIRED_MARKER_PATTERN_SOURCE, 'giu'))]
      .filter((match) => {
        const markerIndex = match.index ?? 0;
        return !new RegExp(String.raw`\bnot\s+$`, 'i').test(before.slice(Math.max(0, markerIndex - 12), markerIndex));
      });
    const lastPositiveIndex = positiveMarkers.at(-1)?.index ?? -1;
    const negativeMarker = new RegExp(String.raw`(?<![\p{L}\p{N}_])${NEGATED_REQUIREMENT_BEFORE_SOURCE}(?![\p{L}\p{N}_])`, 'iu').exec(negativeBefore[0]);
    const negativeEndIndex = (negativeBefore.index ?? 0) + (negativeMarker?.index ?? 0) + (negativeMarker?.[0].length ?? 0);
    if (lastPositiveIndex <= negativeEndIndex) return true;
  }

  const after = source.slice(Math.max(0, index));
  // „kat.” jest częstym skrótem wewnątrz kryterium, nie końcem zdania.
  const boundedPrefix = String.raw`(?:(?:kat\.|kategorii\b)|[^.!?;\n]){0,100}?`;
  return new RegExp(`^${boundedPrefix}(?<![\\p{L}\\p{N}_])${NEGATED_REQUIREMENT_AFTER_SOURCE}(?![\\p{L}\\p{N}_])`, 'iu').test(after);
}

/** Czy fraza ma przynajmniej jedno niezanegowane wystąpienie w źródle. */
export function hasPositiveRequirementMention(text: string, phrase: string): boolean {
  if (!text || !phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
  return [...text.matchAll(pattern)].some((match) => !isNegatedRequirementAt(text, match.index ?? 0));
}

/** Czy fraza występuje dodatnio i nie jest oznaczona jako atut opcjonalny. */
export function hasRequiredRequirementMention(text: string, phrase: string): boolean {
  if (!text || !phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
  return [...text.matchAll(pattern)].some((match) => {
    const index = match.index ?? 0;
    return !isNegatedRequirementAt(text, index) && !isPreferredRequirementAt(text, index);
  });
}

/** Czy fraza ma jawne oznaczenie opcjonalności przed nią albo po niej. */
export function hasPreferredRequirementMention(text: string, phrase: string): boolean {
  if (!text || !phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
  return [...text.matchAll(pattern)].some((match) => {
    const index = match.index ?? 0;
    return !isNegatedRequirementAt(text, index) && isPreferredRequirementAt(text, index);
  });
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

/**
 * Ustala status konkretnego wymogu na podstawie ostatniego jawnego znacznika
 * przed nim. Dzięki temu „mile widziane X, wymagane Y” nie zmiękcza Y tylko
 * dlatego, że oba elementy zmieszczono w jednym zdaniu.
 */
export function isPreferredRequirementAt(text: string, index: number): boolean {
  const source = requirementContextText(text);
  // Część angielskich ogłoszeń zapisuje atut po nazwie: „JavaScript is a
  // plus”. Ograniczamy szukanie do bieżącej klauzuli, żeby status nie
  // przenosił się na następny wymóg.
  const clause = source.slice(index).split(/[.!?;\n]/, 1)[0].slice(0, 160);
  const suffixPattern = /\b(?:is|are|was|were|would\s+be|could\s+be)\s+(?:a\s+)?(?:plus|bonus|benefit|advantage|helpful|useful|beneficial)\b/i;
  const suffix = suffixPattern.exec(clause);
  if (suffix) {
    const beforeSuffix = clause.slice(0, suffix.index);
    const requiredAfterMention = new RegExp(REQUIRED_MARKER_PATTERN_SOURCE, 'iu');
    if (!requiredAfterMention.test(beforeSuffix)) return true;
  }
  // „X is not required. Python is required.” nie może odziedziczyć statusu X.
  // Przecinek odcina kolejne kryterium; liczby dziesiętne są już zabezpieczone.
  if (hasExplicitRequiredMarker(clause.split(',', 1)[0])) return false;
  const optionalMatches = [...source.matchAll(new RegExp(String.raw`\b${OPTIONAL_MARKER_SOURCE}\b`, 'gi'))];
  const statuses: Array<{ index: number; optional: boolean; end: number }> = optionalMatches.map((match) => ({
    index: match.index ?? 0,
    optional: true,
    end: (match.index ?? 0) + match[0].length,
  }));
  const requiredPattern = new RegExp(REQUIRED_MARKER_PATTERN_SOURCE, 'giu');
  for (const match of source.matchAll(requiredPattern)) {
    const markerIndex = match.index ?? 0;
    // „not required” jest jednym znacznikiem opcjonalnym, nie późniejszym
    // obowiązkowym „required”.
    if (optionalMatches.some((optional) => {
      const start = optional.index ?? 0;
      return start <= markerIndex && markerIndex < start + optional[0].length;
    })) continue;
    statuses.push({ index: markerIndex, optional: false, end: markerIndex + match[0].length });
  }
  return statuses
    .filter((status) => status.index <= index)
    .sort((a, b) => a.index - b.index || a.end - b.end)
    .at(-1)?.optional ?? false;
}

/** Usuwa wyłącznie opcjonalną frazę/sekcję przed dalszą ekstrakcją umiejętności. */
export function stripPreferredRequirementText(text: string): string {
  const optionalSegment = new RegExp(
    String.raw`\b${OPTIONAL_MARKER_SOURCE}\b\s*:?\s*[\s\S]*?(?=(?:\b${NEXT_SECTION_SOURCE}\b\s*:)|${REQUIRED_MARKER_PATTERN_SOURCE}|[.!?;](?=\s|$)|$)`,
    'gi',
  );

  return (text ?? '').replace(optionalSegment, ' ');
}
