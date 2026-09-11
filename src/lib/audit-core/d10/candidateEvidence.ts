import type { MasterVault } from '../../../types';
import type { Evidence } from '../contracts';
import { buildEvidenceId } from '../hash';
import { detectD10Entities } from './detectors';
import { segmentD10FormalLine } from './segmentation';
import {
  canonicalFormalEntity,
  canonicalLanguage,
  genericCredentialCanonicalId,
  normalizeFormalTerm,
  parseEducationLevel,
} from './taxonomy';
import type {
  D10CandidateEvidence,
  D10CandidateSource,
  D10FormalRequirementKind,
  D10SourceSpan,
} from './types';

const SCHEMA_VERSION = 'D10.candidate-evidence.v2';

async function makeEvidence(
  source: 'VAULT' | 'CV',
  jsonPath: string,
  label: string,
  canonicalId: string,
  kind: D10FormalRequirementKind,
  extractionConfidence: number,
  candidateSource: D10CandidateSource,
  sourceSpan?: D10SourceSpan,
): Promise<Evidence> {
  const id = await buildEvidenceId(
    SCHEMA_VERSION,
    source,
    jsonPath,
    {
      canonicalId,
      kind,
      label,
      candidateSource,
      charStart: sourceSpan?.start ?? null,
      charEnd: sourceSpan?.end ?? null,
    },
    source === 'VAULT' ? 'USER_ASSERTED_CANONICAL' : 'EXPLICIT_DOCUMENT_FACT',
  );
  return {
    id,
    provenance: source === 'VAULT' ? 'USER_ASSERTED_CANONICAL' : 'EXPLICIT_DOCUMENT_FACT',
    pointer: {
      source,
      jsonPath,
      charStart: sourceSpan?.start,
      charEnd: sourceSpan?.end,
    },
    description: `Dowód formalny kandydata: ${label}.`,
    redactedSnippet: source === 'CV' ? label.slice(0, 180) : undefined,
    normalizedPayload: { canonicalId, kind, candidateSource },
    extractionConfidence,
    correlationKey: `D10:CANDIDATE:${canonicalId}`,
    evidenceImportance: 1,
    signalFamily: 'FORMAL_REQUIREMENT',
  };
}

export async function buildD10CandidateEvidenceFromVault(
  vault: MasterVault | Partial<MasterVault>,
): Promise<D10CandidateEvidence[]> {
  const out: D10CandidateEvidence[] = [];

  for (let index = 0; index < (vault.profiler?.languages ?? []).length; index += 1) {
    const item = vault.profiler!.languages[index];
    const language = canonicalLanguage(item.language) ?? normalizeFormalTerm(item.language).replace(/\s+/g, '-');
    const canonicalId = `language.${language}`;
    const evidence = await makeEvidence(
      'VAULT',
      `profiler.languages[${index}]`,
      `${item.language} ${item.level}`,
      canonicalId,
      'LANGUAGE',
      1,
      'VAULT_LANGUAGE',
    );
    out.push({
      id: `D10_CAND_LANG_${index}`,
      kind: 'LANGUAGE',
      label: item.language,
      canonicalId,
      source: 'VAULT_LANGUAGE',
      extractionConfidence: 1,
      languageLevel: item.level === 'Native' ? 'NATIVE' : item.level,
      evidence,
    });
  }

  for (let index = 0; index < (vault.profiler?.licenses ?? []).length; index += 1) {
    const label = vault.profiler!.licenses![index];
    const entity = canonicalFormalEntity(label);
    const canonicalId = entity?.canonicalId ?? genericCredentialCanonicalId(label, 'LICENSE');
    const kind = entity?.kind ?? 'LICENSE';
    const evidence = await makeEvidence(
      'VAULT',
      `profiler.licenses[${index}]`,
      label,
      canonicalId,
      kind,
      1,
      'VAULT_LICENSE',
    );
    out.push({
      id: `D10_CAND_LICENSE_${index}`,
      kind,
      label,
      canonicalId,
      source: 'VAULT_LICENSE',
      extractionConfidence: 1,
      evidence,
    });
  }

  for (let index = 0; index < (vault.skillsMatrix?.certifications ?? []).length; index += 1) {
    const certification = vault.skillsMatrix!.certifications[index];
    const entity = canonicalFormalEntity(certification.name);
    const canonicalId = entity?.canonicalId ?? genericCredentialCanonicalId(certification.name, 'CERTIFICATION');
    const kind = entity?.kind === 'LICENSE' ? 'LICENSE' : 'CERTIFICATION';
    const evidence = await makeEvidence(
      'VAULT',
      `skillsMatrix.certifications[${index}]`,
      certification.name,
      canonicalId,
      kind,
      1,
      'VAULT_CERTIFICATION',
    );
    out.push({
      id: `D10_CAND_CERT_${index}`,
      kind,
      label: certification.name,
      canonicalId,
      source: 'VAULT_CERTIFICATION',
      extractionConfidence: 1,
      issuer: certification.issuer || null,
      issuedAt: certification.date || null,
      evidence,
    });
  }

  for (let index = 0; index < (vault.education ?? []).length; index += 1) {
    const education = vault.education![index];
    const level = parseEducationLevel(`${education.degree} ${education.description ?? ''}`);
    if (!level) continue;
    const canonicalId = `education.${level.toLowerCase()}`;
    const evidence = await makeEvidence(
      'VAULT',
      `education[${index}]`,
      `${education.degree} ${education.fieldOfStudy}`.trim(),
      canonicalId,
      'EDUCATION',
      1,
      'VAULT_EDUCATION',
    );
    out.push({
      id: `D10_CAND_EDU_${index}`,
      kind: 'EDUCATION',
      label: education.degree,
      canonicalId,
      source: 'VAULT_EDUCATION',
      extractionConfidence: 1,
      educationLevel: level,
      fieldOfStudy: education.fieldOfStudy || null,
      evidence,
    });
  }

  return out;
}

export async function buildD10CandidateEvidenceFromText(
  rawText: string,
  extractionConfidence: number,
): Promise<D10CandidateEvidence[]> {
  const out: D10CandidateEvidence[] = [];
  const seen = new Set<string>();
  const lines = rawText
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const segments = segmentD10FormalLine(line);

    for (const segment of segments) {
      const entities = detectD10Entities(segment);
      for (const entity of entities) {
        const key = `${entity.kind}:${entity.canonicalId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const snippet = line.slice(entity.sourceSpan.start, entity.sourceSpan.end);
        const evidence = await makeEvidence(
          'CV',
          `document.lines[${index}]`,
          snippet || entity.label,
          entity.canonicalId,
          entity.kind,
          extractionConfidence,
          'DOCUMENT_EXPLICIT',
          entity.sourceSpan,
        );
        out.push({
          id: `D10_CAND_DOC_${index}_${out.length}`,
          kind: entity.kind,
          label: entity.label,
          canonicalId: entity.canonicalId,
          source: 'DOCUMENT_EXPLICIT',
          extractionConfidence,
          sourceSpan: entity.sourceSpan,
          languageLevel: entity.languageLevel,
          educationLevel: entity.educationLevel,
          fieldOfStudy: entity.kind === 'EDUCATION' ? segment.text : undefined,
          evidence,
        });
      }
    }
  }

  return out;
}
