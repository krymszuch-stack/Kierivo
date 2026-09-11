import type { MasterVault } from '../../../types';
import type { Evidence } from '../contracts';
import { buildEvidenceId } from '../hash';
import {
  canonicalFormalEntity,
  canonicalLanguage,
  genericCredentialCanonicalId,
  normalizeFormalTerm,
  parseCefrLevel,
  parseEducationLevel,
} from './taxonomy';
import type {
  D10CandidateEvidence,
  D10CandidateSource,
  D10FormalRequirementKind,
} from './types';

const SCHEMA_VERSION = 'D10.candidate-evidence.v1';

async function makeEvidence(
  source: 'VAULT' | 'CV',
  jsonPath: string,
  label: string,
  canonicalId: string,
  kind: D10FormalRequirementKind,
  extractionConfidence: number,
  candidateSource: D10CandidateSource,
): Promise<Evidence> {
  const id = await buildEvidenceId(
    SCHEMA_VERSION,
    source,
    jsonPath,
    { canonicalId, kind, label, candidateSource },
    source === 'VAULT' ? 'USER_ASSERTED_CANONICAL' : 'EXPLICIT_DOCUMENT_FACT',
  );
  return {
    id,
    provenance: source === 'VAULT' ? 'USER_ASSERTED_CANONICAL' : 'EXPLICIT_DOCUMENT_FACT',
    pointer: { source, jsonPath },
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
  const lines = rawText.normalize('NFKC').replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const entities: Array<{
      canonicalId: string;
      kind: D10FormalRequirementKind;
      label: string;
      languageLevel?: D10CandidateEvidence['languageLevel'];
      educationLevel?: D10CandidateEvidence['educationLevel'];
      fieldOfStudy?: string | null;
    }> = [];

    const formal = canonicalFormalEntity(line);
    if (formal) {
      entities.push({
        ...formal,
        languageLevel: formal.kind === 'LANGUAGE' ? (parseCefrLevel(line) ?? undefined) : undefined,
      });
    }

    const language = canonicalLanguage(line);
    if (language && !entities.some((item) => item.canonicalId === `language.${language}`)) {
      entities.push({
        canonicalId: `language.${language}`,
        kind: 'LANGUAGE',
        label: language,
        languageLevel: parseCefrLevel(line) ?? undefined,
      });
    }

    const education = parseEducationLevel(line);
    if (education) {
      entities.push({
        canonicalId: `education.${education.toLowerCase()}`,
        kind: 'EDUCATION',
        label: education,
        educationLevel: education,
        fieldOfStudy: line,
      });
    }

    for (const entity of entities) {
      const key = `${entity.kind}:${entity.canonicalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const evidence = await makeEvidence(
        'CV',
        `document.lines[${index}]`,
        line,
        entity.canonicalId,
        entity.kind,
        extractionConfidence,
        'DOCUMENT_EXPLICIT',
      );
      out.push({
        id: `D10_CAND_DOC_${index}_${out.length}`,
        kind: entity.kind,
        label: entity.label,
        canonicalId: entity.canonicalId,
        source: 'DOCUMENT_EXPLICIT',
        extractionConfidence,
        languageLevel: entity.languageLevel,
        educationLevel: entity.educationLevel,
        fieldOfStudy: entity.fieldOfStudy,
        evidence,
      });
    }
  }

  return out;
}
