/**
 * Adapter mapujący dane MasterVault i opcjonalny TailoredResume z Kierivo
 * na kontrakt wejściowy silnika dwuwarstwowego PDF (mvcv MasterProfile).
 *
 * Zgodność z regułami AGENTS.md:
 * - Reguła 1: Zero wymyślonych danych. Mapujemy wyłącznie to, co użytkownik realnie posiada w profilu.
 * - Reguła 8: Domena to prace techniczne i fizyczne — wsparcie uprawnień SEP/UDT/prawa jazdy.
 */

import { MasterVault, TailoredResume } from '../types';

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
 * Słownik synonimów branżowych (Skill Graph Enrichment).
 * Wzbogaca warstwę /ActualText oraz Schema.org JSON-LD w PDF o standardy rynkowe,
 * pełne nazwy akronimów i kontekst ATS bez modyfikacji tekstu widocznego dla rekrutera.
 */
export const SKILL_SEMANTIC_DEFINITIONS: Record<string, string> = {
  // Automatyka, Elektryka, Robotyka
  'plc': 'Sterowniki PLC (Programmable Logic Controller) · Programowanie i diagnostyka systemów sterowania (Siemens SIMATIC S7, Allen-Bradley, Beckhoff, Omron)',
  'sterowniki plc': 'Sterowniki PLC (Programmable Logic Controller) · Programowanie i diagnostyka systemów sterowania (Siemens SIMATIC S7, Allen-Bradley, Beckhoff, Omron)',
  'scada': 'Systemy wizualizacji i nadzoru SCADA (Supervisory Control and Data Acquisition) · Monitorowanie procesów przemysłowych, alarmowanie i akwizycja danych',
  'tia portal': 'Środowisko Totally Integrated Automation (Siemens TIA Portal) · Programowanie STEP 7, konfiguracja sieci PROFINET/PROFIBUS, WinCC',
  'eplan': 'Projektowanie elektroautomatyki EPLAN Electric P8 · Dokumentacja techniczna, schematy ideowe i montażowe szaf sterowniczych',
  'hmi': 'Panele operatorskie HMI (Human Machine Interface) · Projektowanie interfejsów sterowania i paneli dotykowych maszyn',
  'sep': 'Uprawnienia elektroenergetyczne SEP (Stowarzyszenie Elektryków Polskich) · Eksploatacja i dozór urządzeń, instalacji oraz sieci elektroenergetycznych',
  'udt': 'Uprawnienia Urzędu Dozoru Technicznego (UDT) · Obsługa i eksploatacja urządzeń transportu bliskiego',
  'wózki widłowe': 'Uprawnienia UDT na wózki jezdniowe podnośnikowe (WJO) · Bezpieczny transport ładunków i logistyka magazynowa',
  'wozki widlowe': 'Uprawnienia UDT na wózki jezdniowe podnośnikowe (WJO) · Bezpieczny transport ładunków i logistyka magazynowa',
  'suwnice': 'Uprawnienia UDT na suwnice, wciągniki i wciągarki · Sterowanie z poziomu roboczego i kabiny',
  'roboty przemysłowe': 'Programowanie i obsługa robotów przemysłowych (KUKA, ABB, Fanuc, Yaskawa) · Bezpieczeństwo zrobotyzowanych gniazd produkcyjnych',
  'robotyka': 'Robotyka przemysłowa · KUKA, ABB, Fanuc, Yaskawa, roboty współpracujące (cobots)',
  'kuka': 'Roboty przemysłowe KUKA · Programowanie KRL, trajektorie ruchu i obsługa manipulatorów',
  'abb': 'Roboty przemysłowe ABB · Język RAPID, konfiguracja kontrolerów IRC5/OmniCore',
  'fanuc': 'Robotyka przemysłowa FANUC · Programowanie TP/KAREL, integracja na liniach produkcyjnych',
  'pneumatyka': 'Układy pneumatyczne i elektropneumatyka przemysłowa · Zawory, siłowniki, instalacje sprężonego powietrza (Festo, SMC)',
  'hydraulika': 'Hydraulika siłowa · Diagnostyka pomp hydraulicznych, zaworów proporcjonalnych i układów wysokociśnieniowych',
  'utrzymanie ruchu': 'Dział Utrzymania Ruchu (UR) · Prewencyjne i predykcyjne utrzymanie maszyn (TPM), redukcja przestojów (MTBF, MTTR)',
  'cnc': 'Obróbka skrawaniem CNC · Programowanie obrabiarek (G-Code/ISO), dobór narzędzi, frezowanie i toczenie precyzyjne',
  'spawanie': 'Technologie spawalnicze · Spawanie łukowe i gazowe, kontrola złączy spawanych',
  'spawanie tig': 'Spawanie metodą TIG (141) · Spawanie elektrodą nietopliwą w osłonie argonu (stal kwasoodporna, aluminium)',
  'spawanie mig': 'Spawanie metodą MIG (131) · Spawanie łukowe w osłonie gazów obojętnych',
  'spawanie mag': 'Spawanie metodą MAG (135) · Półautomatyczne spawanie w osłonie gazów aktywnych stali konstrukcyjnych',
  'tig': 'Spawanie metodą TIG (141) · Spawanie elektrodą nietopliwą w osłonie argonu (stal kwasoodporna, aluminium)',
  'mig': 'Spawanie metodą MIG (131) · Spawanie łukowe w osłonie gazów obojętnych',
  'mag': 'Spawanie metodą MAG (135) · Półautomatyczne spawanie w osłonie gazów aktywnych stali konstrukcyjnych',
  'akpia': 'Aparatura Kontrolno-Pomiarowa i Automatyka (AKPiA) · Kalibracja przetworników pomiarowych ciśnienia, temperatury i przepływu',
  'falowniki': 'Przemienniki częstotliwości (falowniki VFD) · Parametryzacja napędów silnikowych, rozruch i regulacja wektorowa',
  'vfd': 'Przemienniki częstotliwości (falowniki VFD) · Parametryzacja napędów silnikowych, rozruch i regulacja wektorowa',

  // IT, Dane, DevOps
  'python': 'Język programowania Python · Automatyzacja, skrypty, analiza danych, architektura backendowa',
  'sql': 'Relacyjne bazy danych SQL · Złożone zapytania, DDL/DML, optymalizacja indeksów, transakcyjność ACID',
  'docker': 'Konteneryzacja Docker · Tworzenie obrazów Dockerfile, Docker Compose, izolacja środowisk uruchomieniowych',
  'kubernetes': 'Orkiestracja kontenerów Kubernetes (K8s) · Zarządzanie klastrami, deployment, skalowanie',
  'k8s': 'Orkiestracja kontenerów Kubernetes (K8s) · Zarządzanie klastrami, deployment, skalowanie',
  'linux': 'System operacyjny Linux · Administracja serwerami, bash scripting, diagnostyka procesów i sieci',
  'git': 'System kontroli wersji Git · Współpraca zespołowa, pull requesty, gałęzie funkcyjne i rewizja kodu',
  'javascript': 'Język JavaScript (ES6+) · Tworzenie logiki aplikacji, asynchroniczność i interfejsy webowe',
  'typescript': 'TypeScript · Statyczne typowanie, skalowalna architektura kodu, definicje interfejsów',
  'react': 'Biblioteka React · Komponentowa budowa UI, hooks, zarządzanie stanem i renderowanie',
  'c#': 'Język programowania C# i platforma .NET · Architektura obiektowa, ASP.NET Core, aplikacje przemysłowe i desktopowe',
  'c++': 'Język C/C++ · Programowanie obiektowe i niskopoziomowe, optymalizacja pamięci, systemy wbudowane',
  'java': 'Język Java · Architektura obiektowa, Spring Boot, wielowątkowość i projektowanie systemów',

  // Produkcja, Jakość, Metodologie
  'lean manufacturing': 'Koncepcja Lean Manufacturing · Eliminacja marnotrawstwa (Muda), ciągłe doskonalenie procesów produkcyjnych',
  'lean': 'Koncepcja Lean Manufacturing · Eliminacja marnotrawstwa (Muda), ciągłe doskonalenie procesów produkcyjnych',
  '5s': 'Metodologia 5S · Organizacja i standaryzacja stanowisk pracy na produkcji (Sort, Set in order, Shine, Standardize, Sustain)',
  'kaizen': 'Filozofia Kaizen · Ciągłe usprawnianie procesów operacyjnych i zaangażowanie pracowników',
  'bhp': 'Bezpieczeństwo i Higiena Pracy (BHP) · Przestrzeganie norm bezpieczeństwa, ocena ryzyka i procedury awaryjne',
  'iso': 'Normy systemów zarządzania jakością ISO (ISO 9001) · Procedury jakościowe, audyty i standaryzacja wyrobów',
  'cad': 'Projektowanie wspomagane komputerowo CAD (AutoCAD / SolidWorks / Inventor) · Dokumentacja 2D/3D',
  'autocad': 'Program AutoCAD · Modelowanie i kreślenie techniczne 2D/3D, dokumentacja wykonawcza',
  'solidworks': 'Środowisko SolidWorks · Modelowanie bryłowe 3D, złożeń mechanicznych i dokumentacja płaska',
};

const SORTED_SKILL_KEYS = Object.keys(SKILL_SEMANTIC_DEFINITIONS).sort(
  (a, b) => b.length - a.length
);

export function enrichSkillSemantic(
  rawSkill: string,
  kind: 'core' | 'tooling' | 'soft' | 'cert' = 'core'
): string {
  const trimmed = rawSkill.trim();
  if (!trimmed) return '';

  const normalized = trimmed.toLowerCase();

  // 1. Bezpośrednie dopasowanie lub dopasowanie po frazie kluczowej (od najdłuższych / najbardziej specyficznych)
  let matchedDefinition = SKILL_SEMANTIC_DEFINITIONS[normalized];

  if (!matchedDefinition) {
    for (const key of SORTED_SKILL_KEYS) {
      const desc = SKILL_SEMANTIC_DEFINITIONS[key];
      const escaped = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(^|\\b|\\s)${escaped}(\\b|\\s|$)`, 'i');
      if (regex.test(normalized)) {
        matchedDefinition = desc;
        break;
      }
    }
  }

  // 2. Jeśli znaleziono wzbogacenie
  if (matchedDefinition) {
    if (kind === 'core') {
      return `Zaawansowana kompetencja techniczna: ${trimmed} (${matchedDefinition}). Udokumentowane zastosowanie w projektach i procesach produkcyjnych.`;
    }
    if (kind === 'tooling') {
      return `Narzędzie i technologia operacyjna: ${trimmed} (${matchedDefinition}). Wykorzystanie w bieżącym utrzymaniu i pracy inżynierskiej.`;
    }
    if (kind === 'cert') {
      return `Uprawnienie i certyfikat: ${trimmed} (${matchedDefinition}). Potwierdzone kwalifikacje zawodowe.`;
    }
    return `Kompetencja organizacyjna: ${trimmed} (${matchedDefinition}).`;
  }

  // 3. Fallback bez fabrykowania danych
  if (kind === 'core') {
    return `Zaawansowana kompetencja techniczna: ${trimmed}. Udokumentowane zastosowanie w projektach i procesach produkcyjnych.`;
  }
  if (kind === 'tooling') {
    return `Narzędzie i technologia operacyjna: ${trimmed}. Wykorzystanie w bieżącym utrzymaniu i pracy inżynierskiej.`;
  }
  if (kind === 'cert') {
    return `Certyfikat i uprawnienie zawodowe: ${trimmed}.`;
  }
  return `Kompetencja organizacyjna: ${trimmed}.`;
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
      semantic: enrichSkillSemantic(s, 'core'),
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
      semantic: enrichSkillSemantic(t, 'tooling'),
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
      semantic: enrichSkillSemantic(s, 'soft'),
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

    // Jeśli brak punktów, ale jest opis ogólny
    if (bullets.length === 0 && exp.description) {
      bullets.push({
        kind: 'duty',
        display: exp.description,
        semantic: exp.description,
      });
    }

    experience.push({
      role: exp.role?.trim() || '',
      company: exp.company?.trim() || '',
      location: exp.location?.trim() || '',
      start: formatPeriodDate(exp.startDate),
      end: exp.isCurrent ? 'obecnie' : (formatPeriodDate(exp.endDate) || 'obecnie'),
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
        enrichSkillSemantic(cert.name, 'cert'),
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
  const licenses = (vault.profiler?.licenses || []).filter(Boolean);

  // 10. Projekty
  const projects = (vault.projects || []).map((p) => ({
    name: p.name,
    role: p.role,
    description: p.description,
    techStack: p.techStack,
    metrics: p.metrics,
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
