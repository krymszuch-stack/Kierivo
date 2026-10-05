/**
 * Czysty silnik domenowy dopasowania oferty pracy (Job Matcher Engine).
 *
 * Wydzielony z komponentu JobMatcher.tsx w celu zagwarantowania:
 * 1. Braku zależności od Reacta (zero hooków, zero stanu UI, zero DOM).
 * 2. 100% testowalności jednostkowej w czystym środowisku Node.
 * 3. Jednego źródła prawdy dla kalkulacji dopasowania, generowania dokumentów
 *    oraz normalizacji ofert pobranych lub wprowadzonych ręcznie.
 */

import type {
  MasterVault,
  JobOffer,
  TailoredResume,
  CoverLetter,
  AtsCheckResult,
} from '../types';
import { CANONICAL_ATS_SCORE_PROVENANCE } from '../types';
import type { FetchJdUrlResponse, ParsedJobDescription } from '../types/api';
import { getUnmetBlockingRequirements, hasCareerEvidence, scoreCanonicalAts, type CanonicalAtsScore } from './canonicalAts';
import { simulateAtsCheck } from './atsSimulator';
import { generateAntiTemplateCoverLetter } from './coverLetterEngine';
import { buildAdvisorContext, type AdvisorContext } from '../features/advisor/advisorContext';
import { parseJobDescriptionLocal, type ParsedWorkModel } from './jdParser';
import { preprocessJobOfferPaste, type JobOfferPreparation } from './jobOfferPreprocessor';
import { hasLimitedMatchEvidence } from './matchInterpretation';
import { measureVaultCompleteness } from './vaultCompleteness';
import { extractExplicitJobLocation } from './jobOfferMetadata';

/** Źródłowy znacznik dla lokalnych, jawnie syntetycznych kart szybkiego startu. */
export const SYNTHETIC_JOB_OFFER_PORTAL = 'Przykładowe ogłoszenie';

export function isSyntheticJobOffer(job: Pick<JobOffer, 'portal'>): boolean {
  return job.portal === SYNTHETIC_JOB_OFFER_PORTAL;
}

function remoteFlagForWorkModel(workModel: ParsedWorkModel | undefined): boolean | undefined {
  if (!workModel) return undefined;
  if (workModel === 'REMOTE') return true;
  if (workModel === 'UNKNOWN' || workModel === 'FLEXIBLE') return undefined;
  return false;
}

export interface JobMatchCalculationResult {
  tailoredResume: TailoredResume;
  canonicalResult: CanonicalAtsScore;
  atsResult: AtsCheckResult;
  coverLetter: CoverLetter;
  advisorContext: AdvisorContext;
  shouldCelebrate: boolean;
}

/**
 * Wyciąga pełny tekst ogłoszenia na potrzeby analizy słów kluczowych i ATS.
 */
export function extractJdText(
  job: Pick<JobOffer, 'description' | 'requirements' | 'title'>
): string {
  return job.description || job.requirements?.join(' ') || job.title;
}

/**
 * Czysta funkcja kalkulacji dopasowania profilu do oferty pracy.
 * Wykonuje slot-filling, kanoniczną kalkulację ATS, symulację ATS,
 * generowanie listu motywacyjnego oraz buduje kontekst dla doradcy AI.
 */
export function calculateJobMatch(
  vault: MasterVault,
  job: JobOffer
): JobMatchCalculationResult {
  const jdText = extractJdText(job);

  const tailored: TailoredResume = {
    targetJobTitle: job.title,
    companyName: job.company,
    summary: vault.personalInfo?.summary || '',
    selectedHighlights: vault.history.flatMap((h) =>
      h.highlights.map((hl) => ({
        experienceId: h.id,
        role: h.role,
        company: h.company,
        originalText: hl.text,
        optimizedText: hl.text,
        source: 'SLOT_FILLING' as const,
        keywordsMatched: hl.keywords || [],
      }))
    ),
    skillsMatched: {
      hardSkills: vault.skillsMatrix?.hardSkills || [],
      toolsAndTech: vault.skillsMatrix?.toolsAndTech || [],
      softSkills: vault.skillsMatrix?.softSkills || [],
    },
    // Brak wyniku pozostaje null, dopóki kanon nie wyliczy oceny.
    atsScore: null,
  };

  // 1. Kanoniczny wynik ATS (rozstrzygająca miara dopasowania F6)
  const canonical = scoreCanonicalAts(vault, jdText, job.title);
  const profileCompleteness = measureVaultCompleteness(vault).percent;
  const totalRequirementCount = canonical.matchedRequirements.length + canonical.missingRequirements.length + canonical.unconfirmedRequirements.length;
  const limitedEvidence = hasLimitedMatchEvidence({
    profileCompleteness,
    totalRequirementCount,
    fitEvidenceAvailable: hasCareerEvidence(vault),
    blockingRequirements: getUnmetBlockingRequirements(canonical),
    unconfirmedRequirements: canonical.unconfirmedRequirements,
  });

  // 2. Symulacja ATS z poziomu tailored resume
  const ats = simulateAtsCheck(tailored, vault, jdText);
  tailored.atsScore = canonical.score;
  tailored.atsScoreProvenance = canonical.score === null
    ? undefined
    : CANONICAL_ATS_SCORE_PROVENANCE;

  // 3. Kontekst doradcy oraz list motywacyjny
  const advisorContext = buildAdvisorContext(vault, job, ats, canonical);
  const coverLetter = generateAntiTemplateCoverLetter(
    job.title,
    job.company,
    jdText,
    vault
  );

  return {
    tailoredResume: tailored,
    canonicalResult: canonical,
    atsResult: ats,
    coverLetter,
    advisorContext,
    // Efekt celebracji nie może sugerować pewnego sukcesu przy małym profilu lub próbce.
    shouldCelebrate: canonical.score !== null && canonical.score >= 90 && !limitedEvidence,
  };
}

export interface BuildScrapedJobOfferParams {
  url: string;
  fetched: FetchJdUrlResponse & { success: true };
  parsed: ParsedJobDescription;
}

/**
 * Tworzy obiekt JobOffer z oferty pobranej przez scraper URL i przetworzonej przez parser.
 * Uwzględnia pierwszeństwo danych strukturalnych ze strony (schema.org/JobPosting).
 */
export function buildJobOfferFromScraped({
  url,
  fetched,
  parsed,
}: BuildScrapedJobOfferParams): JobOffer {
  const fromPortal = fetched.extraction?.structured === true;

  return {
    id: `url-${Date.now()}`,
    title: (fromPortal && fetched.title) || parsed.jobTitle || fetched.title || 'Oferta z adresu URL',
    company: (fromPortal && fetched.company) || parsed.companyName || fetched.company || '',
    salary: fetched.salary || parsed.salaryRange || '',
    // Parser może odzyskać jawne pole „Miejsce pracy” z treści, gdy portal nie
    // udostępnił lokalizacji w schema.org. Nie bierzemy tu niejawnej wzmianki
    // o mieście z dowolnego zdania oferty.
    location: fetched.location || extractExplicitJobLocation(fetched.descriptionRaw),
    description: fetched.descriptionRaw,
    requirements: parsed.requiredHardSkills?.length
      ? parsed.requiredHardSkills
      : (fetched.skills ?? []),
    remote: fetched.remote ?? remoteFlagForWorkModel(parsed.workModel),
    portal: 'URL',
    url,
    techStack: parsed.toolsAndTech?.length ? parsed.toolsAndTech : (fetched.skills ?? []),
    parsedJd: parsed,
  };
}

/**
 * Tworzy obiekt JobOffer oraz sparsowany obiekt z ręcznie wklejonej oferty pracy.
 */
export function buildJobOfferFromManual(manualOffer: Partial<JobOffer>): {
  job: JobOffer;
  parsed: ParsedJobDescription;
  preparation: JobOfferPreparation;
} {
  const rawText = manualOffer.description || '';
  const preparation = preprocessJobOfferPaste(rawText);
  const usableSegments = preparation.segments.filter((segment) => !segment.duplicateOfSegmentId);
  const preparedSegment = usableSegments.length === 1 ? usableSegments[0] : null;
  const parserInput = preparedSegment?.cleanText || rawText;
  const parsed =
    manualOffer.parsedJd ||
    parseJobDescriptionLocal(parserInput, manualOffer.title || preparedSegment?.titleCandidate || 'Stanowisko');

  const job: JobOffer = {
    id: manualOffer.id || `manual-${Date.now()}`,
    title: manualOffer.title || preparedSegment?.titleCandidate || parsed.jobTitle || '',
    company: manualOffer.company || preparedSegment?.companyCandidate || parsed.companyName || '',
    salary: manualOffer.salary || parsed.salaryRange || '',
    location: manualOffer.location || parsed.location || '',
    description: parserInput,
    requirements: manualOffer.requirements?.length ? manualOffer.requirements : (parsed.requiredHardSkills || []),
    remote: manualOffer.remote ?? remoteFlagForWorkModel(parsed.workModel),
    portal: manualOffer.portal || 'Manual',
    techStack: manualOffer.requirements?.length ? manualOffer.requirements : (parsed.toolsAndTech || []),
    parsedJd: parsed,
  };

  return { job, parsed, preparation };
}
