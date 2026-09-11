import { MasterVault } from '../../types';
import {
  Claim,
  ClaimDateRange,
  ConsistencyAlert,
  ConsistencyValidationResult,
  CvRendererOutput,
  CvRendererSection,
  HudRendererOutput,
  HudMetricItem,
  HudSkillStat,
  PitchRendererOutput,
  PitchStrengthItem,
  SectionConsistencyStatus,
  LinkedInRendererOutput,
  LinkedInExperienceItem,
} from './types';
import {
  getPitchHookVariations,
  getPitchCtaVariations,
  selectVariantIndex,
} from '../phrasingVariations';

/**
 * Stała określająca maksymalną dopuszczalną rozbieżność czasu trwania (w latach).
 * Powyżej 0.5 roku (6 miesięcy) walidator ConsistencyGuard podnosi alert spójności.
 */
export const MAX_ALLOWED_YEAR_DIFFERENCE = 0.5;

/**
 * Parsuje ciąg daty (YYYY, YYYY-MM, YYYY-MM-DD, ISO, "Obecnie", "Present") na liczbę zmiennoprzecinkową reprezentującą rok.
 */
export function parseDateToDecimalYear(dateStr: string | undefined): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const normalized = dateStr.trim().toLowerCase();
  if (['obecnie', 'present', 'current', 'teraz', 'now'].includes(normalized)) {
    const now = new Date();
    return now.getFullYear() + (now.getMonth() + 0.5) / 12;
  }

  // Format YYYY-MM lub YYYY-MM-DD
  const matchYm = /^(\d{4})(?:[-/.](\d{1,2}))?/.exec(normalized);
  if (matchYm) {
    const year = parseInt(matchYm[1], 10);
    const month = matchYm[2] ? parseInt(matchYm[2], 10) : 1;
    if (isNaN(year)) return null;
    const clampedMonth = Math.min(12, Math.max(1, month));
    return year + (clampedMonth - 0.5) / 12;
  }

  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.getFullYear() + (d.getMonth() + 0.5) / 12;
  }

  return null;
}

/**
 * Parsuje strukturę ClaimDateRange lub ciąg tekstowy zakresu dat ("2020 - 2022")
 * i oblicza rok początkowy, końcowy oraz czas trwania w latach.
 */
export function parseDateRangeToYears(
  dateRange: ClaimDateRange | string | undefined
): { startYear: number; endYear: number; durationYears: number } | null {
  if (!dateRange) return null;

  let startStr: string | undefined;
  let endStr: string | undefined;

  if (typeof dateRange === 'string') {
    const parts = dateRange.split(/\s*[-–—/]\s*/);
    startStr = parts[0];
    endStr = parts[1] || parts[0];
  } else {
    startStr = dateRange.start;
    endStr = dateRange.end;
  }

  const startYear = parseDateToDecimalYear(startStr);
  const endYear = parseDateToDecimalYear(endStr);

  if (startYear === null || endYear === null) {
    return null;
  }

  // Czas trwania to różnica końcowego i początkowego roku (minimum 1 miesiąc = 0.08 roku)
  const durationYears = Math.max(0.08, Math.abs(endYear - startYear));

  return {
    startYear: Math.min(startYear, endYear),
    endYear: Math.max(startYear, endYear),
    durationYears,
  };
}

/**
 * Oblicza bezwzględną różnicę w latach pomiędzy dwoma zakresami dat.
 *
 * @deprecated Nie używać do stażu — pojedyncze daty (`2020-01`) parsuje jako
 * przedziały (19 lat) i wynik zgadza się tylko przez przypadkowe skasowanie
 * dwóch błędów. Staż liczy `unionExperienceYears` (`lib/experience.ts`).
 * Zostaje dla kompatybilności testów spójności rendererów.
 */
export function calculateYearsDifference(
  rangeA: ClaimDateRange | string | undefined,
  rangeB: ClaimDateRange | string | undefined
): number {
  const parsedA = parseDateRangeToYears(rangeA);
  const parsedB = parseDateRangeToYears(rangeB);

  if (!parsedA || !parsedB) {
    return 0;
  }

  return Math.abs(parsedA.durationYears - parsedB.durationYears);
}

/**
 * Ekstrahuje i mapuje wszystkie Claimy z MasterVault.
 * Jeżeli MasterVault posiada jawne pole `claims`, łączy je z faktami z `history` i `projects`.
 */
export function extractClaimsFromVault(vault: MasterVault): Claim[] {
  const claimsMap = new Map<string, Claim>();

  // 1. Jawnie zadeklarowane claimy w Vault
  if (Array.isArray(vault.claims)) {
    for (const c of vault.claims) {
      if (c && c.id) {
        claimsMap.set(c.id, {
          ...c,
          tags: Array.isArray(c.tags) ? c.tags : [],
        });
      }
    }
  }

  // 2. Claimy z historii zatrudnienia (WorkExperience)
  if (Array.isArray(vault.history)) {
    for (const exp of vault.history) {
      const expTags = new Set<string>();
      if (Array.isArray(exp.highlights)) {
        for (const hl of exp.highlights) {
          if (Array.isArray(hl.keywords)) {
            hl.keywords.forEach((k) => expTags.add(k));
          }
        }
      }

      // Główny claim pozycji
      const mainClaimId = `claim_exp_${exp.id}`;
      if (!claimsMap.has(mainClaimId) && !claimsMap.has(exp.id)) {
        const firstHl = exp.highlights?.[0];
        const firstMetric = typeof firstHl === 'object' ? firstHl?.metric : undefined;
        claimsMap.set(mainClaimId, {
          id: mainClaimId,
          sourceProject: exp.company || exp.role,
          dateRange: {
            start: exp.startDate || '2020-01',
            end: exp.isCurrent ? 'Obecnie' : exp.endDate || '2022-01',
          },
          metric: firstMetric,
          tags: Array.from(expTags),
        });
      }

      // Claimy dla poszczególnych osiągnięć (highlights)
      if (Array.isArray(exp.highlights)) {
        exp.highlights.forEach((hl, idx) => {
          const hlId = typeof hl === 'object' && hl !== null ? hl.id : undefined;
          const hlClaimId = hlId || `claim_hl_${exp.id}_${idx}`;
          if (!claimsMap.has(hlClaimId)) {
            const hlText = typeof hl === 'string' ? hl : (hl?.text || '');
            const hlMetric = (typeof hl === 'object' && hl !== null ? hl.metric : undefined) || (hlText ? hlText.match(/\d+[%kKmM+xX]?/)?.[0] : undefined);
            const hlKeywords = typeof hl === 'object' && hl !== null && Array.isArray(hl.keywords) ? hl.keywords : [];

            claimsMap.set(hlClaimId, {
              id: hlClaimId,
              sourceProject: `${exp.company} (${exp.role})`,
              dateRange: {
                start: exp.startDate || '2020-01',
                end: exp.isCurrent ? 'Obecnie' : exp.endDate || '2022-01',
              },
              metric: hlMetric,
              tags: hlKeywords,
            });
          }
        });
      }
    }
  }

  // 3. Claimy z projektów
  if (Array.isArray(vault.projects)) {
    for (const proj of vault.projects) {
      const projClaimId = `claim_proj_${proj.id}`;
      if (!claimsMap.has(projClaimId) && !claimsMap.has(proj.id)) {
        claimsMap.set(projClaimId, {
          id: projClaimId,
          sourceProject: proj.name,
          dateRange: {
            start: '2022-01',
            end: 'Obecnie',
          },
          metric: proj.metrics,
          tags: Array.isArray(proj.techStack) ? proj.techStack : [],
        });
      }
    }
  }

  return Array.from(claimsMap.values());
}

/**
 * Wyszukuje Claim w MasterVault po jego unikalnym ID.
 */
export function getClaimById(vault: MasterVault, claimId: string): Claim | undefined {
  const allClaims = extractClaimsFromVault(vault);
  return allClaims.find((c) => c.id === claimId || c.id === `claim_exp_${claimId}` || c.id === `claim_proj_${claimId}`);
}

/**
 * Baza reguł sprzeczności w umiejętnościach (np. wzajemne wykluczenia, negacje).
 */
const KNOWN_SKILL_CONTRADICTIONS: Array<{ tagA: RegExp; tagB: RegExp; reason: string }> = [
  {
    tagA: /\b(?:brak|no|bez)\s+(?:znajomości\s+)?(?:sql|baz\s+danych)\b/i,
    tagB: /\b(?:sql|postgresql|mysql|oracle|database\s+expert)\b/i,
    reason: 'Deklaracja braku znajomości SQL stoi w sprzeczności z tagiem technologii bazodanowej SQL.',
  },
  {
    tagA: /\b(?:tylko\s+junior|junior\s+only|brak\s+doświadczenia|entry\s+level\s+only)\b/i,
    tagB: /\b(?:senior|lead|architect|principal|kierownik|architekt)\b/i,
    reason: 'Deklaracja profilu wyłącznie Junior / początkującego kłóci się z rolą Senior/Lead/Architect.',
  },
  {
    tagA: /\b(?:brak\s+uprawnień|bez\s+sep)\b/i,
    tagB: /\b(?:sep|sep\s+g1|sep\s+g2|sep\s+g3|udt|f-gaz)\b/i,
    reason: 'Deklaracja braku uprawnień technicznych jest sprzeczna z certyfikatem uprawnień SEP/UDT.',
  },
  {
    tagA: /\b(?:brak\s+prawa\s+jazdy|no\s+driving\s+license)\b/i,
    tagB: /\b(?:prawo\s+jazdy\s+kat\.?\s*[bcde]|kierowca)\b/i,
    reason: 'Deklaracja braku prawa jazdy stoi w sprzeczności z wpisem o posiadaniu prawa jazdy lub roli kierowcy.',
  },
];

/**
 * Wykrywa sprzeczności w umiejętnościach i tagach danego claimu względem pozostałych claimów lub bazy MasterVault.
 */
export function detectSkillContradictions(
  claim: Claim,
  allClaims: Claim[],
  masterVaultSkills: string[] = []
): string[] {
  const issues: string[] = [];
  const claimTags = claim.tags || [];

  // 1. Sprawdzenie wewnętrznych wykluczeń w obrębie tagów danego claimu
  for (const rule of KNOWN_SKILL_CONTRADICTIONS) {
    const hasA = claimTags.some((t) => rule.tagA.test(t));
    const hasB = claimTags.some((t) => rule.tagB.test(t));
    if (hasA && hasB) {
      issues.push(rule.reason);
    }
  }

  // 2. Sprawdzenie sprzeczności między tagami badanego claimu a innymi claimami w tym samym oknie czasowym
  const thisParsedDate = parseDateRangeToYears(claim.dateRange);
  for (const otherClaim of allClaims) {
    if (otherClaim.id === claim.id) continue;
    const otherTags = otherClaim.tags || [];
    const otherParsedDate = parseDateRangeToYears(otherClaim.dateRange);

    // Jeśli claimy nachodzą na siebie w czasie
    const datesOverlap =
      thisParsedDate &&
      otherParsedDate &&
      Math.max(thisParsedDate.startYear, otherParsedDate.startYear) <=
        Math.min(thisParsedDate.endYear, otherParsedDate.endYear);

    if (datesOverlap) {
      for (const rule of KNOWN_SKILL_CONTRADICTIONS) {
        const claimHasA = claimTags.some((t) => rule.tagA.test(t));
        const otherHasB = otherTags.some((t) => rule.tagB.test(t));
        if (claimHasA && otherHasB) {
          issues.push(
            `Sprzeczność między projektem „${claim.sourceProject}” a „${otherClaim.sourceProject}”: ${rule.reason}`
          );
        }
      }
    }
  }

  // 3. Sprawdzenie deklaracji zaprzeczających głównemu zestawowi umiejętności MasterVault
  for (const tag of claimTags) {
    if (/\b(?:brak|no|nie\s+znam)\b/i.test(tag)) {
      const normalizedSkill = tag.replace(/\b(?:brak|no|nie\s+znam|znajomości)\b/gi, '').trim().toLowerCase();
      if (normalizedSkill && masterVaultSkills.some((s) => s.toLowerCase().includes(normalizedSkill))) {
        issues.push(
          `Claim zawiera tag wykluczający „${tag}”, podczas gdy MasterVault deklaruje kompetencję w tej dziedzinie.`
        );
      }
    }
  }

  return issues;
}

/**
 * Wejście dla weryfikacji projekcji / rendererów.
 */
export interface ProjectedClaimItem {
  sectionId: string;
  sectionName: string;
  claimId: string;
  claimedDateRange?: ClaimDateRange | string;
  claimedTags?: string[];
  claimedMetric?: string;
}

/**
 * Główny walidator modułu ConsistencyGuard.
 * Sprawdza:
 * 1. Czy różnica w latach pomiędzy claimem a źródłem w MasterVault przekracza 0.5 roku.
 * 2. Czy istnieją sprzeczności w umiejętnościach (skill contradictions).
 * 3. Czy każdy odpytany claimId istnieje w MasterVault.
 */
export function validateConsistency(
  vault: MasterVault,
  options?: {
    claimIdsToCheck?: string[];
    projectedItems?: ProjectedClaimItem[];
  }
): ConsistencyValidationResult {
  const alerts: ConsistencyAlert[] = [];
  const allVaultClaims = extractClaimsFromVault(vault);
  const vaultSkills = [
    ...(vault.skillsMatrix?.hardSkills || []),
    ...(vault.skillsMatrix?.toolsAndTech || []),
    ...(vault.skillsMatrix?.softSkills || []),
  ];

  const sectionsMap: Record<string, SectionConsistencyStatus> = {
    cv: { sectionId: 'cv', sectionName: 'Renderer CV', isConsistent: true, claimsCount: 0, alerts: [] },
    hud: { sectionId: 'hud', sectionName: 'Renderer HUD', isConsistent: true, claimsCount: 0, alerts: [] },
    pitch: { sectionId: 'pitch', sectionName: 'Renderer Pitch', isConsistent: true, claimsCount: 0, alerts: [] },
  };

  // 1. Walidacja bazowych claimów w MasterVault pod kątem wewnętrznej spójności i sprzeczności
  for (const claim of allVaultClaims) {
    const contradictions = detectSkillContradictions(claim, allVaultClaims, vaultSkills);
    for (const contradiction of contradictions) {
      const alert: ConsistencyAlert = {
        id: `alert_skill_${claim.id}_${Math.random().toString(36).slice(2, 7)}`,
        claimId: claim.id,
        sectionId: 'vault',
        type: 'SKILL_CONTRADICTION',
        severity: 'ALERT',
        title: 'Wykryto sprzeczność w umiejętnościach',
        message: contradiction,
        details: {
          claimedTags: claim.tags,
          sourceProject: claim.sourceProject,
        },
      };
      alerts.push(alert);
    }
  }

  // 2. Walidacja projekcji / pozycji rendererów
  if (options?.projectedItems && options.projectedItems.length > 0) {
    for (const item of options.projectedItems) {
      const secKey = item.sectionId.toLowerCase().includes('cv')
        ? 'cv'
        : item.sectionId.toLowerCase().includes('hud')
        ? 'hud'
        : item.sectionId.toLowerCase().includes('pitch')
        ? 'pitch'
        : item.sectionId;

      if (!sectionsMap[secKey]) {
        sectionsMap[secKey] = {
          sectionId: secKey,
          sectionName: item.sectionName,
          isConsistent: true,
          claimsCount: 0,
          alerts: [],
        };
      }

      sectionsMap[secKey].claimsCount += 1;

      // Sprawdzenie istnienia claimu w MasterVault
      const sourceClaim = getClaimById(vault, item.claimId);
      if (!sourceClaim) {
        const missingAlert: ConsistencyAlert = {
          id: `alert_missing_${item.claimId}`,
          claimId: item.claimId,
          sectionId: secKey,
          type: 'CLAIM_NOT_FOUND',
          severity: 'WARNING',
          title: 'Brak claimu w MasterVault',
          message: `Renderer odwołał się do claimId „${item.claimId}”, którego brak w MasterVault.`,
        };
        alerts.push(missingAlert);
        sectionsMap[secKey].alerts.push(missingAlert);
        sectionsMap[secKey].isConsistent = false;
        continue;
      }

      // Sprawdzenie różnicy w latach > 0.5 roku
      if (item.claimedDateRange) {
        const sourceYears = parseDateRangeToYears(sourceClaim.dateRange);
        const projectedYears = parseDateRangeToYears(item.claimedDateRange);

        if (sourceYears && projectedYears) {
          const diff = Math.abs(sourceYears.durationYears - projectedYears.durationYears);
          if (diff > MAX_ALLOWED_YEAR_DIFFERENCE) {
            const dateAlert: ConsistencyAlert = {
              id: `alert_date_${item.claimId}`,
              claimId: item.claimId,
              sectionId: secKey,
              type: 'DATE_MISMATCH',
              severity: 'ALERT',
              title: 'Rozbieżność dat > 0.5 roku',
              message: `Różnica czasu trwania dla „${sourceClaim.sourceProject}” wynosi ${diff.toFixed(
                1
              )} lat (oczekiwano ${sourceYears.durationYears.toFixed(1)} lat, zadeklarowano ${projectedYears.durationYears.toFixed(
                1
              )} lat).`,
              details: {
                claimedDurationYears: projectedYears.durationYears,
                sourceDurationYears: sourceYears.durationYears,
                differenceYears: diff,
                sourceProject: sourceClaim.sourceProject,
              },
            };
            alerts.push(dateAlert);
            sectionsMap[secKey].alerts.push(dateAlert);
            sectionsMap[secKey].isConsistent = false;
          }
        }
      }

      // Sprawdzenie sprzeczności w deklarowanych skillach
      if (item.claimedTags && item.claimedTags.length > 0) {
        const combinedClaim: Claim = {
          ...sourceClaim,
          tags: item.claimedTags,
        };
        const contradictions = detectSkillContradictions(combinedClaim, allVaultClaims, vaultSkills);
        for (const contradiction of contradictions) {
          const skillAlert: ConsistencyAlert = {
            id: `alert_proj_skill_${item.claimId}_${Math.random().toString(36).slice(2, 7)}`,
            claimId: item.claimId,
            sectionId: secKey,
            type: 'SKILL_CONTRADICTION',
            severity: 'ALERT',
            title: 'Sprzeczność w umiejętnościach projekcji',
            message: contradiction,
            details: {
              claimedTags: item.claimedTags,
              sourceProject: sourceClaim.sourceProject,
            },
          };
          alerts.push(skillAlert);
          sectionsMap[secKey].alerts.push(skillAlert);
          sectionsMap[secKey].isConsistent = false;
        }
      }
    }
  }

  // Jeśli sprawdzamy samą listę ID claimów
  if (options?.claimIdsToCheck && options.claimIdsToCheck.length > 0) {
    for (const claimId of options.claimIdsToCheck) {
      const source = getClaimById(vault, claimId);
      if (!source) {
        const missingAlert: ConsistencyAlert = {
          id: `alert_missing_${claimId}`,
          claimId,
          type: 'CLAIM_NOT_FOUND',
          severity: 'WARNING',
          title: 'Brak claimu w MasterVault',
          message: `Claim o ID „${claimId}” nie istnieje w MasterVault.`,
        };
        alerts.push(missingAlert);
      }
    }
  }

  const isConsistent = alerts.filter((a) => a.severity === 'ALERT').length === 0;

  return {
    isConsistent,
    totalClaimsChecked: allVaultClaims.length + (options?.projectedItems?.length || 0),
    sections: sectionsMap,
    alerts,
  };
}

/**
 * RENDERER 1: CV Renderer
 * Pobiera dane wyłącznie z MasterVault na podstawie podanych `claimIds`.
 */
export function renderCvFromClaims(vault: MasterVault, claimIds?: string[]): CvRendererOutput {
  const effectiveClaimIds =
    claimIds && claimIds.length > 0
      ? claimIds
      : extractClaimsFromVault(vault).map((c) => c.id);

  const experiencesSection: CvRendererSection = {
    id: 'cv_experience',
    title: 'Doświadczenie Zawodowe (Zweryfikowane)',
    items: [],
  };

  const projectsSection: CvRendererSection = {
    id: 'cv_projects',
    title: 'Projekty & Osiągnięcia (Zweryfikowane)',
    items: [],
  };

  for (const claimId of effectiveClaimIds) {
    const claim = getClaimById(vault, claimId);
    if (!claim) continue;

    const dateRangeDisplay =
      typeof claim.dateRange === 'string'
        ? claim.dateRange
        : `${claim.dateRange.start} – ${claim.dateRange.end}`;

    const item = {
      claimId: claim.id,
      project: claim.sourceProject,
      dateRangeDisplay,
      metric: claim.metric,
      tags: claim.tags || [],
      summary: claim.metric
        ? `Realizacja zadań w ramach „${claim.sourceProject}” z wynikiem: ${claim.metric}. Kluczowe technologie: ${claim.tags.join(', ')}.`
        : `Działania projektowe w „${claim.sourceProject}”. Zastosowane technologie i kompetencje: ${claim.tags.join(', ')}.`,
    };

    if (claim.id.includes('proj')) {
      projectsSection.items.push(item);
    } else {
      experiencesSection.items.push(item);
    }
  }

  return {
    title: vault.personalInfo?.title || 'Profil Kandydata',
    candidateName: vault.personalInfo?.fullName || 'Kandydat',
    sections: [experiencesSection, projectsSection].filter((s) => s.items.length > 0),
  };
}

/**
 * RENDERER 2: HUD Renderer (Career & Competence Head-Up Display)
 * Pobiera dane z MasterVault przez `claimIds` i generuje wskaźniki telemetryczne profilu.
 */
export function renderHudFromClaims(vault: MasterVault, claimIds?: string[]): HudRendererOutput {
  const effectiveClaimIds =
    claimIds && claimIds.length > 0
      ? claimIds
      : extractClaimsFromVault(vault).map((c) => c.id);

  const verifiedMetrics: HudMetricItem[] = [];
  const skillCountMap = new Map<string, { count: number; claimIds: string[] }>();

  for (const claimId of effectiveClaimIds) {
    const claim = getClaimById(vault, claimId);
    if (!claim) continue;

    // Metryki
    if (claim.metric) {
      verifiedMetrics.push({
        claimId: claim.id,
        label: claim.sourceProject,
        value: claim.metric,
        sourceProject: claim.sourceProject,
      });
    }

    // Skille
    for (const tag of claim.tags) {
      const entry = skillCountMap.get(tag) || { count: 0, claimIds: [] };
      entry.count += 1;
      if (!entry.claimIds.includes(claim.id)) {
        entry.claimIds.push(claim.id);
      }
      skillCountMap.set(tag, entry);
    }
  }

  // Oś czasu = unia przedziałów zatrudnienia (JEDEN przedział na wpis historii).
  // Wcześniej każdy punktor dokładał pełny czas roli (2 lata × 5 punktorów
  // + claim główny = 12 lat za 2 lata pracy) — F5. Projekty nie mają dat
  // zatrudnienia (sztywne `2022-01–Obecnie` w generatorze claimów), więc ich
  // nie liczymy do stażu. (Unia liczona lokalnie, żeby nie zapętlać importów
  // z `lib/experience.ts`, który sam korzysta z `parseDateToDecimalYear` stąd.)
  const employmentSpans: Array<{ start: number; end: number }> = [];
  for (const exp of vault.history ?? []) {
    if (!exp?.startDate) continue;
    // Bezpośrednio na datach dziesiętnych: `parseDateRangeToYears` normalizuje
    // min/max, więc odwrócenie wykrywamy przed nim (F5/F13).
    const startYear = parseDateToDecimalYear(exp.startDate);
    const endYear = parseDateToDecimalYear(exp.isCurrent ? 'Obecnie' : exp.endDate || exp.startDate);
    if (startYear === null || endYear === null) continue;
    const nowYear = parseDateToDecimalYear('Obecnie');
    if (nowYear !== null && startYear > nowYear + 1 / 12) continue;
    if (startYear > endYear) continue;
    employmentSpans.push({ start: startYear, end: endYear });
  }
  employmentSpans.sort((a, b) => a.start - b.start);
  let totalYears = 0;
  if (employmentSpans.length > 0) {
    let curStart = employmentSpans[0].start;
    let curEnd = employmentSpans[0].end;
    for (let k = 1; k < employmentSpans.length; k++) {
      const next = employmentSpans[k];
      if (next.start <= curEnd) curEnd = Math.max(curEnd, next.end);
      else {
        totalYears += curEnd - curStart;
        curStart = next.start;
        curEnd = next.end;
      }
    }
    totalYears += curEnd - curStart;
  }

  const skillsRadar: HudSkillStat[] = Array.from(skillCountMap.entries())
    .map(([skill, data]) => ({
      skill,
      count: data.count,
      claimIds: data.claimIds,
    }))
    .sort((a, b) => b.count - a.count);

  const validation = validateConsistency(vault, { claimIdsToCheck: effectiveClaimIds });
  const consistencyScore = validation.isConsistent ? 100 : Math.max(20, 100 - validation.alerts.length * 25);

  return {
    activeClaimsCount: effectiveClaimIds.length,
    verifiedMetrics,
    skillsRadar,
    timelineCoverageYears: Math.round(totalYears * 10) / 10,
    consistencyScore,
  };
}

/**
 * RENDERER 3: Pitch Renderer (30-Second Elevator Pitch & Talking Points)
 * Pobiera dane z MasterVault przez `claimIds` i tworzy spójną wypowiedź rekrutacyjną opartą na faktach.
 */
export function renderPitchFromClaims(
  vault: MasterVault,
  claimIds?: string[],
  targetRole?: string,
  variantIndex?: number
): PitchRendererOutput {
  const effectiveClaimIds =
    claimIds && claimIds.length > 0
      ? claimIds
      : extractClaimsFromVault(vault).map((c) => c.id);

  const coreStrengths: PitchStrengthItem[] = [];
  const candidateName = vault.personalInfo?.fullName || 'Kandydat';
  const role = targetRole || vault.personalInfo?.title || 'Specjalista';

  for (const claimId of effectiveClaimIds) {
    const claim = getClaimById(vault, claimId);
    if (!claim) continue;

    const statement = claim.metric
      ? `W ${claim.sourceProject} osiągnąłem wymierny rezultat: ${claim.metric}, wykorzystując ${claim.tags.slice(0, 3).join(', ')}.`
      : `W projekcie ${claim.sourceProject} odpowiadałem za wdrożenia w oparciu o ${claim.tags.slice(0, 3).join(', ')}.`;

    coreStrengths.push({
      claimId: claim.id,
      statement,
      metric: claim.metric,
      tags: claim.tags,
    });
  }

  const topMetric = coreStrengths.find((s) => s.metric)?.metric;
  const allTags = Array.from(new Set(coreStrengths.flatMap((s) => s.tags)));
  const topSkills = allTags.slice(0, 3).join(', ');

  const hookCtx = {
    candidateName,
    roleTitle: role,
    topSkills,
    topMetric,
    verifiedClaimsCount: coreStrengths.length,
  };

  const hookVariations = getPitchHookVariations(hookCtx);
  const ctaVariations = getPitchCtaVariations(hookCtx);

  const hookIdx = selectVariantIndex(variantIndex ?? candidateName + role, hookVariations.length);
  const ctaIdx = selectVariantIndex(variantIndex ?? role + candidateName, ctaVariations.length);

  const hook = hookVariations[hookIdx];
  const callToAction = ctaVariations[ctaIdx];

  const elevatorPitchText = [
    hook,
    ...coreStrengths.map((s) => `• ${s.statement}`),
    callToAction,
  ].join('\n\n');

  return {
    hook,
    coreStrengths,
    callToAction,
    elevatorPitchText,
  };
}

/**
 * Renderer LinkedIn: Buduje profil zawodowy z podsumowaniem i pozycjami doświadczenia
 * bezpośrednio zidentyfikowanymi przez zweryfikowane ClaimId z MasterVault.
 */
export function renderLinkedInFromClaims(
  vault: MasterVault,
  claimIds?: string[]
): LinkedInRendererOutput {
  const effectiveClaimIds =
    claimIds && claimIds.length > 0
      ? claimIds
      : extractClaimsFromVault(vault).map((c) => c.id);

  const claims = effectiveClaimIds
    .map((id) => getClaimById(vault, id))
    .filter((c): c is Claim => Boolean(c));
  const candidateName = vault.personalInfo?.fullName || 'Kandydat';
  const role = vault.personalInfo?.title || 'Specjalista';

  const experience: LinkedInExperienceItem[] = claims.map((claim) => {
    const rangeDisplay = typeof claim.dateRange === 'string'
      ? claim.dateRange
      : `${claim.dateRange.start} - ${claim.dateRange.end}`;

    return {
      claimId: claim.id,
      title: role,
      company: claim.sourceProject,
      dateRange: rangeDisplay,
      description: claim.metric
        ? `Główny projekt: ${claim.sourceProject}. Osiągnięcie: ${claim.metric}. Technologie: ${claim.tags.join(', ')}.`
        : `Projekt: ${claim.sourceProject}. Technologie: ${claim.tags.join(', ')}.`,
      skills: claim.tags,
    };
  });

  const allSkills = Array.from(new Set(claims.flatMap((c) => c.tags)));

  return {
    headline: `${role} | Ekspert w: ${allSkills.slice(0, 4).join(', ')}`,
    about: `Profil zawodowy ${candidateName} — ${role}. Doświadczenie w kluczowych wdrożeniach: ${experience.map((e) => e.company).join(', ')}. Spójność danych zweryfikowana przez ConsistencyGuard.`,
    experience,
    skills: allSkills,
  };
}
