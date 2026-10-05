import { describe, it, expect } from 'vitest';
import {
  validatePdfForAts,
  validatePdfTextForAts,
} from '../atsPdfValidator';
import { createEmptyVault } from '../sampleVault';
import type { MasterVault } from '../../types';

/**
 * Testy walidatora ATS PDF — sprawdzają, czy moduł poprawnie ocenia
 * kompatybilność dokumentu z różnymi ATS-ami.
 *
 * Nie testują prawdziwych parserów ATS — testują logikę porównawczą
 * opartą na profilach vendorów.
 */

function vaultWith(overrides: Partial<{
  name: string; email: string; phone: string; title: string;
  hardSkills: string[]; tools: string[];
  history: MasterVault['history'];
}> = {}): MasterVault {
  const v = createEmptyVault(overrides.name ?? 'Jan Kowalski', overrides.email ?? 'jan@example.com');
  v.personalInfo.phone = overrides.phone ?? '+48 123 456 789';
  v.personalInfo.title = overrides.title ?? 'Full Stack Developer';
  v.skillsMatrix.hardSkills = overrides.hardSkills ?? ['JavaScript', 'TypeScript', 'React'];
  v.skillsMatrix.toolsAndTech = overrides.tools ?? ['Node.js', 'PostgreSQL'];
  v.history = overrides.history ?? [{
    id: 'h1', company: 'TechCorp', role: 'Senior Developer', location: 'Warszawa',
    startDate: '2020-01', endDate: '2024-01', isCurrent: false,
    highlights: [{ id: 'hh1', text: 'Zbudowałem system MVP w 3 miesiące', action: '', target: '', tool: '', metric: '', keywords: [] }],
  }];
  return v;
}

// ---------------------------------------------------------------------------
// Testy ekstrakcji tekstu
// ---------------------------------------------------------------------------

describe('validatePdfTextForAts', () => {
  it('nie ocenia bufora PDF jako pustego CV, gdy nie ma ekstrakcji tekstu', async () => {
    const report = await validatePdfForAts(new Uint8Array([37, 80, 68, 70]).buffer, vaultWith());

    expect(report.vendors).toHaveLength(0);
    expect(report.taggedPdfPresent).toBeNull();
    expect(report.invisibleTextDetected).toBeNull();
    expect(report.generalRecommendations).toContain(
      'Walidacji nie wykonano: przekazano bufor PDF bez tekstu wyekstrahowanego przez parser PDF.'
    );
    expect(report.generalRecommendations.some((recommendation) => recommendation.includes('Dodanie go poprawi'))).toBe(false);
  });

  it('nie myli braku metadanych ekstrakcji z brakiem /ActualText lub tekstu niewidocznego', async () => {
    const report = await validatePdfTextForAts(
      'Jan Kowalski\\njan@example.com\\nUmiejętności\\nJavaScript',
      vaultWith(),
      { vendorIds: ['workday'] }
    );
    const workday = report.vendors[0];

    expect(report.taggedPdfPresent).toBeNull();
    expect(report.invisibleTextDetected).toBeNull();
    expect(workday.issues.some((issue) => issue.id === 'NO_ACTUALTEXT_SIGNAL')).toBe(false);
  });

  it('waliduje dostarczony tekst ekstrakcji wraz z metadanymi bufora', async () => {
    const report = await validatePdfForAts(new Uint8Array([37, 80, 68, 70]).buffer, vaultWith(), {
      extractedText: 'Jan Kowalski\njan@example.com\nUmiejętności\nJavaScript',
      hasActualText: true,
      vendorIds: ['workday'],
    });

    expect(report.vendors).toHaveLength(1);
    expect(report.taggedPdfPresent).toBe(true);
    expect(report.vendors[0].extractedFields.name).toBe('Jan Kowalski');
  });

  it('zwraca wyniki dla wszystkich 5 ATS-ów', async () => {
    const vault = vaultWith();
    const text = `
      Jan Kowalski
      jan@example.com
      +48 123 456 789

      Doświadczenie zawodowe
      Senior Developer — TechCorp (2020–2024)
      Zbudowałem system MVP w 3 miesiące

      Umiejętności
      JavaScript, TypeScript, React, Node.js, PostgreSQL
    `;

    const report = await validatePdfTextForAts(text, vault);

    expect(report.vendors).toHaveLength(5);
    expect(report.vendors.every((vendor) => !Object.hasOwn(vendor, 'parseScore') && !Object.hasOwn(vendor, 'status'))).toBe(true);
    expect(report.validatedAt).toBeTruthy();
  });

  it('nie zgłasza braków kontaktu i sekcji widocznych w tekście CV', async () => {
    const vault = vaultWith({
      hardSkills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    });
    const text = `
      Jan Kowalski
      jan@example.com
      +48 123 456 789

      Doświadczenie zawodowe
      Senior Developer — TechCorp (2020–2024)
      Zbudowałem system MVP w 3 miesiące

      Umiejętności
      JavaScript, TypeScript, React, Node.js, PostgreSQL

      Wykształcenie
      informatyka — Politechnika Warszawska
    `;

    const report = await validatePdfTextForAts(text, vault);

    for (const vendor of report.vendors) {
      expect(vendor.issues.some((issue) => ['MISSING_NAME', 'MISSING_EMAIL', 'MISSING_SECTION_EXPERIENCE'].includes(issue.id))).toBe(false);
    }
  });

  it('profile reguł rozpoznają nagłówki rozstrzelone przez ekstraktor PDF', async () => {
    const vault = vaultWith({ hardSkills: ['Windows 11'] });
    const report = await validatePdfTextForAts(`
      Jan Kowalski
      jan@example.com
      +48 123 456 789
      K O N T A K T
      jan@example.com
      D O Ś W I A D C Z E N I E
      Specjalista IT — TechCorp (2020–2024)
      K O M P E T E N C J E
      Windows 11
      W Y K S Z T A Ł C E N I E
      Technikum Informatyczne
    `, vault);

    for (const vendor of report.vendors) {
      expect(vendor.extractedFields.sectionHeadersFound).toContain('contact');
      expect(vendor.extractedFields.sectionHeadersFound).toContain('experience');
      expect(vendor.extractedFields.sectionHeadersFound).toContain('skills');
    }
  });

  it('zgłasza brak wymaganych pól w pustym tekście bez publikowania fikcyjnych liczników', async () => {
    const vault = vaultWith();
    const report = await validatePdfTextForAts('', vault);

    expect(report.vendors.every((vendor) => vendor.issues.some((issue) => issue.id === 'MISSING_NAME'))).toBe(true);
    expect(report.vendors[0].extractedFields).not.toHaveProperty('experienceEntries');
    expect(report.vendors[0].extractedFields).not.toHaveProperty('educationEntries');
  });

  it('nie zwraca profili, gdy żaden nie został wybrany', async () => {
    const report = await validatePdfTextForAts('Jan Kowalski', vaultWith(), { vendorIds: [] });

    expect(report.vendors).toHaveLength(0);
    expect(report.generalRecommendations).toContain(
      'Nie wybrano rozpoznanego profilu regułowego, więc walidacja nie została wykonana.'
    );
  });

  it('wykrywa brak danych kontaktowych', async () => {
    const vault = vaultWith();
    const text = `
      Doświadczenie zawodowe
      Developer — Firma (2020–2024)
      Opis stanowiska
    `;

    const report = await validatePdfTextForAts(text, vault);

    // Workday i Taleo (surowe) powinny zgłosić problemy z kontaktem
    const workday = report.vendors.find((v) => v.vendorId === 'workday');
    expect(workday).toBeDefined();
    expect(workday!.issues.some((i) => i.id === 'MISSING_NAME' || i.id === 'MISSING_EMAIL')).toBe(true);
  });

  it('nie uznaje cudzych danych kontaktowych za dane kandydata z MasterVault', async () => {
    const vault = vaultWith();
    const report = await validatePdfTextForAts(`
      Inna Osoba
      inna@example.invalid
      +48 999 888 777
      Doświadczenie zawodowe
      Developer — Firma (2020–2024)
      Umiejętności
      JavaScript React
    `, vault);

    for (const vendor of report.vendors) {
      expect(vendor.extractedFields.name).toBeNull();
      expect(vendor.extractedFields.email).toBeNull();
      expect(vendor.extractedFields.phone).toBeNull();
      expect(vendor.issues.map((issue) => issue.id)).toEqual(expect.arrayContaining([
        'MISSING_NAME', 'MISSING_EMAIL', 'MISSING_PHONE',
      ]));
    }
  });

  it('znajduje pełne imię i nazwisko po nagłówku przed danymi kontaktowymi', async () => {
    const report = await validatePdfTextForAts(`
      Curriculum Vitae
      Kontakt do rekrutacji: rekrutacja@firma.example
      Jan Kowalski
      jan@example.com
      Doświadczenie zawodowe
      Developer — Firma (2020–2024)
      Umiejętności
      JavaScript React
    `, vaultWith());

    for (const vendor of report.vendors) {
      expect(vendor.extractedFields.name).toBe('Jan Kowalski');
      expect(vendor.extractedFields.email).toBe('jan@example.com');
      expect(vendor.issues.some((issue) => ['MISSING_NAME', 'MISSING_EMAIL'].includes(issue.id))).toBe(false);
    }
  });

  it('nie wykrywa niewidzialnego tekstu gdy go nie ma', async () => {
    const vault = vaultWith();
    const report = await validatePdfTextForAts('Tekst testowy', vault, {
      hasInvisibleText: false,
    });

    expect(report.invisibleTextDetected).toBe(false);
  });

  it('zgłasza wykryty niewidzialny tekst bez przypisywania mu intencji ani skutku', async () => {
    const vault = vaultWith();
    const report = await validatePdfTextForAts('Tekst testowy', vault, {
      hasInvisibleText: true,
    });

    expect(report.invisibleTextDetected).toBe(true);
    expect(report.generalRecommendations.some((r) =>
      r.includes('niewidoczny tekst') && r.includes('nie ustala jego przeznaczenia')
    )).toBe(true);
  });

  it('nie odejmuje punktów za ryzyka formatowania, których nie wykryto w PDF', async () => {
    const vault = vaultWith();
    const text = `Jan Kowalski\njan@example.com\n+48 123 456 789\nKontakt\nDoświadczenie\nDeveloper (2020-2024)\nUmiejętności\nJavaScript React`;
    const report = await validatePdfTextForAts(text, vault, { vendorIds: ['taleo'] });
    const taleo = report.vendors[0];

    expect(taleo.issues.some((issue) => issue.id.startsWith('FORMAT_PENALTY_'))).toBe(false);
  });

  it('oznacza wyłącznie obecność sygnału /ActualText, bez przewidywania wpływu na wynik ATS', async () => {
    const vault = vaultWith();
    const text = `
      Jan Kowalski
      jan@example.com
      Doświadczenie
      Developer — Firma
      Umiejętności
      JavaScript React
    `;

    const withTagged = await validatePdfTextForAts(text, vault, { hasActualText: true });
    const withoutTagged = await validatePdfTextForAts(text, vault, { hasActualText: false });

    const workdayWith = withTagged.vendors.find((v) => v.vendorId === 'workday')!;
    const workdayWithout = withoutTagged.vendors.find((v) => v.vendorId === 'workday')!;

    // Kontrolujemy wyłącznie sygnał /ActualText z ekstrakcji, bez wnioskowania o skutku.
    expect(workdayWith.profileReadsActualText).toBe(true);
    expect(workdayWith.issues.some((issue) => issue.id === 'NO_ACTUALTEXT_SIGNAL')).toBe(false);
    expect(workdayWithout.issues.some((issue) => issue.id === 'NO_ACTUALTEXT_SIGNAL')).toBe(true);
  });

  it('nie wyprowadza obsługi kolumn z tekstu bez danych o układzie PDF', async () => {
    const vault = vaultWith();
    const report = await validatePdfTextForAts('Jan Kowalski  jan@example.com  Umiejętności JavaScript', vault);
    const reportWithCollapsedSpaces = await validatePdfTextForAts('Jan Kowalski jan@example.com Umiejętności JavaScript', vault);

    expect(report.vendors.map((vendor) => vendor.extractedFields)).toEqual(
      reportWithCollapsedSpaces.vendors.map((vendor) => vendor.extractedFields)
    );
    expect(report.generalRecommendations).toContain(
      'Analiza dotyczy wyekstrahowanego tekstu; nie ocenia geometrii kolumn, tabel, nagłówków ani kolejności czytania w układzie PDF.'
    );
  });

  it('zwraca dopasowania do jawnych wzorców profilu bez tworzenia punktacji', async () => {
    const vault = vaultWith();
    const text = 'Jan Kowalski\njan@example.com\nUmiejętności\nJavaScript ** React';

    const report = await validatePdfTextForAts(text, vault);
    const icims = report.vendors.find((v) => v.vendorId === 'icims')!;
    const taleo = report.vendors.find((v) => v.vendorId === 'taleo')!;

    expect(taleo.issues.some((issue) => issue.id === 'UNPARSABLE_ELEMENT')).toBe(true);
    expect(icims.issues.some((issue) => issue.id === 'UNPARSABLE_ELEMENT')).toBe(false);
    expect(icims).not.toHaveProperty('parseScore');
  });
});

// ---------------------------------------------------------------------------
// Testy profili vendorów
// ---------------------------------------------------------------------------

describe('ATS Vendor Profiles', () => {
  it('każdy profil ma unikalne ID', async () => {
    const { ALL_ATS_PROFILES } = await import('../atsVendorProfiles');
    const ids = ALL_ATS_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('każdy profil ma obsługiwane sekcje', async () => {
    const { ALL_ATS_PROFILES } = await import('../atsVendorProfiles');
    for (const profile of ALL_ATS_PROFILES) {
      expect(Object.keys(profile.sectionDetection.headerAliases).length).toBeGreaterThan(0);
    }
  });

  it('profile przechowują tylko reguły używane przez lokalny przegląd', async () => {
    const { ALL_ATS_PROFILES } = await import('../atsVendorProfiles');
    for (const profile of ALL_ATS_PROFILES) {
      expect(Object.keys(profile).sort()).toEqual(['id', 'keywordMatching', 'name', 'sectionDetection']);
      expect(Object.keys(profile.keywordMatching)).toEqual(['readsActualText']);
    }
  });
});

// ---------------------------------------------------------------------------
// Testy normalizacji tekstu
// ---------------------------------------------------------------------------

describe('pdfTextExtractor', () => {
  it('normalizeExtractedText usuwa nadmiarowe białe znaki', async () => {
    const { normalizeExtractedText } = await import('../pdfTextExtractor');
    const result = normalizeExtractedText('Tekst   z    wieloma    spacjami\n\n\n\n\n');
    expect(result).toBe('Tekst z wieloma spacjami');
  });

  it('tokenize zwraca słowa lowercase bez interpunkcji', async () => {
    const { tokenize } = await import('../pdfTextExtractor');
    const tokens = tokenize('JavaScript, React.js i Node.js!');
    expect(tokens).toContain('javascript');
    expect(tokens).toContain('react');
    expect(tokens).toContain('node');
    expect(tokens).not.toContain(',');
    expect(tokens).not.toContain('!');
  });

  it('detectSections rozpoznaje standardowe nagłówki', async () => {
    const { detectSections } = await import('../pdfTextExtractor');
    const sections = detectSections([
      'Jan Kowalski',
      '',
      'Doświadczenie zawodowe',
      'Developer — Firma (2020–2024)',
      '',
      'Umiejętności',
      'JavaScript, React',
    ]);

    expect(sections.some((s) => s.header === 'experience')).toBe(true);
    expect(sections.some((s) => s.header === 'skills')).toBe(true);
  });

  it('detectSections rozpoznaje nagłówki z trackingiem liter z pdfminer', async () => {
    const { detectSections } = await import('../pdfTextExtractor');
    const sections = detectSections([
      'P R O F I L',
      'Opis profilu',
      'D O Ś W I A D C Z E N I E',
      'Specjalistka wsparcia IT',
      'K O N T A K T',
      'janina@example.com',
      'K O M P E T E N C J E',
      'Windows 11',
      'W Y K S Z T A Ł C E N I E',
      'Technikum Informatyczne',
    ]);

    expect(sections.map((section) => section.header)).toEqual([
      'summary',
      'experience',
      'contact',
      'skills',
      'education',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Testy buildExpectedText
// ---------------------------------------------------------------------------

describe('buildExpectedText', () => {
  it('buduje oczekiwany tekst z MasterVault', async () => {
    const { buildExpectedText } = await import('../pdfTextExtractor');
    const vault = vaultWith({
      hardSkills: ['JavaScript', 'React'],
      tools: ['Node.js'],
    });

    const expected = buildExpectedText(vault);

    expect(expected.contactInfo.emails).toContain('jan@example.com');
    expect(expected.skills).toContain('JavaScript');
    expect(expected.skills).toContain('React');
    expect(expected.skills).toContain('Node.js');
    expect(expected.fullText).toContain('Jan Kowalski');
  });

  it('zawiera doświadczenie z historii', async () => {
    const { buildExpectedText } = await import('../pdfTextExtractor');
    const vault = vaultWith();

    const expected = buildExpectedText(vault);

    expect(expected.sections.experience.some((e) => e.includes('TechCorp'))).toBe(true);
    expect(expected.sections.experience.some((e) => e.includes('Senior Developer'))).toBe(true);
  });
});
