import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { cleanPastedJobOffer } from '../jobOfferCleaner';
import { parseJobDescriptionLocal, analyzeJdMatchWithVault } from '../jdParser';
import { buildJobOfferFromManual } from '../jobMatcherEngine';
import {
  accountDoradcaKlienta,
  accountKierowcaC,
  accountMonterOkien,
  accountParking,
  accountStolarz,
  accountMagazynAmazon,
  accountSuwnicowy,
  accountMagazynierUnigast,
} from './fixtures/practicalAccounts.fixtures';

const LIVE_TEST_FILE = fileURLToPath(new URL('./fixtures/portal-corpus/test_praktyczny1.md.gz', import.meta.url));

function loadRawSections(): string[] {
  if (!fs.existsSync(LIVE_TEST_FILE)) {
    throw new Error(`Plik testowy nie istnieje: ${LIVE_TEST_FILE}`);
  }
  const content = gunzipSync(fs.readFileSync(LIVE_TEST_FILE)).toString('utf-8');
  return content.split(/\n\s*-{3,}\s*\n/).map((s) => s.trim()).filter(Boolean);
}

const FORBIDDEN_PORTAL_NOISE = [
  'olx.ua',
  'olx.bg',
  'olx.ro',
  'olx.pt',
  'otodom.pl',
  'otomoto.pl',
  'the network',
  'akt o usługach cyfrowych',
  'polityka plików cookies',
  'dla biznesu',
  'twoje konto',
  'dodaj ogłoszenie',
];

describe('Praktyczne czyszczenie wklejek z portali (test_praktyczny1.md)', () => {
  const sections = loadRawSections();

  it('wczytuje wszystkie 33 sekcje ze zbioru testowego', () => {
    expect(sections.length).toBeGreaterThanOrEqual(30);
  });

  it('oczyszcza wszystkie 33 sekcje z szumu portalowego i linków śmieciowych', () => {
    sections.forEach((section, index) => {
      const cleaned = cleanPastedJobOffer(section);
      const textLower = cleaned.cleanText.toLocaleLowerCase('pl-PL');

      FORBIDDEN_PORTAL_NOISE.forEach((forbidden) => {
        expect(
          textLower,
          `Sekcja ${index + 1} zawiera zakazany szum portalowy: "${forbidden}"`
        ).not.toContain(forbidden);
      });
    });
  });

  describe('Izolacja i eliminacja obcych / pasożytniczych ogłoszeń', () => {
    it('Oferta 2 (Kierowca kat. C) nie zawiera treści wklejonej oferty pedagoga ze szkoły Harmonia', () => {
      const sec2 = cleanPastedJobOffer(sections[1]);
      const textLower = sec2.cleanText.toLocaleLowerCase('pl-PL');
      expect(textLower).not.toContain('pedagog');
      expect(textLower).not.toContain('harmonia');
      expect(textLower).not.toContain('autyzm');
      expect(sec2.title).toMatch(/kierowc/i);
      expect(sec2.company).toBe('SVBL Tomasz Ziemiński');
      expect(sec2.location).toBe('Zielona Góra');
    });

    it('Oferta 7 (Monter okien Luzino) nie zawiera powiązanych ofert stolarza ani ładowacza', () => {
      const sec7 = cleanPastedJobOffer(sections[6]);
      const textLower = sec7.cleanText.toLocaleLowerCase('pl-PL');
      expect(textLower).not.toContain('ładowark');
      expect(textLower).not.toContain('więcej od tego ogłoszeniodawcy');
      expect(sec7.title).toMatch(/monter okien/i);
      expect(sec7.location).toBe('Luzino');
    });

    it('Oferta 12 (Stolarz meblowy Bochnia) nie zawiera ogłoszeń sprzedaży figur z brązu ani żyrandoli', () => {
      const sec12 = cleanPastedJobOffer(sections[11]);
      const textLower = sec12.cleanText.toLocaleLowerCase('pl-PL');
      expect(textLower).not.toContain('brązu');
      expect(textLower).not.toContain('żyrandol');
      expect(sec12.title).toMatch(/stolarz meblowy/i);
      expect(sec12.location).toBe('Bochnia');
    });

    it('Oferta 16 (Operator suwnicy Kraków) nie zawiera obcych ofert programistów z dołu strony', () => {
      const sec16 = cleanPastedJobOffer(sections[15]);
      const textLower = sec16.cleanText.toLocaleLowerCase('pl-PL');
      expect(textLower).not.toContain('.net');
      expect(textLower).not.toContain('programista');
      expect(sec16.title).toMatch(/operator.*suwnicy/i);
      expect(sec16.company).toBe('EKO ENERGIA Sp. z o.o.');
      expect(sec16.location).toContain('Kraków');
    });

    it('Oferta 30 (Magazynier UniGast) nie zawiera obcych ogłoszeń ani linków ze stopki', () => {
      const sec30 = cleanPastedJobOffer(sections[29]);
      const textLower = sec30.cleanText.toLocaleLowerCase('pl-PL');
      expect(textLower).not.toContain('tiktok');
      expect(textLower).not.toContain('the network');
      expect(sec30.title).toMatch(/magazynier/i);
      expect(sec30.company).toBe('UniGast S.A.');
      expect(sec30.location).toContain('Warszawa');
    });
  });

  describe('Dopasowanie z fikcyjnymi kontami lokalnymi (MasterVault)', () => {
    it('Konto 1: Doradca Klienta -> Oferta 1 (Oświęcim)', () => {
      const sec1 = sections[0];
      const parsed = parseJobDescriptionLocal(sec1);
      expect(parsed.jobTitle).toMatch(/doradca klienta/i);
      expect(parsed.location).toBe('Oświęcim');
      expect(parsed.salaryRange).toMatch(/5 000 - 10 000/);

      const match = analyzeJdMatchWithVault(parsed, accountDoradcaKlienta, sec1);
      expect(match.overallMatchPercentage).toBeGreaterThanOrEqual(60);
      expect(match.dealbreakerWarnings.some((w) => w.missingInVault && w.type === 'LICENSE')).toBe(false);
    });

    it('Konto 2: Kierowca kat. C -> Oferta 2 (Zielona Góra)', () => {
      const sec2 = sections[1];
      const parsed = parseJobDescriptionLocal(sec2);
      expect(parsed.jobTitle).toMatch(/kierowc.*kat.*c/i);
      expect(parsed.companyName).toBe('SVBL Tomasz Ziemiński');
      expect(parsed.location).toBe('Zielona Góra');

      const match = analyzeJdMatchWithVault(parsed, accountKierowcaC, sec2);
      // Profil posiada prawo jazdy kat. C
      const cLicenseWarning = match.dealbreakerWarnings.find((w) => w.id === 'license_c');
      expect(cLicenseWarning?.missingInVault).not.toBe(true);
    });

    it('Konto 3: Monter okien -> Oferta 7 (Luzino)', () => {
      const sec7 = sections[6];
      const parsed = parseJobDescriptionLocal(sec7);
      expect(parsed.jobTitle).toMatch(/monter okien/i);
      expect(parsed.location).toBe('Luzino');

      const match = analyzeJdMatchWithVault(parsed, accountMonterOkien, sec7);
      expect(match.dealbreakerWarnings.some((w) => w.missingInVault && w.type === 'LICENSE')).toBe(false);
    });

    it('Konto 4: Parking -> Oferta 9 (Łódź)', () => {
      const sec9 = sections[8];
      const parsed = parseJobDescriptionLocal(sec9);
      expect(parsed.jobTitle).toMatch(/parking/i);
      expect(parsed.companyName).toBe('TIS Partners sp.zoo');
      expect(parsed.location).toContain('Łódź');

      const match = analyzeJdMatchWithVault(parsed, accountParking, sec9);
      expect(match.dealbreakerWarnings.some((w) => w.missingInVault)).toBe(false);
    });

    it('Konto 5: Stolarz -> Oferta 12 (Bochnia)', () => {
      const sec12 = sections[11];
      const parsed = parseJobDescriptionLocal(sec12);
      expect(parsed.jobTitle).toMatch(/stolarz meblowy/i);
      expect(parsed.location).toBe('Bochnia');
      expect(parsed.salaryRange).toMatch(/5 000 - 10 000/);

      const match = analyzeJdMatchWithVault(parsed, accountStolarz, sec12);
      expect(match.dealbreakerWarnings.some((w) => w.missingInVault)).toBe(false);
    });

    it('Konto 6: Magazyn Amazon -> Oferta 13 (Trzebnica / Bielany)', () => {
      const sec13 = sections[12];
      const parsed = parseJobDescriptionLocal(sec13);
      expect(parsed.companyName).toBe('Randstad Polska Sp. z o.o.');
      expect(parsed.location).toBe('Trzebnica');

      const match = analyzeJdMatchWithVault(parsed, accountMagazynAmazon, sec13);
      expect(match.dealbreakerWarnings.some((w) => w.missingInVault)).toBe(false);
    });

    it('Konto 7: Operator suwnicy -> Oferta 16 (Kraków)', () => {
      const sec16 = sections[15];
      const parsed = parseJobDescriptionLocal(sec16);
      expect(parsed.jobTitle).toMatch(/operator.*suwnicy/i);
      expect(parsed.companyName).toBe('EKO ENERGIA Sp. z o.o.');
      expect(parsed.location).toContain('Kraków');

      const match = analyzeJdMatchWithVault(parsed, accountSuwnicowy, sec16);
      // Profil posiada UDT na suwnice
      const suwniceWarning = match.dealbreakerWarnings.find((w) => w.id === 'udt_suwnice');
      expect(suwniceWarning?.missingInVault).not.toBe(true);
    });

    it('Konto 8: Magazynier UniGast -> Oferta 30 (Warszawa)', () => {
      const sec30 = sections[29];
      const parsed = parseJobDescriptionLocal(sec30);
      expect(parsed.jobTitle).toMatch(/magazynier/i);
      expect(parsed.companyName).toBe('UniGast S.A.');
      expect(parsed.location).toContain('Warszawa');

      const match = analyzeJdMatchWithVault(parsed, accountMagazynierUnigast, sec30);
      expect(match.dealbreakerWarnings.some((w) => w.missingInVault && w.id === 'udt_forklift')).toBe(false);
    });
  });

  describe('Integracja potoku wejściowego (buildJobOfferFromManual)', () => {
    it('buduje kompletny obiekt oferty bez podawania ręcznego tytułu i firmy z surowego wklejenia OLX', () => {
      const raw = sections[15]; // Operator suwnicy
      const { job, parsed, preparation } = buildJobOfferFromManual({ description: raw });

      expect(preparation.segments).toHaveLength(1);
      expect(job.title).toMatch(/operator.*suwnicy/i);
      expect(job.company).toBe('EKO ENERGIA Sp. z o.o.');
      expect(job.location).toContain('Kraków');
      expect(job.salary).toMatch(/4 806 - 6 000/);
      expect(job.description).not.toContain('Google Play');
      expect(job.description).not.toContain('OLX.ua');
      expect(parsed.jobTitle).toBe(job.title);
    });
  });
});
