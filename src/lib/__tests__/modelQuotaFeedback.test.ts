import { describe, it, expect } from 'vitest';
import {
  formatModelQuotaFeedback,
  getPolishAnalysisNoun,
  getModelGracefulDegradationNotice,
} from '../modelQuotaFeedback';

describe('modelQuotaFeedback - limity i feedback na operacje modelowe', () => {
  describe('getPolishAnalysisNoun', () => {
    it('zwraca poprawną formę fleksyjną', () => {
      expect(getPolishAnalysisNoun(1)).toBe('analiza');
      expect(getPolishAnalysisNoun(2)).toBe('analizy');
      expect(getPolishAnalysisNoun(3)).toBe('analizy');
      expect(getPolishAnalysisNoun(4)).toBe('analizy');
      expect(getPolishAnalysisNoun(5)).toBe('analiz');
      expect(getPolishAnalysisNoun(12)).toBe('analiz');
      expect(getPolishAnalysisNoun(22)).toBe('analizy');
      expect(getPolishAnalysisNoun(25)).toBe('analiz');
      expect(getPolishAnalysisNoun(0)).toBe('analiz');
    });
  });

  describe('formatModelQuotaFeedback', () => {
    it('formatuje komunikat dla 3 analiz (zgodnie z przykładem z zadania)', () => {
      const fb = formatModelQuotaFeedback(3, 25);
      expect(fb.label).toBe('Zostały Ci 3 analizy dzisiaj w tej becie');
      expect(fb.shortBadge).toBe('3/25');
      expect(fb.isExhausted).toBe(false);
      expect(fb.isLow).toBe(true);
      expect(fb.remaining).toBe(3);
      expect(fb.details).toContain('Pozostało 3 z 25');
    });

    it('formatuje komunikat dla 1 analizy', () => {
      const fb = formatModelQuotaFeedback(1, 25);
      expect(fb.label).toBe('Została Ci 1 analiza dzisiaj w tej becie');
      expect(fb.isLow).toBe(true);
      expect(fb.isExhausted).toBe(false);
    });

    it('formatuje komunikat dla pełnego limitu 25 analiz', () => {
      const fb = formatModelQuotaFeedback(25, 25);
      expect(fb.label).toBe('Zostało Ci 25 analiz dzisiaj w tej becie');
      expect(fb.shortBadge).toBe('25/25');
      expect(fb.isLow).toBe(false);
      expect(fb.isExhausted).toBe(false);
    });

    it('formatuje komunikat dla wyczerpanego limitu (0)', () => {
      const fb = formatModelQuotaFeedback(0, 25);
      expect(fb.label).toBe('Wykorzystano dzisiejszy limit analiz AI');
      expect(fb.shortBadge).toBe('0/25');
      expect(fb.isExhausted).toBe(true);
      expect(fb.isLow).toBe(false);
      expect(fb.details).toContain('północy');
      expect(fb.details).not.toContain('Kup Pro');
      expect(fb.details).not.toContain('zł');
    });

    it('zabezpiecza wartości ujemne przed rozbiciem interfejsu', () => {
      const fb = formatModelQuotaFeedback(-2, 25);
      expect(fb.remaining).toBe(0);
      expect(fb.isExhausted).toBe(true);
      expect(fb.shortBadge).toBe('0/25');
    });
  });

  describe('getModelGracefulDegradationNotice - łagodne wygaszanie', () => {
    it('zwraca jasne komunikaty alternatywne dla job matchera bez cichego faila', () => {
      const notice = getModelGracefulDegradationNotice('matcher');
      expect(notice.title).toContain('Limit analiz AI na dziś wyczerpany');
      expect(notice.message).toContain('Kierivo');
      expect(notice.fallbackActionName).toBe('Analizuj silnikiem regułowym');
      expect(notice.fallbackDescription).toContain('scoring ATS');
    });

    it('zwraca jasne komunikaty alternatywne dla trenera STAR', () => {
      const notice = getModelGracefulDegradationNotice('coach');
      expect(notice.title).toContain('Limit symulacji AI');
      expect(notice.fallbackActionName).toContain('pytań wbudowanych');
    });

    it('zwraca jasne komunikaty alternatywne dla weryfikatora CV', () => {
      const notice = getModelGracefulDegradationNotice('verifier');
      expect(notice.fallbackActionName).toContain('Laboratorium Audytu ATS');
    });
  });
});
