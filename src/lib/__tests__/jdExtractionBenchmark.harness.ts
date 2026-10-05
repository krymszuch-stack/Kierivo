/**
 * Funkcje pomiarowe benchmarku jakości ekstrakcji ofert (tylko pomiar — nie
 * dotyka `jdParser.ts` ani `jobOfferPreprocessor.ts`). Nie jest to plik
 * testowy (brak sufiksu .test.ts), więc Vitest go nie uruchamia jako spec —
 * jest importowany przez `jdExtractionBenchmark.test.ts`.
 */
import type { ParsedJobDescription } from '../jdParser';
import {
  compareMeasuredText,
  finiteMeasuredNumber,
  isMissingMeasuredValue,
} from './fieldMeasurement';

/**
 * Grupy równoważności semantycznej — WYŁĄCZNIE na potrzeby tego benchmarku.
 * Nie zmienia to działania parsera; służy tylko do tego, by np. "C#" i "c sharp"
 * liczyły się jako to samo pojęcie przy porównywaniu z gold standardem.
 * Celowo wąskie (tylko warianty wskazane w zadaniu) — benchmark nie ma
 * nadmiernie normalizować niepowiązanych technologii.
 */
const EQUIVALENCE_GROUPS: string[][] = [
  ['c#', 'c sharp', 'csharp'],
  ['.net', 'dotnet', 'dot net', 'net'],
  ['asp.net', 'asp .net', 'aspnet'],
  ['postgresql', 'postgres'],
  ['ef core', 'entity framework core'],
  ['ci/cd', 'ci cd', 'cicd'],
];

export function canonicalizeSkill(raw: string): string {
  let s = raw.toLowerCase().trim().replace(/[",;:.]+$/, '');
  s = s.replace(/\s+/g, ' ');
  for (const group of EQUIVALENCE_GROUPS) {
    if (group.includes(s)) return group[0];
  }
  return s;
}

/**
 * Ujednolicony zbiór "wykrytych pojęć" z wyjścia parsera. `ParsedJobDescription`
 * nie rozdziela required/nice ani hard/soft na poziomie struktury użytecznej dla
 * tego porównania, więc benchmark świadomie łączy wszystkie trzy pola w jeden
 * zbiór — dokładnie tak, jak widzi je dziś każdy konsument tego API.
 */
export function detectedSkillSet(p: ParsedJobDescription): Set<string> {
  const raw = [...p.requiredHardSkills, ...p.toolsAndTech, ...p.requiredSoftSkills];
  const out = new Set<string>();
  for (const r of raw) {
    const c = canonicalizeSkill(r);
    if (c.length >= 2) out.add(c);
  }
  return out;
}

export interface SkillComparison {
  tp: string[];
  fn: string[];
  fp: string[];
  precision: number;
  recall: number;
  f1: number;
  /** Ile TP faktycznie pochodzi z gold "required". */
  tpRequiredCorrect: number;
  /**
   * Ile TP pochodzi z gold "nice-to-have", ale parser i tak wrzucił je do pól
   * required* — to jest miara błędnej klasyfikacji required/nice, NIE FP: to
   * wciąż trafienie w to, że pojęcie istnieje w ofercie (skill TP), tylko
   * błędnie sklasyfikowane jako wymagane (patrz zadanie: "detected skill with
   * wrong required/nice classification is skill TP but classification
   * incorrect").
   */
  tpNiceMisclassified: number;
}

/**
 * Precision/recall zdefiniowane tak, by nie zafałszować zerowej liczby ofert
 * (mianownik=0 => 1, standardowa konwencja), zamiast sztucznie wymuszać
 * mianownik>=1 - dzieki temu oferta bez zadnych wymaganych/mile widzianych
 * umiejetnosci w gold i bez zadnych falszywych trafien parsera dostaje F1=1
 * (poprawnie pusto), a nie F1=0 (co by falszywie sugerowalo porazke pomiaru).
 */
export function compareSkillSets(requiredGold: string[], niceGold: string[], detected: Set<string>): SkillComparison {
  const req = new Set(requiredGold.map(canonicalizeSkill));
  const nice = new Set(niceGold.map(canonicalizeSkill));
  const goldAll = new Set([...req, ...nice]);
  const tp = [...goldAll].filter((g) => detected.has(g));
  const fn = [...goldAll].filter((g) => !detected.has(g));
  const fp = [...detected].filter((d) => !goldAll.has(d));
  const precision = tp.length + fp.length === 0 ? 1 : tp.length / (tp.length + fp.length);
  const recall = tp.length + fn.length === 0 ? 1 : tp.length / (tp.length + fn.length);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const tpRequiredCorrect = tp.filter((g) => req.has(g)).length;
  const tpNiceMisclassified = tp.filter((g) => nice.has(g) && !req.has(g)).length;
  return { tp, fn, fp, precision, recall, f1, tpRequiredCorrect, tpNiceMisclassified };
}

export type FieldStatus = 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'NOT_PRESENT_IN_SOURCE';

/**
 * Dokładny wynik wymaga równości znormalizowanych wartości. Powiązane teksty
 * mogą dostać PARTIAL; liczby nie są porównywane przez zawieranie podciągu.
 * Puste wartości i placeholder UNKNOWN oznaczają brak treści źródłowej.
 */
export function fieldStatus(gold: unknown, parsed: unknown): FieldStatus {
  const goldEmpty = isMissingMeasuredValue(gold);
  const parsedEmpty = isMissingMeasuredValue(parsed);
  if (goldEmpty) return parsedEmpty ? 'NOT_PRESENT_IN_SOURCE' : 'INCORRECT';
  if (parsedEmpty) return 'INCORRECT';

  const goldNumber = finiteMeasuredNumber(gold);
  const parsedNumber = finiteMeasuredNumber(parsed);
  if (goldNumber !== null || parsedNumber !== null) {
    return goldNumber !== null && goldNumber === parsedNumber ? 'CORRECT' : 'INCORRECT';
  }

  if (typeof gold === 'string' && typeof parsed === 'string') {
    return compareMeasuredText(gold, parsed);
  }

  const g = JSON.stringify(gold).toLowerCase();
  const p = JSON.stringify(parsed).toLowerCase();
  return g === p ? 'CORRECT' : 'INCORRECT';
}

export function macroF1(f1s: number[]): number {
  if (f1s.length === 0) return NaN;
  return f1s.reduce((a, b) => a + b, 0) / f1s.length;
}
