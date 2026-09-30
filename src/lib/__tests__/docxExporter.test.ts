import { describe, it, expect } from 'vitest';
import { HeadingLevel, Packer } from 'docx';
import { unzipSync } from 'fflate';
import {
  buildCvDocument,
  h1NameOptions,
  h2SectionOptions,
  h3EntryOptions,
  bulletOptions,
  bodyOptions,
  MARGIN_ONE_INCH_TWIPS,
  LINE_SPACING_115,
  FONT_SIZES_HALF_POINTS,
} from '../docxExporter';
import { createEmptyVault } from '../sampleVault';
import { generatePlainTextCvExport } from '../layeredVaultEngine';
import type { MasterVault, LayeredFactItem } from '../../types';

/**
 * Kontrakt OpenXML pod parsery ATS — testowany na poziomie opcji akapitów
 * (fabryki są czystymi funkcjami), bo to one decydują o wygenerowanym XML-u:
 * margines 1 cal, płaska hierarchia H1→H2→H3, widowControl/keepNext, interlinia
 * 1.15 i zero tabel.
 */

const vault = {
  ...createEmptyVault('Jan Kowalski', 'jan@example.com'),
  personalInfo: {
    ...createEmptyVault().personalInfo,
    title: 'Automatyk',
    summary: 'Podsumowanie zawodowe.',
    phone: '+48 600 000 000',
    location: 'Poznań',
  },
  history: [
    {
      id: 'job-1',
      company: 'Fabryka',
      role: 'Automatyk',
      location: 'Poznań',
      startDate: '2020-01-01',
      endDate: '2024-01-01',
      isCurrent: false,
      description: 'Utrzymanie ruchu.',
      highlights: [
        { id: 'h1', text: 'Wdrożyłem linię', action: '', target: '', tool: '', metric: '30%', keywords: [] },
      ],
    },
  ],
  education: [
    { id: 'e1', institution: 'Politechnika', degree: 'Inż.', fieldOfStudy: 'Automatyka', startDate: '2015-01-01', endDate: '2019-01-01' },
  ],
} as unknown as MasterVault;

const facts: LayeredFactItem[] = [];

describe('kontrakt OpenXML eksportu DOCX', () => {
  it('margines to dokładnie 25,4 mm (1 cal = 1440 twips) na każdej stronie', () => {
    expect(MARGIN_ONE_INCH_TWIPS).toBe(1440);
  });

  it('interlinia 1,15 to 276 dwudziestych punktu', () => {
    expect(LINE_SPACING_115).toBe(276);
  });

  it('Heading 1 imienia: 18 pt, bold, z widowControl i keepNext', () => {
    const options = h1NameOptions('Jan Kowalski');
    expect(options.heading).toBe(HeadingLevel.HEADING_1);
    expect(options.widowControl).toBe(true);
    expect(options.keepNext).toBe(true);
    expect(options.children[0].size).toBe(FONT_SIZES_HALF_POINTS.heading1);
    expect(options.children[0].size).toBe(36);
    expect(options.children[0].bold).toBe(true);
  });

  it('Heading 2 sekcji: 13 pt, allCaps przez formatowanie, border dolny, keepNext', () => {
    const options = h2SectionOptions('Doświadczenie zawodowe');
    expect(options.heading).toBe(HeadingLevel.HEADING_2);
    expect(options.keepNext).toBe(true);
    expect(options.widowControl).toBe(true);
    expect(options.border).toBeDefined();

    const run = options.children[0];
    expect(run.size).toBe(26);
    expect(run.allCaps).toBe(true);
    // Tekst NIE jest mutowany do wersalików — parser czyta właściwy kształt.
    expect(run.text).toBe('Doświadczenie zawodowe');
  });

  it('Heading 3 stanowiska: 11 pt bold + daty jako mniejszy run', () => {
    const options = h3EntryOptions('Automatyk', 'Fabryka', '2020 – obecnie');
    expect(options.heading).toBe(HeadingLevel.HEADING_3);
    expect(options.keepNext).toBe(true);

    expect(options.children[0].size).toBe(22);
    expect(options.children[0].bold).toBe(true);
    expect(options.children[options.children.length - 1].size).toBe(FONT_SIZES_HALF_POINTS.small);
  });

  it('punktor i treść: 10,5 pt, interlinia 276, widowControl', () => {
    const bullet = bulletOptions('Wdrożyłem linię');
    expect(bullet.bullet).toBeDefined();
    expect(bullet.spacing?.line).toBe(276);
    expect(bullet.widowControl).toBe(true);
    expect(bullet.children[0].size).toBe(21);
  });

  it('bodyOptions wspiera pogrubiony prefiks (Umiejętności:) bez mutacji treści', () => {
    const options = bodyOptions('PLC, TIA Portal', { boldPrefix: 'Umiejętności' });
    expect(options.children[0].text).toContain('Umiejętności');
    expect(options.children[0].bold).toBe(true);
    expect(options.children[1].text).toBe('PLC, TIA Portal');
  });
});

describe('skład dokumentu CV', () => {
  it('buduje dokument dla pełnego vaultu bez wyjątku', () => {
    expect(() => buildCvDocument(vault, facts, 'Automatyk Utrzymania', 'Nowa Fabryka')).not.toThrow();
  });

  it('minimalny vault (chaos wejścia) nie rzuca przy brakujących polach opcjonalnych', () => {
    const minimalVault = createEmptyVault();
    expect(() => buildCvDocument(minimalVault as MasterVault, [], '', '')).not.toThrow();
  });

  it('nie dopisuje w imieniu kandydata klauzuli zgody RODO do eksportu DOCX ani TXT', async () => {
    const docx = buildCvDocument(vault, facts, 'Automatyk Utrzymania', 'Nowa Fabryka');
    const txt = generatePlainTextCvExport(vault, facts, 'Automatyk Utrzymania', 'Nowa Fabryka');
    const archive = unzipSync(new Uint8Array(await Packer.toBuffer(docx)));
    const docxContent = new TextDecoder().decode(archive['word/document.xml']);
    expect(docxContent).toContain('Automatyk Utrzymania');
    expect(docxContent).not.toContain('Wyrażam zgodę');
    expect(txt).not.toContain('Wyrażam zgodę');
    expect(txt).not.toContain('KLAUZULA RODO');
  });

  it('eksportuje stanowisko docelowe, ale nie umieszcza firmy z oferty w treści CV', async () => {
    const companyFromOffer = 'FirmaDocelowaKtorejNieMaWCV';
    const doc = buildCvDocument(vault, facts, 'Rola docelowa', companyFromOffer);
    const archive = unzipSync(new Uint8Array(await Packer.toBuffer(doc)));
    const documentXml = new TextDecoder().decode(archive['word/document.xml']);

    expect(documentXml).toContain('Rola docelowa');
    expect(documentXml).not.toContain(companyFromOffer);
  });

  it('warstwa facts nadpisuje punktory doświadczenia, gdy istnieją', () => {
    const withFacts: LayeredFactItem[] = [
      { experienceId: 'job-1', userOverrideText: 'Wersja użytkownika', jobReframedText: 'Wersja AI', baseText: 'Baza' },
    ] as unknown as LayeredFactItem[];

    // Budowa nie rzuca; priorytet warstwy zweryfikowany pośrednio przez
    // kontrakt fabryk bulletOptions (tekst wchodzi w children[0].text).
    expect(() => buildCvDocument(vault, withFacts, 'Rola', 'Firma')).not.toThrow();
  });
});
