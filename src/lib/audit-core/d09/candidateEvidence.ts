import type { MasterVault } from '../../../types';
import type { CanonicalDocumentBlock, CanonicalDocumentRepresentation } from '../document';
import { buildEvidenceId } from '../hash';
import type { Evidence, EvidenceProvenance } from '../contracts';
import {
  canonicalizeD09Term,
  findD09EntitiesInText,
  getD09OntologyEntity,
} from './ontology';
import type { D09CandidateEvidence, D09CandidateSource } from './types';

const SCHEMA_VERSION = 'D09.candidate-evidence.v1';

interface CandidateEvidenceSeed {
  canonicalId: string;
  label: string;
  source: D09CandidateSource;
  sourceLabel: string;
  sourcePath: string;
  evidenceDepth: number;
  extractionConfidence: number;
  provenance: EvidenceProvenance;
  snippet?: string;
}

async function buildCandidateEvidence(seed: CandidateEvidenceSeed): Promise<D09CandidateEvidence> {
  const auditEvidenceId = await buildEvidenceId(
    SCHEMA_VERSION,
    seed.source.startsWith('VAULT_') ? 'VAULT' : 'CV',
    seed.sourcePath,
    {
      canonicalId: seed.canonicalId,
      source: seed.source,
      evidenceDepth: seed.evidenceDepth,
      sourceLabel: seed.sourceLabel,
    },
    seed.provenance,
  );

  const evidence: Evidence = {
    id: auditEvidenceId,
    provenance: seed.provenance,
    pointer: {
      source: seed.source.startsWith('VAULT_') ? 'VAULT' : 'CV',
      jsonPath: seed.sourcePath,
    },
    description: `${seed.label}: dowód z ${seed.sourceLabel}.`,
    redactedSnippet: seed.snippet?.slice(0, 220),
    normalizedPayload: {
      canonicalId: seed.canonicalId,
      evidenceDepth: seed.evidenceDepth,
      candidateSource: seed.source,
    },
    extractionConfidence: seed.extractionConfidence,
    correlationKey: `D09:CANDIDATE:${seed.canonicalId}:${seed.sourcePath}`,
    evidenceImportance: Math.max(0.1, Math.min(1, seed.evidenceDepth)),
    signalFamily: 'SKILL_CONTEXT',
  };

  return {
    id: `CAND_${auditEvidenceId}`,
    canonicalId: seed.canonicalId,
    label: seed.label,
    source: seed.source,
    sourceLabel: seed.sourceLabel,
    evidenceDepth: seed.evidenceDepth,
    extractionConfidence: seed.extractionConfidence,
    evidence,
  };
}

function uniqueSeeds(seeds: CandidateEvidenceSeed[]): CandidateEvidenceSeed[] {
  const seen = new Set<string>();
  return seeds.filter((seed) => {
    const key = `${seed.canonicalId}|${seed.source}|${seed.sourcePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pushTermSeed(
  seeds: CandidateEvidenceSeed[],
  term: string,
  seedBase: Omit<CandidateEvidenceSeed, 'canonicalId' | 'label'>,
): void {
  const entity = canonicalizeD09Term(term);
  if (!entity) return;
  seeds.push({ ...seedBase, canonicalId: entity.id, label: entity.label });
}

function pushTextSeeds(
  seeds: CandidateEvidenceSeed[],
  text: string | undefined,
  seedBase: Omit<CandidateEvidenceSeed, 'canonicalId' | 'label' | 'snippet'>,
): void {
  if (!text?.trim()) return;
  for (const entity of findD09EntitiesInText(text)) {
    seeds.push({
      ...seedBase,
      canonicalId: entity.id,
      label: entity.label,
      snippet: text,
    });
  }
}

export async function buildD09CandidateEvidenceFromVault(vault: MasterVault): Promise<D09CandidateEvidence[]> {
  const seeds: CandidateEvidenceSeed[] = [];

  vault.skillsMatrix?.hardSkills?.forEach((term, index) => {
    pushTermSeed(seeds, term, {
      source: 'VAULT_SKILL',
      sourceLabel: 'Master Vault / hard skills',
      sourcePath: `skillsMatrix.hardSkills[${index}]`,
      evidenceDepth: 0.35,
      extractionConfidence: 1,
      provenance: 'USER_ASSERTED_CANONICAL',
      snippet: term,
    });
  });
  vault.skillsMatrix?.toolsAndTech?.forEach((term, index) => {
    pushTermSeed(seeds, term, {
      source: 'VAULT_SKILL',
      sourceLabel: 'Master Vault / tools & tech',
      sourcePath: `skillsMatrix.toolsAndTech[${index}]`,
      evidenceDepth: 0.35,
      extractionConfidence: 1,
      provenance: 'USER_ASSERTED_CANONICAL',
      snippet: term,
    });
  });
  vault.skillsMatrix?.softSkills?.forEach((term, index) => {
    pushTermSeed(seeds, term, {
      source: 'VAULT_SKILL',
      sourceLabel: 'Master Vault / soft skills',
      sourcePath: `skillsMatrix.softSkills[${index}]`,
      evidenceDepth: 0.30,
      extractionConfidence: 1,
      provenance: 'USER_ASSERTED_CANONICAL',
      snippet: term,
    });
  });

  pushTextSeeds(seeds, vault.personalInfo?.summary, {
    source: 'VAULT_SUMMARY',
    sourceLabel: 'Master Vault / summary',
    sourcePath: 'personalInfo.summary',
    evidenceDepth: 0.45,
    extractionConfidence: 1,
    provenance: 'USER_ASSERTED_CANONICAL',
  });

  (vault.projects ?? []).forEach((project, projectIndex) => {
    project.techStack?.forEach((term, techIndex) => {
      pushTermSeed(seeds, term, {
        source: 'VAULT_PROJECT',
        sourceLabel: `Projekt: ${project.name}`,
        sourcePath: `projects[${projectIndex}].techStack[${techIndex}]`,
        evidenceDepth: 0.78,
        extractionConfidence: 1,
        provenance: 'USER_ASSERTED_CANONICAL',
        snippet: term,
      });
    });
    pushTextSeeds(seeds, project.description, {
      source: 'VAULT_PROJECT',
      sourceLabel: `Projekt: ${project.name}`,
      sourcePath: `projects[${projectIndex}].description`,
      evidenceDepth: 0.75,
      extractionConfidence: 1,
      provenance: 'USER_ASSERTED_CANONICAL',
    });
  });

  (vault.history ?? []).forEach((experience, experienceIndex) => {
    pushTextSeeds(seeds, experience.description, {
      source: 'VAULT_EXPERIENCE',
      sourceLabel: `Doświadczenie: ${experience.company} (${experience.role})`,
      sourcePath: `history[${experienceIndex}].description`,
      evidenceDepth: 0.90,
      extractionConfidence: 1,
      provenance: 'USER_ASSERTED_CANONICAL',
    });

    experience.highlights?.forEach((highlight, highlightIndex) => {
      highlight.keywords?.forEach((term, keywordIndex) => {
        pushTermSeed(seeds, term, {
          source: 'VAULT_EXPERIENCE',
          sourceLabel: `Doświadczenie: ${experience.company} (${experience.role})`,
          sourcePath: `history[${experienceIndex}].highlights[${highlightIndex}].keywords[${keywordIndex}]`,
          evidenceDepth: 0.98,
          extractionConfidence: 1,
          provenance: 'USER_ASSERTED_CANONICAL',
          snippet: highlight.text,
        });
      });
      pushTextSeeds(seeds, highlight.text, {
        source: 'VAULT_EXPERIENCE',
        sourceLabel: `Doświadczenie: ${experience.company} (${experience.role})`,
        sourcePath: `history[${experienceIndex}].highlights[${highlightIndex}].text`,
        evidenceDepth: 0.98,
        extractionConfidence: 1,
        provenance: 'USER_ASSERTED_CANONICAL',
      });
    });
  });

  return Promise.all(uniqueSeeds(seeds).map(buildCandidateEvidence));
}

function sourceForBlock(block: CanonicalDocumentBlock): { source: D09CandidateSource; depth: number } {
  switch (block.section) {
    case 'EXPERIENCE': return { source: 'DOCUMENT_EXPERIENCE', depth: 0.90 };
    case 'PROJECTS': return { source: 'DOCUMENT_PROJECT', depth: 0.75 };
    case 'SUMMARY': return { source: 'DOCUMENT_SUMMARY', depth: 0.45 };
    case 'SKILLS': return { source: 'DOCUMENT_SKILLS', depth: 0.35 };
    default: return { source: 'DOCUMENT_UNKNOWN', depth: 0.25 };
  }
}

export async function buildD09CandidateEvidenceFromDocument(
  document: CanonicalDocumentRepresentation,
): Promise<D09CandidateEvidence[]> {
  const seeds: CandidateEvidenceSeed[] = [];
  for (const block of document.blocks) {
    const mappedSource = sourceForBlock(block);
    for (const entity of findD09EntitiesInText(block.text)) {
      seeds.push({
        canonicalId: entity.id,
        label: entity.label,
        source: mappedSource.source,
        sourceLabel: `${block.section}: ${block.id}`,
        sourcePath: block.sourcePath,
        evidenceDepth: mappedSource.depth,
        extractionConfidence: block.extractionConfidence,
        provenance: 'EXPLICIT_DOCUMENT_FACT',
        snippet: block.text,
      });
    }
  }
  return Promise.all(uniqueSeeds(seeds).map(buildCandidateEvidence));
}

/**
 * Adapter dla przyszłego semantic/NLI layer. Model może zaproponować np.
 * "obsługa sieci 16 000 detalistów" -> Key Account Management, ale nie może
 * udawać faktu kanonicznego: provenance pozostaje INFERRED_HEURISTIC i
 * confidence jest jawne.
 */
export async function createD09SemanticInferenceEvidence(input: {
  canonicalId: string;
  sourcePath: string;
  sourceLabel: string;
  rationale: string;
  inferenceConfidence: number;
  evidenceDepth?: number;
}): Promise<D09CandidateEvidence> {
  const entity = getD09OntologyEntity(input.canonicalId);
  if (!entity) throw new Error(`Nieznana encja D09: ${input.canonicalId}`);
  return buildCandidateEvidence({
    canonicalId: entity.id,
    label: entity.label,
    source: 'INFERRED_SEMANTIC',
    sourceLabel: input.sourceLabel,
    sourcePath: input.sourcePath,
    evidenceDepth: Math.min(0.90, Math.max(0.20, input.evidenceDepth ?? 0.75)),
    extractionConfidence: Math.min(1, Math.max(0, input.inferenceConfidence)),
    provenance: 'INFERRED_HEURISTIC',
    snippet: input.rationale,
  });
}
