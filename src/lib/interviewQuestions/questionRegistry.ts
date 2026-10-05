import { PRERECORDED_INTERVIEW_QUESTIONS } from './prerecordedQuestions';
import { TOKEN_INJECTED_INTERVIEW_QUESTIONS } from './tokenInjectedQuestions';
import {
  DynamicTokenInterviewQuestion,
  InjectedInterviewQuestion,
  PrerecordedInterviewQuestion,
  QuestionCategory,
  QuestionTokenContext,
  TokenSlotName,
} from './types';
import type { MasterVault } from '../../types';
import type { ParsedJobDescription } from '../jdParser';
import { getLatestExperience, inferLatestExperienceRole } from '../experienceChronology';

/**
 * Podstawia tokeny `{{nazwa_tokenu}}` w szablonie pytania.
 * Jeśli brakuje wymaganego tokenu i brak wartości domyślnej, zwraca `fallbackQuestion`
 * lub częściowo wypełniony szablon z oznaczeniem brakujących slotów.
 */
export function injectTokensIntoQuestion(
  question: DynamicTokenInterviewQuestion,
  context: QuestionTokenContext
): InjectedInterviewQuestion {
  let resolved = question.template;
  const injectedTokens: Partial<Record<TokenSlotName, string>> = {};
  const missingTokens: TokenSlotName[] = [];

  for (const token of question.requiredTokens) {
    const rawVal = context[token] || question.defaultTokens?.[token];
    if (rawVal && rawVal.trim().length > 0) {
      const cleanVal = rawVal.trim();
      injectedTokens[token] = cleanVal;
      const regex = new RegExp(`\\{\\{${token}\\}\\}`, 'g');
      resolved = resolved.replace(regex, cleanVal);
    } else {
      missingTokens.push(token);
    }
  }

  // W przypadku brakujących krytycznych tokenów, sprawdzamy czy pozostały niedomknięte wąsy {{...}}
  const hasRemainingTags = /\{\{[a-zA-Z0-9_]+\}\}/.test(resolved);
  const isFullyInjected = missingTokens.length === 0 && !hasRemainingTags;

  // Jeśli brakowało kluczowych tokenów i nie dało się ich uzupełnić z defaultów, używamy fallbacku
  const finalQuestion = isFullyInjected ? resolved : question.fallbackQuestion;

  return {
    id: question.id,
    resolvedQuestion: finalQuestion,
    rawTemplate: question.template,
    category: question.category,
    intent: question.intent,
    starGuide: question.starFrameworkGuide,
    injectedTokens,
    missingTokens,
    isFullyInjected,
  };
}

/**
 * Ekstrahuje kontekst tokenów z danych MasterVault i ParsedJobDescription (0-token deterministic).
 */
export function buildTokenContext(
  vault?: Partial<MasterVault> | null,
  jobDescription?: Partial<ParsedJobDescription> | null,
  overrides?: Partial<QuestionTokenContext>
): QuestionTokenContext {
  const context: QuestionTokenContext = {};

  // 1. Z ogłoszenia o pracę (JD)
  if (jobDescription) {
    if (jobDescription.jobTitle) context.rola = jobDescription.jobTitle;
    if (jobDescription.companyName) context.firma = jobDescription.companyName;
    if (jobDescription.toolsAndTech && jobDescription.toolsAndTech.length > 0) {
      context.narzedzie = jobDescription.toolsAndTech[0];
    } else if (jobDescription.requiredHardSkills && jobDescription.requiredHardSkills.length > 0) {
      context.narzedzie = jobDescription.requiredHardSkills[0];
    }
    if (jobDescription.mandatoryRequirements && jobDescription.mandatoryRequirements.length > 0) {
      context.luka_kompetencyjna = jobDescription.mandatoryRequirements[0];
    }
  }

  // 2. Z MasterVault kandydata
  if (vault) {
    if (!context.rola && vault.personalInfo?.title) {
      context.rola = vault.personalInfo.title;
    }
    if (vault.history && vault.history.length > 0) {
      const latestJob = getLatestExperience(vault.history);
      if (!context.rola) context.rola = inferLatestExperienceRole(vault.history);
      if (!context.firma && latestJob?.company) context.firma = latestJob.company;
      if (latestJob?.highlights && latestJob.highlights.length > 0) {
        const h = latestJob.highlights[0];
        if (h.metric) context.metryka = h.metric;
        if (h.tool && !context.narzedzie) context.narzedzie = h.tool;
        if (h.target) context.obiekt = h.target;
      }
    }
    if (vault.skillsMatrix?.toolsAndTech && vault.skillsMatrix.toolsAndTech.length > 0 && !context.narzedzie) {
      context.narzedzie = vault.skillsMatrix.toolsAndTech[0];
    } else if (vault.skillsMatrix?.hardSkills && vault.skillsMatrix.hardSkills.length > 0 && !context.narzedzie) {
      context.narzedzie = vault.skillsMatrix.hardSkills[0];
    }
  }

  // 3. Nadpisania użytkownika / API
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v) context[k] = v;
    }
  }

  return context;
}

/**
 * Pobiera zestaw wszystkich pytań prerecorded z opcjonalnym filtrowaniem po kategorii lub tagach.
 */
export function getPrerecordedQuestions(filter?: {
  category?: QuestionCategory;
  tag?: string;
  tradeSpecialization?: string;
}): PrerecordedInterviewQuestion[] {
  let list = PRERECORDED_INTERVIEW_QUESTIONS;

  if (filter?.category) {
    list = list.filter((q) => q.category === filter.category);
  }
  if (filter?.tag) {
    const t = filter.tag.toLowerCase();
    list = list.filter((q) => q.tags.some((tag) => tag.toLowerCase().includes(t)));
  }
  if (filter?.tradeSpecialization) {
    const spec = filter.tradeSpecialization.toLowerCase();
    list = list.filter((q) => q.tradeSpecialization?.toLowerCase().includes(spec));
  }

  return list;
}

/**
 * Pobiera zestaw pytań z tokenami, wstrzykując aktualny kontekst.
 */
export function getInjectedQuestions(
  context: QuestionTokenContext,
  filter?: { category?: QuestionCategory; tag?: string }
): InjectedInterviewQuestion[] {
  let list = TOKEN_INJECTED_INTERVIEW_QUESTIONS;

  if (filter?.category) {
    list = list.filter((q) => q.category === filter.category);
  }
  if (filter?.tag) {
    const t = filter.tag.toLowerCase();
    list = list.filter((q) => q.tags.some((tag) => tag.toLowerCase().includes(t)));
  }

  return list.map((q) => injectTokensIntoQuestion(q, context));
}

/**
 * Zwraca całościową pulę (35 Prerecorded + 25 Token Injected = 60 pytań).
 */
export function getAllInterviewQuestions(context: QuestionTokenContext = {}) {
  const prerecorded = getPrerecordedQuestions();
  const injected = getInjectedQuestions(context);

  return {
    prerecordedCount: prerecorded.length,
    injectedCount: injected.length,
    totalCount: prerecorded.length + injected.length,
    prerecorded,
    injected,
  };
}
