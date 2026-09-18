import { describe, expect, it } from 'vitest';
import { parseJobDescriptionLocal } from '../jdParser';
import { preprocessJobOfferPaste } from '../jobOfferPreprocessor';

const CORPUS = `ogramista (m/k)
ELEKTROBUDOWA sp. z o.o.O firmie
Katowice
umowa o pracę
specjalista / specjalistka (mid / regular)
praca stacjonarna
Asystent Pracuj.pl
Podsumowanie oferty
Twój zakres obowiązków
Tworzenie oprogramowania dla energetyki.
Nasze wymagania
bardzo dobra znajomość języka C/C++.
Senior .NET Developer / Solution Architect
P&P Solutions Sp. z o.o.O firmie
100,00 – 120,00 zł
Katowice
kontrakt B2B
praca zdalna
Twój zakres obowiązków
Projektowanie systemów .NET.
Nasze wymagania
C#, .NET i Azure.
Senior .NET Developer / Solution Architect
P&P Solutions Sp. z o.o.O firmie
100,00 – 120,00 zł
Katowice
kontrakt B2B
praca zdalna
Twój zakres obowiązków
Projektowanie systemów .NET.
Nasze wymagania
C#, .NET i Azure.
Programista .NET (k/m)
ORLEN PACZKA sp. z o.o.O firmie
Warszawa
umowa o pracę
mid
praca hybrydowa
Twój zakres obowiązków
Implementacja logiki biznesowej.
Nasze wymagania
.NET, SQL i Git.
Pracownik / Pracowniczka kuchni
SOLLEIM GROUP sp. z o.o.O firmie
32,00 – 33,00 zł
Warszawa
umowa zlecenie
praca stacjonarna
Twój zakres obowiązków
Przygotowanie dań kuchni koreańskiej.
Nasze wymagania
Książeczka sanepidowska.
Kucharz (ze znajomością kuchni ukraińskiej)
UBICOM sp. z o.o.O firmie
35,00 – 45,00 zł
Warszawa
umowa zlecenie
praca stacjonarna
Twój zakres obowiązków
Przygotowywanie potraw.
Nasze wymagania
Znajomość kuchni ukraińskiej.
Kucharz do Bistro (m/k)
Level WorkO firmie
7 800 – 8 800 zł
Warszawa
umowa o pracę
praca stacjonarna
Twój zakres obowiązków
Praca na kuchni.
Nasze wymagania
Doświadczenie jako kucharz.`;

describe('jobOfferPreprocessor', () => {
  it('pozostawia zwykłe krótkie ogłoszenie jako pojedynczą ofertę bez domyślania danych', () => {
    const plain = preprocessJobOfferPaste('Backend Developer\nWymagania\nNode.js, SQL');
    const linkedin = preprocessJobOfferPaste('Szukamy osoby do zespołu.\nPraca zdalna.\nAplikuj.');
    expect(plain.classification).toBe('single');
    expect(plain.segments).toHaveLength(1);
    expect(linkedin.segments[0].completeness).toBe('uncertain');
  });

  it('nie wymaga wynagrodzenia i nie dzieli alternatyw pracy jednej oferty', () => {
    const result = preprocessJobOfferPaste(`Developer
Firma A O firmie
Warszawa / Kraków, praca zdalna lub hybrydowa
umowa o pracę albo B2B
Twój zakres obowiązków
Rozwój aplikacji
Nasze wymagania
TypeScript`);
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].cleanText).not.toContain('Asystent Pracuj.pl');
  });

  it('nie dzieli jednej oferty przez powtórzony nagłówek wymagań', () => {
    const result = preprocessJobOfferPaste(`Kucharz
Restauracja A O firmie
Warszawa
umowa o pracę
Twój zakres obowiązków
Przygotowywanie dań.
Nasze wymagania
Doświadczenie w kuchni.
Nasze wymagania
Dyspozycyjność w weekendy.`);
    expect(result.segments).toHaveLength(1);
  });

  it('zachowuje duplikat diagnostycznie, izoluje wymagania i przekazuje segmenty do parsera', () => {
    const result = preprocessJobOfferPaste(CORPUS);
    const unique = result.segments.filter((segment) => !segment.duplicateOfSegmentId);
    expect(unique).toHaveLength(6);
    expect(result.classification).toBe('duplicated');
    expect(result.segments.find((segment) => segment.companyCandidate?.startsWith('P&P'))?.duplicateOfSegmentId).toBeNull();
    expect(result.segments.filter((segment) => segment.companyCandidate?.startsWith('P&P'))[1].duplicateOfSegmentId).toBe('segment-2');
    expect(unique.map((segment) => segment.titleCandidate)).toEqual([
      'Programista C/C++', 'Senior .NET Developer / Solution Architect', 'Programista .NET (k/m)',
      'Pracownik / Pracowniczka kuchni', 'Kucharz (ze znajomością kuchni ukraińskiej)', 'Kucharz do Bistro (m/k)',
    ]);
    const parsed = unique.map((segment) => parseJobDescriptionLocal(segment.cleanText, segment.titleCandidate || ''));
    expect(parsed[2].requiredHardSkills.map((skill) => skill.toLowerCase())).toContain('.net');
    expect(parsed[2].keyKeywords.join(' ')).not.toMatch(/sanepid|ukraińskiej/i);
    expect(parsed[3].keyKeywords.join(' ')).not.toMatch(/azure|asystent|podsumowanie/i);
    expect(parsed[1].salaryRange).toMatch(/100,00/);
    expect(parsed[1].workModel).toBe('REMOTE');
    expect(parsed[1].seniorityLevel).toBe('SENIOR');
  });

  it('odcina tytuł nieinformatycznej oferty sklejony z profilem poprzedniej firmy', () => {
    const result = preprocessJobOfferPaste(`Pracownik kuchni
Restauracja A sp. z o.o.O firmie
Warszawa
umowa o pracę
praca stacjonarna
Twój zakres obowiązków
Przygotowanie dań.
Nasze wymagania
Chęć do pracy.
O nas
Restauracja A działa lokalnie.Kucharz (m/k)
Restauracja B sp. z o.o.
Restauracja B sp. z o.o.O firmie
Warszawa
umowa zlecenie
praca stacjonarna
Twój zakres obowiązków
Przygotowanie potraw.`);
    const unique = result.segments.filter((segment) => !segment.duplicateOfSegmentId);
    expect(unique).toHaveLength(2);
    expect(unique[0].cleanText).not.toMatch(/Restauracja A działa lokalnie\.Kucharz$/);
    expect(unique[1].companyCandidate).toBe('Restauracja B sp. z o.o.');
  });

  it('oznacza urwany fragment obowiązków bez wymagań jako częściowy', () => {
    const result = preprocessJobOfferPaste(`Mechanik
Firma B O firmie
Warszawa
umowa o pracę
Twój zakres obowiązków
Naprawa maszyn,`);
    expect(result.segments[0]).toMatchObject({ completeness: 'partial', needsUserReview: true });
  });
});
