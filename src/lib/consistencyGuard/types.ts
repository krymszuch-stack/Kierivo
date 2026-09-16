/**
 * Typy danych dla modułu ConsistencyGuard.
 * Gwarantuje jednolite źródło prawdy (Single Source of Truth)
 * pomiędzy MasterVault a rendererami CV, HUD i Pitch.
 */

export interface ClaimDateRange {
  start: string; // np. "2021-01", "2021-01-15", "2021"
  end: string;   // np. "2023-06", "Obecnie", "Present"
}

export interface Claim {
  id: string;
  sourceProject: string; // ID lub nazwa projektu / pozycji w MasterVault
  dateRange: ClaimDateRange | string;
  metric?: string;
  tags: string[];
}

export type ConsistencyAlertType =
  | 'DATE_MISMATCH'
  | 'SKILL_CONTRADICTION'
  | 'CLAIM_NOT_FOUND'
  | 'INVALID_DATE_RANGE'
  | 'CAREER_GAP'
  | 'LOCATION_CONFLICT'
  | 'OVERLAPPING_EXPERIENCE'
  | 'MISSING_METRICS';

export interface ConsistencyAlert {
  id: string;
  claimId?: string;
  sectionId?: string;
  type: ConsistencyAlertType;
  severity: 'ALERT' | 'WARNING';
  title: string;
  message: string;
  details?: {
    claimedDurationYears?: number;
    sourceDurationYears?: number;
    differenceYears?: number;
    claimedTags?: string[];
    conflictingTags?: string[];
    sourceProject?: string;
    gapMonths?: number;
    gapStart?: string;
    gapEnd?: string;
    previousCompany?: string;
    nextCompany?: string;
    conflictingCompany?: string;
    conflictingLocation?: string;
    experienceId?: string;
    suggestedFormula?: string;
  };
}

export interface SectionConsistencyStatus {
  sectionId: string;
  sectionName: string;
  isConsistent: boolean;
  claimsCount: number;
  alerts: ConsistencyAlert[];
}

export interface ConsistencyValidationResult {
  isConsistent: boolean;
  totalClaimsChecked: number;
  sections: Record<string, SectionConsistencyStatus>;
  alerts: ConsistencyAlert[];
}

export interface CvRendererItem {
  claimId: string;
  project: string;
  dateRangeDisplay: string;
  metric?: string;
  tags: string[];
  summary: string;
}

export interface CvRendererSection {
  id: string;
  title: string;
  items: CvRendererItem[];
}

export interface CvRendererOutput {
  title: string;
  candidateName: string;
  sections: CvRendererSection[];
}

export interface HudMetricItem {
  claimId: string;
  label: string;
  value: string;
  sourceProject: string;
}

export interface HudSkillStat {
  skill: string;
  count: number;
  claimIds: string[];
}

export interface HudRendererOutput {
  activeClaimsCount: number;
  verifiedMetrics: HudMetricItem[];
  skillsRadar: HudSkillStat[];
  timelineCoverageYears: number;
  consistencyScore: number; // 0 - 100%
}

export interface PitchStrengthItem {
  claimId: string;
  statement: string;
  metric?: string;
  tags: string[];
}

export interface PitchRendererOutput {
  hook: string;
  coreStrengths: PitchStrengthItem[];
  callToAction: string;
  elevatorPitchText: string;
}

export interface LinkedInExperienceItem {
  claimId: string;
  title: string;
  company: string;
  dateRange: string;
  description: string;
  skills: string[];
}

export interface LinkedInRendererOutput {
  headline: string;
  about: string;
  experience: LinkedInExperienceItem[];
  skills: string[];
}
