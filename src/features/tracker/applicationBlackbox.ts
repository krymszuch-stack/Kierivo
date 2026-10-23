import { z } from 'zod';
import type { JobApplication } from '../../types';
import { isValidOffsetDateTime } from '../../lib/isoDateTime';
import { buildApplicationFromReceipt, findApplicationForReceipt, parseApplicationReceiptMessage, HUNTER_APPLICATION_RECEIPT_MESSAGE, type ApplicationReceipt } from './applicationReceipt';

export const BLACKBOX_IMPORT_TYPE = 'KIERIVO_APPLICATION_IMPORT';
export const BLACKBOX_MAX_BYTES = 256 * 1024;
// Wspólny kontrakt z Hunter extension/applicationBlackboxSchema.js; test parytetu
// sprawdza eksport producenta, żeby dwa niezależne repozytoria nie rozjechały się.
export const BLACKBOX_EXCLUDED = new RegExp('password|passwd|hasło|haslo|secret|sekret|token|api[ _-]?key|captcha|health|medical|medycz|zdrow|disabil|niepełnospraw|niepelnospraw|ethnic|ethnicity|pochodzeni|race|racial|religio|religij|gender|płeć|plec|sexual|seksual|pregnan|ciąż|ciaz|marital|rodzinn|nationality|narodowo|veteran|weteran|\\beeo\\b|\\bssn\\b|pesel|credit.?card|numer.?karty|date.?of.?birth|data.?urodzenia|-----BEGIN|Bearer\\s|eyJ[a-zA-Z0-9_-]+\\.eyJ', 'iu');
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const timestamp = z.string().refine(isValidOffsetDateTime);
const text = (limit: number) => z.string().min(1).max(limit).refine(value => Boolean(value.trim()));
const safe = (value: string) => !BLACKBOX_EXCLUDED.test(value.normalize('NFKC'));
const scalar = z.union([text(1500).refine(safe), z.boolean()]);
const answerSchema = z.strictObject({
  answerId:id, stepKey:id,
  category:z.enum(['salary','availability','notice-period','work-mode','work-location','linkedin-url','github-url','portfolio-url','work-authorization','open-question']),
  label:text(300).refine(safe), value:z.union([scalar,z.array(scalar).min(1).max(30)]).refine(value => JSON.stringify(value).length <= 8000),
  capturedAt:timestamp, provenance:z.literal('observed_form_value'),
});
export function normalizeBlackboxUrl(value: unknown, allowLocalTestUrls = false): string | null {
  if (typeof value !== 'string' || value.length > 2048 || value.includes('#')) return null;
  try {
    const url = new URL(value);
    const local = allowLocalTestUrls && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname);
    return (url.protocol === 'https:' || local) && !url.username && !url.password && url.hostname && url.href.length <= 2048 ? url.href : null;
  } catch { return null; }
}
const snapshotSchema = z.strictObject({
  schemaVersion:z.literal(1), snapshotId:id, attemptId:id, receiptId:id.optional(),
  capturedAt:timestamp, approvedAt:timestamp, correctedAfterApprovalAt:timestamp.optional(),
  profileRevision:id.optional(), cvRevision:id.optional(), stepCount:z.number().int().min(1).max(20), completeness:z.literal('unconfirmed'),
  job:z.strictObject({canonicalUrl:z.string(),companyName:text(300).optional(),roleTitle:text(300).optional(),description:text(20000).optional()}),
  answers:z.array(answerSchema).min(1).max(200),
}).superRefine((value,ctx) => {
  if (Date.parse(value.approvedAt) < Date.parse(value.capturedAt) ||
    (value.correctedAfterApprovalAt && Date.parse(value.correctedAfterApprovalAt) < Date.parse(value.approvedAt)) ||
    new Set(value.answers.map(answer => answer.answerId)).size !== value.answers.length ||
    new Set(value.answers.map(answer => answer.stepKey)).size > value.stepCount) ctx.addIssue({code:'custom',message:'Niespójna migawka'});
});
export type ApplicationSnapshot = z.infer<typeof snapshotSchema>;
export type ApplicationImportEnvelope = {type:typeof BLACKBOX_IMPORT_TYPE; schemaVersion:1; receipt?:ApplicationReceipt; snapshot?:ApplicationSnapshot};
export interface ApplicationBlackbox { schemaVersion:1; snapshot:ApplicationSnapshot; receipt?:ApplicationReceipt }
const withinLimit = (value: unknown) => { try {return new TextEncoder().encode(JSON.stringify(value)).length <= BLACKBOX_MAX_BYTES;} catch {return false;} };
export function parseApplicationSnapshot(value: unknown, allowLocalTestUrls = false): ApplicationSnapshot | null {
  if (!withinLimit(value)) return null;
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) return null;
  const canonicalUrl = normalizeBlackboxUrl(parsed.data.job.canonicalUrl,allowLocalTestUrls);
  return canonicalUrl ? {...parsed.data,job:{...parsed.data.job,canonicalUrl}} : null;
}
export function parseApplicationImportEnvelope(value: unknown, allowLocalTestUrls = false): ApplicationImportEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !withinLimit(value)) return null;
  const record = value as Record<string,unknown>;
  if (Object.keys(record).some(key => !['type','schemaVersion','receipt','snapshot'].includes(key)) ||
    record.type !== BLACKBOX_IMPORT_TYPE || record.schemaVersion !== 1 || (record.receipt === undefined && record.snapshot === undefined)) return null;
  const receipt = record.receipt === undefined ? undefined : parseApplicationReceiptMessage({type:HUNTER_APPLICATION_RECEIPT_MESSAGE,receipt:record.receipt});
  const snapshot = record.snapshot === undefined ? undefined : parseApplicationSnapshot(record.snapshot,allowLocalTestUrls);
  if ((record.receipt !== undefined && !receipt) || (record.snapshot !== undefined && !snapshot)) return null;
  if (receipt?.jobUrl && !normalizeBlackboxUrl((record.receipt as Record<string,unknown>).jobUrl,allowLocalTestUrls)) return null;
  if (receipt && snapshot && (snapshot.receiptId !== receipt.receiptId || snapshot.job.companyName !== receipt.company ||
    snapshot.job.roleTitle !== receipt.position || normalizeBlackboxUrl(receipt.jobUrl,allowLocalTestUrls) !== snapshot.job.canonicalUrl)) return null;
  return {type:BLACKBOX_IMPORT_TYPE,schemaVersion:1,...(receipt ? {receipt} : {}),...(snapshot ? {snapshot} : {})};
}
export function isApplicationBlackbox(value: unknown): value is ApplicationBlackbox {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string,unknown>;
  return Object.keys(record).every(key => ['schemaVersion','snapshot','receipt'].includes(key)) && record.schemaVersion === 1 &&
    record.snapshot !== undefined && Boolean(parseApplicationImportEnvelope({type:BLACKBOX_IMPORT_TYPE,...record}));
}
export function blackboxEnvelope(application: JobApplication): ApplicationImportEnvelope | null {
  const box = application.applicationBlackbox;
  return box ? parseApplicationImportEnvelope({type:BLACKBOX_IMPORT_TYPE,...box}) : null;
}
export function blackboxConfirmation(application: JobApplication): 'captured' | 'user_declared_sent' {
  // Import pliku nie jest dowodem odbioru ATS, nawet jeśli plik twierdzi inaczej.
  return application.applicationBlackbox?.receipt || application.events?.some(event => event.kind === 'application_sent' && event.verificationStatus === 'user_declared')
    ? 'user_declared_sent' : 'captured';
}
export function findBlackboxImportCandidates(envelope: ApplicationImportEnvelope, applications: JobApplication[]): JobApplication[] {
  const url = envelope.snapshot?.job.canonicalUrl || envelope.receipt?.jobUrl;
  const company = envelope.snapshot?.job.companyName || envelope.receipt?.company;
  const position = envelope.snapshot?.job.roleTitle || envelope.receipt?.position;
  return applications.filter(app => Boolean(url && company && position && app.jobUrl === url && app.company === company && app.position === position));
}
export function buildApplicationFromBlackbox(envelope: ApplicationImportEnvelope, applications: JobApplication[], timeZone: string, targetApplicationId?: string): JobApplication {
  const parsed = parseApplicationImportEnvelope(envelope);
  if (!parsed) throw new Error('Nieprawidłowy plik Blackbox.');
  const {snapshot,receipt} = parsed;
  const byReceipt = receipt ? findApplicationForReceipt(applications,receipt.receiptId) : snapshot?.receiptId ? findApplicationForReceipt(applications,snapshot.receiptId) : undefined;
  const byAttempt = snapshot ? applications.find(app => app.applicationBlackbox?.snapshot.attemptId === snapshot.attemptId || app.applicationBlackbox?.snapshot.snapshotId === snapshot.snapshotId) : undefined;
  if (byReceipt && byAttempt && byReceipt.id !== byAttempt.id) throw new Error('Konflikt tożsamości aplikacji.');
  const target = targetApplicationId ? findBlackboxImportCandidates(parsed,applications).find(app => app.id === targetApplicationId) : undefined;
  if (targetApplicationId && (!target || (byReceipt && byReceipt.id !== target.id) || (byAttempt && byAttempt.id !== target.id))) throw new Error('Wybrana aplikacja nie odpowiada plikowi.');
  const existing = byReceipt || byAttempt || target;
  if (existing?.applicationBlackbox && snapshot && existing.applicationBlackbox.snapshot.attemptId !== snapshot.attemptId) throw new Error('Inna próba aplikacyjna wymaga osobnego wpisu.');
  const base: JobApplication = receipt ? buildApplicationFromReceipt(receipt,existing,timeZone) : existing || {
    id:`blackbox-${snapshot!.attemptId}`,company:snapshot!.job.companyName || '',position:snapshot!.job.roleTitle || '',
    salary:'',date:snapshot!.capturedAt.slice(0,10),status:'Do wysłania',jobUrl:snapshot!.job.canonicalUrl,events:[],
  };
  const previous = existing?.applicationBlackbox;
  if (!snapshot && !previous) return base;
  let selected = snapshot || previous!.snapshot;
  const pairedReceipt = receipt || previous?.receipt;
  if (receipt && !selected.receiptId) selected = {...selected,receiptId:receipt.receiptId,
    job:{...selected.job,companyName:selected.job.companyName || receipt.company,roleTitle:selected.job.roleTitle || receipt.position}};
  // Starsza migawka nie może po retry cofnąć późniejszej, jawnej korekty.
  const oldSnapshot = previous?.snapshot;
  if (oldSnapshot?.correctedAfterApprovalAt && JSON.stringify(oldSnapshot) !== JSON.stringify(selected) &&
    Date.parse(selected.correctedAfterApprovalAt || selected.approvedAt) < Date.parse(oldSnapshot.correctedAfterApprovalAt)) throw new Error('Starsza migawka nie zastąpi zapisanej korekty.');
  const content = (value: ApplicationSnapshot) => JSON.stringify({answers:value.answers,job:value.job,profileRevision:value.profileRevision,cvRevision:value.cvRevision,stepCount:value.stepCount});
  if (oldSnapshot && content(oldSnapshot) !== content(selected)) {
    const changedAt = selected.correctedAfterApprovalAt || selected.approvedAt;
    if (Date.parse(changedAt) <= Date.parse(oldSnapshot.correctedAfterApprovalAt || oldSnapshot.approvedAt)) throw new Error('Zmieniona migawka wymaga późniejszego zatwierdzenia korekty.');
    selected = {...selected,correctedAfterApprovalAt:changedAt};
  }
  const applicationBlackbox: ApplicationBlackbox = {schemaVersion:1,snapshot:structuredClone(selected),...(pairedReceipt ? {receipt:pairedReceipt} : {})};
  if (pairedReceipt && !parseApplicationImportEnvelope({type:BLACKBOX_IMPORT_TYPE,...applicationBlackbox})) throw new Error('Migawka i deklaracja dotyczą innych danych.');
  if (!base.company && !base.position) throw new Error('Podaj firmę lub rolę przed zapisem.');
  return {...base,status:receipt && base.status === 'Do wysłania' ? 'Wysłana' : base.status,applicationBlackbox};
}
export function correctApplicationBlackbox(application: JobApplication, values: Record<string,unknown>, description: string, now: string): JobApplication {
  const box = application.applicationBlackbox;
  if (!box) throw new Error('Brak migawki do korekty.');
  const candidate = {...box.snapshot,job:{...box.snapshot.job,description:description.trim() || undefined},correctedAfterApprovalAt:now,
    answers:box.snapshot.answers.map(answer => Object.hasOwn(values,answer.answerId) ? {...answer,value:values[answer.answerId]} : answer)};
  const snapshot = parseApplicationSnapshot(candidate);
  if (!snapshot) throw new Error('Korekta narusza limity lub wykluczenia Blackbox.');
  return {...application,applicationBlackbox:{...box,snapshot}};
}
