import { describe, it, expect } from 'vitest';
import {
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
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.validatedAt).toBeTruthy();
  });

  it('wysoki wynik dla kompletnego CV z standardowymi sekcjami', async () => {
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

    expect(report.overallScore).toBeGreaterThanOrEqual(70);
    expect(report.overallStatus).not.toBe('FAIL');
  });

  it('niski wynik dla pustego tekstu', async () => {
    const vault = vaultWith();
    const report = await validatePdfTextForAts('', vault);

    expect(report.overallScore).toBeLessThan(50);
    expect(report.overallStatus).toBe('FAIL');
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

  it('nie wykrywa niewidzialnego tekstu gdy go nie ma', async () => {
    const vault = vaultWith();
    const report = await validatePdfTextForAts('Tekst testowy', vault, {
      hasInvisibleText: false,
    });

    expect(report.invisibleTextDetected).toBe(false);
  });

  it('zgłasza krytyczny alert przy niewidzialnym tekście', async () => {
    const vault = vaultWith();
    const report = await validatePdfTextForAts('Tekst testowy', vault, {
      hasInvisibleText: true,
    });

    expect(report.invisibleTextDetected).toBe(true);
    expect(report.generalRecommendations.some((r) => r.includes('niewidoczny tekst'))).toBe(true);
  });

  it('Tagged PDF poprawia wynik dla Workday', async () => {
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

    // Workday obsługuje /ActualText — z Tagged PDF powinien mieć mniej problemów
    expect(workdayWith.taggedPdfBeneficial).toBe(true);
    expect(workdayWith.parseScore).toBeGreaterThanOrEqual(workdayWithout.parseScore);
  });

  it('Taleo jest najsurowszy przy wielokolumnowym layoutcie', async () => {
    const vault = vaultWith();
    // Symulacja wielokolumnowego layouttu (wiele linii z podwójną spacją)
    const text = Array.from({ length: 30 }, (_, i) =>
      `Linia ${i} z 30    druga kolumna tutaj jest tekst`
    ).join('\n');

    const report = await validatePdfTextForAts(text, vault);
    const taleo = report.vendors.find((v) => v.vendorId === 'taleo')!;

    expect(taleo.issues.length).toBeGreaterThan(0);
  });

  it('iCIMS jest najbardziej wyrozumiały', async () => {
    const vault = vaultWith();
    const text = `
      Jan Kowalski
      jan@example.com
      Umiejętności: JavaScript React Node.js
    `;

    const report = await validatePdfTextForAts(text, vault);
    const icims = report.vendors.find((v) => v.vendorId === 'icims')!;
    const taleo = report.vendors.find((v) => v.vendorId === 'taleo')!;

    // iCIMS powinien być bardziej wyrozumiały niż Taleo
    expect(icims.parseScore).toBeGreaterThanOrEqual(taleo.parseScore);
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

  it('profile mają spójne strictness (1–5)', async () => {
    const { ALL_ATS_PROFILES } = await import('../atsVendorProfiles');
    for (const profile of ALL_ATS_PROFILES) {
      expect(profile.strictness).toBeGreaterThanOrEqual(1);
      expect(profile.strictness).toBeLessThanOrEqual(5);
    }
  });

  it('Workday jest surowszy od iCIMS', async () => {
    const { WORKDAY_PROFILE, ICIMS_PROFILE } = await import('../atsVendorProfiles');
    expect(WORKDAY_PROFILE.strictness).toBeLessThan(ICIMS_PROFILE.strictness);
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
