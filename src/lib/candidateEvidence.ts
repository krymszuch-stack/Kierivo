import type { MasterVault } from '../types';
import { ALL_LICENSES } from '../data/licenses';
import { containsPhrase, hasPositiveSkillEvidence } from './skillEvidence';

export interface CandidateSkillEvidenceEntry {
  text: string;
  sourceLabel?: string;
}

function sourceLabel(name?: string, role?: string): string | undefined {
  return [name?.trim(), role?.trim() ? `(${role.trim()})` : ''].filter(Boolean).join(' ') || undefined;
}

export function isSupportedSkillAnnotation(text: string, annotation: string): boolean {
  return !containsPhrase(text, annotation) || hasPositiveSkillEvidence(text, annotation);
}

function evidenceWithAnnotations(text: string, annotations: readonly string[]): string {
  // Tag wyciągnięty z zaprzeczonego zdania nie może po kropce stać się nową
  // deklaracją. Niezależny pozytywny wpis o tej umiejętności nadal jest dowodem.
  const safeAnnotations = annotations.filter(annotation => isSupportedSkillAnnotation(text, annotation));
  return [text, ...safeAnnotations].filter(Boolean).join('\n');
}

/** Wpisy zachowują kontekst negacji i źródło; etykiety firm nie są kompetencją. */
export function buildCandidateSkillEvidenceEntries(vault: MasterVault): CandidateSkillEvidenceEntry[] {
  return [
    { text: vault.personalInfo?.summary || '' },
    ...(vault.skillsMatrix?.hardSkills ?? []).map(text => ({ text })),
    ...(vault.skillsMatrix?.toolsAndTech ?? []).map(text => ({ text })),
    ...(vault.skillsMatrix?.softSkills ?? []).map(text => ({ text })),
    ...(vault.skillsMatrix?.certifications ?? []).map(certification => ({ text: certification?.name || '' })),
    ...(vault.profiler?.licenses ?? []).map(id => ({ text: getLicenseEvidenceLabel(id) })),
    ...(vault.profiler?.languages ?? []).map(language => ({ text: `${language?.language || ''} ${language?.level || ''}` })),
    ...(vault.history ?? []).flatMap(job => [
      { text: job?.description || '', sourceLabel: sourceLabel(job?.company, job?.role) },
      ...(job?.highlights ?? []).map(highlight => ({
        text: typeof highlight === 'string' ? highlight : evidenceWithAnnotations(highlight?.text || '', [highlight?.tool || '', ...(highlight?.keywords ?? [])].filter(Boolean)),
        sourceLabel: sourceLabel(job?.company, job?.role),
      })),
    ]),
    ...(vault.projects ?? []).map(project => ({
      text: evidenceWithAnnotations(project?.description || '', project?.techStack ?? []),
      sourceLabel: sourceLabel(project?.name, project?.role),
    })),
  ].filter(entry => entry.text.trim());
}

export interface CandidateEvidenceCorpora {
  /** Tresci potwierdzajace umiejetnosci; bez naglowkow i etykiet metadanych. */
  skills: string;
  /** Narracja zawodowa do miar jezykowych; bez list, nazw technologii i etykiet. */
  narrative: string;
  /** Dowody formalne uzupelnione o typowane pola wyksztalcenia. */
  formal: string;
}

export function getLicenseEvidenceLabel(licenseId: string): string {
  return ALL_LICENSES.find((license) => license.id === licenseId)?.label ?? licenseId;
}

/** Jedno zrodlo prawdy dla tekstu kandydata uzywanego w porownaniu wymagan. */
export function buildCandidateEvidenceCorpora(vault: MasterVault): CandidateEvidenceCorpora {
  const formalEvidence = [
    vault.personalInfo?.summary || '',
    ...(vault.skillsMatrix?.certifications ?? []).flatMap((certification) => [
      certification?.name || '',
      certification?.issuer || '',
    ]),
    ...(vault.profiler?.licenses ?? []).map(getLicenseEvidenceLabel),
    ...(vault.profiler?.languages ?? []).map((language) => `${language?.language || ''} ${language?.level || ''}`),
    ...(vault.history ?? []).flatMap((job) => [
      job?.description || '',
      ...(job?.highlights ?? []).map((highlight) =>
        typeof highlight === 'string' ? highlight : highlight?.text || ''
      ),
    ]),
    ...(vault.projects ?? []).map((project) => project?.description || ''),
    ...(vault.education ?? []).flatMap((education) => [
      education?.degree || '',
      education?.fieldOfStudy || '',
      education?.description || '',
    ]),
  ];

  const narrative = [
    vault.personalInfo?.summary || '',
    ...(vault.history ?? []).flatMap((job) => [
      job?.description || '',
      ...(job?.highlights ?? []).map((highlight) =>
        typeof highlight === 'string' ? highlight : highlight?.text || ''
      ),
    ]),
    ...(vault.projects ?? []).map((project) => project?.description || ''),
  ].filter(Boolean);

  return {
    skills: buildCandidateSkillEvidenceEntries(vault).map(entry => entry.text).join('\n'),
    narrative: narrative.join('\n'),
    // Lista umiejętności i narzędzi potwierdza praktykę, ale sama nie dowodzi
    // posiadania uprawnień. Kwalifikacje bierzemy z dedykowanych pól i opisów.
    formal: formalEvidence.filter(Boolean).join('\n'),
  };
}
