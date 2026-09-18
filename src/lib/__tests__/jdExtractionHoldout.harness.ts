import { parseJobDescriptionLocal, type ParsedJobDescription } from '../jdParser';
import { preprocessJobOfferPaste } from '../jobOfferPreprocessor';
import { HOLDOUT_OFFERS, type HoldoutGold, type HoldoutOffer } from './fixtures/jdExtractionHoldout.fixtures';

const EQUIVALENCE_GROUPS: string[][] = [
  ['c#', 'c sharp', 'csharp'],
  ['.net', 'dotnet', 'dot net', 'net'],
  ['asp.net', 'asp .net', 'aspnet'],
  ['postgresql', 'postgres'],
  ['ef core', 'entity framework core'],
  ['ci/cd', 'ci cd', 'cicd'],
];

export function normalizeHoldoutTerm(raw: string): string {
  const value = raw.toLocaleLowerCase('pl-PL').trim()
    .replace(/[",;:.]+$/g, '').replace(/\s+/g, ' ');
  return EQUIVALENCE_GROUPS.find((group) => group.includes(value))?.[0] ?? value;
}

export type HoldoutFieldStatus = 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'NOT_PRESENT_IN_SOURCE';

function empty(value: unknown): boolean {
  return value === null || value === undefined || value === '' ||
    (Array.isArray(value) && value.length === 0);
}

export function holdoutFieldStatus(gold: unknown, parsed: unknown): HoldoutFieldStatus {
  const goldEmpty = empty(gold);
  const parsedEmpty = empty(parsed);
  if (goldEmpty) return parsedEmpty ? 'NOT_PRESENT_IN_SOURCE' : 'INCORRECT';
  if (parsedEmpty) return 'INCORRECT';
  const g = JSON.stringify(gold).toLocaleLowerCase('pl-PL');
  const p = JSON.stringify(parsed).toLocaleLowerCase('pl-PL');
  if (g === p || p.includes(g) || g.includes(p)) return 'CORRECT';
  return 'PARTIAL';
}

export interface HoldoutSkillResult {
  tp: string[];
  fp: string[];
  fn: string[];
  precision: number;
  recall: number;
  f1: number;
  requiredNice: { correct: string[]; misclassified: string[]; unclassified: string[] };
}

function parsedAllSkills(parsed: ParsedJobDescription): Set<string> {
  return new Set([
    ...parsed.requiredHardSkills,
    ...parsed.requiredSoftSkills,
    ...parsed.toolsAndTech,
  ].map(normalizeHoldoutTerm).filter((skill) => skill.length > 1));
}

function parsedClassification(parsed: ParsedJobDescription): { required: Set<string>; nice: Set<string> } {
  const nice = new Set([
    ...(parsed.niceToHaveHardSkills ?? []),
    ...(parsed.niceToHaveSoftSkills ?? []),
  ].map(normalizeHoldoutTerm));
  const required = new Set([
    ...parsed.requiredHardSkills,
    ...parsed.requiredSoftSkills,
    ...parsed.toolsAndTech.filter((skill) => !nice.has(normalizeHoldoutTerm(skill))),
  ].map(normalizeHoldoutTerm));
  return { required, nice };
}

export function compareHoldoutSkills(gold: HoldoutGold, parsed: ParsedJobDescription): HoldoutSkillResult {
  const required = new Set(gold.requiredSkills.map(normalizeHoldoutTerm));
  const nice = new Set(gold.niceSkills.map(normalizeHoldoutTerm));
  const allGold = new Set([...required, ...nice]);
  const detected = parsedAllSkills(parsed);
  const tp = [...allGold].filter((skill) => detected.has(skill));
  const fp = [...detected].filter((skill) => !allGold.has(skill));
  const fn = [...allGold].filter((skill) => !detected.has(skill));
  const precision = tp.length + fp.length === 0 ? 1 : tp.length / (tp.length + fp.length);
  const recall = tp.length + fn.length === 0 ? 1 : tp.length / (tp.length + fn.length);
  const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
  const classification = parsedClassification(parsed);
  const correct = tp.filter((skill) => required.has(skill) ? classification.required.has(skill) : classification.nice.has(skill));
  const misclassified = tp.filter((skill) => required.has(skill)
    ? classification.nice.has(skill)
    : classification.required.has(skill));
  const unclassified = tp.filter((skill) => !classification.required.has(skill) && !classification.nice.has(skill));
  return { tp, fp, fn, precision, recall, f1, requiredNice: { correct, misclassified, unclassified } };
}

export interface HoldoutOfferResult {
  id: string;
  f1: number;
  precision: number;
  recall: number;
  skills: HoldoutSkillResult;
  fields: Record<string, HoldoutFieldStatus>;
  parsed: ParsedJobDescription;
  errors: { kind: 'FP' | 'FN' | 'FIELD' | 'CLASSIFICATION'; value: string }[];
}

export interface HoldoutReport {
  perOffer: HoldoutOfferResult[];
  macro: { precision: number; recall: number; f1: number };
  byDomain: Record<'IT' | 'NON_IT', { precision: number; recall: number; f1: number }>;
  byLanguage: Record<'PL' | 'EN' | 'MIXED', { precision: number; recall: number; f1: number }>;
  classification: { correct: number; misclassified: number; unclassified: number; accuracy: number };
  fieldAccuracy: number;
  fieldStatuses: Record<HoldoutFieldStatus, number>;
  unrecognizedTaxonomy: string[];
  errors: Array<HoldoutOfferResult['errors'][number] & { offerId: string }>;
  targetsSatisfied: boolean;
  verdict: 'GREEN' | 'ORANGE' | 'RED';
}

const average = (values: number[]): number => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1;
const aggregate = (results: HoldoutOfferResult[]) => ({
  precision: average(results.map((r) => r.precision)),
  recall: average(results.map((r) => r.recall)),
  f1: average(results.map((r) => r.f1)),
});

function parseOffer(offer: HoldoutOffer): ParsedJobDescription {
  if (!offer.noisyPortalPaste) return parseJobDescriptionLocal(offer.text, offer.gold.title);
  const prepared = preprocessJobOfferPaste(offer.text);
  const segment = prepared.segments.find((candidate) => !candidate.duplicateOfSegmentId);
  if (!segment) throw new Error(`Nie znaleziono segmentu holdoutu ${offer.gold.id}`);
  return parseJobDescriptionLocal(segment.cleanText, segment.titleCandidate ?? offer.gold.title);
}

const FIELD_PAIRS = (gold: HoldoutGold, parsed: ParsedJobDescription): Record<string, [unknown, unknown]> => ({
  title: [gold.title, parsed.jobTitle],
  company: [gold.company, parsed.companyName],
  seniority: [gold.seniority, parsed.seniorityLevel],
  workMode: [gold.workMode, parsed.workModel],
  contractTypes: [gold.contractTypes, parsed.contractTypes],
  salary: [gold.salary, parsed.salary],
  experienceMinYears: [gold.experienceMinYears, parsed.experienceMinYears],
  languages: [gold.languages, parsed.languagesRequired],
});

export function runHoldoutReport(): HoldoutReport {
  const perOffer = HOLDOUT_OFFERS.map((offer) => {
    const parsed = parseOffer(offer);
    const skills = compareHoldoutSkills(offer.gold, parsed);
    const fields = Object.fromEntries(Object.entries(FIELD_PAIRS(offer.gold, parsed))
      .map(([key, [gold, value]]) => [key, holdoutFieldStatus(gold, value)]));
    const errors: HoldoutOfferResult['errors'] = [
      ...skills.fp.map((value) => ({ kind: 'FP' as const, value })),
      ...skills.fn.map((value) => ({ kind: 'FN' as const, value })),
      ...Object.entries(fields)
        .filter(([, status]) => status === 'INCORRECT' || status === 'PARTIAL')
        .map(([value, status]) => ({ kind: 'FIELD' as const, value: `${value}:${status}` })),
      ...skills.requiredNice.misclassified.map((value) => ({ kind: 'CLASSIFICATION' as const, value })),
    ];
    return {
      id: offer.gold.id, f1: skills.f1, precision: skills.precision, recall: skills.recall,
      skills, fields, parsed, errors,
    };
  });
  const byDomain = {
    IT: aggregate(perOffer.filter((r) => HOLDOUT_OFFERS.find((o) => o.gold.id === r.id)?.gold.domain === 'IT')),
    NON_IT: aggregate(perOffer.filter((r) => HOLDOUT_OFFERS.find((o) => o.gold.id === r.id)?.gold.domain === 'NON_IT')),
  };
  const byLanguage = {
    PL: aggregate(perOffer.filter((r) => HOLDOUT_OFFERS.find((o) => o.gold.id === r.id)?.gold.language === 'PL')),
    EN: aggregate(perOffer.filter((r) => HOLDOUT_OFFERS.find((o) => o.gold.id === r.id)?.gold.language === 'EN')),
    MIXED: aggregate(perOffer.filter((r) => HOLDOUT_OFFERS.find((o) => o.gold.id === r.id)?.gold.language === 'MIXED')),
  };
  const classificationCounts = perOffer.reduce((sum, result) => {
    sum.correct += result.skills.requiredNice.correct.length;
    sum.misclassified += result.skills.requiredNice.misclassified.length;
    sum.unclassified += result.skills.requiredNice.unclassified.length;
    return sum;
  }, { correct: 0, misclassified: 0, unclassified: 0 });
  const classificationTotal = classificationCounts.correct + classificationCounts.misclassified + classificationCounts.unclassified;
  const fieldStatuses = perOffer.flatMap((r) => Object.values(r.fields)).reduce<Record<HoldoutFieldStatus, number>>((counts, status) => {
    counts[status] += 1;
    return counts;
  }, { CORRECT: 0, PARTIAL: 0, INCORRECT: 0, NOT_PRESENT_IN_SOURCE: 0 });
  const fieldTotal = Object.values(fieldStatuses).reduce((a, b) => a + b, 0);
  const unrecognizedTaxonomy = Array.from(new Set(perOffer.flatMap((result) => result.skills.fp)));
  const errors = perOffer.flatMap((result) => result.errors.map((error) => ({ ...error, offerId: result.id })));
  const macro = aggregate(perOffer);
  const fieldAccuracy = (fieldStatuses.CORRECT + fieldStatuses.NOT_PRESENT_IN_SOURCE) / fieldTotal;
  const classificationAccuracy = classificationTotal === 0 ? 1 : classificationCounts.correct / classificationTotal;
  const targetsSatisfied = macro.f1 >= 0.9 && classificationAccuracy >= 0.9 && fieldAccuracy >= 0.9;
  const threshold = Math.min(macro.f1, classificationAccuracy, fieldAccuracy);
  return {
    perOffer, macro, byDomain, byLanguage,
    classification: { ...classificationCounts, accuracy: classificationAccuracy },
    fieldAccuracy, fieldStatuses, unrecognizedTaxonomy, errors, targetsSatisfied,
    verdict: targetsSatisfied ? 'GREEN' : threshold >= 0.7 ? 'ORANGE' : 'RED',
  };
}
