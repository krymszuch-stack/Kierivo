import { describe, it, expect } from 'vitest';
import {
  validateRawCvText,
  resolveCvIngestionResult,
  formatCvMergeSummary,
  MIN_RAW_CV_LENGTH,
} from '../cvIngestionEngine';
import type { ParsedCVResult } from '../cvUniversalParser';
import { MAX_DOCUMENT_TEXT_CHARS } from '../textNormalization';

describe('cvIngestionEngine - czysta warstwa domenowa wczytywania CV', () => {
  describe('validateRawCvText', () => {
    it('odrzuca pusty tekst lub tekst poniżej progu 30 znaków', () => {
      expect(validateRawCvText('').valid).toBe(false);
      expect(validateRawCvText('   ').valid).toBe(false);
      expect(validateRawCvText('Zbyt krótki tekst').valid).toBe(false);
      expect(validateRawCvText('Zbyt krótki tekst').error).toContain('30 znaków');
    });

    it('akceptuje poprawny tekst o odpowiedniej długości', () => {
      const validText = `Anna Kowalska
Email: anna.kowalska@example.pl
Tel: +48 600 700 800
Stanowisko: Backend Developer

Podsumowanie: Programistka backendu z doświadczeniem w budowie usług sieciowych.

Umiejętności: Python, Django, PostgreSQL, Git, Docker

Doświadczenie zawodowe:
Acme Sp. z o.o. - Backend Developer, 2020 - 2025
Projektowanie usług REST i optymalizacja zapytań do PostgreSQL.

Wykształcenie:
Politechnika Warszawska - Informatyka, 2015 - 2019`;
      expect(validText.length).toBeGreaterThanOrEqual(MIN_RAW_CV_LENGTH);
      const res = validateRawCvText(validText);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
      expect(res.parsedResult?.personalInfo.fullName).toBe('Anna Kowalska');
    });

    it('odrzuca tekst przekraczający limit długości, z którego parser nie wydobywa treści zawodowej', () => {
      const malformed = 'A'.repeat(40);
      const res = validateRawCvText(malformed);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/nie znaleziono|nie wykryto/i);
    });

    it('odrzuca treść ogłoszenia, opis firmy i list motywacyjny jako CV', () => {
      const unrelatedInputs = [
        `Specjalista IT Support\nPoszukujemy osoby do zespołu helpdesk.\nZakres obowiązków: obsługa zgłoszeń, diagnozowanie problemów Windows, konfiguracja komputerów, instalowanie oprogramowania, wsparcie pracowników i prowadzenie dokumentacji.\nWymagania: znajomość Windows, Microsoft 365, Active Directory, TCP/IP, umiejętność komunikacji, praca zmianowa.\nOferujemy stabilne zatrudnienie, szkolenia i prywatną opiekę medyczną. Aplikuj już dziś.`,
        `O nas\nJesteśmy nowoczesną firmą technologiczną rozwijającą systemy dla klientów w całej Europie. Nasz zespół pracuje z technologiami JavaScript, React, Node.js, PostgreSQL, Docker i Kubernetes. Cenimy komunikację, współpracę, odpowiedzialność i ciągłe doskonalenie. Oferujemy elastyczne godziny pracy, szkolenia, prywatną opiekę medyczną i dodatkowy urlop.`,
        `Szanowni Państwo, aplikuję na stanowisko specjalisty wsparcia IT. Posiadam doświadczenie w obsłudze użytkowników oraz rozwiązywaniu problemów systemu Windows i Microsoft 365. W poprzedniej pracy obsługiwałem zgłoszenia, konfigurowałem komputery, dokumentowałem rozwiązania i współpracowałem z zespołem administratorów. Chętnie opowiem więcej podczas rozmowy.`,
      ];

      for (const input of unrelatedInputs) {
        expect(validateRawCvText(input).valid).toBe(false);
      }
    });

    it('odrzuca tekst ponad limit parsera z jawnym powodem zamiast walidować jego ucięty początek', () => {
      const longCv = `${'Anna Kowalska\nUmiejętności: Windows, Microsoft 365\nDoświadczenie zawodowe:\nAcme — Specjalistka wsparcia, 2020-2025\n'.repeat(2_000)}${'A'.repeat(MAX_DOCUMENT_TEXT_CHARS)}`;
      const result = validateRawCvText(longCv);

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/przekracza limit 200.?000 znaków/i);
      expect(result.parsedResult).toBeUndefined();
    });
  });

  it('akceptuje łacińskie CV z cyrylickim imieniem, gdy treść pozostaje czytelna dla parsera', () => {
    const latinCvWithCyrillicName = `\u0418\u0432\u0430\u043d\u043e\u0432 \u0418\u0432\u0430\u043d
IT Support Specialist
ivan@example.invalid
Summary: Experienced IT support specialist with five years in customer support and Windows troubleshooting.
Skills: Windows, Microsoft 365, TCP/IP, Active Directory, ticket handling.
Experience:
2021-2025 IT Support Specialist, Example Company
Supported users, diagnosed incidents, documented resolutions and configured laptops.
Education:
Technical College, Information Technology, 2017-2021`;

    const result = validateRawCvText(latinCvWithCyrillicName);

    expect(result.valid).toBe(true);
    expect(result.parsedResult?.hasCyrillicScript).toBe(false);
  });

  it('odrzuca nieobsługiwaną cyrylicę przed podglądem i nie zwraca częściowego parsowania', () => {
    const cyrillicCv = `Иван Иванов
IT Support Specialist
ivan@example.invalid
Summary: Опытный специалист технической поддержки с пятью годами работы.
Skills: Windows, Microsoft 365, TCP/IP, Active Directory
Experience:
2021-2025 Специалист поддержки, Компания Пример
Поддерживал пользователей, настраивал Windows и решал технические обращения.
Education:
Технический колледж, Информационные технологии, 2017-2021`;

    const result = validateRawCvText(cyrillicCv);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Wykryto alfabet cyrylicki');
    expect(result.error).toContain('uzupełnij profil ręcznie');
    expect(result.parsedResult).toBeUndefined();
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

    it('używa wyniku zwróconego przez walidację bez ponownego parsowania tekstu', () => {
      const validation = validateRawCvText(`
Jan Kowalski
Programista TypeScript i React
Doświadczenie:
2020 - 2024 Software Engineer w ABC Sp. z o.o.
Umiejętności: TypeScript, React, Node.js
      `);
      expect(validation.valid).toBe(true);
      const parsedResult = validation.parsedResult!;

      const result = resolveCvIngestionResult({
        extractedText: 'tekst ignorowany przy użyciu sparsowanego wyniku',
        parsedResult,
        isFile: false,
      });

      expect(result).toBe(parsedResult);
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
