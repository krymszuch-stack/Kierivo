import { createEmptyVault } from '../../sampleVault';

export const PUBLIC_EXPORT_MARKERS = ['PUBLIC_B_COMPANY', 'PUBLIC_B_HIGHLIGHT'];
export const OMITTED_EXPORT_MARKERS = [
  'PRIVATE_PHONE_MARKER', 'INTERNAL_CLAIM_MARKER',
  'INTERNAL_SUBROLE_MARKER', 'REMOVED_HIGHLIGHT_MARKER',
];

/** Kontrakt nie ma private/visible. Edytor usuwa dane ze swojego docVault. */
export function createExportProjectionFixture() {
  const source = createEmptyVault('Syntetyczny Profil B', 'profile-b@example.invalid');
  source.personalInfo.title = 'Technik serwisu';
  source.personalInfo.summary = 'PUBLIC_B_SUMMARY';
  source.personalInfo.phone = OMITTED_EXPORT_MARKERS[0];
  source.claims = [{ id: 'draft', sourceProject: OMITTED_EXPORT_MARKERS[1], tags: [] }];
  source.profiler.subRoleId = OMITTED_EXPORT_MARKERS[2];
  source.history = [{
    id: 'experience-b', company: PUBLIC_EXPORT_MARKERS[0], role: 'Technik',
    location: '', startDate: '2020-01', endDate: '2024-01', isCurrent: false,
    highlights: [PUBLIC_EXPORT_MARKERS[1], OMITTED_EXPORT_MARKERS[3]].map((text, index) => ({
      id: String(index), text, action: '', target: '', tool: '', metric: '', keywords: [],
    })),
  }];
  const projection = structuredClone(source);
  projection.personalInfo.phone = '';
  projection.history[0].highlights = projection.history[0].highlights.filter(item => item.id === '0');
  const layeredFacts = [{
    id: 'fact-b', experienceId: 'experience-b', baseText: PUBLIC_EXPORT_MARKERS[1],
    jobReframedText: '', isUserEdited: false, sourceType: 'VAULT_BASE' as const, keywordsMatched: [],
  }];
  return { source, projection, layeredFacts };
}
