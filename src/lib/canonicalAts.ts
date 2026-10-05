import { CANONICAL_ATS_SCORE_PROVENANCE, type AtsCalculationTime, type JobApplication, type MasterVault } from '../types';
import { getAnalysisMonth } from './analysisPeriod';
import { extractDynamicJdPhrases } from './atsSimulator';
import { auditKnockouts } from './knockouts';
import { hasPositiveSkillEvidence, containsPhrase } from './skillEvidence';
import { hasRequiredRequirementMention, stripPreferredRequirementText } from './jdOptionality';
import { unionExperienceYears, employmentIntervalForJob } from './experience';
import { buildCandidateEvidenceCorpora, getLicenseEvidenceLabel } from './candidateEvidence';
import { formatExperienceRequirementLabel, parseJobDescriptionLocal } from './jdParser';
import { experienceRequirementScore, isExperienceRequirementSatisfied, isUnconditionalExperienceRequirement } from './experienceRequirement';
import { isPlausibleEmailAddress } from './emailAddress';
import { findRequiredSkillDefinitions } from './jdSkillTaxonomy';
export { hasCareerEvidence } from './careerEvidence';

/**
 * Kanoniczny wynik ATS — JEDYNA liczba, którą wolno pokazywać jako
 * „dopasowanie do oferty" (F6).
 *
 * Wcześniej trzy silniki pokazywały trzy różne „wyniki ATS" dla tych samych
 * danych (63 / 72 / 14 na jednej parze): symulator ignorował formalia,
 * mediana je uśredniała, telemetria odejmowała `blocking*25` po wagach.
 * Ten moduł jest rozstrzygający; `simulateAtsCheck`, `simulateMultiEngineATS`
 * i `buildAtsTelemetryReport` zostają jako diagnostyka symulacyjna i nie
 * wolno ich podpinać pod główny wskaźnik dopasowania w UI.
 *
 * Wzór: S = Σ wi·ci / Σ wi, składniki w [0,100], wagi z intencji produktu:
 * telemetria ważyła hard 0.40 / staż 0.25 / strukturę 0.20 / czasowniki 0.15.
 * Czasowniki sprawcze wypadają z kanonu (faworyzowały polski 1. os. — F8),
 * a ich 0.15 przejmują wymagania formalne (silnik je mierzył, ale wynik je
 * ignorował — F3). Stąd: skills 0.40, experience 0.25, structure 0.20,
 * formal 0.15. Wymiary bez wykrytych wymagań nie udają 100%: są wyłączane,
 * a pozostałe wagi normalizowane do 1.00.
 */

export const CANONICAL_WEIGHTS = {
  skills: 0.4,
  experience: 0.25,
  structure: 0.2,
  formal: 0.15,
} as const;

export type CanonicalScoreBand = 'high' | 'moderate' | 'low';

/** Wspólne progi i nazwy oceny, żeby szybki i szczegółowy widok nie sprzeczały się o ten sam wynik. */
export const CANONICAL_SCORE_BAND_LABELS: Record<CanonicalScoreBand, string> = {
  high: 'Wysokie dopasowanie',
  moderate: 'Umiarkowane dopasowanie',
  low: 'Niskie dopasowanie',
};

export function getCanonicalScoreBand(score: number): CanonicalScoreBand {
  if (score >= 75) return 'high';
  if (score >= 50) return 'moderate';
  return 'low';
}

/** Starszy `atsScore` bez wersji źródła nie jest wynikiem kanonicznym. */
export function hasCanonicalAtsScore<T extends {
  atsScore?: number | null;
  atsScoreProvenance?: JobApplication['atsScoreProvenance'];
}>(
  application: T
): application is T & {
  atsScore: number;
  atsScoreProvenance: typeof CANONICAL_ATS_SCORE_PROVENANCE;
} {
  return application.atsScoreProvenance === CANONICAL_ATS_SCORE_PROVENANCE &&
    isValidAtsScore(application.atsScore);
}

export function isValidAtsScore(score: unknown): score is number {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100;
}

export type CanonicalState =
  | 'SCORABLE'
  | 'INSUFFICIENT_CV'
  | 'INSUFFICIENT_JD'
  | 'UNCONFIRMED_REQUIREMENTS'
  | 'NO_REQUIREMENTS_DETECTED';

export interface CanonicalComponents {
  skills: number | null;
  experience: number | null;
  structure: number | null;
  formal: number | null;
}

export type CanonicalEffectiveWeights = Record<keyof CanonicalComponents, number>;

export interface CanonicalAtsScore extends AtsCalculationTime {
  /** null oznacza brak podstaw do obliczenia; zero jest rzeczywistym wynikiem. */
  score: number | null;
  components: CanonicalComponents;
  weights: typeof CANONICAL_WEIGHTS;
  /** Wagi faktycznie użyte w sumie; wymiary bez danych są wyłączone. */
  effectiveWeights: CanonicalEffectiveWeights;
  matchedRequirements: string[];
  missingRequirements: string[];
  unconfirmedRequirements: string[];
  formalFindings: Array<{ label: string; satisfied: boolean; severity: string; status: 'satisfied' | 'unsatisfied' | 'unknown' }>;
  penalties: string[];
  state: CanonicalState;
  reason: string;
}

/** Jedno źródło prawdy dla formalnych braków, które oferta oznaczyła jako blokujące. */
export function getUnmetBlockingRequirements(result?: CanonicalAtsScore): string[] {
  return result?.formalFindings
    .filter((finding) => finding.severity === 'knockout' && (finding.status ?? (finding.satisfied ? 'satisfied' : 'unsatisfied')) === 'unsatisfied')
    .map((finding) => finding.label) ?? [];
}

/** Wymogi wymagające danych, których profil obecnie nie przechowuje. */
export function getUnconfirmedBlockingRequirements(result?: CanonicalAtsScore): string[] {
  return result?.formalFindings
    .filter((finding) => finding.severity === 'knockout' && finding.status === 'unknown')
    .map((finding) => finding.label) ?? [];
}

/** Używa kanonicznego stanu UNKNOWN do odfiltrowania duplikatu z mappera słów. */
export function isRequirementUnconfirmed(result: CanonicalAtsScore | undefined, phrase: string): boolean {
  return Boolean(result?.unconfirmedRequirements.some((label) =>
    containsPhrase(label, phrase) || containsPhrase(phrase, label)
  ));
}

const MAX_COUNTED_YEARS = 15;

/** Treść kandydata + etykiety typowane; nagłówek roli, firmy i instytucji nie dowodzi kompetencji. */
export function buildEvidenceCorpus(vault: MasterVault): string {
  return buildCandidateEvidenceCorpora(vault).skills;
}

export const INSUFFICIENT_CV_CONTENT_MESSAGE =
  'Profil nie zawiera wystarczającej treści o umiejętnościach, doświadczeniu ani projektach do wiarygodnego audytu CV. Uzupełnij dane lub sprawdź odczyt CV.';

export function hasSufficientCvContent(vault: MasterVault): boolean {
  // Nagłówek stanowiska, nazwy pracodawców i szkół oraz sam poziom
  // wykształcenia nie opisują dowodów kandydata. Wliczenie ich pozwalało
  // przejść walidację profilom, które miały dużo metadanych, ale żadnej treści
  // o umiejętnościach, pracy ani projektach.
  const sections = [
    [vault.personalInfo?.summary],
    [
      ...(vault.skillsMatrix?.hardSkills ?? []),
      ...(vault.skillsMatrix?.toolsAndTech ?? []),
      ...(vault.skillsMatrix?.softSkills ?? []),
    ],
    ...(vault.skillsMatrix?.certifications?.length ? [[...(vault.skillsMatrix.certifications.map((certification) => certification?.name))]] : []),
    ...(vault.profiler?.licenses?.length ? [[...vault.profiler.licenses.map(getLicenseEvidenceLabel)]] : []),
    ...(vault.profiler?.languages?.length ? [[...vault.profiler.languages.map((language) => `${language?.language || ''} ${language?.level || ''}`)]] : []),
    (vault.history ?? []).flatMap((job) => [
      job?.description,
      ...(job?.highlights ?? []).map((highlight) =>
        typeof highlight === 'string' ? highlight : `${highlight?.text || ''} ${highlight?.tool || ''} ${(highlight?.keywords ?? []).join(' ')}`
      ),
    ]),
    (vault.projects ?? []).flatMap((project) => [
      project?.description,
      ...((project as { techStack?: string[] })?.techStack ?? []),
    ]),
  ].map((parts) => parts.filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join('\n').trim())
    .filter((section) => section.length > 0);
  const evidence = sections.join('\n');
  const letters = evidence.match(/[\p{L}]/gu)?.length ?? 0;
  const hasSubstantialSection = sections.some((section) =>
    section.length >= 20 && section.trim().split(/\s+/).length >= 2
  );
  return letters >= 10 && (hasSubstantialSection || sections.length >= 2);
}

/** Formalna fraza spełniona tekstem LUB typowanym rozstrzygnięciem knock-outów. */
function isFormalSatisfied(
  phrase: string,
  corpus: string,
  knockoutLabelsSatisfied: string[]
): boolean {
  if (hasPositiveSkillEvidence(corpus, phrase)) return true;
  return knockoutLabelsSatisfied.some(
    (label) => containsPhrase(label, phrase) || containsPhrase(phrase, label)
  );
}

export function scoreCanonicalAts(
  vault: MasterVault,
  jobDescription: string,
  targetRoleTitle = '',
  referenceDate = new Date()
): CanonicalAtsScore {
  const result = calculateCanonicalAts(vault, jobDescription, targetRoleTitle, referenceDate);
  // Także opóźniony eksport zachowuje czas obliczenia. Każda ścieżka wyniku,
  // również bez liczby, korzysta z tego samego miesiąca co matematyka stażu.
  return { ...result, calculatedAt: referenceDate.toISOString(), calculationMonth: getAnalysisMonth(referenceDate) ?? undefined };
}

function calculateCanonicalAts(vault: MasterVault, jobDescription: string, targetRoleTitle: string, referenceDate: Date): CanonicalAtsScore {
  const jd = (jobDescription ?? '').trim();
  const { skills: corpus, formal: formalCorpus } = buildCandidateEvidenceCorpora(vault);

  if (!hasSufficientCvContent(vault)) {
    return emptyResult(
      'INSUFFICIENT_CV',
      INSUFFICIENT_CV_CONTENT_MESSAGE
    );
  }
  if (jd.length < 20) {
    return emptyResult('INSUFFICIENT_JD', 'Ogłoszenie jest zbyt krótkie, żeby wykryć wymagania.');
  }

  const extraction = extractDynamicJdPhrases(jd);
  // Wynik kanoniczny uzupełnia leksykonem używanym przez parser/mapper, ale
  // wyłącznie z wymaganej sekcji. Narzędzie wspomniane w obowiązkach nie może
  // przez samą wzmiankę stać się wymaganiem kandydata.
  const parsedOffer = parseJobDescriptionLocal(jd, targetRoleTitle);
  const requiredSectionText = parsedOffer.sourceSections?.required?.join('\n') ?? '';
  // Gdy oferta jawnie wydziela wymagania albo obowiązki, nie wyciągamy luk
  // z drugiej sekcji. Bez rozpoznanej sekcji wymaganej obowiązki nie stają się
  // wymaganiami wyłącznie dlatego, że zawierają nazwę narzędzia.
  if (requiredSectionText.trim() || parsedOffer.coreResponsibilities?.length) {
    extraction.hardSkills = extraction.hardSkills.filter(({ phrase }) =>
      containsPhrase(requiredSectionText, phrase) && hasRequiredRequirementMention(requiredSectionText, phrase)
    );
    extraction.formalReqs = extraction.formalReqs.filter(({ phrase }) =>
      containsPhrase(requiredSectionText, phrase) && hasRequiredRequirementMention(requiredSectionText, phrase)
    );
  }
  for (const definition of findRequiredSkillDefinitions(requiredSectionText)) {
    const phrase = definition.term.toLocaleLowerCase('pl-PL');
    const alreadyExtracted = extraction.hardSkills.some((skill) =>
      containsPhrase(skill.phrase, phrase) || containsPhrase(phrase, skill.phrase)
    );
    if (!alreadyExtracted) extraction.hardSkills.push({ phrase, weight: 3.0 });
  }
  const knockouts = auditKnockouts(jd, vault);
  const satisfiedLabels = knockouts.findings.filter((f) => f.satisfied).map((f) => f.label);

  // Frazy twarde zdublowane z kryteriami formalnymi liczymy raz (formalnie),
  // żeby nie ważyć dwa razy tego samego dowodu (np. SEP jako skill i knockout).
  const knockoutLabels = knockouts.findings.map((f) => f.label);
  const hasFormalWeldingRequirement = knockouts.findings.some((finding) => finding.ruleId === 'welding');
  const hardPhrases = extraction.hardSkills.filter(
    (h) => !knockoutLabels.some((label) => containsPhrase(label, h.phrase) || containsPhrase(h.phrase, label)) &&
      // Alternatywy narzędzi liczą się jako jedna umiejętność; jeśli CV zawiera
      // ServiceNow, nie raportujemy brakującej Jiry z frazy „X lub Y”.
      !(h.phrase.toLowerCase() === 'jira' && /servicenow\s+(?:or|lub)\s+jira\b/i.test(stripPreferredRequirementText(jd)) && hasPositiveSkillEvidence(corpus, 'servicenow')) &&
      // Samodzielny skrót metody powtórzony przez ekstraktor umiejętności
      // pochodzi tu z tej samej frazy „uprawnienia spawalnicze TIG 141”.
      // Brak formalnego dokumentu pokazujemy tylko jako jedną, typowaną lukę.
      !(hasFormalWeldingRequirement && /^(?:tig|mag|mig)$/.test(h.phrase.trim().toLowerCase()))
  );
  // Ekstraktor ogólny znajduje np. „prawo jazdy” i „certyfikat”, a audyt
  // zerojedynkowy ma bardziej użyteczne kryteria „kat. B” i „F-Gaz”.
  // Liczenie obu form dubluje jedną lukę i zawyża mianownik formaliów.
  const formalRequirements = extraction.formalReqs.filter(
    (f) => !knockoutLabels.some((label) => containsPhrase(label, f.phrase) || containsPhrase(f.phrase, label))
  );

  const matchedRequirements: string[] = [];
  const missingRequirements: string[] = [];
  const unconfirmedRequirements: string[] = [];
  let matchedWeight = 0;
  let totalWeight = 0;
  for (const h of hardPhrases) {
    totalWeight += h.weight;
    if (hasPositiveSkillEvidence(corpus, h.phrase)) {
      matchedWeight += h.weight;
      matchedRequirements.push(h.phrase);
    } else {
      missingRequirements.push(h.phrase);
    }
  }
  // Formalia z ekstrakcji (tekst/typy) — waga 2.0 jak w ekstraktorze.
  let matchedFormalWeight = 0;
  let totalFormalWeight = 0;
  for (const f of formalRequirements) {
    totalFormalWeight += f.weight;
    if (isFormalSatisfied(f.phrase, formalCorpus, satisfiedLabels)) {
      matchedFormalWeight += f.weight;
      matchedRequirements.push(f.phrase);
    } else {
      missingRequirements.push(f.phrase);
    }
  }
  // Kryteria zerojedynkowe jako formalia typowane (waga 2.0 za każde).
  for (const finding of knockouts.findings) {
    // Atuty opcjonalne i wzmianki bez określonego statusu nie są brakami ani
    // karą. `formalFindings` zachowuje ich status dla widoków informacyjnych.
    if (finding.severity !== 'knockout') continue;

    // Brak daty ważności nie dowodzi ani zaliczenia, ani braku dokumentu.
    // Nie wchodzi do licznika ani punktacji, ale pozostaje widoczny jako UNKNOWN.
    if (finding.status === 'unknown') {
      unconfirmedRequirements.push(finding.label);
      continue;
    }

    totalFormalWeight += 2.0;
    if (finding.satisfied) {
      matchedFormalWeight += 2.0;
      if (!matchedRequirements.includes(finding.label)) matchedRequirements.push(finding.label);
    } else if (!missingRequirements.includes(finding.label)) {
      missingRequirements.push(finding.label);
    }
  }

  const skills = totalWeight === 0 ? null : Math.round((matchedWeight / totalWeight) * 100);

  // Staż z unii (70%) + świeżość dopasowań w bieżącej roli (30%).
  // Brak dowodow w opisach stanowisk oznacza brak pomiaru swiezosci, nie wynik 0.
  const experienceRequirements = parsedOffer.experienceRequirements ?? [];
  const generalExperienceRequirements = experienceRequirements.filter((requirement) => requirement.scopeText === null || isUnconditionalExperienceRequirement(requirement));
  const scopedExperienceRequirements = experienceRequirements.filter((requirement) => requirement.scopeText !== null && !isUnconditionalExperienceRequirement(requirement));
  const hasOnlyScopedExperience = generalExperienceRequirements.length === 0 && scopedExperienceRequirements.length > 0;
  const datedHistory = (vault.history ?? [])
    .map((job) => ({ job, interval: employmentIntervalForJob(job, referenceDate) }))
    .filter((entry): entry is {
      job: MasterVault['history'][number];
      interval: NonNullable<ReturnType<typeof employmentIntervalForJob>>;
    } => entry.interval !== null && (entry.job.isCurrent === true || Boolean(entry.job.endDate?.trim())))
    .sort((a, b) => b.interval.end - a.interval.end || b.interval.start - a.interval.start);
  const years = unionExperienceYears(datedHistory.map(({ job }) => job), referenceDate);
  // Każdą jawną granicę oceniamy w jej kierunku. Najniższy wynik zachowuje
  // wpływ wszystkich obowiązkowych granic, również przy minimum i maksimum
  // w jednej ofercie. Bez progów zostaje dotychczasowa skala stażu ogólnego.
  const tenureScores = generalExperienceRequirements.map((requirement) =>
    isUnconditionalExperienceRequirement(requirement) ? 100 : datedHistory.length === 0 ? null :
      experienceRequirementScore(years, requirement.years, requirement.comparison)
  );
  const tenureNorm = hasOnlyScopedExperience
    ? null
    : tenureScores.length > 0
      ? tenureScores.some((score) => score === null) ? null : Math.min(...tenureScores.filter((score): score is number => score !== null))
      : datedHistory.length === 0
      ? null
      : Math.min(1, years / MAX_COUNTED_YEARS) * 100;
  for (const requirement of experienceRequirements) {
    const requirementLabel = formatExperienceRequirementLabel(requirement.years, requirement.scopeText, requirement.comparison);
    // Daty zatrudnienia nie datują używania narzędzia ani pracy w danym
    // obszarze. Nawet pojedynczy punkt z Pythonem nie opisuje całej kadencji.
    if (requirement.scopeText !== null && !isUnconditionalExperienceRequirement(requirement)) {
      if (!unconfirmedRequirements.includes(requirementLabel)) unconfirmedRequirements.push(requirementLabel);
    } else if (isUnconditionalExperienceRequirement(requirement) || (datedHistory.length > 0 && isExperienceRequirementSatisfied(years, requirement.years, requirement.comparison))) {
      if (!matchedRequirements.includes(requirementLabel)) matchedRequirements.push(requirementLabel);
    } else if (datedHistory.length > 0 && !missingRequirements.includes(requirementLabel)) {
      missingRequirements.push(requirementLabel);
    } else if (datedHistory.length === 0 && !unconfirmedRequirements.includes(requirementLabel)) {
      // Bez wiarygodnych dat nie wolno uznać stażu ani zamieniać go w brak;
      // raport musi jednak policzyć go jako rozpoznany, niepotwierdzony wymóg.
      unconfirmedRequirements.push(requirementLabel);
    }
  }
  const scopedExperienceUncertaintyReason = scopedExperienceRequirements.length > 0
    ? 'Daty zatrudnienia nie potwierdzają czasu doświadczenia w wymaganym obszarze.' : '';
  const experienceUncertaintyReason = [
    scopedExperienceUncertaintyReason,
    generalExperienceRequirements.length > 0 && tenureNorm === null ? 'Brak wiarygodnych dat zatrudnienia.' : '',
  ].filter(Boolean).join(' ');
  // Próg stażu jest samodzielnym wymaganiem. Wcześniejszy powrót sprawdzał
  // tylko narzędzia i uprawnienia, więc oferta z samym progiem znikała z oceny.
  const hasScorableExperienceRequirement = generalExperienceRequirements.length > 0 && tenureNorm !== null;
  if (totalWeight === 0 && totalFormalWeight === 0 && !hasScorableExperienceRequirement) {
    const hasUnconfirmedRequirements = unconfirmedRequirements.length > 0;
    return {
      ...emptyResult(
        hasUnconfirmedRequirements ? 'UNCONFIRMED_REQUIREMENTS' : 'NO_REQUIREMENTS_DETECTED',
        hasUnconfirmedRequirements
          ? `Nie można potwierdzić wymogów z oferty: ${[...new Set(unconfirmedRequirements)].join(', ')}.${experienceUncertaintyReason ? ` ${experienceUncertaintyReason}` : ''}`
          : 'Z ogłoszenia nie wykryto żadnych wymagań — nie ma czego oceniać.'
      ),
      unconfirmedRequirements: [...new Set(unconfirmedRequirements)],
      // Brak podstaw do wyniku nie ukrywa obserwacji formalnych o statusie
      // informacyjnym; pozostają widoczne, ale nie wpływają na punktację.
      formalFindings: knockouts.findings.map((finding) => ({
        label: finding.label,
        satisfied: finding.satisfied,
        severity: finding.severity,
        status: finding.status ?? (finding.satisfied ? 'satisfied' : 'unsatisfied'),
      })),
    };
  }

  let recencyNorm: number | null = null;
  const matchedHard = hardPhrases.filter((h) => matchedRequirements.includes(h.phrase));
  if (!hasOnlyScopedExperience && matchedHard.length > 0 && datedHistory.length > 0) {
    // Użytkownik może przestawiać karty historii; indeks tablicy nie jest datą.
    // Brak lub błąd daty nie daje bonusu świeżości, a nazwa firmy nie jest dowodem umiejętności.
    let sum = 0;
    let evidencedSkills = 0;
    for (const h of matchedHard) {
      const evidenceRank = datedHistory.findIndex(({ job }) => {
        const text = `${job.description || ''} ${job.highlights
          .map((highlight) => typeof highlight === 'string' ? highlight : highlight.text)
          .join(' ')}`;
        return hasPositiveSkillEvidence(text, h.phrase);
      });
      if (evidenceRank < 0) continue;
      sum += evidenceRank === 0 ? 100 : evidenceRank <= 2 ? 70 : 40;
      evidencedSkills++;
    }
    if (evidencedSkills > 0) recencyNorm = sum / evidencedSkills;
  }
  const availableExperienceWeight = (tenureNorm === null ? 0 : 0.7) + (recencyNorm === null ? 0 : 0.3);
  const experience = availableExperienceWeight === 0
    ? null
    : Math.round(((tenureNorm ?? 0) * (tenureNorm === null ? 0 : 0.7) +
        (recencyNorm ?? 0) * (recencyNorm === null ? 0 : 0.3)) / availableExperienceWeight);

  // Struktura bez kar za alfabet: nagłówki + kontakt + poprawność dat.
  // Cyrylica nie jest wadą dokumentu (F7); tabele/kolumny bez surowego tekstu
  // przyjmują dokument kanoniczny (stabilny z konstrukcji).
  const penalties: string[] = [];
  if (scopedExperienceUncertaintyReason) penalties.push(scopedExperienceUncertaintyReason);
  const unknownGeneralExperience = generalExperienceRequirements.filter((requirement) => !isUnconditionalExperienceRequirement(requirement));
  if (unknownGeneralExperience.length > 0 && datedHistory.length === 0) {
    penalties.push(`Nie można potwierdzić wymaganego stażu ${unknownGeneralExperience.map(({ years: threshold, scopeText, comparison }) => formatExperienceRequirementLabel(threshold, scopeText, comparison)).join(', ')}: brak wiarygodnych dat zatrudnienia.`);
  }
  // Sekcje oceniamy po danych, które rzeczywiście trafią do CV. Wzmianka
  // „work experience” w podsumowaniu i pusty wiersz edytora nie są sekcjami.
  const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;
  const hasExperienceSection = (vault.history ?? []).some((job) =>
    [job?.role, job?.company, job?.location, job?.startDate, job?.endDate, job?.description].some(hasText) ||
    (job?.highlights ?? []).some((highlight) => typeof highlight === 'string'
      ? hasText(highlight)
      : [highlight?.text, highlight?.action, highlight?.target, highlight?.tool, highlight?.metric,
          ...(highlight?.keywords ?? [])].some(hasText))
  );
  const hasSkillsSection = [
    ...(vault.skillsMatrix?.hardSkills ?? []),
    ...(vault.skillsMatrix?.toolsAndTech ?? []),
    ...(vault.skillsMatrix?.softSkills ?? []),
  ].some(hasText);
  const hasContactSection =
    [vault.personalInfo?.email, vault.personalInfo?.phone, vault.personalInfo?.location,
      vault.personalInfo?.linkedin, vault.personalInfo?.github, vault.personalInfo?.website].some(hasText);

  let missingHeaders = 0;
  if (!hasExperienceSection) missingHeaders++;
  if (!hasSkillsSection) missingHeaders++;
  if (!hasContactSection) missingHeaders++;

  if (missingHeaders > 0) penalties.push(`Brak ${missingHeaders} standardowych nagłówków sekcji.`);
  if (!vault.personalInfo?.email || !isPlausibleEmailAddress(vault.personalInfo.email)) {
    penalties.push('Brak prawidłowego adresu e-mail.');
  }
  if (!vault.personalInfo?.phone || vault.personalInfo.phone.trim().length < 6) {
    penalties.push('Brak numeru telefonu.');
  }
  let badDates = 0;
  for (const job of vault.history ?? []) {
    if (!job?.startDate) continue;
    if (!employmentIntervalForJob(job, referenceDate)) badDates++;
  }
  if (badDates > 0) penalties.push(`${badDates} wpis(y) z niepoprawnym lub przyszłym zakresem dat (wykluczone ze stażu).`);
  const structure = Math.max(0, Math.round(100 - missingHeaders * 12 - penalties.filter((p) => p.startsWith('Brak prawidłowego') || p.startsWith('Brak numeru')).length * 10 - Math.min(24, badDates * 8)));

  void targetRoleTitle;
  const formal = totalFormalWeight === 0 ? null : Math.round((matchedFormalWeight / totalFormalWeight) * 100);

  const components: CanonicalComponents = { skills, experience, structure, formal };
  const effectiveWeights = calculateEffectiveWeights(components);
  const score = recomputeCanonicalTotal(components);

  return {
    score,
    components,
    weights: CANONICAL_WEIGHTS,
    effectiveWeights,
    matchedRequirements: [...new Set(matchedRequirements)],
    missingRequirements: [...new Set(missingRequirements)],
    unconfirmedRequirements: [...new Set(unconfirmedRequirements)],
    formalFindings: knockouts.findings.map((f) => ({ label: f.label, satisfied: f.satisfied, severity: f.severity, status: f.status ?? (f.satisfied ? 'satisfied' : 'unsatisfied') })),
    penalties,
    state: 'SCORABLE',
    reason: 'Policzono na pozytywnych dowodach z granicami słów; negacje, nauka i wyciek wymagań nie liczą się.',
  };
}

function emptyResult(state: CanonicalState, reason: string): CanonicalAtsScore {
  return {
    score: null,
    components: { skills: null, experience: null, structure: null, formal: null },
    weights: CANONICAL_WEIGHTS,
    effectiveWeights: { skills: 0, experience: 0, structure: 0, formal: 0 },
    matchedRequirements: [],
    missingRequirements: [],
    unconfirmedRequirements: [],
    formalFindings: [],
    penalties: [],
    state,
    reason,
  };
}

/** Rekonstrukcja do testu uzgodnienia (pokazana suma ≡ składniki). */
export function recomputeCanonicalTotal(components: CanonicalComponents): number {
  const effectiveWeights = calculateEffectiveWeights(components);
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (components.skills ?? 0) * effectiveWeights.skills +
          (components.experience ?? 0) * effectiveWeights.experience +
          (components.structure ?? 0) * effectiveWeights.structure +
          (components.formal ?? 0) * effectiveWeights.formal
      )
    )
  );
}

function calculateEffectiveWeights(components: CanonicalComponents): CanonicalEffectiveWeights {
  const availableWeight = Object.entries(CANONICAL_WEIGHTS).reduce((sum, [key, weight]) => {
    return components[key as keyof CanonicalComponents] === null ? sum : sum + weight;
  }, 0);

  if (availableWeight === 0) {
    return { skills: 0, experience: 0, structure: 0, formal: 0 };
  }

  return {
    skills: components.skills === null ? 0 : CANONICAL_WEIGHTS.skills / availableWeight,
    experience: components.experience === null ? 0 : CANONICAL_WEIGHTS.experience / availableWeight,
    structure: components.structure === null ? 0 : CANONICAL_WEIGHTS.structure / availableWeight,
    formal: components.formal === null ? 0 : CANONICAL_WEIGHTS.formal / availableWeight,
  };
}
