import type { AuditMode, HardCapScope } from './contracts';

export const AUDIT_CORE_CORPUS_VERSION = 'audit-core-corpus-v2-2026-09-11';

export interface GoldenCorpusExpectation {
  applicability?: 'APPLICABLE' | 'PARTIALLY_APPLICABLE' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
  expectedHardCaps?: Array<{ scope: HardCapScope; ruleCode: string }>;
  minConfidence?: number;
  maxConfidence?: number;
  notes: string[];
}

export interface GoldenCorpusCase {
  id: string;
  mode: AuditMode;
  /**
   * D07 przechowuje wejścia jako jawnie syntetyczne deskryptory. Moduły D08–D17
   * mapują descriptor do własnych fixture'ów zamiast sprzęgać core z MasterVault.
   */
  cvInput: { fixture: string; mutations: string[] };
  vaultInput: { fixture: string; mutations: string[] };
  jobInput: { fixture: string; mutations: string[] } | null;
  tags: string[];
  expectation: GoldenCorpusExpectation;
}

const c = (
  id: string,
  mode: AuditMode,
  tags: string[],
  notes: string[],
  mutations: { cv?: string[]; vault?: string[]; job?: string[] } = {},
): GoldenCorpusCase => ({
  id,
  mode,
  cvInput: { fixture: `CV_${id}`, mutations: mutations.cv ?? [] },
  vaultInput: { fixture: `VAULT_${id}`, mutations: mutations.vault ?? [] },
  jobInput: mode === 'TARGETED_APPLICATION'
    ? { fixture: `JOB_${id}`, mutations: mutations.job ?? [] }
    : null,
  tags,
  expectation: { notes },
});

export const D07_GOLDEN_CORPUS: readonly GoldenCorpusCase[] = [
  c('EMPTY_PROFILE', 'GENERAL_CV', ['missingness', 'boundary'], ['Nie może wygenerować dobrego score.']),
  c('MINIMAL_VALID_PROFILE', 'GENERAL_CV', ['baseline'], ['Minimalny komplet danych, bez darmowego 100.']),
  c('JUNIOR_UNQUANTIFIED', 'GENERAL_CV', ['junior', 'metrics'], ['Brak liczb nie jest globalnym hard capem.']),
  c('JUNIOR_GOOD_EVIDENCE', 'GENERAL_CV', ['junior', 'metrics'], ['Kontrolowana poprawa względem JUNIOR_UNQUANTIFIED.']),
  c('MID_AVERAGE', 'GENERAL_CV', ['mid', 'baseline'], ['Przeciętny profil kontrolny.']),
  c('SENIOR_HIGH_IMPACT', 'GENERAL_CV', ['senior', 'metrics'], ['Silne, kontekstowe dowody wpływu.']),
  c('LONG_SINGLE_EMPLOYMENT', 'GENERAL_CV', ['confidence', 'temporal'], ['Jedno długie zatrudnienie nie może obniżać confidence tylko przez małą liczbę ról.']),
  c('JOB_HOPPER_GOOD_EVIDENCE', 'GENERAL_CV', ['confidence', 'temporal'], ['Wiele ról nie daje automatycznie przewagi confidence.']),
  c('CAREER_PIVOT', 'TARGETED_APPLICATION', ['job-fit', 'pivot'], ['Zmiana branży ma być oceniana z kontekstu, nie samego tytułu.']),
  c('RETURNING_WORKER', 'GENERAL_CV', ['temporal', 'gap'], ['Powrót po przerwie nie jest sam w sobie błędem integralności.']),
  c('NON_IT_OFFICE', 'GENERAL_CV', ['domain-diversity'], ['Corpus nie może być IT-only.']),
  c('PHYSICAL_WORKER', 'GENERAL_CV', ['domain-diversity'], ['Metryki i dowody muszą działać poza pracą biurową.']),
  c('SALES', 'TARGETED_APPLICATION', ['domain-diversity', 'metrics'], ['Test silnych metryk sprzedażowych.']),
  c('CUSTOMER_SUPPORT', 'TARGETED_APPLICATION', ['domain-diversity'], ['Test języka obsługi i SLA bez IT bias.']),
  c('FINANCE', 'TARGETED_APPLICATION', ['domain-diversity', 'formal'], ['Test wymagań formalnych i precyzji.']),
  c('STUDENT', 'GENERAL_CV', ['junior', 'missingness'], ['Brak historii pracy nie może być utożsamiany z awarią parsera.']),
  c('EMPLOYMENT_GAP_JUSTIFIED', 'GENERAL_CV', ['gap', 'consistency'], ['Wyjaśniona luka > niewyjaśniona przy pozostałych danych stałych.']),
  c('EMPLOYMENT_GAP_UNEXPLAINED', 'GENERAL_CV', ['gap', 'consistency'], ['Kontrolowana para do justified gap.']),
  c('OVERLAPPING_PART_TIME_VALID', 'GENERAL_CV', ['temporal', 'consistency'], ['Legalny overlap nie może być automatycznie sprzecznością.']),
  c('OVERLAPPING_FULL_TIME_SUSPICIOUS', 'GENERAL_CV', ['temporal', 'consistency'], ['Podejrzany overlap wymaga evidence, nie samego heurystycznego wyroku.']),
  c('DATE_INVERSION', 'GENERAL_CV', ['temporal', 'adversarial'], ['Jawna inwersja dat powinna pogorszyć integralność.'], { cv: ['end_before_start'] }),
  c('KEYWORD_STUFFING', 'TARGETED_APPLICATION', ['anti-gaming', 'keywords'], ['Stuffing nie może zwiększać consensus.'], { cv: ['repeat_job_terms'] }),
  c('JD_COPY_PASTE', 'TARGETED_APPLICATION', ['anti-gaming', 'keywords'], ['Kopiowanie JD nie jest dowodem kompetencji.'], { cv: ['copy_job_description'] }),
  c('FAKE_SENIOR_TITLE', 'TARGETED_APPLICATION', ['anti-gaming', 'role'], ['Sam senior title nie dowodzi seniority.']),
  c('SKILLS_LIST_NO_CONTEXT', 'TARGETED_APPLICATION', ['skills', 'context'], ['Lista skill bez kontekstu < skill poparty doświadczeniem.']),
  c('METRIC_TOKEN_NO_RESULT', 'GENERAL_CV', ['metrics', 'anti-gaming'], ['Sama liczba bez rezultatu nie jest osiągnięciem.']),
  c('STRONG_METRIC_EVIDENCE', 'GENERAL_CV', ['metrics'], ['Kontrolowana poprawa względem METRIC_TOKEN_NO_RESULT.']),
  c('FORMAL_REQUIREMENT_MISSING', 'TARGETED_APPLICATION', ['formal', 'knockout'], ['Brak jawnie wymaganego formalnego warunku może uruchomić domain/global cap zależnie od polityki.']),
  c('FORMAL_REQUIREMENT_UNKNOWN', 'TARGETED_APPLICATION', ['formal', 'missingness'], ['UNKNOWN nie jest SATISFIED ani automatycznie FAILED.']),
  c('VAULT_CV_CONTRADICTION', 'GENERAL_CV', ['integrity', 'provenance'], ['Sprzeczność Vault/CV ma jawny provenance CONTRADICTION.']),
  c('BROKEN_PDF_EXTRACTION', 'GENERAL_CV', ['structure', 'missingness'], ['Awaria/utrata tekstu ma obniżyć confidence lub dać INSUFFICIENT_DATA, nie udawać dobrego CV.'], { cv: ['corrupt_text_layer'] }),
  c('MULTICOLUMN_READING_ORDER', 'GENERAL_CV', ['structure', 'layout'], ['Liczba kolumn sama nie karze; karze udowodniona zła kolejność.'], { cv: ['interleave_columns'] }),
  c('PROMPT_INJECTION_TEXT', 'TARGETED_APPLICATION', ['adversarial', 'injection'], ['Tekst prompt injection jest treścią dokumentu, nie instrukcją dla silnika.']),
  c('EXTREME_LONG_TEXT', 'GENERAL_CV', ['boundary', 'performance'], ['Długi tekst nie może powodować NaN/Infinity ani darmowego confidence.']),
] as const;

export interface GoldenCorpusRelation {
  betterCaseId: string;
  worseCaseId: string;
  rationale: string;
}

export const D07_EXPECTED_RELATIONS: readonly GoldenCorpusRelation[] = [
  {
    betterCaseId: 'JUNIOR_GOOD_EVIDENCE',
    worseCaseId: 'JUNIOR_UNQUANTIFIED',
    rationale: 'Ta sama klasa profilu z lepszym dowodem wpływu.',
  },
  {
    betterCaseId: 'EMPLOYMENT_GAP_JUSTIFIED',
    worseCaseId: 'EMPLOYMENT_GAP_UNEXPLAINED',
    rationale: 'Wyjaśnienie luki poprawia integralność evidence.',
  },
  {
    betterCaseId: 'STRONG_METRIC_EVIDENCE',
    worseCaseId: 'METRIC_TOKEN_NO_RESULT',
    rationale: 'Cause-effect > samotny token liczbowy.',
  },
  {
    betterCaseId: 'MINIMAL_VALID_PROFILE',
    worseCaseId: 'EMPTY_PROFILE',
    rationale: 'Brak danych nie może zostać wynagrodzony renormalizacją.',
  },
] as const;

export function validateGoldenCorpus(corpus: readonly GoldenCorpusCase[] = D07_GOLDEN_CORPUS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const item of corpus) {
    if (ids.has(item.id)) errors.push(`Zduplikowany caseId: ${item.id}`);
    ids.add(item.id);
    if (!item.cvInput || !item.vaultInput) errors.push(`${item.id}: brak CV lub Vault input.`);
    if (item.mode === 'TARGETED_APPLICATION' && !item.jobInput) {
      errors.push(`${item.id}: TARGETED_APPLICATION bez Job input.`);
    }
    if (item.mode === 'GENERAL_CV' && item.jobInput !== null) {
      errors.push(`${item.id}: GENERAL_CV nie powinien wymagać Job input.`);
    }
    if (item.expectation.notes.length === 0) errors.push(`${item.id}: brak oczekiwania relacyjnego/diagnostycznego.`);
  }
  return errors;
}
