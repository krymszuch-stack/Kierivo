/**
 * Ekstrakcja tekstu z PDF do walidacji ATS.
 *
 * Symuluje, co=poszczególne parsery ATS faktycznie widzą w dokumencie.
 * Nie jest to kopia pdfminer.six — to warstwa abstrakcji nad dowolnym
 * źródłem tekstu (PDF, DOCX, surowy tekst), która normalizuje dane
 * wejściowe pod profile vendorów.
 *
 * Ekstrakcja jest wykonywana przez Pythona (pdfminer.six / pikepdf) w
 * `mastervault-cv/mvcv/tools/verify.py`, a ten moduł przetwarza wynik
 * na ustrukturyzowany obiekt konsumowany przez `atsPdfValidator.ts`.
 */

import type { MasterVault } from '../types';

// ---------------------------------------------------------------------------
// Struktury danych
// ---------------------------------------------------------------------------

export interface ExtractedPdfText {
  /** Pełny surowy tekst wyekstrahowany z PDF */
  rawText: string;
  /** Tekst podzielony na linie (zachowuje kolejność czytania) */
  lines: string[];
  /** Wykryte sekcje z ich zawartością */
  sections: ExtractedSection[];
  /** Elementy, które mogły zostać utracone w ekstrakcji */
  potentialLosses: string[];
  /** Czy tekst zawiera Tagged PDF /ActualText? */
  hasActualText: boolean;
  /** Czy wykryto niewidoczny tekst (Tr 3)? */
  hasInvisibleText: boolean;
  /** Liczba znaków w pełnej ekstrakcji */
  totalChars: number;
  /** Liczba słów */
  totalWords: number;
}

export interface ExtractedSection {
  header: string;
  headerAliases: string[];
  content: string;
  lineStart: number;
  lineEnd: number;
  /** Czy sekcja jest pusta lub zbyt krótka? */
  isEmpty: boolean;
}

// ---------------------------------------------------------------------------
// Normalizacja tekstu
// ---------------------------------------------------------------------------

/** Usuwa nadmiarowe białe znaki, normalizuje spacje, zachowuje strukturę linii. */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Tokenizuje tekst na słowa (lowercase, bez interpunkcji). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

// ---------------------------------------------------------------------------
// Detekcja sekcji
// ---------------------------------------------------------------------------

const STANDARD_SECTION_HEADERS: Record<string, string[]> = {
  experience: ['doświadczenie', 'work experience', 'historia zatrudnienia', 'employment history', 'career history', 'professional experience', 'zatrudnienie'],
  education: ['wykształcenie', 'education', 'edukacja', 'academic background', 'wykształcenie i szkolenia'],
  skills: ['umiejętności', 'skills', 'technologie', 'tools', 'competencies', 'core competencies', 'kompetencje', 'technologie i narzędzia'],
  contact: ['kontakt', 'contact', 'dane osobowe', 'personal information', 'dane kontaktowe'],
  certifications: ['certyfikaty', 'certifications', 'uprawnienia', 'licenses', 'licencje'],
  summary: ['podsumowanie', 'summary', 'profil zawodowy', 'professional summary', 'o mnie', 'about me'],
  projects: ['projekty', 'projects', 'portfolio'],
  languages: ['języki', 'languages', 'znajomość języków'],
};

export function detectSections(lines: string[]): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const headerPattern = /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ\s:]+$/u;

  let currentSection: ExtractedSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Sprawdź czy linia jest nagłówkiem sekcji
    const isHeader = headerPattern.test(line) && line.length < 60;
    const matchedKey = isHeader
      ? Object.keys(STANDARD_SECTION_HEADERS).find((key) =>
          STANDARD_SECTION_HEADERS[key].some(
            (alias) => line.toLowerCase().includes(alias) || alias.includes(line.toLowerCase())
          )
        )
      : undefined;

    if (matchedKey && isHeader) {
      // Zamknij poprzednią sekcję
      if (currentSection) {
        currentSection.lineEnd = i - 1;
        currentSection.isEmpty = currentSection.content.trim().length < 10;
        sections.push(currentSection);
      }
      currentSection = {
        header: matchedKey,
        headerAliases: STANDARD_SECTION_HEADERS[matchedKey],
        content: '',
        lineStart: i,
        lineEnd: i,
        isEmpty: false,
      };
    } else if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + line;
    }
  }

  // Zamknij ostatnią sekcję
  if (currentSection) {
    currentSection.lineEnd = lines.length - 1;
    currentSection.isEmpty = currentSection.content.trim().length < 10;
    sections.push(currentSection);
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Ekstrakcja kluczowych elementów
// ---------------------------------------------------------------------------

/** Wyodrębnia dane kontaktowe z tekstu. */
export function extractContactInfo(text: string): {
  emails: string[];
  phones: string[];
  linkedin: string[];
  github: string[];
  locations: string[];
} {
  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.]+/gi;
  const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{2,4}/g;
  const linkedinRegex = /(?:linkedin\.com\/in\/[\w-]+|linkedin\.com\/profiles\/[\w-]+)/gi;
  const githubRegex = /github\.com\/[\w-]+/gi;

  return {
    emails: text.match(emailRegex) ?? [],
    phones: text.match(phoneRegex) ?? [],
    linkedin: text.match(linkedinRegex) ?? [],
    github: text.match(githubRegex) ?? [],
    locations: [], // wymaga NLP lub listy miast
  };
}

/** Wykrywa potencjalne straty w ekstrakcji (elementy wizualne bez odpowiednika tekstowego). */
export function detectPotentialLosses(text: string): string[] {
  const losses: string[] = [];

  // Wskaźniki wizualne (gwiazdki, paski postępu)
  if (/[★☆]{2,}/.test(text) || /[●◐◑]{2,}/.test(text)) {
    losses.push('Wykryto wskaźniki wizualne (gwiazdki/paski) — ATS nie potrafi ich zinterpretować.');
  }

  // Ikony Unicode bez odpowiednika tekstowego
  if (/[◆◇■□▲△]/.test(text)) {
    losses.push('Wykryto ikony Unicode — mogą nie być parsowane przez wszystkie ATS-y.');
  }

  return losses;
}

// ---------------------------------------------------------------------------
// Główna funkcja ekstrakcji (z surowego tekstu)
// ---------------------------------------------------------------------------

/**
 * Przetwarza surowy tekst ekstrahowany z PDF (przez pdfminer.six / pikepdf)
 * na ustrukturyzowany obiekt do walidacji ATS.
 *
 * @param rawText - tekst wyekstrahowany z PDF przez Pythona
 * @param hasActualText - czy Tagged PDF zawiera /ActualText (z verify.py)
 * @param hasInvisibleText - czy wykryto Tr 3 (z verify.py)
 */
export function processExtractedText(
  rawText: string,
  hasActualText = false,
  hasInvisibleText = false
): ExtractedPdfText {
  const normalized = normalizeExtractedText(rawText);
  const lines = normalized.split('\n').filter((l) => l.trim());
  const sections = detectSections(lines);
  const potentialLosses = detectPotentialLosses(normalized);
  const words = tokenize(normalized);

  return {
    rawText: normalized,
    lines,
    sections,
    potentialLosses,
    hasActualText,
    hasInvisibleText,
    totalChars: normalized.length,
    totalWords: words.length,
  };
}

/**
 * Buduje oczekiwany tekst z MasterVault do porównania z ekstrahowanym.
 *
 * To jest "ground truth" — co POWINNO się znaleźć w PDF-ie po ekstrakcji,
 * niezależnie od layoutu wizualnego.
 */
export function buildExpectedText(vault: MasterVault): {
  fullText: string;
  sections: Record<string, string[]>;
  contactInfo: { emails: string[]; phones: string[] };
  skills: string[];
  sectionHeaders: string[];
} {
  const v = vault;
  const sections: Record<string, string[]> = {};

  // Sekcja: kontakt
  sections.contact = [
    v.personalInfo.fullName,
    v.personalInfo.email,
    v.personalInfo.phone,
    v.personalInfo.location,
    v.personalInfo.title,
  ].filter(Boolean);

  // Sekcja: umiejętności
  sections.skills = [
    ...(v.skillsMatrix?.hardSkills ?? []),
    ...(v.skillsMatrix?.toolsAndTech ?? []),
    ...(v.skillsMatrix?.softSkills ?? []),
  ];

  // Sekcja: doświadczenie
  sections.experience = (v.history ?? []).flatMap((job) => [
    `${job.role} — ${job.company}`,
    `${job.startDate || ''} – ${job.endDate || 'obecnie'}`,
    ...job.highlights.map((h) => (typeof h === 'string' ? h : h.text)),
  ]);

  // Sekcja: wykształcenie
  sections.education = (v.education ?? []).flatMap((e) => [
    `${e.degree} — ${e.institution}`,
    e.fieldOfStudy,
  ].filter(Boolean));

  // Sekcja: certyfikaty
  sections.certifications = (v.skillsMatrix?.certifications ?? []).flatMap((c) => [
    c?.name,
    c?.issuer,
  ].filter(Boolean));

  // Sekcja: języki
  sections.languages = (v.profiler?.languages ?? []).map(
    (l) => `${l?.language || ''} ${l?.level || ''}`
  );

  // Sekcja: projekty
  sections.projects = (v.projects ?? []).flatMap((p) => [
    p.name,
    p.description,
    ...(p as { techStack?: string[] })?.techStack ?? [],
  ]);

  const fullText = Object.values(sections).flat().join('\n');

  return {
    fullText,
    sections,
    contactInfo: {
      emails: [v.personalInfo.email].filter(Boolean),
      phones: [v.personalInfo.phone].filter(Boolean),
    },
    skills: sections.skills,
    sectionHeaders: ['Doświadczenie', 'Umiejętności', 'Kontakt'],
  };
}
