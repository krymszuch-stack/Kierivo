/** Reguły lokalnego przeglądu tekstu; nie są konfiguracją ani emulacją parserów ATS. */

export interface AtsVendorProfile {
  id: string;
  name: string;
  sectionDetection: SectionDetectionProfile;
  keywordMatching: { readsActualText: boolean };
}

export interface SectionDetectionProfile {
  /** Aliasy nagłówków sekcji, które rozpoznaje (case-insensitive) */
  headerAliases: Record<string, string[]>;
  /** Czy wymaga standardowych nagłówków? */
  requiresStandardHeaders: boolean;
  /** Co traktuje jako nieparsowalne */
  unparsablePatterns: string[];
}

// ---------------------------------------------------------------------------
// Profile vendorów
// ---------------------------------------------------------------------------

export const WORKDAY_PROFILE: AtsVendorProfile = {
  id: 'workday',
  name: 'Workday ATS',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'historia zatrudnienia', 'employment history'],
      education: ['wykształcenie', 'education', 'edukacja'],
      skills: ['umiejętności', 'kompetencje', 'skills', 'technologie', 'tools'],
      contact: ['kontakt', 'contact', 'dane osobowe'],
    },
    requiresStandardHeaders: true,
    unparsablePatterns: ['\\*\\*\\*', '●●●', '■■■', '▶'],
  },
  keywordMatching: {
    readsActualText: true,
  },
};

export const GREENHOUSE_PROFILE: AtsVendorProfile = {
  id: 'greenhouse',
  name: 'Greenhouse ATS',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'employment', 'career'],
      education: ['wykształcenie', 'education'],
      skills: ['umiejętności', 'kompetencje', 'skills', 'technologie', 'tools', 'competencies'],
      contact: ['kontakt', 'contact'],
    },
    requiresStandardHeaders: false,
    unparsablePatterns: ['★', '☆', '●', '◐', '◑'],
  },
  keywordMatching: {
    readsActualText: true,
  },
};

export const LEVER_PROFILE: AtsVendorProfile = {
  id: 'lever',
  name: 'Lever ATS',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'employment', 'history'],
      education: ['wykształcenie', 'education'],
      skills: ['umiejętności', 'kompetencje', 'skills', 'technologies'],
      contact: ['kontakt', 'contact'],
    },
    requiresStandardHeaders: true,
    unparsablePatterns: ['•', '▸', '▪', '●'],
  },
  keywordMatching: {
    readsActualText: true,
  },
};

export const ICIMS_PROFILE: AtsVendorProfile = {
  id: 'icims',
  name: 'iCIMS ATS',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'employment', 'career history', 'professional experience'],
      education: ['wykształcenie', 'education', 'academic background'],
      skills: ['umiejętności', 'kompetencje', 'skills', 'technologies', 'competencies', 'core competencies'],
      contact: ['kontakt', 'contact', 'personal information'],
    },
    requiresStandardHeaders: false,
    unparsablePatterns: [],
  },
  keywordMatching: {
    readsActualText: true,
  },
};

export const TALEO_PROFILE: AtsVendorProfile = {
  id: 'taleo',
  name: 'Taleo ATS',
  sectionDetection: {
    headerAliases: {
      experience: ['doświadczenie', 'work experience', 'employment history'],
      education: ['wykształcenie', 'education'],
      skills: ['umiejętności', 'kompetencje', 'skills'],
      contact: ['kontakt', 'contact'],
    },
    requiresStandardHeaders: true,
    unparsablePatterns: ['\\*\\*', '●', '■', '◆'],
  },
  keywordMatching: {
    readsActualText: true,
  },
};

export const ALL_ATS_PROFILES: AtsVendorProfile[] = [
  WORKDAY_PROFILE,
  GREENHOUSE_PROFILE,
  LEVER_PROFILE,
  ICIMS_PROFILE,
  TALEO_PROFILE,
];

export function getAtsProfile(id: string): AtsVendorProfile | undefined {
  return ALL_ATS_PROFILES.find((p) => p.id === id);
}
