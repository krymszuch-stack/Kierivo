/**
 * Adapter mapujący dane MasterVault i opcjonalny TailoredResume z Kierivo
 * na kontrakt wejściowy silnika dwuwarstwowego PDF (mvcv MasterProfile).
 *
 * Zgodność z regułami AGENTS.md:
 * - Reguła 1: Zero wymyślonych danych. Mapujemy wyłącznie to, co użytkownik realnie posiada w profilu.
 * - Reguła 8: Domena to prace techniczne i fizyczne — wsparcie uprawnień SEP/UDT/prawa jazdy.
 */

import { MasterVault, TailoredResume } from '../types';
import { ALL_LICENSES } from '../data/licenses';

export interface SemanticPdfAdapterOptions {
  summaryOverride?: string;
  targetRole?: string;
  companyName?: string;
  sourceId?: string;
  rodoClause?: string;
}

export interface MasterProfilePayload {
  source_id?: string;
  name: string;
  title: string;
  initials: string;
  avatar: string;
  photo?: string;
  contact: {
    phone: string;
    email: string;
    city: string;
    linkedin: string;
    github: string;
    www: string;
  };
  summary: {
    display: string;
    semantic: string;
  };
  skills: Array<{
    label: string;
    semantic: string;
    group: string;
    weight: number;
  }>;
  experience: Array<{
    role: string;
    company: string;
    location: string;
    start: string;
    end: string;
    bullets: Array<{
      kind: 'result' | 'duty';
      display: string;
      semantic: string;
    }>;
    tech?: string[];
  }>;
  education: Array<{
    degree: string;
    school: string;
    start: string;
    end: string;
    note: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    year: string;
    semantic: string;
  }>;
  languages: Array<{
    name: string;
    level: string;
  }>;
  licenses: string[];
  clause?: string;
  projects?: Array<Record<string, unknown>>;
  interests?: string[];
}

function formatPeriodDate(val: string | undefined): string {
  if (!val) return '';
  const trimmed = val.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    return `${match[2]}.${match[1]}`;
  }
  return trimmed;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'CV';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const RESULT_PATTERNS = /\d+|%|zwiększ|zreduk|obniż|wdroż|zbudow|optymaliz|osiągn|przeprowadzi|wykona/i;

/**
 * Warstwa semantyczna ma wiernie powtarzać dowód z profilu.
 * Dawne rozwinięcia dopisywały poziom biegłości, zadania, narzędzia i wyniki,
 * których kandydat nie podał. ATS czyta /ActualText i JSON-LD, więc ukryty opis
 * również jest treścią CV i nie może rozszerzać deklaracji użytkownika.
 */
function preserveSourceText(rawText: string): string {
  return rawText.trim();
}

/**
 * Przekształca MasterVault i opcjonalny TailoredResume w strukturę profilu mvcv.
 */
export function adaptMasterVaultToSemanticProfile(
  vault: MasterVault,
  tailoredResume?: TailoredResume | null,
  options: SemanticPdfAdapterOptions = {}
): MasterProfilePayload {
  const personal = vault.personalInfo || {};

  // 1. Tożsamość i nagłówek
  const fullName = personal.fullName?.trim() || 'Kandydat';
  const initials = getInitials(fullName);
  const targetTitle = (
    options.targetRole ||
    tailoredResume?.targetJobTitle ||
    personal.title ||
    ''
  ).trim();

  // 2. Podsumowanie (z priorytetem wariantu dopasowanego do oferty)
  const displaySummary = (
    options.summaryOverride ||
    tailoredResume?.summary ||
    personal.summary ||
    ''
  ).trim();

  // 3. Dane kontaktowe
  const contact = {
    phone: personal.phone?.trim() || '',
    email: personal.email?.trim() || '',
    city: personal.location?.trim() || '',
    linkedin: personal.linkedin?.trim() || '',
    github: personal.github?.trim() || '',
    www: personal.website?.trim() || '',
  };

  // 4. Umiejętności z wagami i kontekstem semantycznym
  const skills: MasterProfilePayload['skills'] = [];
  const matchedHard = new Set(tailoredResume?.skillsMatched?.hardSkills || []);
  const matchedTools = new Set(tailoredResume?.skillsMatched?.toolsAndTech || []);
  const matchedSoft = new Set(tailoredResume?.skillsMatched?.softSkills || []);

  const hardSkills = vault.skillsMatrix?.hardSkills || [];
  for (const s of hardSkills) {
    if (!s) continue;
    const isMatched = matchedHard.has(s);
    skills.push({
      label: s,
      semantic: preserveSourceText(s),
      group: 'core',
      weight: isMatched ? 12 : 8,
    });
  }

  const tools = vault.skillsMatrix?.toolsAndTech || [];
  for (const t of tools) {
    if (!t) continue;
    const isMatched = matchedTools.has(t);
    skills.push({
      label: t,
      semantic: preserveSourceText(t),
      group: 'tooling',
      weight: isMatched ? 10 : 6,
    });
  }

  const soft = vault.skillsMatrix?.softSkills || [];
  for (const s of soft) {
    if (!s) continue;
    const isMatched = matchedSoft.has(s);
    skills.push({
      label: s,
      semantic: preserveSourceText(s),
      group: 'soft',
      weight: isMatched ? 6 : 4,
    });
  }

  // 5. Doświadczenie zawodowe i punkty osiągnięć
  const tailoredByExpAndText = new Map<string, string>();
  const tailoredByExpId = new Map<string, string>();

  if (tailoredResume?.selectedHighlights) {
    for (const sh of tailoredResume.selectedHighlights) {
      const text = sh.optimizedText || sh.originalText;
      if (text && sh.experienceId) {
        if (sh.originalText) {
          tailoredByExpAndText.set(`${sh.experienceId}:::${sh.originalText.trim()}`, text);
        }
        tailoredByExpId.set(sh.experienceId, text);
      }
    }
  }

  const experience: MasterProfilePayload['experience'] = [];
  const historyList = vault.history || [];

  for (const exp of historyList) {
    const bullets: MasterProfilePayload['experience'][0]['bullets'] = [];
    const techSet = new Set<string>();

    // Podgląd pokazuje opis obok punktów; nie pomijaj go przy eksporcie, gdy
    // doświadczenie ma również osobne highlights.
    if (exp.description?.trim()) {
      bullets.push({
        kind: 'duty',
        display: exp.description.trim(),
        semantic: preserveSourceText(exp.description),
      });
    }

    const expHighlights = exp.highlights || [];
    for (const h of expHighlights) {
      const original = h.text?.trim();
      if (!original) continue;

      const tailoredText =
        tailoredByExpAndText.get(`${exp.id}:::${original}`) ||
        (expHighlights.length === 1 ? tailoredByExpId.get(exp.id) : undefined) ||
        original;

      const text = tailoredText.trim();

      if (h.tool) techSet.add(h.tool);
      if (Array.isArray(h.keywords)) {
        for (const kw of h.keywords) {
          if (kw) techSet.add(kw);
        }
      }

      // Klasyfikacja rezultatu
      const isResult = Boolean(
        (h.metric && h.metric.trim().length > 0) ||
        RESULT_PATTERNS.test(text)
      );

      // Bogaty kontekst semantyczny dla parserów ATS
      const semanticParts: string[] = [text];
      if (h.metric) semanticParts.push(`Rezultat mierzalny: ${h.metric}`);
      if (h.action) semanticParts.push(`Działanie: ${h.action}`);
      if (h.target) semanticParts.push(`Cel: ${h.target}`);
      if (h.tool) semanticParts.push(`Narzędzia: ${h.tool}`);

      bullets.push({
        kind: isResult ? 'result' : 'duty',
        display: text,
        semantic: semanticParts.join(' · '),
      });
    }

    experience.push({
      role: exp.role?.trim() || '',
      company: exp.company?.trim() || '',
      location: exp.location?.trim() || '',
      start: formatPeriodDate(exp.startDate),
      // Brak daty końca nie dowodzi, że praca nadal trwa.
      end: exp.isCurrent ? 'obecnie' : (formatPeriodDate(exp.endDate) || ''),
      bullets,
      tech: Array.from(techSet).slice(0, 5),
    });
  }

  // 6. Edukacja
  const education: MasterProfilePayload['education'] = [];
  for (const edu of vault.education || []) {
    const degParts = [edu.degree, edu.fieldOfStudy].filter(Boolean);
    education.push({
      degree: degParts.join(' — ') || 'Wykształcenie',
      school: edu.institution?.trim() || '',
      start: formatPeriodDate(edu.startDate),
      end: formatPeriodDate(edu.endDate),
      note: edu.description?.trim() || '',
    });
  }

  // 7. Certyfikaty
  const certifications: MasterProfilePayload['certifications'] = [];
  for (const cert of vault.skillsMatrix?.certifications || []) {
    certifications.push({
      name: cert.name?.trim() || '',
      issuer: cert.issuer?.trim() || '',
      year: cert.date ? formatPeriodDate(cert.date) : '',
      semantic: [
        preserveSourceText(cert.name),
        cert.issuer ? `Wydawca: ${cert.issuer}` : '',
        cert.date ? `Data: ${cert.date}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }

  // 8. Języki
  const languages: MasterProfilePayload['languages'] = [];
  for (const lang of vault.profiler?.languages || []) {
    languages.push({
      name: lang.language?.trim() || '',
      level: lang.level?.trim() || '',
    });
  }

  // 9. Uprawnienia formalne (SEP, UDT, prawa jazdy)
  const licenseLabels = new Map(ALL_LICENSES.map((license) => [license.id, license.label]));
  const licenses = (vault.profiler?.licenses || [])
    .filter(Boolean)
    .map((licenseId) => licenseLabels.get(licenseId) || licenseId);

  // 10. Projekty
  const projects = (vault.projects || []).map((p) => ({
    name: p.name,
    role: p.role,
    description: p.description,
    techStack: p.techStack,
    metrics: p.metrics,
    link: p.link,
  }));

  return {
    source_id: options.sourceId || `kierivo://vault/${vault.version || '1'}`,
    name: fullName,
    title: targetTitle,
    initials,
    avatar: 'circle',
    photo: personal.photoUrl?.trim() || '',
    contact,
    summary: {
      display: displaySummary,
      semantic: displaySummary,
    },
    skills,
    experience,
    education,
    certifications,
    languages,
    licenses,
    clause: options.rodoClause?.trim() || '',
    projects,
  };
}
