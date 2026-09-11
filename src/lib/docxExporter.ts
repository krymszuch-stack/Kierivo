import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { MasterVault, LayeredFactItem } from '../types';
import { reportClientError } from './errorReporter';

/**
 * Natywny eksport .docx pod parsery ATS (czytelność maszynowa, układ jednokolumnowy).
 *
 * Twardy kontrakt hierarchii OpenXML — bez wyjątków:
 * - marginesy dokładnie 25,4 mm (1 cal = 1440 twips) ze wszystkich stron;
 * - płaska hierarchia: Heading 1 wyłącznie imię i nazwisko (18 pt),
 *   Heading 2 sekcje główne (13 pt, wersaliki przez FORMATOWANIE, nie przez
 *   mutację tekstu — parser czyta „Doświadczenie", nie „DOŚWIADCZENIE",
 *   a rekruter widzi wersaliki), Heading 3 stanowiska (11 pt);
 * - treść i punktory jako Normal 10,5 pt z interlinią 1,15 (line = 276/240);
 * - `widowControl` wszędzie oraz `keepNext` na nagłówkach sekcji i stanowisk
 *   (w terminologii Worda: keep with next — nagłówek nigdy nie zostaje
 *   sam na końcu strony);
 * - zero tabel, zero ramek pływających: wyłącznie czysty potok akapitowy,
 *   bo tabele w legacy parserach czytane są wierszami i mieszają etykiety
 *   z wartościami.
 *
 * Kolor tekstu celowo czarny (#000000): szare odcienie giną na słabych
 * drukarkach i przy OCR starszych systemów. Kontrast to cecha
 * parserowalności, nie estetyka.
 *
 * Architektura testowalności: fabryki poniżej zwracają **gołe literały opcji**
 * (CvParagraphOptions), które testy czytają wprost. Mapowanie na klasy biblioteki
 * (`new Paragraph` / `new TextRun`) dzieje się wyłącznie w dwóch wierszach
 * `toDocxParagraph`/`toDocxRun` — biblioteka opakowuje opcje w nieprzejrzyste
 * instancje, więc testowanie po jej stronie byłoby zgadywaniem.
 */

/** 1 cal w twipsach — jednostka marginesów OpenXML. */
export const MARGIN_ONE_INCH_TWIPS = 1440;

/** Interlinia 1,15 w jednostkach dwudziestych punktu: 240 × 1,15. */
export const LINE_SPACING_115 = 276;

/** Rozmiary w półpunktach (docx mierzy size w half-points). */
export const FONT_SIZES_HALF_POINTS = {
  heading1: 36, // 18 pt
  heading2: 26, // 13 pt
  heading3: 22, // 11 pt
  body: 21, // 10,5 pt
  small: 18, // 9 pt
  finePrint: 16, // 8 pt
} as const;

const BLACK = '000000';
const FONT = 'Calibri';

// ---------------------------------------------------------------------------
// Czyste kształty opcji (testowalne) i cienkie mapowanie na docx
// ---------------------------------------------------------------------------

export interface CvRunOptions {
  text: string;
  bold?: boolean;
  size: number;
  color: string;
  font: string;
  allCaps?: boolean;
  italics?: boolean;
}

export interface CvParagraphOptions {
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  alignment?: typeof AlignmentType.LEFT;
  widowControl?: boolean;
  keepNext?: boolean;
  bullet?: { level: number };
  spacing?: { before?: number; after?: number; line?: number };
  border?: {
    bottom: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string; space: number };
  };
  children: CvRunOptions[];
}

function toDocxRun(options: CvRunOptions): TextRun {
  return new TextRun(options);
}

function toDocxParagraph(options: CvParagraphOptions): Paragraph {
  return new Paragraph({
    ...options,
    children: options.children.map(toDocxRun),
  });
}

// ---------------------------------------------------------------------------
// Fabryki akapitów CV
// ---------------------------------------------------------------------------

export function h1NameOptions(name: string): CvParagraphOptions {
  return {
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    widowControl: true,
    keepNext: true,
    spacing: { before: 0, after: 60 },
    children: [
      { text: name, bold: true, size: FONT_SIZES_HALF_POINTS.heading1, color: BLACK, font: FONT },
    ],
  };
}

export function h2SectionOptions(title: string): CvParagraphOptions {
  return {
    heading: HeadingLevel.HEADING_2,
    widowControl: true,
    keepNext: true,
    spacing: { before: 280, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 },
    },
    children: [
      // Wersaliki formatowaniem, nie mutacją tekstu — patrz komentarz modułu.
      { text: title, bold: true, size: FONT_SIZES_HALF_POINTS.heading2, color: BLACK, font: FONT, allCaps: true },
    ],
  };
}

export function h3EntryOptions(role: string, company: string, dates: string): CvParagraphOptions {
  return {
    heading: HeadingLevel.HEADING_3,
    widowControl: true,
    keepNext: true,
    spacing: { before: 160, after: 40 },
    children: [
      { text: role, bold: true, size: FONT_SIZES_HALF_POINTS.heading3, color: BLACK, font: FONT },
      { text: ` — ${company}`, bold: true, size: FONT_SIZES_HALF_POINTS.heading3, color: BLACK, font: FONT },
      { text: ` | ${dates}`, size: FONT_SIZES_HALF_POINTS.small, color: BLACK, font: FONT },
    ],
  };
}

export function bulletOptions(text: string): CvParagraphOptions {
  return {
    bullet: { level: 0 },
    widowControl: true,
    spacing: { after: 40, line: LINE_SPACING_115 },
    children: [{ text, size: FONT_SIZES_HALF_POINTS.body, color: BLACK, font: FONT }],
  };
}

export function bodyOptions(
  text: string,
  extra?: Partial<{ before: number; after: number; boldPrefix: string }>
): CvParagraphOptions {
  const children: CvRunOptions[] = [];
  if (extra?.boldPrefix) {
    children.push({ text: `${extra.boldPrefix}: `, bold: true, size: FONT_SIZES_HALF_POINTS.body, color: BLACK, font: FONT });
  }
  children.push({ text, size: FONT_SIZES_HALF_POINTS.body, color: BLACK, font: FONT });

  return {
    widowControl: true,
    spacing: { before: extra?.before ?? 0, after: extra?.after ?? 80, line: LINE_SPACING_115 },
    children,
  };
}

function contactLineOptions(text: string): CvParagraphOptions {
  return {
    widowControl: true,
    spacing: { after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 },
    },
    children: [{ text, size: FONT_SIZES_HALF_POINTS.small, color: BLACK, font: FONT }],
  };
}

function finePrintOptions(text: string): CvParagraphOptions {
  return {
    widowControl: true,
    spacing: { before: 240 },
    children: [{ text, italics: true, size: FONT_SIZES_HALF_POINTS.finePrint, color: BLACK, font: FONT }],
  };
}

function datesOf(start: string, end: string, isCurrent: boolean): string {
  return `${start || '—'} – ${isCurrent ? 'obecnie' : end || '—'}`;
}

export interface BuildCvDocumentOptions {
  /** Nadpisanie podsumowania zawodowego (np. z dopasowanego tailoredResume.summary) */
  summaryOverride?: string;
}

/**
 * Składa dokument CV wyłącznie z akapitów. Eksportowana do testów — download
 * to cienka nakładka na tej funkcji.
 */
export function buildCvDocument(
  vault: MasterVault,
  layeredFacts: LayeredFactItem[],
  targetRole: string,
  companyName: string,
  options: BuildCvDocumentOptions = {}
): Document {
  const name = vault.personalInfo?.fullName?.trim() || 'Kandydat';
  const docTitle = targetRole || vault.personalInfo?.title || '';

  const paragraphs: CvParagraphOptions[] = [];

  // --- Nagłówek kandydata (jedyny Heading 1 w dokumencie) ---
  paragraphs.push(h1NameOptions(name));

  if (docTitle || companyName) {
    paragraphs.push(bodyOptions([docTitle, companyName].filter(Boolean).join(' — '), { after: 40 }));
  }

  // Kontakt pod linią oddzielającą — jeden akapit, zero tabel układu.
  const contact = [
    vault.personalInfo?.email ? `E-mail: ${vault.personalInfo.email}` : '',
    vault.personalInfo?.phone ? `Tel: ${vault.personalInfo.phone}` : '',
    vault.personalInfo?.location ? `Lokalizacja: ${vault.personalInfo.location}` : '',
  ]
    .filter(Boolean)
    .join('  |  ');

  if (contact) paragraphs.push(contactLineOptions(contact));

  // --- Podsumowanie ---
  // Preferowana kolejność: tailored summary ze snapshotu/dopasowania -> vault.personalInfo.summary
  const effectiveSummary = options.summaryOverride?.trim() || vault.personalInfo?.summary?.trim();
  if (effectiveSummary) {
    paragraphs.push(h2SectionOptions('Podsumowanie zawodowe'));
    paragraphs.push(bodyOptions(effectiveSummary, { after: 160 }));
  }

  // --- Doświadczenie ---
  const history = vault.history ?? [];
  if (history.length > 0) {
    paragraphs.push(h2SectionOptions('Doświadczenie zawodowe'));

    for (const exp of history) {
      paragraphs.push(
        h3EntryOptions(exp.role || 'Stanowisko', exp.company || '', datesOf(exp.startDate, exp.endDate, exp.isCurrent))
      );

      if (exp.description?.trim()) paragraphs.push(bodyOptions(exp.description));

      const facts = layeredFacts.filter((fact) => fact.experienceId === exp.id);
      const bullets =
        facts.length > 0
          ? facts.map((fact) => fact.userOverrideText || fact.jobReframedText || fact.baseText)
          : (exp.highlights ?? []).map((highlight) =>
              typeof highlight === 'string' ? highlight : highlight.text
            );

      for (const text of bullets.filter(Boolean)) {
        paragraphs.push(bulletOptions(text));
      }
    }
  }

  // --- Umiejętności ---
  const hardSkills = (vault.skillsMatrix?.hardSkills ?? []).join(', ');
  const tools = (vault.skillsMatrix?.toolsAndTech ?? []).join(', ');
  const softSkills = (vault.skillsMatrix?.softSkills ?? []).join(', ');

  if (hardSkills || tools || softSkills) {
    paragraphs.push(h2SectionOptions('Umiejętności i narzędzia'));
    if (hardSkills) paragraphs.push(bodyOptions(hardSkills, { boldPrefix: 'Umiejętności' }));
    if (tools) paragraphs.push(bodyOptions(tools, { boldPrefix: 'Narzędzia' }));
    if (softSkills) paragraphs.push(bodyOptions(softSkills, { boldPrefix: 'Kompetencje', after: 160 }));
  }

  // --- Wykształcenie ---
  const education = vault.education ?? [];
  if (education.length > 0) {
    paragraphs.push(h2SectionOptions('Wykształcenie'));
    for (const edu of education) {
      paragraphs.push(
        h3EntryOptions(edu.degree || edu.fieldOfStudy || 'Szkoła', edu.institution || '', datesOf(edu.startDate, edu.endDate, false))
      );
      if (edu.description?.trim()) paragraphs.push(bodyOptions(edu.description));
    }
  }

  // --- Projekty ---
  const projects = vault.projects ?? [];
  if (projects.length > 0) {
    paragraphs.push(h2SectionOptions('Projekty'));
    for (const project of projects) {
      paragraphs.push(h3EntryOptions(project.name, project.role || '', project.techStack?.join(', ') ?? ''));
      if (project.description?.trim()) paragraphs.push(bodyOptions(project.description));
      if (project.metrics?.trim()) paragraphs.push(bulletOptions(project.metrics));
    }
  }

  // --- Języki i uprawnienia ---
  const languages = (vault.profiler?.languages ?? [])
    .map((language) => `${language?.language || ''} — ${language?.level || ''}`)
    .filter((entry) => entry !== ' — ')
    .join(', ');
  const licenses = (vault.profiler?.licenses ?? []).join(', ');
  const certifications = (vault.skillsMatrix?.certifications ?? [])
    .map((certification) => certification?.name)
    .filter(Boolean)
    .join(', ');

  if (languages || licenses || certifications) {
    paragraphs.push(h2SectionOptions('Języki i uprawnienia'));
    if (languages) paragraphs.push(bodyOptions(languages, { boldPrefix: 'Języki obce' }));
    if (licenses) paragraphs.push(bodyOptions(licenses, { boldPrefix: 'Uprawnienia' }));
    if (certifications) paragraphs.push(bodyOptions(certifications, { boldPrefix: 'Certyfikaty', after: 160 }));
  }

  // --- Klauzula RODO ---
  paragraphs.push(
    finePrintOptions(
      'Wyrażam zgodę na przetwarzanie moich danych osobowych dla potrzeb niezbędnych do realizacji procesu rekrutacji zgodnie z rozporządzeniem RODO.'
    )
  );

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              // A4 w twipsach: 210 × 297 mm — standard polskiego rynku pracy.
              width: 11906,
              height: 16838,
            },
            margin: {
              top: MARGIN_ONE_INCH_TWIPS,
              right: MARGIN_ONE_INCH_TWIPS,
              bottom: MARGIN_ONE_INCH_TWIPS,
              left: MARGIN_ONE_INCH_TWIPS,
            },
          },
        },
        children: paragraphs.map(toDocxParagraph),
      },
    ],
  });
}

/**
 * Pobiera CV jako plik .docx. Nazwa wg schematu: CV_[Nazwisko]_[Firma]_[Stanowisko].docx
 */
export async function downloadNativeDocxCv(
  vault: MasterVault,
  layeredFacts: LayeredFactItem[],
  targetRole: string,
  companyName: string,
  options: BuildCvDocumentOptions = {}
): Promise<void> {
  try {
    const doc = buildCvDocument(vault, layeredFacts, targetRole, companyName, options);
    const blob = await Packer.toBlob(doc);

    const cleanName = (vault.personalInfo?.fullName || 'Kandydat').replace(/\s+/g, '_');
    const cleanCompany = (companyName || 'Aplikacja').replace(/\s+/g, '_');
    const cleanTitle = ((targetRole || vault.personalInfo?.title) || 'Stanowisko').replace(/\s+/g, '_');
    const fileName = `CV_${cleanName}_${cleanCompany}_${cleanTitle}.docx`;

    saveAs(blob, fileName);
  } catch (error) {
    // Zgłoszenie jest zanonimizowane (sanityzer) i nie zmienia zachowania dla
    // wywołującego: wyjątek leci dalej, żeby interfejs mógł pokazać swój błąd.
    reportClientError({ kind: 'cv-export', surface: 'docxExporter', error });
    throw error;
  }
}
