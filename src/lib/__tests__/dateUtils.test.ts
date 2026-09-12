import { describe, it, expect } from 'vitest';
import {
  parseMonthYear,
  formatMonthYear,
  isFutureMonthYear,
  validateDateRange,
  getCurrentMonthYear,
} from '../dateUtils';

describe('dateUtils - obsługa i walidacja dat miesiąc/rok', () => {
  describe('parseMonthYear', () => {
    it('poprawnie parsuje standardowy format ISO YYYY-MM', () => {
      expect(parseMonthYear('2024-09')).toBe('2024-09');
      expect(parseMonthYear('2021-01')).toBe('2021-01');
      expect(parseMonthYear('1998-12')).toBe('1998-12');
    });

    it('parsuje polski format MM.YYYY oraz MM/YYYY', () => {
      expect(parseMonthYear('09.2024')).toBe('2024-09');
      expect(parseMonthYear('9.2024')).toBe('2024-09');
      expect(parseMonthYear('01/2023')).toBe('2023-01');
    });

    it('parsuje słowne polskie nazwy miesięcy', () => {
      expect(parseMonthYear('wrzesień 2024')).toBe('2024-09');
      expect(parseMonthYear('wrz 2024')).toBe('2024-09');
      expect(parseMonthYear('Styczeń 2020')).toBe('2020-01');
      expect(parseMonthYear('lipiec 2019')).toBe('2019-07');
    });

    it('parsuje sam rok mapując na styczeń', () => {
      expect(parseMonthYear('2022')).toBe('2022-01');
    });

    it('zwraca null dla niepoprawnych formatów i pustych wartości', () => {
      expect(parseMonthYear('')).toBeNull();
      expect(parseMonthYear(null)).toBeNull();
      expect(parseMonthYear('losowy tekst')).toBeNull();
      expect(parseMonthYear('2024-15')).toBeNull();
    });
  });

  describe('formatMonthYear', () => {
    it('formatuje YYYY-MM na pełną nazwę miesiąca po polsku', () => {
      expect(formatMonthYear('2024-09')).toBe('wrzesień 2024');
      expect(formatMonthYear('2020-01')).toBe('styczeń 2020');
      expect(formatMonthYear('2023-12')).toBe('grudzień 2023');
    });

    it('wspiera opcję skrótową', () => {
      expect(formatMonthYear('2024-09', { short: true })).toBe('wrz 2024');
      expect(formatMonthYear('2020-01', { short: true })).toBe('sty 2020');
    });

    it('obsługuje puste wartości i fallback', () => {
      expect(formatMonthYear(null)).toBe('');
      expect(formatMonthYear(null, { fallback: 'Brak daty' })).toBe('Brak daty');
    });
  });

  describe('isFutureMonthYear', () => {
    it('zwraca true dla daty w przyszłości', () => {
      expect(isFutureMonthYear('2099-01')).toBe(true);
    });

    it('zwraca false dla dat z przeszłości', () => {
      expect(isFutureMonthYear('2020-01')).toBe(false);
      expect(isFutureMonthYear('2015-06')).toBe(false);
    });
  });

  describe('validateDateRange', () => {
    it('akceptuje poprawny chronologicznie zakres', () => {
      const result = validateDateRange('2020-01', '2023-05');
      expect(result.error).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('zgłasza błąd, gdy startDate > endDate', () => {
      const result = validateDateRange('2024-05', '2022-01');
      expect(result.error).toBe('Data rozpoczęcia nie może być późniejsza niż data zakończenia.');
    });

    it('ignoruje błąd zakresu, gdy isCurrent jest zaznaczone', () => {
      const result = validateDateRange('2024-05', '', true);
      expect(result.error).toBeUndefined();
      const resultZData = validateDateRange('2024-05', '2020-01', true);
      expect(resultZData.error).toBeUndefined();
    });

    it('zgłasza ostrzeżenie, gdy data rozpoczęcia jest w przyszłości', () => {
      const result = validateDateRange('2099-01', '2099-12');
      expect(result.warning).toBe('Data rozpoczęcia przypada w przyszłości.');
    });

    it('akceptuje lata od 1900 do 2100 z tolerancją na separatory', () => {
      expect(parseMonthYear('1975/04')).toBe('1975-04');
      expect(parseMonthYear('04-1975')).toBe('1975-04');
      expect(parseMonthYear('1899-01')).toBeNull(); // poza zakresem praktycznym
      expect(parseMonthYear('2105-01')).toBeNull();
    });
  });

  describe('getCurrentMonthYear', () => {
    it('zwraca aktualny rok i miesiąc w poprawnym formacie', () => {
      const current = getCurrentMonthYear();
      expect(current).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
