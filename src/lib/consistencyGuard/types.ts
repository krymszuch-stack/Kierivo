/** ConsistencyGuard używa wspólnych typów claimów z modelu MasterVault. */
import type { Claim as MasterVaultClaim, ClaimDateRange as MasterVaultClaimDateRange } from '../../types';

export type ClaimDateRange = MasterVaultClaimDateRange;
export type Claim = MasterVaultClaim;

export type ConsistencyAlertType =
  | 'DATE_MISMATCH'
  | 'METRIC_MISMATCH'
  | 'SKILL_CONTRADICTION'
  | 'CLAIM_NOT_FOUND'
  | 'PROJECTION_MISSING'
  | 'PROJECTION_COUNT_MISMATCH'
  | 'PROJECTION_DUPLICATE'
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
  timelineCoverageYears: number | null;
  timelineExcludedEntries: number;
}

export interface ProfileClaimStatement {
  claimId: string;
  statement: string;
  metric?: string;
  tags: string[];
}

export interface PitchRendererOutput {
  hook: string;
  profileStatements: ProfileClaimStatement[];
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
