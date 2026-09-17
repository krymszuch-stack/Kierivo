import { describe, it, expect } from 'vitest';
import {
  validateRawCvText,
  resolveCvIngestionResult,
  formatCvMergeSummary,
  MIN_RAW_CV_LENGTH,
} from '../cvIngestionEngine';
import type { ParsedCVResult } from '../cvUniversalParser';

describe('cvIngestionEngine - czysta warstwa domenowa wczytywania CV', () => {
  describe('validateRawCvText', () => {
    it('odrzuca pusty tekst lub tekst poniżej progu 30 znaków', () => {
      expect(validateRawCvText('').valid).toBe(false);
      expect(validateRawCvText('   ').valid).toBe(false);
      expect(validateRawCvText('Zbyt krótki tekst').valid).toBe(false);
      expect(validateRawCvText('Zbyt krótki tekst').error).toContain('30 znaków');
    });

    it('akceptuje poprawny tekst o odpowiedniej długości', () => {
      const validText = 'Jan Kowalski\nDoświadczony monter instalacji sanitarnych z uprawnieniami SEP.';
      expect(validText.length).toBeGreaterThanOrEqual(MIN_RAW_CV_LENGTH);
      const res = validateRawCvText(validText);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });
  });

  describe('resolveCvIngestionResult', () => {
    it('respektuje pierwszeństwo rekordu Smart Portable PDF', () => {
      const mockPortable: ParsedCVResult = {
        personalInfo: {
          fullName: 'Anna Nowak',
          title: 'Architekt Systemów',
          email: 'anna@example.com',
          phone: '',
          location: 'Kraków',
          summary: '',
        },
        hardSkills: ['Go', 'Kubernetes'],
        softSkills: [],
        toolsAndTech: ['Docker'],
        languages: [],
        certifications: [],
        history: [],
        education: [],
        rawText: 'Mock Portable Content',
        detectedFormat: 'Smart Portable PDF',
      };

      const result = resolveCvIngestionResult({
        extractedText: 'Jakiś inny tekst z OCR',
        portableResult: mockPortable,
        fileName: 'anna_nowak_cv.pdf',
        isFile: true,
      });

      expect(result.personalInfo.fullName).toBe('Anna Nowak');
      expect(result.detectedFormat).toBe('Smart Portable PDF');
    });

    it('wykrywa format pliku na podstawie rozszerzenia dla zwykłych plików', () => {
      const rawCv = `
Jan Kowalski
Programista TypeScript i React
Doświadczenie:
2020 - 2024 Software Engineer w ABC Sp. z o.o.
Umiejętności: TypeScript, React, Node.js
      `;

      const result = resolveCvIngestionResult({
        extractedText: rawCv,
        fileName: 'moje_cv.docx',
        isFile: true,
      });

      expect(result.detectedFormat).toBe('DOCX');
      expect(result.hardSkills).toBeDefined();
    });

    it('ustawia format "Wklejony tekst" w trybie tekstowym', () => {
      const rawCv = `
Marek Nowak
Monter instalacji grzewczych i sanitarnych
Uprawnienia: SEP do 1kV, F-Gazy
      `;

      const result = resolveCvIngestionResult({
        extractedText: rawCv,
        isFile: false,
      });

      expect(result.detectedFormat).toBe('Wklejony tekst');
    });
  });

  describe('formatCvMergeSummary', () => {
    it('zwraca informację o braku zmian dla pustego zliczenia', () => {
      expect(formatCvMergeSummary({})).toBe('Nie wykryto nowych pozycji do dodania.');
      expect(
        formatCvMergeSummary({
          history: 0,
          education: 0,
          hardSkills: 0,
          softSkills: 0,
          toolsAndTech: 0,
          certifications: 0,
        })
      ).toBe('Nie wykryto nowych pozycji do dodania.');
    });

    it('poprawnie sumuje pozycje i składa komunikat w języku polskim', () => {
      const summary = formatCvMergeSummary({
        history: 2,
        education: 1,
        hardSkills: 3,
        softSkills: 1,
        toolsAndTech: 2,
        certifications: 1,
      });

      expect(summary).toBe('Dodano: 2 stanowisk, 1 szkół, 7 pozycji umiejętności.');
    });

    it('poprawnie obsługuje częściowe zliczenia', () => {
      expect(formatCvMergeSummary({ history: 3 })).toBe('Dodano: 3 stanowisk.');
      expect(formatCvMergeSummary({ hardSkills: 4 })).toBe('Dodano: 4 pozycji umiejętności.');
    });
  });
});
