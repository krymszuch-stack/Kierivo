import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MasterVault } from '../../types';

/**
 * Dowód, że dane osobowe nie przekraczają granicy modelu.
 *
 * Test na samej funkcji `pseudonymize` sprawdzałby tylko, że funkcja działa —
 * nie, że ktokolwiek jej używa. Dlatego podstawiamy atrapę klienta Gemini
 * i oglądamy **ładunek faktycznie wysłany** przez `gemini.ts`.
 */

const sentPrompts: string[] = [];

vi.mock('../geminiClient', async () => {
  const actual = await vi.importActual<typeof import('../geminiClient')>('../geminiClient');
  return {
    ...actual,
    getActiveAiModel: () => 'test-azure-deployment',
    generateWithUsage: vi.fn(async (params: Record<string, unknown>) => {
      sentPrompts.push(String(params.contents));
      return {
        text: JSON.stringify({
          hook: 'Nazywam się [KANDYDAT] i piszę w sprawie rekrutacji.',
          proofPoints: ['Kontakt: [EMAIL]'],
          callToAction: 'Pozdrawiam, [KANDYDAT]',
          fullText: 'Nazywam się [KANDYDAT].',
          optimizedText: 'Zoptymalizowany punktor dla [KANDYDAT].',
          keywordsMatched: ['React'],
          starTalkingPoints: [],
          personalizedFraming: '',
          emergencyPhrases: [],
          jobTitle: '',
          companyName: '',
          companyDescription: '',
          seniorityLevel: 'UNKNOWN',
          requiredHardSkills: [],
          requiredSoftSkills: [],
          toolsAndTech: [],
          languagesRequired: [],
          coreResponsibilities: [],
          keyKeywords: [],
          benefits: [],
          perksAndPlusy: [],
          mandatoryRequirements: [],
          salaryRange: '',
          workModel: 'UNKNOWN',
          recruitmentMode: '',
          recruitmentModeReason: '',
          cleanBodyText: '',
          explanation: '',
          tips: [],
          actionItems: [],
        }),
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      };
    }),
  };
});

const vault = {
  personalInfo: {
    fullName: "Sean O'Brien",
    email: 'sean.obrien@example.pl',
    phone: '+48 600 700 800',
    location: 'Kraków',
    photoUrl: 'https://cdn.example.pl/zdjecia/sean.jpg',
    title: 'Backend Developer',
    summary: "Sean O'Brien, programista z Krakowa, sean.obrien@example.pl",
  },
  skillsMatrix: { hardSkills: ['PHP'], toolsAndTech: ['Docker'] },
  history: [
    {
      company: 'Acme',
      role: 'Developer',
      highlights: [{ text: "Kontakt do klienta: biuro@acme.pl, prowadził Sean O'Brien" }],
    },
  ],
  projects: [],
} as unknown as Partial<MasterVault>;

beforeEach(() => {
  sentPrompts.length = 0;
});

describe('Calosc promptu przed wyslaniem modelowi', () => {
  it('redagowanie listu pseudonimizuje tez tytul, role i kontakt z oferty', async () => {
    const { generateCoverLetterWithFlash } = await import('../gemini');
    const privateVault = structuredClone(vault) as typeof vault;
    privateVault.personalInfo!.title = "Sean O'Brien";

    await generateCoverLetterWithFlash(
      privateVault,
      "Sean O'Brien",
      'Firma',
      'Wymagania: Docker. Kontakt: recruiter@example.invalid, +48 600 700 800.'
    );

    const payload = sentPrompts.at(-1) ?? '';
    expect(payload).not.toContain("Sean O'Brien");
    expect(payload).not.toContain('recruiter@example.invalid');
    expect(payload).not.toContain('+48 600 700 800');
    expect(payload).toContain('Wymagania: Docker');
  }, 15000);

  it('sciaga na rozmowe pseudonimizuje umiejetnosci i kontakt z oferty', async () => {
    const { generateInterviewCheatSheetEnrichmentWithFlash } = await import('../gemini');
    const privateVault = structuredClone(vault) as typeof vault;
    privateVault.skillsMatrix!.hardSkills = ['PHP', "Sean O'Brien"];

    await generateInterviewCheatSheetEnrichmentWithFlash(
      privateVault,
      'Backend Developer',
      'Firma',
      'Kontakt: recruiter@example.invalid, +48 600 700 800.',
      ['PHP']
    );

    const payload = sentPrompts.at(-1) ?? '';
    expect(payload).not.toContain("Sean O'Brien");
    expect(payload).not.toContain('recruiter@example.invalid');
    expect(payload).not.toContain('+48 600 700 800');
  }, 15000);
});

describe('Granica AI — co faktycznie wychodzi z serwera', () => {
  it(
    'list motywacyjny: żadne dane identyfikujące nie trafiają do modelu',
    async () => {
      const { generateCoverLetterWithFlash } = await import('../gemini');

    await generateCoverLetterWithFlash(vault, 'Backend Developer', 'Firma', 'Opis oferty');

    expect(sentPrompts).toHaveLength(1);
    const payload = sentPrompts[0];

    expect(payload).not.toContain("Sean O'Brien");
    expect(payload).not.toContain('sean.obrien@example.pl');
    expect(payload).not.toContain('biuro@acme.pl');
    expect(payload).not.toContain('600 700 800');

    // Zdjęcie znika całkowicie, nie jako placeholder.
    expect(payload).not.toContain('sean.jpg');
    expect(payload).not.toContain('photoUrl');

    // Treść merytoryczna musi przetrwać, inaczej list byłby bezwartościowy.
    expect(payload).toContain('Acme');
    expect(payload).toContain('Docker');
  }, 15000);

  it('list motywacyjny: użytkownik dostaje wynik ze swoim nazwiskiem, nie z placeholderem', async () => {
    const { generateCoverLetterWithFlash } = await import('../gemini');

    const letter = await generateCoverLetterWithFlash(vault, 'Backend Developer', 'Firma', '');

    expect(letter.hook).toContain("Sean O'Brien");
    expect(letter.hook).not.toContain('[KANDYDAT]');
    expect(letter.callToAction).not.toContain('[KANDYDAT]');
  }, 15000);

  it('parsowanie ogłoszenia: kontakt rekrutera nie przekracza granicy', async () => {
    const { parseJobDescriptionWithGemini } = await import('../gemini');

    await parseJobDescriptionWithGemini(
      'Szukamy programisty. CV wysyłaj na rekrutacja@firma.pl lub dzwoń 601 202 303.'
    );

    expect(sentPrompts[0]).not.toContain('rekrutacja@firma.pl');
    expect(sentPrompts[0]).not.toContain('601 202 303');
    expect(sentPrompts[0]).toContain('Szukamy programisty');
  }, 15000);
});
