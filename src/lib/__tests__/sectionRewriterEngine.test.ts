import { describe, it, expect } from 'vitest';
import {
  analyzeSectionText,
  rewriteSectionWithRules,
} from '../sectionRewriterEngine';

describe('sectionRewriterEngine', () => {
  describe('analyzeSectionText', () => {
    it('wykrywa zwroty pasywne i słabe zaimki wprowadzające', () => {
      const text = 'Byłem odpowiedzialny za montaż instalacji grzewczych u klientów.';
      const analysis = analyzeSectionText(text, 'Monter instalacji');

      expect(analysis.hasPassiveOrWeakWords).toBe(true);
      expect(analysis.detectedWeakPhrases).toContain('byłem odpowiedzialny za');
      expect(analysis.industry).toBe('tech');
    });

    it('wykrywa istniejące w tekście liczby i metryki', () => {
      const text = 'Skompletowałem 150 zamówień dziennie w magazynie przy 99.8% dokładności.';
      const analysis = analyzeSectionText(text, 'Magazynier');

      expect(analysis.hasMetrics).toBe(true);
      expect(analysis.detectedMetrics).toEqual(expect.arrayContaining(['150', '99.8%']));
      expect(analysis.industry).toBe('logistics');
    });

    it('poprawnie rozpoznaje branże techniczne i rzemieślnicze (Reguła 8)', () => {
      expect(analyzeSectionText('Prace spawalnicze', 'Spawacz TIG').industry).toBe('tech');
      expect(analyzeSectionText('Prowadzenie pojazdu', 'Kierowca kat. C+E').industry).toBe('logistics');
      expect(analyzeSectionText('Opieka nad pacjentami', 'Pielęgniarka').industry).toBe('medical');
      expect(analyzeSectionText('Refaktoryzacja kodu', 'Frontend Developer').industry).toBe('it');
    });
  });

  describe('rewriteSectionWithRules', () => {
    it('dla montera zamienia formę bierną na mocny czasownik i zachowuje strukturę STAR', () => {
      const original = 'Zajmowałem się montażem pieców gazowych i usuwaniem awarii hydraulicznych.';
      const result = rewriteSectionWithRules({
        text: original,
        roleTitle: 'Monter instalacji sanitarnych',
      });

      expect(result.originalText).toBe(original);
      expect(result.proposedText).toContain('Zmontowałem i uruchomiłem');
      expect(result.proposedText).not.toContain('Zajmowałem się');
      expect(result.appliedRules).toContain('Mocny czasownik dokonany');
      expect(result.appliedRules).toContain('Eliminacja zaimków i zwrotów biernych');
      // Ponieważ w oryginale brakowało liczby, nie zmyśla liczby (Reguła 1)
      expect(result.appliedRules).toContain('Szablon mierzalnego rezultatu (Zero zmyślania liczb)');
      expect(result.proposedText).toContain('[np.');
    });

    it('dla magazyniera zachowuje oryginalne metryki bez ich zniekształcania', () => {
      const original = 'Wykonywałem załadunek 40 palet dziennie wózkiem widłowym.';
      const result = rewriteSectionWithRules({
        text: original,
        roleTitle: 'Magazynier - Operator wózka',
      });

      expect(result.appliedRules).toContain('Zachowanie oryginalnych metryk');
      expect(result.proposedText).toContain('40 palet');
      expect(result.diffHighlights.addedOrChanged.length).toBeGreaterThan(0);
    });

    it('dla programisty IT formatuje punkt czytelnie dla ATS', () => {
      const original = 'Brałem udział w tworzeniu aplikacji w React i poprawianiu wydajności.';
      const result = rewriteSectionWithRules({
        text: original,
        roleTitle: 'Senior React Developer',
        ruleFocus: 'ats_clarity',
      });

      expect(result.proposedText).toContain('Zaprojektowałem i zaimplementowałem');
      expect(result.appliedRules).toContain('Struktura STAR (Akcja + Rezultat)');
      expect(result.ruleExplanation.length).toBeGreaterThan(20);
    });
  });
});
