import {
  canonicalFormalEntity,
  canonicalLanguage,
  genericCredentialCanonicalId,
  normalizeFormalTerm,
  parseCefrLevel,
  parseEducationLevel,
} from './taxonomy';
import type { D10FormalLineSegment } from './segmentation';
import type {
  D10FormalRequirement,
  D10FormalRequirementKind,
  D10SourceSpan,
} from './types';

export interface DetectedD10Entity {
  canonicalId: string;
  kind: D10FormalRequirementKind;
  label: string;
  sourceSpan: D10SourceSpan;
  specificity: number;
  languageLevel?: D10FormalRequirement['languageLevel'];
  educationLevel?: D10FormalRequirement['educationLevel'];
  fieldConstraint?: string | null;
  validityRequired?: boolean;
}

function absoluteSpan(segment: D10FormalLineSegment, localStart = 0, localEnd = segment.text.length): D10SourceSpan {
  return {
    start: segment.span.start + localStart,
    end: segment.span.start + localEnd,
  };
}

export function extractEducationFieldConstraint(text: string): string | null {
  const normalized = normalizeFormalTerm(text);
  const patterns = [
    /(?:kierunek|specjalnosc|field(?: of study)?)\s*[:-]?\s*([a-z0-9 +.#/-]{3,80})$/,
    /(?:in|z zakresu|w dziedzinie)\s+([a-z0-9 +.#/-]{3,80})$/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function detectDrivingCategories(segment: D10FormalLineSegment): DetectedD10Entity[] {
  const match = segment.text.match(/(?:prawo\s+jazdy|driving\s+licen[cs]e)(?:\s+kat(?:egoria)?\.?|\s+category)?\s*[:.-]?\s*((?:AM|A1|A2|A|B1|B|C1|C|D1|D|BE|CE|DE|T)(?:\s*\/\s*(?:AM|A1|A2|A|B1|B|C1|C|D1|D|BE|CE|DE|T))*)/i);
  if (!match || match.index === undefined) return [];
  const categoriesRaw = match[1];
  const categoriesOffset = match.index + match[0].lastIndexOf(categoriesRaw);
  const out: DetectedD10Entity[] = [];
  let searchFrom = 0;
  for (const token of categoriesRaw.split('/').map((item) => item.trim()).filter(Boolean)) {
    const local = categoriesRaw.toUpperCase().indexOf(token.toUpperCase(), searchFrom);
    searchFrom = Math.max(searchFrom, local + token.length);
    out.push({
      canonicalId: `driving.${token.toLowerCase()}`,
      kind: 'DRIVING_LICENSE',
      label: `Prawo jazdy kat. ${token.toUpperCase()}`,
      sourceSpan: absoluteSpan(segment, categoriesOffset + local, categoriesOffset + local + token.length),
      specificity: 1,
    });
  }
  return out;
}

function dedupeDetected(entities: DetectedD10Entity[]): DetectedD10Entity[] {
  const byKey = new Map<string, DetectedD10Entity>();
  for (const entity of entities) {
    const key = `${entity.kind}:${entity.canonicalId}`;
    const current = byKey.get(key);
    if (!current || entity.specificity > current.specificity ||
      (entity.specificity === current.specificity &&
        (entity.sourceSpan.end - entity.sourceSpan.start) < (current.sourceSpan.end - current.sourceSpan.start))) {
      byKey.set(key, entity);
    }
  }
  return [...byKey.values()].sort((a, b) => a.sourceSpan.start - b.sourceSpan.start);
}

/**
 * Wszystkie detektory pracują równolegle. Trafienie jednego typu nie kończy
 * analizy segmentu, dzięki czemu jedna linia może wygenerować wiele Evidence.
 */
export function detectD10Entities(segment: D10FormalLineSegment): DetectedD10Entity[] {
  const out: DetectedD10Entity[] = [];
  const normalized = normalizeFormalTerm(segment.text);
  const validityRequired = /\b(valid|current|aktualn\w*|wazn\w*)\b/i.test(normalized);

  out.push(...detectDrivingCategories(segment));

  const formal = canonicalFormalEntity(segment.text);
  if (formal) {
    out.push({
      ...formal,
      sourceSpan: absoluteSpan(segment),
      specificity: formal.canonicalId.includes('.generic.') ? 0.7 : 1,
      languageLevel: formal.kind === 'LANGUAGE' ? (parseCefrLevel(segment.text) ?? undefined) : undefined,
      validityRequired,
    });
  }

  const language = canonicalLanguage(segment.text);
  if (language) {
    out.push({
      canonicalId: `language.${language}`,
      kind: 'LANGUAGE',
      label: language,
      sourceSpan: absoluteSpan(segment),
      specificity: 0.95,
      languageLevel: parseCefrLevel(segment.text) ?? undefined,
    });
  }

  const education = parseEducationLevel(segment.text);
  if (education) {
    out.push({
      canonicalId: `education.${education.toLowerCase()}`,
      kind: 'EDUCATION',
      label: education,
      sourceSpan: absoluteSpan(segment),
      specificity: 0.9,
      educationLevel: education,
      fieldConstraint: extractEducationFieldConstraint(segment.text),
    });
  }

  // Prefix listy (np. "Certyfikaty:") jest tylko hintem. Nie wolno mu
  // przepisywać segmentu na certyfikat, jeżeli równoległy detektor znalazł
  // w nim już konkretną encję innego typu, np. język angielski C1.
  if (segment.contextHint === 'CERTIFICATION' && out.length === 0) {
    out.push({
      canonicalId: genericCredentialCanonicalId(segment.text, 'CERTIFICATION'),
      kind: 'CERTIFICATION',
      label: segment.text.trim(),
      sourceSpan: absoluteSpan(segment),
      specificity: 0.65,
      validityRequired,
    });
  }

  if (segment.contextHint === 'LICENSE' && out.length === 0) {
    out.push({
      canonicalId: genericCredentialCanonicalId(segment.text, 'LICENSE'),
      kind: 'LICENSE',
      label: segment.text.trim(),
      sourceSpan: absoluteSpan(segment),
      specificity: 0.65,
      validityRequired,
    });
  }

  return dedupeDetected(out);
}
