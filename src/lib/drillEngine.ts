import type { DrillScorecard } from './drillHistory';
export { loadDrillHistory, saveDrillAttempt, clearDrillHistory } from './drillHistory';
export type { DrillAttemptRecord, DrillScorecard } from './drillHistory';

export interface DrillQuestion {
  id: string;
  question: string;
  category: 'BEHAVIORAL' | 'TECHNICAL' | 'SITUATIONAL' | 'TRADE';
  hint: string;
  targetDurationSec: number;
  referenceNotes?: string;
}

import { PRERECORDED_INTERVIEW_QUESTIONS } from './interviewQuestions/prerecordedQuestions';
import { getInjectedQuestions, QuestionTokenContext } from './interviewQuestions';
import { detectDrillMetrics } from './drillMetricDetection';

export const DEFAULT_DRILL_QUESTIONS: DrillQuestion[] = PRERECORDED_INTERVIEW_QUESTIONS.map((q) => ({
  id: q.id,
  question: q.question,
  category: q.category === 'LEADERSHIP' || q.category === 'CLIENT' ? 'SITUATIONAL' : q.category,
  hint: `${q.intent} Struktura STAR: ${q.starHint.situation} -> ${q.starHint.action} -> ${q.starHint.result}`,
  targetDurationSec: q.recommendedDurationSec,
  referenceNotes: `S: ${q.starHint.situation} | T: ${q.starHint.task} | A: ${q.starHint.action} | R: ${q.starHint.result}`,
}));

/**
 * Generuje pełną pulę pytań do drill mode (35 bazowych + 25 kontekstowych z wstrzykniętymi tokenami).
 */
export function buildContextualDrillPool(context: QuestionTokenContext = {}): DrillQuestion[] {
  const basePool = [...DEFAULT_DRILL_QUESTIONS];
  const injected = getInjectedQuestions(context);

  const injectedDrills: DrillQuestion[] = injected.map((q) => ({
    id: q.id,
    question: q.resolvedQuestion,
    category: q.category === 'LEADERSHIP' || q.category === 'CLIENT' ? 'SITUATIONAL' : q.category,
    hint: `${q.intent} ${q.starGuide}`,
    targetDurationSec: 60,
    referenceNotes: q.starGuide,
  }));

  return [...basePool, ...injectedDrills];
}

/**
 * Wybiera losowe pytanie z puli, opcjonalnie wykluczając poprzednio wyświetlone ID.
 */
export function getRandomDrillQuestion(
  pool: DrillQuestion[] = DEFAULT_DRILL_QUESTIONS,
  excludeId?: string
): DrillQuestion {
  if (!pool || pool.length === 0) {
    return DEFAULT_DRILL_QUESTIONS[0];
  }

  const alternatives = excludeId ? pool.filter((q) => q.id !== excludeId) : pool;
  // Wadliwa pula z powtórzonym ID nie może zwrócić undefined i wywrócić modala.
  const available = alternatives.length > 0 ? alternatives : pool;

  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

/**
 * Heurystyczna analiza wypowiedzi pod kątem struktury STAR, metryk liczbowych i poczucia sprawczości (I vs We).
 */
export function analyzeDrillResponse(
  transcript: string | undefined | null,
  _referenceNotes?: string
): DrillScorecard {
  const text = typeof transcript === 'string' ? transcript.trim() : String(transcript || '').trim();
  if (!text) {
    return {
      structure: {
        hasSituation: false,
        hasTask: false,
        hasAction: false,
        hasResult: false,
        detectedElementsCount: 0,
        scorePercent: null,
      },
      metrics: {
        hasMetrics: false,
        detectedMetrics: [],
      },
      ownership: {
        iCount: 0,
        weCount: 0,
      },
      overallScore: null,
      suggestions: ['Wprowadź lub nagraj odpowiedź, aby otrzymać szczegółową analizę STAR.'],
    };
  }

  const lower = text.toLowerCase();

  // 1. STRUKTURA STAR
  const situationKeywords = /\b(?:kiedy|gdy|w firmie|w projekcie|podczas|sytuacja|początkowo|zespół stanął|klient zgłosił|zidentyfikowałem)\b/i;
  const taskKeywords = /\b(?:zadaniem|zadanie|celem|cel|wyzwanie|musiałem|musieliśmy|odpowiadałem za|odpowiedzialność|postawiono przede mną)\b/i;
  const actionKeywords = /\b(?:zrobiłem|zrobiłam|wdrożyłem|wdrożyłam|zaprojektowałem|zaprojektowałam|napisałem|napisałam|zastosowałem|zastosowałam|przeprowadziłem|przeprowadziłam|skonfigurowałem|zbadałem|wykonałem)\b/i;
  const resultKeywords = /\b(?:w rezultacie|efektem|efekt|wynik|wyniku|dzięki temu|udało się|przyniosło|zredukowałem|zwiększyłem|osiągnąłem|zakończyło się|metryka)\b/i;

  // Długość odpowiedzi nie jest dowodem na opis sytuacji; tylko rozpoznany sygnał daje punkt STAR.
  const hasSituation = situationKeywords.test(lower);
  const hasTask = taskKeywords.test(lower);
  const hasAction = actionKeywords.test(lower);
  const hasResult = resultKeywords.test(lower);

  const detectedElementsCount = [hasSituation, hasTask, hasAction, hasResult].filter(Boolean).length;
  const structureScorePercent = Math.round((detectedElementsCount / 4) * 100);

  // 2. METRYKI LICZBOWE — sama data, wersja lub liczba bez kontekstu nie wystarcza.
  const detectedMetrics = detectDrillMetrics(text);
  const hasMetrics = detectedMetrics.length > 0;

  // 3. SPRAWCZOŚĆ ("I" vs "We" / "Ja" vs "My")
  const iRegex = /\b(?:ja|zrobiłem|zrobiłam|wdrożyłem|wdrożyłam|zaprojektowałem|zaprojektowałam|napisałem|napisałam|postanowiłem|postanowiłam|odpowiadałem|odpowiadałam|mój|moje|moja|moim|podjąłem|podjęłam|przeanalizowałem|przeanalizowałam|zastosowałem|zastosowałam)\b/gi;
  const weRegex = /\b(?:my|zrobiliśmy|wdrożyliśmy|zaprojektowaliśmy|napisaliśmy|zespół|firma|robiliśmy|postanowiliśmy|musieliśmy|wspólnie)\b/gi;

  const iMatches = text.match(iRegex) || [];
  const weMatches = text.match(weRegex) || [];

  const iCount = iMatches.length;
  const weCount = weMatches.length;

  // 4. DETEKCJA SŁÓW WATY (Filler Words / Natręctwa językowe)
  const fillerPatterns = [
    { word: 'w sensie', regex: /\bw\s+sensie\b/gi },
    { word: 'jakby', regex: /\bjakby\b/gi },
    { word: 'po prostu', regex: /\bpo\s+prostu\b/gi },
    { word: 'tak naprawdę', regex: /\btak\s+naprawdę\b/gi },
    { word: 'generalnie', regex: /\bgeneralnie\b/gi },
    { word: 'w sumie', regex: /\bw\s+sumie\b/gi },
    { word: 'znaczy się', regex: /\bznaczy\s+się\b/gi },
  ];

  const detectedFillers: Array<{ word: string; count: number }> = [];
  let totalFillerCount = 0;
  for (const fp of fillerPatterns) {
    const matches = text.match(fp.regex) || [];
    if (matches.length > 0) {
      detectedFillers.push({ word: fp.word, count: matches.length });
      totalFillerCount += matches.length;
    }
  }
  // 5. SUGESTIE ULEPSZEŃ
  const suggestions: string[] = [];

  if (totalFillerCount >= 2) {
    suggestions.push(`Wykryto słowa waty (${totalFillerCount}x: ${detectedFillers.map((f) => `„${f.word}”`).join(', ')}). Zadbaj o płynność bez natręctw językowych.`);
  }

  if (!hasResult) {
    suggestions.push('Dodaj wyraźny Rezultat (R): Jaki był finalny efekt Twoich działań i korzyść dla projektu?');
  }

  if (!hasMetrics) {
    suggestions.push('Jeśli masz potwierdzoną miarę rezultatu, dodaj ją do odpowiedzi. Nie zgaduj liczb.');
  }

  if (weCount > iCount && weCount > 0) {
    suggestions.push('Jeśli pytanie dotyczy Twojego wkładu, rozdziel własne działania od działań zespołu.');
  }

  if (!hasTask) {
    suggestions.push('Doprecyzuj Zadanie (T): Jakie było konkretne wyzwanie i Twoja rola w jego rozwiązaniu?');
  }

  if (suggestions.length === 0) {
    suggestions.push('Wykryto sygnały struktury STAR, liczb i własnego działania. Sprawdź, czy pasują do faktów Twojej odpowiedzi.');
  }

  return {
    structure: {
      hasSituation,
      hasTask,
      hasAction,
      hasResult,
      detectedElementsCount,
      scorePercent: structureScorePercent,
    },
    metrics: {
      hasMetrics,
      detectedMetrics,
    },
    ownership: {
      iCount,
      weCount,
    },
    // Wzorce tekstowe są wskazówkami, nie skalibrowaną oceną jakości.
    overallScore: null,
    suggestions,
  };
}
