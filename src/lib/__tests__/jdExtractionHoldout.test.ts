import { describe, expect, it } from 'vitest';
import { parseJobDescriptionLocal } from '../jdParser';
import { preprocessJobOfferPaste } from '../jobOfferPreprocessor';
import { HOLDOUT_OFFERS } from './fixtures/jdExtractionHoldout.fixtures';
import { runHoldoutReport } from './jdExtractionHoldout.harness';

describe('ślepy holdout ekstrakcji JD: niezależny pomiar 20 ofert', () => {
  it('ma dokładnie 20 ręcznie zdefiniowanych ofert i nie ma pustego gold', () => {
    expect(HOLDOUT_OFFERS).toHaveLength(20);
    for (const offer of HOLDOUT_OFFERS) {
      expect(offer.gold.title).not.toBe('');
      expect(offer.gold.company).not.toBe('');
      expect(offer.text).toContain(offer.gold.title);
      expect(offer.gold.requiredSkills).not.toBeUndefined();
      expect(offer.gold.niceSkills).not.toBeUndefined();
    }
  });

  it('uruchamia każdą ofertę osobno, bez przecieku stanu między ofertami', () => {
    const parsed = HOLDOUT_OFFERS.map((offer) => parseJobDescriptionLocal(offer.text, offer.gold.title));
    expect(new Set(parsed.map((result) => result.jobTitle)).size).toBeGreaterThan(1);
    parsed.forEach((result, index) => {
      expect(result.jobTitle).toBe(HOLDOUT_OFFERS[index].gold.title);
      expect(result.companyName).toBe(HOLDOUT_OFFERS[index].gold.company);
    });
  });

  it('przepuszcza ofertę portalową 20 przez preprocessor i nie wpuszcza boilerplate do wymagań', () => {
    const offer = HOLDOUT_OFFERS[19];
    const prepared = preprocessJobOfferPaste(offer.text);
    const unique = prepared.segments.filter((segment) => !segment.duplicateOfSegmentId);
    expect(unique).toHaveLength(1);
    const parsed = parseJobDescriptionLocal(unique[0].cleanText, unique[0].titleCandidate ?? offer.gold.title);
    const requirements = [
      ...parsed.requiredHardSkills,
      ...parsed.requiredSoftSkills,
      ...parsed.toolsAndTech,
      ...(parsed.mandatoryRequirements ?? []),
    ].join(' ');
    expect(requirements).not.toMatch(/aplikuj|portal|asystent|podsumowanie|benefit/i);
  });

  it('nie traktuje benefitów jako wymagań i zachowuje rozdział required/nice', () => {
    const parsed = parseJobDescriptionLocal(HOLDOUT_OFFERS[19].text, HOLDOUT_OFFERS[19].gold.title);
    expect(parsed.mandatoryRequirements ?? []).not.toContain('Prywatna opieka medyczna');
    expect(parsed.niceToHaveHardSkills ?? []).toEqual(expect.arrayContaining(['Docker', 'CI/CD', 'Azure']));
    expect(parsed.sourceSections?.required?.join(' ')).toContain('C#');
    expect(parsed.sourceSections?.niceToHave?.join(' ')).toContain('Docker');
  });

  it('buduje pełny snapshot pomiarowy bez asercji jakościowego progu', () => {
    const report = runHoldoutReport();
    expect(report.perOffer).toHaveLength(20);
    expect(report.perOffer.every((result) => Number.isFinite(result.f1))).toBe(true);
    expect(report.macro.precision).toBeGreaterThanOrEqual(0);
    expect(report.macro.recall).toBeLessThanOrEqual(1);
    expect(report.macro.f1).toBeGreaterThanOrEqual(0);
    expect(report.macro.f1).toBeLessThanOrEqual(1);
    expect(Object.keys(report.byDomain)).toEqual(expect.arrayContaining(['IT', 'NON_IT']));
    expect(Object.keys(report.byLanguage)).toEqual(expect.arrayContaining(['PL', 'EN', 'MIXED']));
    expect(report.fieldStatuses).toMatchObject({
      CORRECT: expect.any(Number),
      PARTIAL: expect.any(Number),
      INCORRECT: expect.any(Number),
      NOT_PRESENT_IN_SOURCE: expect.any(Number),
    });
    expect(['GREEN', 'ORANGE', 'RED']).toContain(report.verdict);
    // Wynik jest obserwacją baseline'u: poniżej 90% raport pozostaje ważny i test nadal jest zielony.
    console.info(JSON.stringify({
      perOfferF1: Object.fromEntries(report.perOffer.map((result) => [result.id, result.f1])),
      macro: report.macro,
      byDomain: report.byDomain,
      byLanguage: report.byLanguage,
      classification: report.classification,
      fieldAccuracy: report.fieldAccuracy,
      fieldStatuses: report.fieldStatuses,
      errors: report.errors,
      unrecognizedTaxonomy: report.unrecognizedTaxonomy,
      targetsSatisfied: report.targetsSatisfied,
      verdict: report.verdict,
    }, null, 2));
  });
});
