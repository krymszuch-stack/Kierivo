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
  ProfileClaimStatement,
  SectionConsistencyStatus,
  LinkedInRendererOutput,
  LinkedInExperienceItem,
} from './types';
import {
  getPitchHookVariations,
  getPitchCtaVariations,
  selectVariantIndex,
} from '../phrasingVariations';
import { auditExperienceTimelineAndMetrics } from './timelineAuditor';
import { parseDateToDecimalYear } from '../dateUtils';
import { employmentIntervalForJob, unionYears } from '../experience';
import { claimDateRangeFromProfile } from './claimDateRange';
import { describeProfileClaim } from './pitchStatements';
import { hasPositiveSkillEvidence, stripDiacriticsLower } from '../skillEvidence';

/**
 * Stała określająca maksymalną dopuszczalną rozbieżność czasu trwania (w latach).
 * Powyżej 0.5 roku (6 miesięcy) walidator ConsistencyGuard podnosi alert spójności.
 */
export const MAX_ALLOWED_YEAR_DIFFERENCE = 0.5;

function formatClaimDateRange(range: ClaimDateRange | string | undefined): string {
  if (!range) return 'Daty niepodane w profilu';
  return typeof range === 'string' ? range : `${range.start} – ${range.end}`;
}

/**
 * Parsuje ciąg daty (YYYY, YYYY-MM, MM.YYYY, MM/YYYY, ISO, "Obecnie", "Present") na liczbę zmiennoprzecinkową reprezentującą rok.
 */
export { parseDateToDecimalYear } from '../dateUtils';

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
    // Myślnik i ukośnik należą też do daty. Podział wolno przyjąć dopiero,
    // gdy oba końce przejdą wspólny parser; pojedyncze ISO nie jest zakresem.
    if (parseDateToDecimalYear(dateRange) !== null) {
      startStr = endStr = dateRange;
    } else {
      const candidates = Array.from(dateRange.matchAll(/[-–—/]/g))
        .map(match => [dateRange.slice(0, match.index).trim(), dateRange.slice(match.index + 1).trim()])
        .filter(([start, end]) => parseDateToDecimalYear(start) !== null && parseDateToDecimalYear(end) !== null);
      if (candidates.length !== 1) return null;
      [startStr, endStr] = candidates[0];
    }
  } else {
    startStr = dateRange.start;
    endStr = dateRange.end;
  }

  const startYear = parseDateToDecimalYear(startStr);
  const endYear = parseDateToDecimalYear(endStr);

  if (startYear === null || endYear === null || endYear < startYear) {
    return null;
  }

  // Odwróconego okresu nie normalizujemy do pozornie poprawnej historii.
  const durationYears = Math.max(1 / 12, endYear - startYear);

  return {
    startYear,
    endYear,
    durationYears,
  };
}

/**
 * Oblicza bezwzględną różnicę w latach pomiędzy dwoma zakresami dat.
 *
 * Porównuje tylko długości, nie zgodność dat rozpoczęcia i zakończenia.
 * Nie używać do stażu ani walidacji projekcji. Staż liczy `unionExperienceYears`
 * (`lib/experience.ts`), a walidator porównuje oba końce okresów.
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
        const dateRange = claimDateRangeFromProfile(
          exp.startDate,
          exp.isCurrent ? 'Obecnie' : exp.endDate,
        );
        claimsMap.set(mainClaimId, {
          id: mainClaimId,
          sourceProject: exp.company || exp.role,
          ...(dateRange ? { dateRange } : {}),
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
            // Pierwsza liczba może być wersją narzędzia, datą albo numerem normy.
            // Claim przenosi jawny wynik użytkownika, nie zgaduje jego metryki.
            const hlMetric = typeof hl === 'object' && hl !== null && typeof hl.metric === 'string'
              ? hl.metric.trim() || undefined
              : undefined;
            const hlKeywords = typeof hl === 'object' && hl !== null && Array.isArray(hl.keywords) ? hl.keywords : [];
            const dateRange = claimDateRangeFromProfile(
              exp.startDate,
              exp.isCurrent ? 'Obecnie' : exp.endDate,
            );

            claimsMap.set(hlClaimId, {
              id: hlClaimId,
              sourceProject: `${exp.company} (${exp.role})`,
              ...(dateRange ? { dateRange } : {}),
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
    tagA: /\b(?:brak|no|bez)\s+(?:znajomosci\s+)?(?:sql|baz\s+danych)\b/i,
    tagB: /\b(?:sql|postgresql|mysql|oracle|database\s+expert)\b/i,
    reason: 'Deklaracja braku znajomości SQL stoi w sprzeczności z tagiem technologii bazodanowej SQL.',
  },
  {
    tagA: /\b(?:tylko\s+junior|junior\s+only|brak\s+doswiadczenia|entry\s+level\s+only)\b/i,
    tagB: /\b(?:senior|lead|architect|principal|kierownik|architekt)\b/i,
    reason: 'Deklaracja profilu wyłącznie Junior / początkującego kłóci się z rolą Senior/Lead/Architect.',
  },
  {
    tagA: /\b(?:brak\s+uprawnien|bez\s+sep)\b/i,
    tagB: /\b(?:sep|sep\s+g1|sep\s+g2|sep\s+g3|udt|f-gaz)\b/i,
    reason: 'Deklaracja braku uprawnień technicznych jest sprzeczna z certyfikatem uprawnień SEP/UDT.',
  },
  {
    tagA: /\b(?:brak\s+prawa\s+jazdy|no\s+driving\s+license)\b/i,
    tagB: /\b(?:prawo\s+jazdy\s+kat\.?\s*[bcde]|kierowca)\b/i,
    reason: 'Deklaracja braku prawa jazdy stoi w sprzeczności z wpisem o posiadaniu prawa jazdy lub roli kierowcy.',
  },
];

const NEGATED_TAG_PREFIX = /^(?:brak|no|nie\s+znam|bez)\s+/i;

/** Negacja nie może być jednocześnie dowodem dodatnim. Średnik rozdziela
 * niezależne deklaracje; granice i aliasy kompetencji rozstrzyga wspólny matcher. */
function positiveTagClauses(tags: string[]): string[] {
  return tags.flatMap(tag => stripDiacriticsLower(tag).split(/[;\n]/))
    .map(tag => tag.trim())
    .filter(tag => !NEGATED_TAG_PREFIX.test(tag)
      && !KNOWN_SKILL_CONTRADICTIONS.some(rule => rule.tagA.test(tag)));
}

function hasPositiveRuleTag(tags: string[], rule: typeof KNOWN_SKILL_CONTRADICTIONS[number]): boolean {
  return positiveTagClauses(tags).some(tag => {
    const matches = tag.match(new RegExp(rule.tagB.source, `${rule.tagB.flags}g`)) || [];
    return matches.some(phrase => hasPositiveSkillEvidence(tag, phrase));
  });
}

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
    const hasA = claimTags.some((t) => rule.tagA.test(stripDiacriticsLower(t)));
    const hasB = hasPositiveRuleTag(claimTags, rule);
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
        const claimHasA = claimTags.some((t) => rule.tagA.test(stripDiacriticsLower(t)));
        const otherHasB = hasPositiveRuleTag(otherTags, rule);
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
    const normalizedTag = stripDiacriticsLower(tag).trim();
    if (NEGATED_TAG_PREFIX.test(normalizedTag)) {
      const normalizedSkill = normalizedTag.replace(NEGATED_TAG_PREFIX, '').replace(/^znajomosci\s+/i, '').trim();
      if (normalizedSkill && positiveTagClauses(masterVaultSkills).some((s) => hasPositiveSkillEvidence(s, normalizedSkill))) {
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
  projectionMissing?: boolean;
  projectionCountMismatch?: boolean;
}

/** Walidujemy dane wyjściowe, bo porównanie dwóch kopii źródła ukrywa błąd renderera. */
export function projectRendererOutputs(
  cv: CvRendererOutput,
  hud: HudRendererOutput,
  pitch: PitchRendererOutput,
  activeClaimIds: string[],
): ProjectedClaimItem[] {
  const hudMetrics = new Map(hud.verifiedMetrics.map(item => [item.claimId, item.value]));
  // W HUD brak pozycji jest również brakiem metryki, nie powodem pominięcia kontroli.
  const hudClaimIds = new Set([...activeClaimIds, ...hudMetrics.keys()]);
  const hudCountMismatch = hud.activeClaimsCount !== new Set(activeClaimIds).size;
  // Sam licznik również może fabrykować fakty przy pustym wejściu.
  if (hudCountMismatch && hudClaimIds.size === 0) hudClaimIds.add('');
  const cvClaimIds = new Set(cv.sections.flatMap(section => section.items.map(item => item.claimId)));
  const pitchClaimIds = new Set(pitch.profileStatements.map(item => item.claimId));
  const missingItems = (sectionId: string, sectionName: string, emittedIds: Set<string>): ProjectedClaimItem[] =>
    [...new Set(activeClaimIds)].filter(id => !emittedIds.has(id)).map(claimId => ({
      sectionId, sectionName, claimId, projectionMissing: true,
    }));
  return [
    ...cv.sections.flatMap(section => section.items.map(item => ({
      sectionId: section.id,
      sectionName: section.title,
      claimId: item.claimId,
      claimedDateRange: item.dateRangeDisplay === 'Daty niepodane w profilu' ? '' : item.dateRangeDisplay,
      claimedTags: item.tags,
      claimedMetric: item.metric,
    }))),
    ...missingItems('cv', 'Renderer CV', cvClaimIds),
    ...Array.from(hudClaimIds, claimId => ({
      sectionId: 'hud',
      sectionName: 'Renderer HUD',
      claimId,
      claimedMetric: hudMetrics.get(claimId),
      projectionCountMismatch: hudCountMismatch,
      claimedTags: hud.skillsRadar.filter(item => item.claimIds.includes(claimId)).map(item => item.skill),
    })),
    ...pitch.profileStatements.map(item => ({
      sectionId: 'pitch',
      sectionName: 'Renderer Pitch',
      claimId: item.claimId,
      claimedTags: item.tags,
      claimedMetric: item.metric,
    })),
    ...missingItems('pitch', 'Renderer Pitch', pitchClaimIds),
  ];
}

/**
 * Główny walidator modułu ConsistencyGuard.
 * Sprawdza:
 * 1. Czy daty początku, końca lub długość okresu różnią się od źródła o ponad 0.5 roku,
 *    oraz czy oba zakresy można w ogóle odczytać.
 * 2. Czy istnieją sprzeczności w umiejętnościach (skill contradictions).
 * 3. Czy każdy odpytany claimId istnieje w MasterVault.
 * 4. Czy jawna metryka podglądu odpowiada zapisowi źródłowemu.
 */
export function validateConsistency(
  vault: MasterVault,
  options?: {
    claimIdsToCheck?: string[];
    projectedItems?: ProjectedClaimItem[];
    skipTimelineAudit?: boolean;
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

      if (item.claimId) sectionsMap[secKey].claimsCount += 1;

      if (item.projectionCountMismatch) {
        const countAlert: ConsistencyAlert = {
          id: `alert_projection_count_${secKey}`,
          sectionId: secKey,
          type: 'PROJECTION_COUNT_MISMATCH',
          severity: 'ALERT',
          title: 'Niezgodna liczba faktów w podglądzie',
          message: 'Licznik podglądu nie odpowiada liczbie unikalnych aktywnych faktów. Sprawdź podgląd przed użyciem.',
        };
        if (!sectionsMap[secKey].alerts.some(alert => alert.type === countAlert.type)) {
          alerts.push(countAlert);
          sectionsMap[secKey].alerts.push(countAlert);
        }
        sectionsMap[secKey].isConsistent = false;
        if (!item.claimId) continue;
      }

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

      if (item.projectionMissing) {
        const missingProjection: ConsistencyAlert = {
          id: `alert_projection_missing_${secKey}_${item.claimId}`,
          claimId: item.claimId,
          sectionId: secKey,
          type: 'PROJECTION_MISSING',
          severity: 'ALERT',
          title: 'Brak faktu w podglądzie',
          message: `Podgląd pomija aktywny fakt „${sourceClaim.sourceProject}”. Sprawdź dokument przed użyciem.`,
        };
        alerts.push(missingProjection);
        sectionsMap[secKey].alerts.push(missingProjection);
        sectionsMap[secKey].isConsistent = false;
        continue;
      }

      // Jawnie pusty zakres CV porównujemy z datami źródła. HUD/Pitch nie projektują dat.
      if (item.claimedDateRange !== undefined && (item.claimedDateRange || sourceClaim.dateRange)) {
        const sourceYears = parseDateRangeToYears(sourceClaim.dateRange);
        const projectedYears = parseDateRangeToYears(item.claimedDateRange);

        if (!sourceYears || !projectedYears) {
          const invalidAlert: ConsistencyAlert = {
            id: `alert_invalid_date_${item.claimId}`,
            claimId: item.claimId,
            sectionId: secKey,
            type: 'INVALID_DATE_RANGE',
            severity: 'ALERT',
            title: 'Nie można potwierdzić zgodności dat',
            message: `Zakres dat źródła lub projekcji dla „${sourceClaim.sourceProject}” jest niepełny, nieczytelny albo odwrócony. Sprawdź daty przed użyciem dokumentu.`,
          };
          alerts.push(invalidAlert);
          sectionsMap[secKey].alerts.push(invalidAlert);
          sectionsMap[secKey].isConsistent = false;
        }
        if (sourceYears && projectedYears) {
          // Ta sama długość po przesunięciu całej historii nie oznacza tych
          // samych faktów. Próg obejmuje oba końce i zmianę długości okresu.
          const diff = Math.max(
            Math.abs(sourceYears.durationYears - projectedYears.durationYears),
            Math.abs(sourceYears.startYear - projectedYears.startYear),
            Math.abs(sourceYears.endYear - projectedYears.endYear),
          );
          if (diff > MAX_ALLOWED_YEAR_DIFFERENCE) {
            const dateAlert: ConsistencyAlert = {
              id: `alert_date_${item.claimId}`,
              claimId: item.claimId,
              sectionId: secKey,
              type: 'DATE_MISMATCH',
              severity: 'ALERT',
              title: 'Rozbieżność dat > 0.5 roku',
              message: `Daty rozpoczęcia, zakończenia lub długość okresu dla „${sourceClaim.sourceProject}” różnią się o maksymalnie ${diff.toFixed(1)} lat. W profilu: ${formatClaimDateRange(sourceClaim.dateRange)}; w podglądzie: ${formatClaimDateRange(item.claimedDateRange)}.`,
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

      // Bez porównania metryk podgląd mógł zmieniać liczby bez naruszenia
      // statusu spójności. Normalizujemy tylko odstępy, bez zgadywania jednostek.
      if (item.claimedMetric !== undefined || sourceClaim.metric !== undefined) {
        const sourceMetric = typeof sourceClaim.metric === 'string'
          ? sourceClaim.metric.trim().replace(/\s+/g, ' ')
          : '';
        const projectedMetric = typeof item.claimedMetric === 'string'
          ? item.claimedMetric.trim().replace(/\s+/g, ' ')
          : item.claimedMetric === undefined ? '' : null;
        if (projectedMetric === null || sourceMetric !== projectedMetric) {
          const metricAlert: ConsistencyAlert = {
            id: `alert_metric_${item.claimId}`,
            claimId: item.claimId,
            sectionId: secKey,
            type: 'METRIC_MISMATCH',
            severity: 'ALERT',
            title: 'Metryka podglądu wymaga sprawdzenia ze źródłem',
            message: `Wynik dla „${sourceClaim.sourceProject}” nie odpowiada zapisowi profilu. W profilu: ${sourceMetric || 'brak metryki'}; w podglądzie: ${projectedMetric ?? 'nieczytelna metryka'}. Sprawdź wartości i jednostki przed użyciem dokumentu.`,
          };
          alerts.push(metricAlert);
          sectionsMap[secKey].alerts.push(metricAlert);
          sectionsMap[secKey].isConsistent = false;
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

  // 4. Audyt osi czasu, chronologii i metryk (luki > 6 mies., kolizje miast, brak metryk Google X-Y-Z)
  if (vault.history && vault.history.length > 0 && options?.skipTimelineAudit !== true) {
    const timelineAudit = auditExperienceTimelineAndMetrics(vault.history);
    for (const alert of timelineAudit.alerts) {
      alerts.push(alert);
    }
  }

  // Brak źródła nie dowodzi sprzeczności, ale uniemożliwia potwierdzenie.
  // Ostrzeżenia o lukach lub metrykach nadal nie są automatycznym błędem faktów.
  const isConsistent = !alerts.some((a) => a.severity === 'ALERT' || a.type === 'CLAIM_NOT_FOUND');

  return {
    isConsistent,
    totalClaimsChecked: allVaultClaims.length + (options?.projectedItems?.length || 0),
    sections: sectionsMap,
    alerts,
  };
}

/** Jeden fakt ma jednego właściciela ID. Alias i powtórzona referencja nie
 * mogą mnożyć pozycji CV, wyników, liczników ani zdań o doświadczeniu. */
function selectUniqueClaims(vault: MasterVault, claimIds?: string[]): Claim[] {
  const allClaims = extractClaimsFromVault(vault);
  if (!claimIds?.length) return allClaims;
  const selected = new Map<string, Claim>();
  for (const id of claimIds) {
    const claim = allClaims.find(c => c.id === id || c.id === `claim_exp_${id}` || c.id === `claim_proj_${id}`);
    if (claim) selected.set(claim.id, claim);
  }
  return Array.from(selected.values());
}

/**
 * RENDERER 1: CV Renderer
 * Pobiera dane wyłącznie z MasterVault na podstawie podanych `claimIds`.
 */
export function renderCvFromClaims(vault: MasterVault, claimIds?: string[]): CvRendererOutput {
  const claims = selectUniqueClaims(vault, claimIds);

  const experiencesSection: CvRendererSection = {
    id: 'cv_experience',
    title: 'Doświadczenie zawodowe',
    items: [],
  };

  const projectsSection: CvRendererSection = {
    id: 'cv_projects',
    title: 'Projekty i osiągnięcia',
    items: [],
  };

  for (const claim of claims) {
    const dateRangeDisplay = formatClaimDateRange(claim.dateRange);

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
  const claims = selectUniqueClaims(vault, claimIds);

  const verifiedMetrics: HudMetricItem[] = [];
  const skillCountMap = new Map<string, { count: number; claimIds: string[] }>();

  for (const claim of claims) {
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
  // zatrudnienia (claimy projektów nie zawierają dat), więc ich nie liczymy do
  // stażu. Wspólna unia odrzuca przyszłe końce, a brak okresów nie udaje zera.
  const history = Array.isArray(vault.history) ? vault.history : [];
  const referenceDate = new Date();
  const employmentSpans = history
    .map(exp => employmentIntervalForJob(exp, referenceDate))
    .filter((span): span is NonNullable<typeof span> => span !== null);
  const totalYears = employmentSpans.length > 0 ? unionYears(employmentSpans) : null;

  const skillsRadar: HudSkillStat[] = Array.from(skillCountMap.entries())
    .map(([skill, data]) => ({
      skill,
      count: data.count,
      claimIds: data.claimIds,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    activeClaimsCount: claims.length,
    verifiedMetrics,
    skillsRadar,
    timelineCoverageYears: totalYears === null ? null : Math.round(totalYears * 10) / 10,
    timelineExcludedEntries: history.length - employmentSpans.length,
  };
}

/**
 * RENDERER 3: Szkic wypowiedzi rekrutacyjnej na podstawie wpisów profilu.
 * Claim identyfikuje źródłowy wpis; sam w sobie nie potwierdza prawdziwości ani poziomu biegłości.
 */
export function renderPitchFromClaims(
  vault: MasterVault,
  claimIds?: string[],
  targetRole?: string,
  variantIndex?: number
): PitchRendererOutput {
  const claims = selectUniqueClaims(vault, claimIds);

  const profileStatements: ProfileClaimStatement[] = [];
  const candidateName = vault.personalInfo?.fullName?.trim() || '';
  const role = targetRole || vault.personalInfo?.title || '';

  for (const claim of claims) {
    profileStatements.push({
      claimId: claim.id,
      statement: describeProfileClaim(claim),
      metric: claim.metric,
      tags: claim.tags,
    });
  }

  const hookCtx = {
    candidateName,
    roleTitle: role,
  };

  const hookVariations = getPitchHookVariations(hookCtx);
  const ctaVariations = getPitchCtaVariations(hookCtx);

  const hookIdx = selectVariantIndex(variantIndex ?? candidateName + role, hookVariations.length);
  const ctaIdx = selectVariantIndex(variantIndex ?? role + candidateName, ctaVariations.length);

  const hook = hookVariations[hookIdx];
  const callToAction = ctaVariations[ctaIdx];

  const elevatorPitchText = [
    hook,
    ...profileStatements.map((statement) => `• ${statement.statement}`),
    callToAction,
  ].join('\n\n');

  return {
    hook,
    profileStatements,
    callToAction,
    elevatorPitchText,
  };
}

/**
 * Renderer LinkedIn: Buduje profil zawodowy z podsumowaniem i pozycjami doświadczenia
 * z wpisów MasterVault. Referencja ID nie potwierdza prawdziwości ani biegłości.
 */
export function renderLinkedInFromClaims(
  vault: MasterVault,
  claimIds?: string[]
): LinkedInRendererOutput {
  const claims = selectUniqueClaims(vault, claimIds);
  const candidateName = vault.personalInfo?.fullName || 'Kandydat';
  const role = vault.personalInfo?.title?.trim() || 'Profil zawodowy';

  const experience: LinkedInExperienceItem[] = claims.map((claim) => {
    const rangeDisplay = !claim.dateRange
      ? 'Daty niepodane w profilu'
      : typeof claim.dateRange === 'string'
        ? claim.dateRange
        : `${claim.dateRange.start} - ${claim.dateRange.end}`;

    return {
      claimId: claim.id,
      title: role,
      company: claim.sourceProject,
      dateRange: rangeDisplay,
      description: describeProfileClaim(claim),
      skills: claim.tags,
    };
  });

  const allSkills = Array.from(new Set(claims.flatMap((c) => c.tags)));

  return {
    headline: role,
    about: `Szkic profilu ${candidateName}. Wpisy użyte w szkicu: ${experience.map((e) => e.company).join(', ') || 'brak'}. Nazwy i tagi wpisów nie potwierdzają poziomu biegłości ani prawdziwości osiągnięć.`,
    experience,
    skills: allSkills,
  };
}
