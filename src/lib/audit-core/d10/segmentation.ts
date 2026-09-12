import { normalizeFormalTerm } from './taxonomy';
import type { D10FormalRequirementKind, D10RequirementGroupOperator, D10SourceSpan } from './types';

export type D10SegmentConnector = D10RequirementGroupOperator | 'SEPARATOR' | null;

export interface D10FormalLineSegment {
  text: string;
  span: D10SourceSpan;
  connectorBefore: D10SegmentConnector;
  contextHint: D10FormalRequirementKind | null;
}

const PREFIX_HINTS: Array<{ pattern: RegExp; kind: D10FormalRequirementKind }> = [
  { pattern: /^(certyfikaty?|certyfikacje?|certifications?|certificates?)$/, kind: 'CERTIFICATION' },
  { pattern: /^(jezyki?|languages?)$/, kind: 'LANGUAGE' },
  { pattern: /^(licencje?|uprawnienia|licenses?|licences?)$/, kind: 'LICENSE' },
  { pattern: /^(prawo jazdy|driving licen[cs]e)$/, kind: 'DRIVING_LICENSE' },
  { pattern: /^(wyksztalcenie|education|degree)$/, kind: 'EDUCATION' },
  { pattern: /^(clearance|security clearance|poswiadczenie bezpieczenstwa)$/, kind: 'CLEARANCE' },
];

function contextHintFromPrefix(line: string): { start: number; kind: D10FormalRequirementKind | null } {
  const colon = line.indexOf(':');
  if (colon < 0) return { start: 0, kind: null };
  const prefix = normalizeFormalTerm(line.slice(0, colon));
  const hit = PREFIX_HINTS.find((item) => item.pattern.test(prefix));
  return hit ? { start: colon + 1, kind: hit.kind } : { start: 0, kind: null };
}

function connectorFromToken(token: string): D10SegmentConnector {
  const normalized = normalizeFormalTerm(token);
  if (/^(lub|albo|or)$/.test(normalized) || token.trim() === '/') return 'ANY_OF';
  if (/^(oraz|i|and)$/.test(normalized) || token.trim() === '&') return 'ALL_OF';
  return 'SEPARATOR';
}

/**
 * Dzieli jedną linię na logiczne fragmenty bez utraty offsetów źródłowych.
 * Przecinek i średnik są separatorami listy, nie tworzą relacji logicznej.
 * Jawne spójniki `lub/or` i `i/oraz/and` zachowujemy jako relacje.
 */
export function segmentD10FormalLine(line: string): D10FormalLineSegment[] {
  const { start: contentStart, kind: contextHint } = contextHintFromPrefix(line);
  const content = line.slice(contentStart);
  const separator = /\s+(lub|albo|or|oraz|i|and)\s+|\s*&\s*|\s+\/\s+|[;,]/gi;
  const segments: D10FormalLineSegment[] = [];
  let segmentStart = 0;
  let connectorBefore: D10SegmentConnector = null;
  let match: RegExpExecArray | null;

  const push = (localStart: number, localEnd: number, connector: D10SegmentConnector): void => {
    const raw = content.slice(localStart, localEnd);
    const leading = raw.match(/^\s*/)?.[0].length ?? 0;
    const trailing = raw.match(/\s*$/)?.[0].length ?? 0;
    const start = contentStart + localStart + leading;
    const end = contentStart + localEnd - trailing;
    if (end <= start) return;
    segments.push({
      text: line.slice(start, end),
      span: { start, end },
      connectorBefore: connector,
      contextHint,
    });
  };

  while ((match = separator.exec(content)) !== null) {
    push(segmentStart, match.index, connectorBefore);
    connectorBefore = connectorFromToken(match[0]);
    segmentStart = match.index + match[0].length;
  }
  push(segmentStart, content.length, connectorBefore);

  return segments.length > 0
    ? segments
    : [{
      text: line.trim(),
      span: { start: line.indexOf(line.trim()), end: line.indexOf(line.trim()) + line.trim().length },
      connectorBefore: null,
      contextHint,
    }];
}
