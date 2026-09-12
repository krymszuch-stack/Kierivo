import type { MasterVault, TailoredResume } from '../../../types';
import { buildEvidenceId } from '../hash';
import type { Evidence } from '../contracts';
import {
  computeD08TokenAgreement,
  computeD08WeightedOrderStats,
  normalizeD08Text,
} from './extractor';
import type { D08Signals } from './types';

const D08_SOURCE_SCHEMA_VERSION = 'D08.source.v1';

export interface D08SourceBlock {
  id: string;
  text: string;
  importance: number;
}

export interface D08DocumentReference {
  blocks: D08SourceBlock[];
  fullText: string;
}

const clean = (value: string | undefined | null): string => (value ?? '').trim();

const pushBlock = (
  blocks: D08SourceBlock[],
  id: string,
  text: string | undefined | null,
  importance = 1,
): void => {
  const normalized = clean(text);
  if (!normalized) return;
  blocks.push({ id, text: normalized, importance });
};

/**
 * Referencja odpowiada kolejności aktualnego `DocumentRenderer`. Nie jest
 * ogólnym modelem idealnego CV. Jej jedynym celem jest sprawdzenie, czy eksport
 * zachował to, co CVelocity faktycznie próbowało wyrenderować.
 */
export function buildD08DocumentReference(
  vault: MasterVault,
  tailoredResume?: TailoredResume | null,
): D08DocumentReference {
  const blocks: D08SourceBlock[] = [];
  const personal = vault.personalInfo;

  pushBlock(blocks, 'header.fullName', personal.fullName, 2);
  pushBlock(
    blocks,
    'header.title',
    tailoredResume?.targetJobTitle || personal.title,
    1.5,
  );

  pushBlock(blocks, 'contact.email', personal.email, 1);
  pushBlock(blocks, 'contact.phone', personal.phone, 1);
  pushBlock(blocks, 'contact.location', personal.location, 0.8);
  pushBlock(blocks, 'contact.linkedin', personal.linkedin, 0.5);
  pushBlock(blocks, 'contact.github', personal.github, 0.5);

  pushBlock(blocks, 'section.summary', 'Podsumowanie Zawodowe', 2);
  pushBlock(
    blocks,
    'summary.text',
    tailoredResume?.summary || personal.summary || 'Brak podsumowania zawodowego.',
    2,
  );

  pushBlock(blocks, 'section.skills', 'Kluczowe Umiejętności & Narzędzia', 2);
  vault.skillsMatrix?.hardSkills?.forEach((skill, index) => {
    pushBlock(blocks, `skills.${index}`, skill, 0.6);
  });

  pushBlock(blocks, 'section.experience', 'Doświadczenie Zawodowe', 2.5);
  (vault.history ?? []).forEach((experience, index) => {
    pushBlock(blocks, `experience.${index}.role`, experience.role, 1.5);
    pushBlock(blocks, `experience.${index}.company`, experience.company, 1.5);
    pushBlock(blocks, `experience.${index}.startDate`, experience.startDate, 0.6);
    pushBlock(
      blocks,
      `experience.${index}.endDate`,
      experience.isCurrent ? 'Obecnie' : experience.endDate,
      0.6,
    );
    pushBlock(blocks, `experience.${index}.description`, experience.description, 1);
    (experience.highlights ?? []).forEach((highlight, highlightIndex) => {
      pushBlock(
        blocks,
        `experience.${index}.highlight.${highlightIndex}`,
        highlight.text,
        1.3,
      );
    });
  });

  if ((vault.education ?? []).length > 0) {
    pushBlock(blocks, 'section.education', 'Edukacja & Wykształcenie', 2);
    vault.education.forEach((education, index) => {
      pushBlock(blocks, `education.${index}.degree`, education.degree, 1);
      pushBlock(blocks, `education.${index}.field`, education.fieldOfStudy, 0.8);
      pushBlock(blocks, `education.${index}.institution`, education.institution, 1);
      pushBlock(blocks, `education.${index}.startDate`, education.startDate, 0.5);
      pushBlock(blocks, `education.${index}.endDate`, education.endDate, 0.5);
    });
  }

  pushBlock(
    blocks,
    'footer.rodo',
    'Wyrażam zgodę na przetwarzanie moich danych osobowych dla potrzeb niezbędnych do realizacji procesu rekrutacji zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).',
    0.5,
  );

  return {
    blocks,
    fullText: blocks.map((block) => block.text).join('\n'),
  };
}

const searchable = (text: string): string =>
  normalizeD08Text(text)
    .toLocaleLowerCase('pl-PL')
    .replace(/\s+/g, ' ')
    .trim();

interface LocatedBlock {
  block: D08SourceBlock;
  position: number;
}

export function locateD08SourceBlocks(
  reference: D08DocumentReference,
  extractedText: string,
): {
  located: LocatedBlock[];
  coverage: number;
} {
  const haystack = searchable(extractedText);
  const located: LocatedBlock[] = [];
  let totalImportance = 0;
  let matchedImportance = 0;

  for (const block of reference.blocks) {
    const needle = searchable(block.text);
    if (needle.length < 3) continue;
    totalImportance += block.importance;
    const position = haystack.indexOf(needle);
    if (position < 0) continue;
    matchedImportance += block.importance;
    located.push({ block, position });
  }

  return {
    located,
    coverage: totalImportance > 0 ? matchedImportance / totalImportance : 0,
  };
}

export async function applyD08SourceReference(
  rawSignals: D08Signals,
  reference: D08DocumentReference,
  extractedText: string,
): Promise<D08Signals> {
  const signals = structuredClone(rawSignals);
  const tokenAgreement = computeD08TokenAgreement(reference.fullText, extractedText);
  const { located, coverage } = locateD08SourceBlocks(reference, extractedText);

  const expectedLocatedOrder = reference.blocks
    .filter((block) => located.some((locatedBlock) => locatedBlock.block.id === block.id))
    .map((block) => block.id);
  const extractedLocatedOrder = [...located]
    .sort((a, b) => a.position - b.position)
    .map((locatedBlock) => locatedBlock.block.id);
  const importanceById = new Map(reference.blocks.map((block) => [block.id, block.importance]));
  const orderStats = computeD08WeightedOrderStats(
    expectedLocatedOrder,
    extractedLocatedOrder,
    (beforeId, afterId) => Math.max(
      0.1,
      Math.min(importanceById.get(beforeId) ?? 1, importanceById.get(afterId) ?? 1),
    ),
  );

  const evidenceId = await buildEvidenceId(
    D08_SOURCE_SCHEMA_VERSION,
    'CV',
    'sourceReference.comparison',
    {
      precision: tokenAgreement.precision,
      recall: tokenAgreement.recall,
      f1: tokenAgreement.f1,
      blockCoverage: coverage,
      discordance: orderStats.discordance,
      locatedBlocks: located.length,
      expectedBlocks: reference.blocks.length,
    },
    'CROSS_SOURCE_CONSISTENT',
  );

  const evidence: Evidence = {
    id: evidenceId,
    provenance: 'CROSS_SOURCE_CONSISTENT',
    pointer: { source: 'CV', jsonPath: 'sourceReference.comparison' },
    description: 'Porównano oczekiwaną treść renderera CVelocity z faktycznie wyekstrahowanym dokumentem.',
    normalizedPayload: {
      precision: tokenAgreement.precision,
      recall: tokenAgreement.recall,
      f1: tokenAgreement.f1,
      blockCoverage: coverage,
      discordance: orderStats.discordance,
    },
    extractionConfidence: Math.min(1, 0.85 + 0.15 * coverage),
  };

  signals.referenceProfile = 'SOURCE_AWARE';
  signals.textLayer = {
    applicable: true,
    sourceTokenCount: tokenAgreement.sourceTokenCount,
    extractedTokenCount: tokenAgreement.extractedTokenCount,
    matchedTokenCount: tokenAgreement.matchedTokenCount,
    evidenceIds: [...signals.textLayer.evidenceIds, evidenceId],
  };
  signals.readingOrder = {
    comparablePairWeight: orderStats.comparablePairWeight,
    discordantPairWeight: orderStats.discordantPairWeight,
    measurementConfidence: coverage,
    evidenceIds: [...signals.readingOrder.evidenceIds, evidenceId],
  };

  // Cross-source comparison wzmacnia provenance i coverage, ale nie może
  // przykryć słabej jakości samej ekstrakcji PDF.
  signals.confidenceInput.provenanceReliability = Math.max(
    signals.confidenceInput.provenanceReliability,
    0.90 * coverage,
  );
  signals.confidenceInput.fulfilledEvidenceWeight = Math.min(
    signals.confidenceInput.expectedEvidenceWeight,
    Math.max(signals.confidenceInput.fulfilledEvidenceWeight, coverage),
  );
  signals.confidenceInput.independentEvidenceCount += 2;
  signals.evidence = [...signals.evidence, evidence];

  return signals;
}
