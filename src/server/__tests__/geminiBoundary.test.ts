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

  it('przeformułowanie punktora: kontakt klienta nie wychodzi, wynik wraca czytelny', async () => {
    const { optimizeDeltaPhrases } = await import('../gemini');

    const result = await optimizeDeltaPhrases(
      ['React'],
      "Wdrożyłem system dla klienta biuro@acme.pl razem z Sean O'Brien",
      'Frontend Developer'
    );

    expect(sentPrompts[0]).not.toContain('biuro@acme.pl');
    expect(result.optimizedText).not.toContain('[EMAIL]');
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
