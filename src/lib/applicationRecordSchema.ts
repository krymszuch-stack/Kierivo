import type { ApplicationStatus, JobApplication } from '../types';
import { isAtsScoreProvenance } from './atsScoreProvenance';

const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'Do wysłania',
  'Wysłana',
  'Rozmowa',
  'Oferta',
  'Odrzucona',
];

export interface ParsedApplications {
  applications: JobApplication[];
  rejected: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(record: Record<string, unknown>, key: string): boolean {
  return record[key] === undefined || typeof record[key] === 'string';
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const timestamp = /^\d{4}-\d{2}-\d{2}T/.test(value);
  if (!dateOnly && !timestamp) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  if (!dateOnly) return true;
  return new Date(parsed).toISOString().slice(0, 10) === value;
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 1 || !isDateTime(value.createdAt)) return false;
  if (!isRecord(value.tailoredResume) || !isRecord(value.vaultSnapshot)) return false;
  if (!isRecord(value.jobOfferSnapshot)) return false;

  const offer = value.jobOfferSnapshot;
  if (typeof offer.title !== 'string' || typeof offer.company !== 'string') return false;
  if (!isOptionalString(offer, 'id') || !isOptionalString(offer, 'salary')) return false;
  if (!isOptionalString(offer, 'location') || !isOptionalString(offer, 'description')) return false;
  if (!isOptionalString(offer, 'url')) return false;

  if (value.exportedCv !== undefined) {
    if (!isRecord(value.exportedCv) || typeof value.exportedCv.templateName !== 'string') return false;
  }
  if (value.exportedDocument !== undefined) {
    if (!isRecord(value.exportedDocument) || typeof value.exportedDocument.content !== 'string') return false;
    if (!['cv', 'cover-letter'].includes(String(value.exportedDocument.kind))) return false;
    if (!['plain-text', 'markdown'].includes(String(value.exportedDocument.format))) return false;
  }
  return true;
}

function isAtsScoreContext(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const requiredNumbers = ['detectedRequirementCount', 'profileCompleteness'];
  if (!requiredNumbers.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))) return false;
  const optionalNumbers = [
    'unmetBlockingRequirementCount',
    'unconfirmedBlockingRequirementCount',
    'unconfirmedRequirementCount',
    'scoreContextVersion',
    'careerEvidenceVersion',
  ];
  if (!optionalNumbers.every((key) => value[key] === undefined ||
      (typeof value[key] === 'number' && Number.isFinite(value[key])))) return false;
  return value.careerEvidenceAvailable === undefined || typeof value.careerEvidenceAvailable === 'boolean';
}

export function isJobApplication(value: unknown): value is JobApplication {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== undefined &&
      (typeof value.schemaVersion !== 'number' || !Number.isInteger(value.schemaVersion) || value.schemaVersion < 1)) return false;
  if (typeof value.id !== 'string' || value.id.trim() === '') return false;
  if (typeof value.company !== 'string' || typeof value.position !== 'string') return false;
  if (typeof value.salary !== 'string' || !isDate(value.date)) return false;
  if (!APPLICATION_STATUSES.includes(value.status as ApplicationStatus)) return false;
  if (!isOptionalString(value, 'notes') || !isOptionalString(value, 'jobUrl')) return false;
  if (value.atsScore !== undefined &&
      (typeof value.atsScore !== 'number' || !Number.isFinite(value.atsScore) || value.atsScore < 0 || value.atsScore > 100)) return false;
  if (value.atsScoreProvenance !== undefined && !isAtsScoreProvenance(value.atsScoreProvenance)) return false;
  if (value.atsScoreContext !== undefined && !isAtsScoreContext(value.atsScoreContext)) return false;
  if (value.missingKeywords !== undefined &&
      (!Array.isArray(value.missingKeywords) || !value.missingKeywords.every((entry) => typeof entry === 'string'))) return false;
  if (!isOptionalString(value, 'interviewAt') || !isOptionalString(value, 'briefDoneAt') ||
      !isOptionalString(value, 'debriefSentAt') || !isOptionalString(value, 'updatedAt')) return false;
  if (value.interviewAt !== undefined && !isDateTime(value.interviewAt)) return false;
  if (value.briefDoneAt !== undefined && !isDateTime(value.briefDoneAt)) return false;
  if (value.debriefSentAt !== undefined && !isDateTime(value.debriefSentAt)) return false;
  if (value.updatedAt !== undefined && !isDateTime(value.updatedAt)) return false;
  if (value.documentSnapshot !== undefined && !isSnapshot(value.documentSnapshot)) return false;
  return true;
}

/** Wadliwe rekordy pozostają dostępne dla zapisu zwrotnego zamiast znikać po filtracji. */
export function parseApplications(value: unknown): ParsedApplications {
  if (!Array.isArray(value)) return { applications: [], rejected: value === undefined ? [] : [value] };
  const applications: JobApplication[] = [];
  const rejected: unknown[] = [];
  for (const entry of value) {
    if (isJobApplication(entry)) applications.push(entry);
    else rejected.push(entry);
  }
  return { applications, rejected };
}
