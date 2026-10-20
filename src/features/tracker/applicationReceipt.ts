import type { ApplicationEvent, JobApplication } from '../../types';
import { normalizeExternalHttpUrl } from '../../lib/externalHttpUrl';
import { dateKeyInTimeZone } from './applicationCalendar';
import { upsertApplicationEvent } from './applicationEvents';
import { isValidOffsetDateTime } from '../../lib/isoDateTime';

export const HUNTER_APPLICATION_RECEIPT_MESSAGE = 'KIERIVO_HUNTER_APPLICATION_RECEIPT_V1';

export interface ApplicationReceipt {
  schemaVersion: 1;
  receiptId: string;
  company: string;
  position: string;
  submittedAt: string;
  jobUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Mesaj z rozszerzenia to niezaufane wejście. Nie przyjmujemy CV ani faktów profilu. */
export function parseApplicationReceiptMessage(value: unknown): ApplicationReceipt | null {
  if (!isRecord(value) || Object.keys(value).length !== 2 ||
      !Object.hasOwn(value, 'type') || !Object.hasOwn(value, 'receipt') ||
      value.type !== HUNTER_APPLICATION_RECEIPT_MESSAGE || !isRecord(value.receipt)) return null;
  const receipt = value.receipt;
  const allowedKeys = new Set(['schemaVersion', 'receiptId', 'company', 'position', 'submittedAt', 'jobUrl']);
  if (Object.keys(receipt).some((key) => !allowedKeys.has(key)) ||
      receipt.schemaVersion !== 1 ||
      typeof receipt.receiptId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(receipt.receiptId) ||
      typeof receipt.company !== 'string' || receipt.company.trim().length === 0 || receipt.company.trim().length > 300 ||
      typeof receipt.position !== 'string' || receipt.position.trim().length === 0 || receipt.position.trim().length > 300 ||
      !isValidOffsetDateTime(receipt.submittedAt)) return null;

  const jobUrl = receipt.jobUrl === undefined ? undefined : normalizeExternalHttpUrl(receipt.jobUrl);
  if (receipt.jobUrl !== undefined && !jobUrl) return null;
  return {
    schemaVersion: 1,
    receiptId: receipt.receiptId,
    company: receipt.company.trim(),
    position: receipt.position.trim(),
    submittedAt: receipt.submittedAt,
    ...(jobUrl ? { jobUrl } : {}),
  };
}

/** Odrzuca wiadomości spoza bieżącego okna i originu przed walidacją ich treści. */
export function parseSameWindowApplicationReceipt(
  event: Pick<MessageEvent<unknown>, 'source' | 'origin' | 'data'>,
  targetWindow: Window,
  targetOrigin: string,
): ApplicationReceipt | null {
  if (event.source !== targetWindow || event.origin !== targetOrigin) return null;
  return parseApplicationReceiptMessage(event.data);
}

export function findApplicationForReceipt(
  applications: JobApplication[],
  receiptId: string,
): JobApplication | undefined {
  return applications.find((application) => application.id === `hunter-${receiptId}` ||
    application.events?.some((event) => event.source === 'extension' && event.sourceEventId === receiptId));
}

function normalizeFingerprintText(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function canonicalJobUrl(value: string | undefined): string | undefined {
  const normalized = normalizeExternalHttpUrl(value);
  if (!normalized) return undefined;
  const url = new URL(normalized);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|source|ref|trk|gh_src)$/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLocaleLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

/** Tylko ostrzeżenie: nowy receiptId tego samego dnia nie scala aplikacji automatycznie. */
export function findSameDayReceiptCandidate(
  applications: JobApplication[],
  receipt: ApplicationReceipt,
  timeZone: string,
): JobApplication | undefined {
  const day = dateKeyInTimeZone(receipt.submittedAt, timeZone);
  if (!day) return undefined;
  const receiptUrl = canonicalJobUrl(receipt.jobUrl);
  const company = normalizeFingerprintText(receipt.company);
  const position = normalizeFingerprintText(receipt.position);

  return applications.find((application) => {
    if (application.date !== day ||
        normalizeFingerprintText(application.company) !== company ||
        normalizeFingerprintText(application.position) !== position) return false;
    const applicationUrl = canonicalJobUrl(application.jobUrl);
    return !receiptUrl || !applicationUrl || receiptUrl === applicationUrl;
  });
}

export function buildApplicationFromReceipt(
  receipt: ApplicationReceipt,
  existing: JobApplication | undefined,
  timeZone: string,
): JobApplication {
  const event: ApplicationEvent = {
    id: `hunter-receipt-${receipt.receiptId}`,
    kind: 'application_sent',
    scheduledAt: receipt.submittedAt,
    timeZone,
    state: 'confirmed',
    source: 'extension',
    verificationStatus: 'user_declared',
    sourceEventId: receipt.receiptId,
  };
  const applicationDate = dateKeyInTimeZone(receipt.submittedAt, timeZone) ?? receipt.submittedAt.slice(0, 10);
  return {
    ...(existing ?? {}),
    id: existing?.id ?? `hunter-${receipt.receiptId}`,
    company: existing?.company.trim() ? existing.company : receipt.company,
    position: existing?.position.trim() ? existing.position : receipt.position,
    salary: existing?.salary ?? '',
    date: existing?.date || applicationDate,
    status: existing?.status ?? 'Wysłana',
    jobUrl: existing?.jobUrl || receipt.jobUrl || '',
    events: upsertApplicationEvent(existing?.events ?? [], event),
  };
}
