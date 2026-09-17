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
import type { FetchJdUrlResponse, ParsedJobDescription } from '../types/api';
import { scoreCanonicalAts, type CanonicalAtsScore } from './canonicalAts';
import { simulateAtsCheck } from './atsSimulator';
import { generateAntiTemplateCoverLetter } from './coverLetterEngine';
import { buildAdvisorContext, type AdvisorContext } from '../features/advisor/advisorContext';
import { parseJobDescriptionLocal } from './jdParser';

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
    summary: vault.personalInfo?.summary
      ? vault.personalInfo.summary
      : `Dopasowany profil zawodowy pod stanowisko ${job.title} w firmie ${job.company}.`,
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
    // Wartość tymczasowa przed kalkulacją kanoniczną
    atsScore: 0,
  };

  // 1. Kanoniczny wynik ATS (rozstrzygająca miara dopasowania F6)
  const canonical = scoreCanonicalAts(vault, jdText, job.title);

  // 2. Symulacja ATS z poziomu tailored resume
  const ats = simulateAtsCheck(tailored, vault, jdText);
  tailored.atsScore = canonical.score;

  // 3. Kontekst doradcy oraz list motywacyjny
  const advisorContext = buildAdvisorContext(vault, job, ats);
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
    shouldCelebrate: canonical.score >= 90,
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
    location: fetched.location || '',
    description: fetched.descriptionRaw,
    requirements: parsed.requiredHardSkills?.length
      ? parsed.requiredHardSkills
      : (fetched.skills ?? []),
    remote: fetched.remote ?? parsed.workModel === 'REMOTE',
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
} {
  const rawText = manualOffer.description || '';
  const parsed =
    manualOffer.parsedJd ||
    parseJobDescriptionLocal(rawText, manualOffer.title || 'Stanowisko');

  const job: JobOffer = {
    id: manualOffer.id || `manual-${Date.now()}`,
    title: manualOffer.title || '',
    company: manualOffer.company || '',
    salary: manualOffer.salary || '',
    location: manualOffer.location || '',
    description: manualOffer.description || '',
    requirements: manualOffer.requirements || [],
    remote: manualOffer.remote ?? false,
    portal: 'Manual',
    techStack: manualOffer.requirements || [],
    parsedJd: parsed,
  };

  return { job, parsed };
}
