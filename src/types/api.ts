import type { MasterVault } from './index';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface JobsQueryParams {
  keywords?: string;
  location?: string;
  remoteOnly?: string | boolean;
  portal?: string;
  seniority?: string;
}

export interface FetchJdUrlRequest {
  url: string;
}

export interface FetchJdUrlResponse {
  title: string;
  company: string;
  descriptionRaw: string;
  sourceUrl: string;

  /**
   * Pola poniżej pochodzą z danych strukturalnych strony (schema.org/JobPosting)
   * i są obecne tylko wtedy, gdy portal je udostępnia. Ich odczyt nie kosztuje
   * ani jednego wywołania modelu.
   */
  location?: string;
  remote?: boolean;
  employmentType?: string;
  salary?: string;
  seniority?: string;
  skills?: string[];
  benefits?: string[];

  /**
   * Szczebel drabiny, który dostarczył dane. `structured: true` oznacza, że
   * metadane pochodzą wprost od wystawiającego ofertę, więc mają pierwszeństwo
   * przed wynikiem modelu.
   */
  extraction?: {
    tier: 'json-ld' | 'open-graph' | 'main-content' | 'none';
    structured: boolean;
  };
}

/**
 * The canonical shape lives in `src/lib/jdParser.ts` and is what both the Gemini
 * response schema and the local fallback parser actually produce. A second,
 * differently-named interface used to live here; anything typed against it read
 * `undefined` from every field, silently discarding paid-for AI results.
 */
export type { ParsedJobDescription } from '../lib/jdParser';

/*
 * Kontrakty poniżej opisują funkcje AI, które nie są dziś wystawione jako trasy
 * HTTP — zdjęto je z powierzchni publicznej, bo nie miały wywołań w interfejsie,
 * a wołały model bez uwierzytelnienia i bez limitu kwot. Zostają jako opis
 * kontraktu na Fazę 6, w której wracają razem z ekranami i kontrolą uprawnień.
 */

export interface DeltaOptimizeRequest {
  originalBullet: string;
  targetRole?: string;
  keywords?: string[];
  metricFocus?: string;
}

export interface DeltaOptimizeResponse {
  optimizedBullet: string;
  method: 'SLOT_FILLING' | 'SEMANTIC_CACHE' | 'GEMINI_DELTA';
}

export interface CoverLetterRequest {
  targetRole: string;
  companyName: string;
  jobDescription: string;
  vault: MasterVault;
}

export interface InterviewPrepRequest {
  targetRole: string;
  companyName: string;
  jobDescription: string;
  vault: MasterVault;
}

export interface InterviewPrepResponse {
  questions: Array<{
    question: string;
    difficulty: 'Łatwe' | 'Średnie' | 'Wymagające';
    category: string;
    answerTip: string;
  }>;
  starSuggestions: Array<{
    situation: string;
    task: string;
    action: string;
    result: string;
  }>;
  glossary: Array<{
    term: string;
    definition: string;
  }>;
}
