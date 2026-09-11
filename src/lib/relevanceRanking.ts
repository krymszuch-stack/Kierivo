import { WorkExperience, HighlightMetric } from '../types';
import { HR_AND_COMMON_STOP_WORDS } from './atsSimulator';
import {
  hasPositiveSkillEvidence,
  hasPositiveSkillEvidenceNormalized,
  normalizeHaystackText,
} from './skillEvidence';

/**
 * 0-Token relevance scoring & reordering.
 * Decides which experience blocks and bullet points to surface first for a given
 * job offer, purely via keyword-overlap math — no AI call involved. This is the
 * algorithmic counterpart to what a human (or an LLM) does by eye: skim the JD,
 * then push the most relevant history to the top of the CV.
 */

function toKeywordSet(jdKeywords: string[]): Set<string> {
  // Słowa kluczowe z samych spacji (`' '`) też są „truthy" — bez trima każde
  // CV by do nich pasowało przez `String.includes`, jak kiedyś w atsSimulator.
  // Dodatkowo odrzucamy śmieci interpunkcyjne, 1-znakowe resztki i słowa
  // funkcyjne (`the` w JD nie może tasować rankingu — F10).
  return new Set(
    jdKeywords
      .map((k) => (k ?? '').toLowerCase().trim())
      .filter(
        (k) =>
          k.length >= 2 &&
          /[\p{L}\p{N}]/u.test(k) &&
          !HR_AND_COMMON_STOP_WORDS.has(k)
      )
  );
}

function highlightText(highlight: HighlightMetric | string): string {
  return (typeof highlight === 'string' ? highlight : highlight.text) || '';
}

function scoreTextAgainstKeywords(text: string, jdKeywordSet: Set<string>): { score: number; matchedKeywords: string[] } {
  if (jdKeywordSet.size === 0) return { score: 0, matchedKeywords: [] };
  const matchedKeywords: string[] = [];
  // Kanoniczny dowód zamiast `includes`: `ai` nie wchodzi w `pain`/`air`,
  // `java` w `javascript`, a negacje nie punktują (F10/F1).
  // Korpus normalizowany raz na tekst (test 15 ms przy 250 punktorach).
  const normalized = normalizeHaystackText(text);
  jdKeywordSet.forEach((kw) => {
    if (hasPositiveSkillEvidenceNormalized(normalized, kw)) matchedKeywords.push(kw);
  });
  return { score: matchedKeywords.length / jdKeywordSet.size, matchedKeywords };
}

/** Rough title-alignment heuristic, mirrors the logic already used in atsScorer.ts. */
function titleSimilarity(roleTitle: string, targetJobTitle: string): number {
  if (!roleTitle || !targetJobTitle) return 0;
  const a = roleTitle.toLowerCase().trim();
  const b = targetJobTitle.toLowerCase().trim();
  // Tytuł z samych spacji trimuje się do pustki, a pustka jest podciągiem
  // wszystkiego — bez tego `'   '` dostawało 0.8 za samo istnienie drugiego tytułu.
  // Śmieci interpunkcyjne (`---`) też nie są tytułem (R3).
  if (!a || !b) return 0;
  if (!/[\p{L}\p{N}]/u.test(a) || !/[\p{L}\p{N}]/u.test(b)) return 0;
  if (a === b) return 1;
  // Podciąg tylko z granicami słów — `java` w `javascript` to nie 0.8 (F1).
  // Używamy kanonicznego matchera zamiast `includes`.
  if (hasPositiveSkillEvidence(a, b) || hasPositiveSkillEvidence(b, a)) return 0.8;
  const aWords = new Set(a.split(/\s+/));
  const bWords = b.split(/\s+/).filter(Boolean);
  const common = bWords.filter((w) => aWords.has(w));
  return bWords.length > 0 && common.length > 0 ? 0.5 * (common.length / bWords.length) : 0;
}

export interface ScoredHighlight<T extends HighlightMetric | string> {
  highlight: T;
  score: number;
  matchedKeywords: string[];
}

/**
 * Sorts bullet points within a single experience by JD keyword overlap (descending).
 * Ties keep their original relative order (stable sort) so untouched bullets don't shuffle needlessly.
 */
export function rankHighlightsByRelevance<T extends HighlightMetric | string>(
  highlights: T[] | undefined | null,
  jdKeywords: string[] | undefined | null
): ScoredHighlight<T>[] {
  if (!Array.isArray(highlights) || highlights.length === 0) return [];
  const jdKeywordSet = toKeywordSet(Array.isArray(jdKeywords) ? jdKeywords : []);
  return highlights
    .map((highlight, originalIndex) => {
      const { score, matchedKeywords } = scoreTextAgainstKeywords(highlightText(highlight), jdKeywordSet);
      return { highlight, score, matchedKeywords, originalIndex };
    })
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .map(({ highlight, score, matchedKeywords }) => ({ highlight, score, matchedKeywords }));
}

export interface ScoredExperience {
  experience: WorkExperience;
  score: number;
  matchedKeywords: string[];
}

/**
 * Sorts work-history entries by relevance to the job offer: keyword overlap in their
 * bullets (dominant factor), role-title alignment, and a small recency nudge
 * (vault.history is authored newest-first, per MasterVaultEditor's addExperience).
 * Ties keep original order.
 */
export function rankExperienceByRelevance(
  history: WorkExperience[] | undefined | null,
  jdKeywords: string[] | undefined | null,
  targetJobTitle: string = ''
): ScoredExperience[] {
  if (!Array.isArray(history) || history.length === 0) return [];
  const jdKeywordSet = toKeywordSet(Array.isArray(jdKeywords) ? jdKeywords : []);

  return history
    .filter((exp): exp is WorkExperience => Boolean(exp && typeof exp === 'object'))
    .map((experience, originalIndex) => {
      const highlightScores = (experience.highlights || []).map((h) => scoreTextAgainstKeywords(highlightText(h), jdKeywordSet));

      const bestHighlightScore = highlightScores.reduce((max, s) => Math.max(max, s.score), 0);
      const avgHighlightScore =
        highlightScores.length > 0 ? highlightScores.reduce((sum, s) => sum + s.score, 0) / highlightScores.length : 0;
      const matchedKeywords = Array.from(new Set(highlightScores.flatMap((s) => s.matchedKeywords)));

      const roleTitleScore = titleSimilarity(experience.role || '', targetJobTitle);
      const recencyBonus = Math.max(0, 0.1 - originalIndex * 0.02);

      const score = bestHighlightScore * 0.5 + avgHighlightScore * 0.3 + roleTitleScore * 0.15 + recencyBonus;

      return { experience, score, matchedKeywords, originalIndex };
    })
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .map(({ experience, score, matchedKeywords }) => ({ experience, score, matchedKeywords }));
}

/** Convenience helper: just the experience ids, in relevance order — for consumers that only need a sort key. */
export function getRelevanceOrderedExperienceIds(
  history: WorkExperience[] | undefined | null,
  jdKeywords: string[] | undefined | null,
  targetJobTitle: string = ''
): string[] {
  if (!Array.isArray(history) || history.length === 0) return [];
  return rankExperienceByRelevance(history, jdKeywords, targetJobTitle).map((s) => s.experience.id).filter(Boolean);
}
