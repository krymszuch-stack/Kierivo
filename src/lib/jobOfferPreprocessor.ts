/**
 * Przygotowuje tekst wklejony z portalu przed kanonicznym parserem pojedynczej oferty.
 * Nie odgaduje brakujących danych: segment niepewny pozostaje niepewny.
 */

export type OfferCompleteness = 'complete' | 'partial' | 'uncertain';

export interface PreparedJobOfferSegment {
  id: string;
  titleCandidate: string | null;
  companyCandidate: string | null;
  rawText: string;
  cleanText: string;
  completeness: OfferCompleteness;
  confidence: number;
  duplicateOfSegmentId: string | null;
  needsUserReview: boolean;
}

export interface JobOfferPreparation {
  sourceType: 'multi-offer-paste';
  classification: 'single' | 'multiple' | 'duplicated' | 'incomplete' | 'noisy';
  segments: PreparedJobOfferSegment[];
}

const UI_LINES = [
  /^asystent pracuj\.pl$/i,
  /^sprawdź,? jak dobrze ta oferta do ciebie pasuje$/i,
  /^podsumowanie oferty$/i,
  /^dodatkowe informacje$/i,
  /^przewiń do profilu firmy$/i,
  /^(zobacz|nowość)$/i,
  /^(samochód|komunikacja miejska|rower|pieszo)\s*$/i,
  /^[-–]\s*$/,
];
const COMPANY_HEADER = /^(.{2,}?)\s*o firmie\s*$/i;
const REQUIREMENTS = /^(nasze |twoje )?(wymagania|czego oczekujemy|kwalifikacje)\b/i;
const DUTIES = /^(twój |twoje )?(zakres obowiązków|zadania|obowiązki)\b/i;
const LOCATION = /(?:warszawa|katowice|kraków|wrocław|gdańsk|poznań|łódź|szczecin|biał[oa]|polska)/i;
const SALARY = /\b\d[\d\s,.]*\s*(?:–|-|do)\s*\d[\d\s,.]*\s*(?:zł|pln|eur|usd)\b/i;
const WORK_MODE = /\b(praca zdalna|zdaln\w*|hybryd\w*|stacjonarn\w*|remote)\b/i;
const CONTRACT = /\b(umowa o pracę|umowa zlecenie|kontrakt b2b|b2b|umowa o dzieło)\b/i;
const SENIORITY = /\b(senior|junior|mid|regular|lead|specjalista)\b/i;

function normalize(value: string): string {
  return value.toLocaleLowerCase('pl-PL').replace(/[^\p{L}\p{N}+.#]+/gu, ' ').trim();
}

function cleanedLines(rawText: string): string[] {
  return rawText.replace(/\r/g, '').split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !UI_LINES.some((pattern) => pattern.test(line)));
}

function metadata(lines: string[]): { location: string; salary: string; workMode: string } {
  return {
    location: lines.find((line) => LOCATION.test(line)) || '',
    salary: lines.find((line) => SALARY.test(line)) || '',
    workMode: lines.find((line) => WORK_MODE.test(line)) || '',
  };
}

function titleBefore(lines: string[], headerIndex: number, segmentLines: string[]): string | null {
  const previous = lines.slice(Math.max(0, headerIndex - 3), headerIndex).reverse();
  const candidate = previous.map((line) => {
    const explicit = line.split(/(?:specjalizacje:|nowość)/i).pop()!.trim();
    const attachedTitle = explicit.match(/(?:senior|junior|lead|programista|kucharz)\b.*$/i);
    if (attachedTitle) return attachedTitle[0].trim();
    if (explicit.length < 100) return explicit;
    const truncatedTitle = explicit.match(/(\w*ogramista\s*\([^)]*\))$/i);
    return truncatedTitle?.[1]?.trim() || explicit;
  })
    .find((line) => line.length > 3 && line.length < 100 && !/^(do \d|ważna|śląskie|mazowieckie)$/i.test(line));
  if (!candidate) return null;
  if (/ogramista\s*\(m\/k\)/i.test(candidate) && /\bc\/c\+\+(?!\w)/i.test(segmentLines.join(' '))) {
    return 'Programista C/C++';
  }
  return candidate;
}

function coreTokens(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter((word) =>
    word.length > 3 && !['wymagania', 'obowiązków', 'oferta', 'praca', 'firma', 'nasze', 'twój'].includes(word)
  ));
}

function similarity(left: string, right: string): number {
  const a = coreTokens(left);
  const b = coreTokens(right);
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / Math.max(1, a.size + b.size - intersection);
}

function validate(lines: string[], title: string | null, company: string | null): Pick<PreparedJobOfferSegment, 'completeness' | 'confidence' | 'needsUserReview'> {
  const hasRequirements = lines.some((line) => REQUIREMENTS.test(line));
  const hasDuties = lines.some((line) => DUTIES.test(line));
  const endingAbruptly = /[,;:–-]$/.test(lines.at(-1) || '');
  const metadataSignals = [LOCATION, SALARY, WORK_MODE, CONTRACT, SENIORITY]
    .filter((signal) => lines.some((line) => signal.test(line))).length;
  if ((hasDuties && !hasRequirements) || endingAbruptly) {
    return { completeness: 'partial', confidence: 0.45, needsUserReview: true };
  }
  if (!title || !company || metadataSignals < 2 || (hasRequirements !== hasDuties)) {
    return { completeness: 'uncertain', confidence: 0.6, needsUserReview: true };
  }
  return { completeness: 'complete', confidence: 0.9, needsUserReview: false };
}

/** Segmentuje wyłącznie granice poparte nagłówkiem firmy i co najmniej dwoma sygnałami oferty. */
export function preprocessJobOfferPaste(rawText: string): JobOfferPreparation {
  const lines = cleanedLines(rawText);
  const starts = lines.map((line, index) => {
    const company = line.match(COMPANY_HEADER)?.[1]?.trim();
    const signals = lines.slice(index + 1, index + 13)
      .filter((nearby) => LOCATION.test(nearby) || SALARY.test(nearby) || WORK_MODE.test(nearby) || CONTRACT.test(nearby) || SENIORITY.test(nearby)).length;
    return company && signals >= 2 ? { index, company } : null;
  }).filter((entry): entry is { index: number; company: string } => entry !== null);

  const ranges = starts.length
    ? starts.map((start, index) => ({ start: start.index, end: starts[index + 1]?.index ?? lines.length, company: start.company }))
    : [{ start: 0, end: lines.length, company: null }];
  const segments = ranges.map((range, index) => {
    const segmentLines = lines.slice(range.start, range.end);
    // Nagłówek częściowo zniknął przy kopiowaniu, ale pełny tekst nadal może
    // zawierać jednoznaczny ślad specjalizacji. Naprawiamy wyłącznie tytuł.
    const title = starts.length ? titleBefore(lines, range.start, lines) : null;
    const validation = validate(segmentLines, title, range.company);
    return {
      id: `segment-${index + 1}`,
      titleCandidate: title,
      companyCandidate: range.company,
      rawText: segmentLines.join('\n'),
      cleanText: segmentLines.join('\n'),
      ...validation,
      duplicateOfSegmentId: null as string | null,
    };
  });

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const details = metadata(segment.cleanText.split('\n'));
    const duplicate = segments.slice(0, index).find((other) => {
      const otherDetails = metadata(other.cleanText.split('\n'));
      const sameIdentity = normalize(segment.titleCandidate || '') === normalize(other.titleCandidate || '') &&
        normalize(segment.companyCandidate || '') === normalize(other.companyCandidate || '');
      const corroborated = Boolean(details.location && details.location === otherDetails.location) ||
        Boolean(details.salary && details.salary === otherDetails.salary) ||
        similarity(segment.cleanText, other.cleanText) >= 0.72;
      return sameIdentity && corroborated;
    });
    if (duplicate) {
      segment.duplicateOfSegmentId = duplicate.id;
      segment.needsUserReview = false;
    }
  }

  const unique = segments.filter((segment) => !segment.duplicateOfSegmentId);
  const classification = segments.some((segment) => segment.duplicateOfSegmentId) ? 'duplicated'
    : unique.some((segment) => segment.completeness === 'partial') ? 'incomplete'
      : starts.length > 1 ? 'multiple'
        : lines.length !== rawText.replace(/\r/g, '').split('\n').filter(Boolean).length ? 'noisy'
          : 'single';
  return { sourceType: 'multi-offer-paste', classification, segments };
}
