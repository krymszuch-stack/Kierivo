import { describe, expect, it } from 'vitest';
import { parseJobDescriptionLocal } from '../jdParser';

describe('tytuł stanowiska z lokalnego parsera JD', () => {
  it('nie zamienia pustego ani opisowego wejścia na nazwę stanowiska', () => {
    expect(parseJobDescriptionLocal('').jobTitle).toBe('');
    expect(parseJobDescriptionLocal('Dziękujemy za zainteresowanie naszą ofertą').jobTitle).toBe('');
    expect(parseJobDescriptionLocal('Firma: Example\nWymagania: Excel').jobTitle).toBe('');
  });

  it('czyta tytuł z ogłoszenia przed opcjonalnym tytułem kontekstowym', () => {
    expect(parseJobDescriptionLocal('Stanowisko: Monter instalacji\nWymagania: SEP', 'Magazynier').jobTitle)
      .toBe('Monter instalacji');
  });

  it('zwraca jawny tytuł kontekstowy tylko gdy źródło nie podaje tytułu', () => {
    expect(parseJobDescriptionLocal('Wymagania: ServiceNow', 'Specjalista IT Support').jobTitle)
      .toBe('Specjalista IT Support');
  });

  it('pomija metadane portalu przy wyborze tytułu i zachowuje seniority z kandydata źródłowego', () => {
    const parsed = parseJobDescriptionLocal(`P&P Solutions Sp. z o.o. O firmie
100,00 – 120,00 zł
Katowice
ważna jeszcze 7 dni
Twój zakres obowiązków
Projektowanie systemów .NET.
Nasze wymagania
C#, .NET i Azure.`, 'Senior .NET Developer / Solution Architect');

    expect(parsed.jobTitle).toBe('Senior .NET Developer / Solution Architect');
    expect(parsed.seniorityLevel).toBe('SENIOR');
  });

  it('nie odrzuca nazwy stanowiska zaczynającej się od Remote', () => {
    expect(parseJobDescriptionLocal('Remote Frontend Developer\nWymagania\nReact', '').jobTitle)
      .toBe('Remote Frontend Developer');
  });
});
