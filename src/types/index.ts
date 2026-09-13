export type FlagCategory = 'PHYSICAL' | 'OFFICE_IT' | 'CASUAL' | 'REMOTE';

export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'PIVOT';

export interface LocationPreferences {
  city: string;
  radiusKm: number;
  willingnessToTravel: boolean;
  hybridWork: boolean;
  remoteOnly: boolean;
  relocationReady?: boolean;
  commuteRadiusKm?: number;
}

export interface LanguageProficiency {
  id: string;
  language: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Native';
  context: string;
}

export interface ProfilerState {
  flags: FlagCategory[];
  experienceLevel: ExperienceLevel;
  location: LocationPreferences;
  languages: LanguageProficiency[];
  licenses?: string[];
  /**
   * Zawód wybrany jawnie w wyborze specjalizacji — identyfikator podroli
   * z `src/data/specializations.ts`. Opcjonalny, bo rozpoznanie z tytułu
   * (`specializationIndex`) pozostaje wartością początkową dopóki użytkownik
   * czegoś nie wybierze sam; po wyborze jego decyzja bije zgadywankę.
   */
  subRoleId?: string;
}

export interface PersonalInfo {
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  website?: string;
  photoUrl?: string;
  title: string;
  summary: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date?: string;
  url?: string;
}

export interface SkillsMatrix {
  hardSkills: string[];
  softSkills: string[];
  toolsAndTech: string[];
  certifications: Certification[];
}

export interface HighlightMetric {
  id: string;
  text: string;
  action: string;
  target: string;
  tool: string;
  metric: string;
  keywords: string[];
}

export interface WorkExperience {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description?: string;
  highlights: HighlightMetric[];
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  role: string;
  description: string;
  techStack: string[];
  metrics?: string;
  link?: string;
}

export interface ClaimDateRange {
  start: string;
  end: string;
}

export interface Claim {
  id: string;
  sourceProject: string;
  dateRange: ClaimDateRange | string;
  metric?: string;
  tags: string[];
}

import type { MobilityPreferences } from '../lib/commuteCalculator';

export interface MasterVault {
  version: string;
  updatedAt: string;
  profiler: ProfilerState;
  personalInfo: PersonalInfo;
  skillsMatrix: SkillsMatrix;
  history: WorkExperience[];
  education: Education[];
  projects: Project[];
  claims?: Claim[];
  /**
   * Preferencje dojazdu do kalkulatora opłacalności. Pole opcjonalne, bo
   * vaulty zapisane przed jego wprowadzeniem muszą się dalej wczytywać —
   * brak preferencji znaczy „jeszcze nie ustawione", nie „zero".
   */
  mobilityPreferences?: MobilityPreferences;
}

export interface PhraseSlot {
  template: string;
  action: string;
  target: string;
  tool: string;
  metric: string;
  keywords: string[];
}

export interface CachedPhrase {
  id: string;
  originalText: string;
  optimizedText: string;
  slots: PhraseSlot;
  keywords: string[];
  hitCount: number;
  score: number;
  lastUsed: string;
}

export interface LemmatizedMatch {
  keywordFromJD: string;
  matchedInCv: string;
  category: 'HARD_SKILL' | 'FORMAL_REQUIREMENT' | 'SOFT_SKILL';
  weight: number;
}

export interface AtsCheckResult {
  overallScore: number;
  keywordCoverageScore: number;
  structureScore: number;
  formattingScore: number;

  /**
   * Profil, pod który ułożono zalecenia. Wpływa na ich kolejność, nie na wynik:
   * ta sama treść CV nie może dostawać różnych ocen zależnie od checkboxa.
   */
  appliedProfile: FlagCategory;
  
  // Layer 1: Structure & Layout Diagnostics
  layer1Structure: {
    layoutScore: number;
    headerNormalizationScore: number;
    detectedSections: string[];
    missingStandardSections: string[];
    unparsableElementsWarnings: string[];
    isSingleColumnCompliant: boolean;
  };

  // Layer 2: NLP & Lemmatized Keyword Matching
  layer2Nlp: {
    hardSkillsCoverage: number;
    formalReqsCoverage: number;
    softSkillsFilterCount: number;
    extractedJdPhrasesCount: number;
    lemmatizedMatches: LemmatizedMatch[];
  };

  // Layer 3: Weighted Scoring Algebra
  layer3Scoring: {
    hardSkillScore: number; // Sh (Weight 3.0x)
    recencyScore: number;   // Sr (1.0 for current, 0.7 for mid, 0.4 for old)
    titleMatchScore: number; // St (Job Title Density & Similarity)
    formulaBreakdown: string;
  };

  matchedKeywords: string[];
  missingHardSkills: string[];
  missingSoftSkills: string[];
  ocrWarnings: string[];
  badDateFormats: string[];
  gapAnalysis: string[];
  recommendations: string[];
}

export interface TailoredHighlight {
  experienceId: string;
  role: string;
  company: string;
  originalText: string;
  optimizedText: string;
  source: 'SLOT_FILLING' | 'SEMANTIC_CACHE' | 'GEMINI_DELTA';
  keywordsMatched: string[];
}

export interface TailoredResume {
  targetJobTitle: string;
  companyName: string;
  summary: string;
  selectedHighlights: TailoredHighlight[];
  skillsMatched: {
    hardSkills: string[];
    toolsAndTech: string[];
    softSkills: string[];
  };
  atsScore: number;
  /** Work-experience ids ordered by relevance to this job offer (see lib/relevanceRanking.ts). Falls back to vault order when absent. */
  experienceOrder?: string[];
}

export interface CoverLetter {
  targetJobTitle: string;
  companyName: string;
  hook: string;
  proofPoints: string[];
  callToAction: string;
  fullText: string;
}

/**
 * Rodzaj luki w profilu.
 *
 * Nazewnictwo pochodzi z `ConsistencyCheckIssue`, który stał tu wcześniej
 * z właściwym słownictwem i zerem konsumentów — ani jeden plik go nie
 * produkował, ani jeden nie czytał. Reguła 5 działa w obie strony: kod bez
 * konsumenta albo go dostaje, albo znika. Została sama klasyfikacja, bo
 * posługuje się nią katalog pytań uzupełniających (`src/lib/cvQuestionEngine.ts`),
 * a druga kopia tej listy rozjechałaby się przy pierwszej nowej kategorii.
 */
export type GapKind = 'GAP' | 'SLOGAN' | 'UNQUANTIFIED' | 'MISSING_FIELD';

export interface LayeredFactItem {
  id: string;
  experienceId: string;
  sourceFactId?: string;
  baseText: string;
  jobReframedText: string;
  userOverrideText?: string;
  isUserEdited: boolean;
  sourceType: 'VAULT_BASE' | 'AI_REFRAMED' | 'USER_EDITED';
  keywordsMatched: string[];
}

export interface PreFlightCheckItem {
  id: string;
  title: string;
  status: 'PASSED' | 'WARNING' | 'FAILED';
  message: string;
  category: 'FACT_ACCURACY' | 'DEALBREAKER' | 'PAGE_BUDGET' | 'METRICS' | 'LANGUAGE';
}

/**
 * Ściąga na rozmowę kwalifikacyjną.
 *
 * Szkielet (słownik, pytania, checklista, pytania do rekrutera) powstaje lokalnie
 * i deterministycznie z (ParsedJobDescription, MasterVault) — zero tokenów. Model
 * dokłada wyłącznie to, co naprawdę wymaga personalizacji, i podmienia tylko
 * odpowiadające mu pola; stąd `source` przy pozycjach i `generationMode` na całości.
 */
export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  category: 'HARD_SKILL' | 'TOOL' | 'DOMAIN_CONCEPT' | 'ACRONYM';
  source: 'JD_KEYWORD' | 'JD_TOOL' | 'JD_HARD_SKILL';
}

export interface StarTalkingPoint {
  id: string;
  relatedRequirement: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  sourceExperienceId?: string;
}

export interface STARStory {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  metrics: string[];
  tags: string[];
  projectId: string;
  durationSec: number;
}

export interface SkillBridge {
  id: string;
  missingSkill: string;
  adjacentSkill: string;
  conceptualEquivalence: string;
  bridgeExplanation: string;
  talkingPoint: string;
  evidenceFromVault?: string;
  learningCurveDays?: number;
  confidenceScore: number;
}

export interface ElevatorPitchOutput {
  oneLiner: string;
  thirtySeconds: string;
  ninetySeconds: string;
  metricsUsed: string[];
  targetRole: string;
  estimatedDurationSec: {
    oneLiner: number;
    thirtySeconds: number;
    ninetySeconds: number;
  };
}

export interface InterviewQaItem {
  id: string;
  question: string;
  modelAnswer: string;
  category: 'BEHAVIORAL' | 'TECHNICAL' | 'MOTIVATION' | 'SITUATIONAL';
  source: 'LOCAL_TEMPLATE' | 'GEMINI_PERSONALIZED';
}

export interface RedFlagConceptItem {
  id: string;
  label: string;
  detail: string;
  severity: 'MUST_KNOW' | 'GOOD_TO_KNOW';
  source: 'MANDATORY_REQUIREMENT' | 'CORE_RESPONSIBILITY' | 'SENIORITY_IMPLICATION';
}

export type InterviewStage =
  | 'INTRO'
  | 'TECHNICAL'
  | 'SYSTEM_DESIGN'
  | 'BEHAVIORAL'
  | 'CANDIDATE_QA'
  | 'WRAP_UP';

export interface PreCallChecklistItem {
  id: string;
  category: 'TECHNICAL' | 'RESEARCH' | 'ENVIRONMENT';
  label: string;
  completed: boolean;
}

export interface LiveNoteItem {
  id: string;
  timestamp: string;
  stage: InterviewStage;
  text: string;
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'CHALLENGING';
}

export interface LiveTrackerState {
  currentStage: InterviewStage;
  startedAt?: string;
  stageDurations: Partial<Record<InterviewStage, number>>;
  notes: LiveNoteItem[];
  interviewerQuestions: string[];
}

export interface PostCallDebrief {
  overallRating: 1 | 2 | 3 | 4 | 5;
  whatWentWell: string;
  trickyQuestions: string[];
  topicsToClarifyInFollowUp: string;
  salaryTimelineNotes?: string;
  generatedFollowUpEmail: string;
  completedAt?: string;
}

export interface InterviewLoopSession {
  id: string;
  jobOfferId?: string;
  companyName: string;
  roleTitle: string;
  jdText?: string;
  scheduledAt: string;
  status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
  tags?: string[];
  selectedStories?: STARStory[];
  selectedBridges?: SkillBridge[];
  preCallChecklist: PreCallChecklistItem[];
  liveTracker: LiveTrackerState;
  postCallDebrief?: PostCallDebrief;
  updatedAt: string;
}

export interface EmergencyPhrase {
  id: string;
  scenario: string;
  phrasePL: string;
  phraseEN?: string;
}

export interface QuestionToAsk {
  id: string;
  question: string;
  rationale: string;
  category: 'ROLE_SCOPE' | 'TEAM_CULTURE' | 'GROWTH' | 'BUSINESS_CONTEXT';
}

export interface InterviewCheatSheet {
  targetJobTitle: string;
  companyName: string;
  generatedAt: string;
  glossary: GlossaryTerm[];
  starTalkingPoints: StarTalkingPoint[];
  qaBank: InterviewQaItem[];
  redFlagsChecklist: RedFlagConceptItem[];
  emergencyPhrases: EmergencyPhrase[];
  questionsToAsk: QuestionToAsk[];
  personalizedFraming?: string;
  generationMode: 'LOCAL_SKELETON' | 'GEMINI_ENRICHED';
}

export interface JobOffer {
  id: string;
  title: string;
  company: string;
  salary: string;
  location: string;
  description?: string;
  requirements?: string[];
  tags?: string[];
  techStack?: string[];
  remote?: boolean;
  isRemote?: boolean;
  portal?: string;
  level?: string;
  url?: string;
  rawDescription?: string;
  parsedJd?: import('../lib/jdParser').ParsedJobDescription;
}

export interface ApplicationHistoryRecord {
  id: string;
  companyName: string;
  jobTitle: string;
  dateCreated: string;
  recruitmentMode: 'ATS_CORPORATE' | 'CRAFT_LOCAL' | 'HYBRID';
  atsScore: number;
  layeredFacts: LayeredFactItem[];
  exportedFormats: Array<'PDF' | 'DOCX' | 'TXT' | 'LINKEDIN'>;
  jobDescriptionExcerpt: string;
}



/**
 * „Do wysłania" to szkic: dokumenty gotowe, zgłoszenie jeszcze nie poszło.
 * Doszedł razem z ankietą po eksporcie — bez niego oferta, przy której portal
 * odrzucił plik, musiałaby wylądować jako „Wysłana", czyli jako nieprawda
 * (reguła 1 w `AGENTS.md`).
 */
export type ApplicationStatus = 'Do wysłania' | 'Wysłana' | 'Rozmowa' | 'Oferta' | 'Odrzucona';

export interface ApplicationDocumentSnapshot {
  /** Wersja schematu snapshotu (do kompatybilności wstecznej) */
  schemaVersion: 1;
  /** Znacznik czasu utworzenia snapshotu w formacie ISO 8601 */
  createdAt: string;
  /** Niezmienna migawka wygenerowanego dopasowanego CV */
  tailoredResume: TailoredResume;
  /** Niezmienna migawka wygenerowanego listu motywacyjnego */
  coverLetter?: CoverLetter;
  /** Niezmienna migawka stanu MasterVault z momentu zapisu aplikacji */
  vaultSnapshot: MasterVault;
  /** Niezmienna migawka oferty pracy z momentu zapisu */
  jobOfferSnapshot: {
    id?: string;
    title: string;
    company: string;
    salary?: string;
    location?: string;
    description?: string;
    url?: string;
  };
  /** Niezmienna migawka wyniku symulacji ATS z momentu zapisu */
  atsResultSnapshot?: AtsCheckResult;
  /**
   * Wariant wyglądu faktycznie użyty przy eksporcie dokumentu. Nie ma go,
   * dopóki użytkownik nie wyeksportuje CV i nie potwierdzi wysłania aplikacji.
   */
  exportedCv?: GeneratedCvExport;
}

/** Metadane wyglądu dokumentu, bez treści CV ani deklaracji o skuteczności ATS. */
export interface GeneratedCvExport {
  templateId: string;
  templateName: string;
  fit: 'ats-friendly' | 'visual-balanced';
  exportedAt: string;
}

/**
 * Jedna aplikacja o pracę w Pipeline.
 *
 * Typ mieszkał wcześniej w `features/tracker/ApplicationModal.tsx`, czyli
 * w module okna dialogowego. Przeniesiony tutaj, bo przestał być sprawą
 * jednego ekranu: czyta go silnik „następnego kroku" i mechanizm odblokowań,
 * a `src/lib/` nie ma prawa importować niczego z `src/features/`.
 *
 * Pola rozmowy (`interviewAt`, `briefDoneAt`, `debriefSentAt`) są tu celowo,
 * a nie w osobnym bycie. Rozmowa nie istnieje sama dla siebie — zawsze jest
 * rozmową o **tę** aplikację, i to właśnie ona wiąże trening oraz narzędzia
 * live z konkretnym wpisem w Pipeline. Osobna encja wymagałaby klucza obcego
 * i synchronizacji, a przy jednej rozmowie na aplikację nie kupowałaby nic.
 */
export interface JobApplication {
  id: string;
  company: string;
  position: string;
  salary: string;
  /** Data wysłania aplikacji, `YYYY-MM-DD`. */
  date: string;
  status: ApplicationStatus;
  notes?: string;
  jobUrl?: string;

  /**
   * Wynik ATS zapisany w chwili analizy oferty, 0–100.
   *
   * Pole opcjonalne, bo aplikacja dodana ręcznie w Pipeline nigdy nie
   * przeszła przez symulator i **nie ma** wyniku. Zera nie wpisujemy: zero
   * znaczyłoby „zmierzono i wyszło fatalnie", a prawda jest taka, że nie
   * mierzono (reguła 1 w `AGENTS.md`).
   */
  atsScore?: number;
  /** Braki wskazane przez symulator ATS przy tym wyniku. */
  missingKeywords?: string[];

  /** Termin rozmowy, ISO 8601 z godziną. Ustawiany, gdy status = „Rozmowa". */
  interviewAt?: string;
  /** Kiedy odhaczono przygotowanie przed rozmową (Pre-Call Brief). */
  briefDoneAt?: string;
  /** Kiedy wysłano follow-up po rozmowie. */
  debriefSentAt?: string;

  /**
   * Niezmienna migawka wygenerowanych dokumentów aplikacyjnych (CV, List motywacyjny,
   * stan MasterVault i oferty z chwili aplikacji).
   * Opcjonalna dla aplikacji dodanych ręcznie w Pipeline.
   */
  documentSnapshot?: ApplicationDocumentSnapshot;
}
