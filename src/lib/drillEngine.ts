import { StorageKeys, profileDataKeyFor, readJson, removeRaw, writeJson } from './storage';

export interface DrillQuestion {
  id: string;
  question: string;
  category: 'BEHAVIORAL' | 'TECHNICAL' | 'SITUATIONAL' | 'TRADE';
  hint: string;
  targetDurationSec: number;
  referenceNotes?: string;
}

export interface DrillAttemptRecord {
  id: string;
  questionId: string;
  questionText: string;
  transcript: string;
  durationSec: number;
  scorecard: DrillScorecard;
  recordedAt: string;
}

export interface DrillScorecard {
  structure: {
    hasSituation: boolean;
    hasTask: boolean;
    hasAction: boolean;
    hasResult: boolean;
    detectedElementsCount: number;
    scorePercent: number;
  };
  metrics: {
    hasMetrics: boolean;
    detectedMetrics: string[];
  };
  ownership: {
    iCount: number;
    weCount: number;
    ownershipPercent: number;
    assessment: 'HIGH_OWNERSHIP' | 'BALANCED' | 'DIFFUSED_OWNERSHIP';
    label: string;
  };
  fillerWords?: {
    totalCount: number;
    detected: Array<{ word: string; count: number }>;
    clarityScore: number;
  };
  overallScore: number;
  suggestions: string[];
}

import { PRERECORDED_INTERVIEW_QUESTIONS } from './interviewQuestions/prerecordedQuestions';
import { getInjectedQuestions, QuestionTokenContext } from './interviewQuestions';

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

  const available = pool.length > 1 && excludeId
    ? pool.filter((q) => q.id !== excludeId)
    : pool;

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
        scorePercent: 0,
      },
      metrics: {
        hasMetrics: false,
        detectedMetrics: [],
      },
      ownership: {
        iCount: 0,
        weCount: 0,
        ownershipPercent: 50,
        assessment: 'BALANCED',
        label: 'Brak danych do analizy sprawczości',
      },
      overallScore: 0,
      suggestions: ['Wprowadź lub nagraj odpowiedź, aby otrzymać szczegółową analizę STAR.'],
    };
  }

  const lower = text.toLowerCase();

  // 1. STRUKTURA STAR
  const situationKeywords = /\b(?:kiedy|gdy|w firmie|w projekcie|podczas|sytuacja|początkowo|zespół stanął|klient zgłosił|zidentyfikowałem)\b/i;
  const taskKeywords = /\b(?:zadaniem|zadanie|celem|cel|wyzwanie|musiałem|musieliśmy|odpowiadałem za|odpowiedzialność|postawiono przede mną)\b/i;
  const actionKeywords = /\b(?:zrobiłem|zrobiłam|wdrożyłem|wdrożyłam|zaprojektowałem|zaprojektowałam|napisałem|napisałam|zastosowałem|zastosowałam|przeprowadziłem|przeprowadziłam|skonfigurowałem|zbadałem|wykonałem)\b/i;
  const resultKeywords = /\b(?:w rezultacie|efektem|efekt|wynik|wyniku|dzięki temu|udało się|przyniosło|zredukowałem|zwiększyłem|osiągnąłem|zakończyło się|metryka)\b/i;

  const hasSituation = situationKeywords.test(lower) || text.length > 20;
  const hasTask = taskKeywords.test(lower);
  const hasAction = actionKeywords.test(lower);
  const hasResult = resultKeywords.test(lower);

  const detectedElementsCount = [hasSituation, hasTask, hasAction, hasResult].filter(Boolean).length;
  const structureScorePercent = Math.round((detectedElementsCount / 4) * 100);

  // 2. METRYKI LICZBOWE (Liczby, %, k, s, zł, TPS, LCP)
  const metricRegex = /(?:^|\s|[+<>=~])\d+[%xXkKmM+]?(?:\s*(?:zł|pln|tps|lcp|ms|s|dni|godz|godzin|osób|wypadków|incydentów|proc|procent))?(?:\s|$|[,.:;!])/gi;
  const rawMetricsMatches = text.match(metricRegex) || [];
  const detectedMetrics = Array.from(new Set(rawMetricsMatches.map((m) => m.trim()).filter((m) => m.length > 0)));
  const hasMetrics = detectedMetrics.length > 0;

  // 3. SPRAWCZOŚĆ ("I" vs "We" / "Ja" vs "My")
  const iRegex = /\b(?:ja|zrobiłem|zrobiłam|wdrożyłem|wdrożyłam|zaprojektowałem|zaprojektowałam|napisałem|napisałam|postanowiłem|postanowiłam|odpowiadałem|odpowiadałam|mój|moje|moja|moim|podjąłem|podjęłam|przeanalizowałem|przeanalizowałam|zastosowałem|zastosowałam)\b/gi;
  const weRegex = /\b(?:my|zrobiliśmy|wdrożyliśmy|zaprojektowaliśmy|napisaliśmy|zespół|firma|robiliśmy|postanowiliśmy|musieliśmy|wspólnie)\b/gi;

  const iMatches = text.match(iRegex) || [];
  const weMatches = text.match(weRegex) || [];

  const iCount = iMatches.length;
  const weCount = weMatches.length;
  const totalOwnershipTokens = iCount + weCount;

  let ownershipPercent = 50;
  let assessment: DrillScorecard['ownership']['assessment'] = 'BALANCED';
  let ownershipLabel = 'Zrównoważone (Balans między zespołem a rolą własną)';

  if (totalOwnershipTokens > 0) {
    ownershipPercent = Math.round((iCount / totalOwnershipTokens) * 100);
    if (ownershipPercent >= 65) {
      assessment = 'HIGH_OWNERSHIP';
      ownershipLabel = 'Wysoka sprawczość (Wyraźny akcent na własne decyzje i działania)';
    } else if (ownershipPercent <= 35) {
      assessment = 'DIFFUSED_OWNERSHIP';
      ownershipLabel = 'Rozmyta odpowiedzialność (Dominacja formy "My / Zespół")';
    }
  }

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
  const clarityScore = Math.max(20, 100 - totalFillerCount * 15);

  // 5. SUGESTIE ULEPSZEŃ
  const suggestions: string[] = [];

  if (totalFillerCount >= 2) {
    suggestions.push(`Wykryto słowa waty (${totalFillerCount}x: ${detectedFillers.map((f) => `„${f.word}”`).join(', ')}). Zadbaj o płynność bez natręctw językowych.`);
  }

  if (!hasResult) {
    suggestions.push('Dodaj wyraźny Rezultat (R): Jaki był finalny efekt Twoich działań i korzyść dla projektu?');
  }

  if (!hasMetrics) {
    suggestions.push('Wzbogać odpowiedź o twarde metryki liczbowe (np. % przyspieszenia, liczba dni/godzin, oszczędność budżetu, 0 awarii).');
  }

  if (assessment === 'DIFFUSED_OWNERSHIP') {
    suggestions.push('Używaj form pierwszej osoby („Zaprojektowałem”, „Zdecydowałem”) — rekruter ocenia Twój bezpośredni wkład, a nie całego zespołu.');
  }

  if (!hasTask) {
    suggestions.push('Doprecyzuj Zadanie (T): Jakie było konkretne wyzwanie i Twoja rola w jego rozwiązaniu?');
  }

  if (suggestions.length === 0) {
    suggestions.push('Świetna odpowiedź! Zachowana pełna struktura STAR, twarde liczby i wysoka sprawczość.');
  }

  // 6. CAŁKOWITY WYNIK (Wagi: Struktura 40%, Metryki 25%, Sprawczość 20%, Czystość 15%)
  const metricsScore = hasMetrics ? 100 : 20;
  const ownershipScore = assessment === 'HIGH_OWNERSHIP' ? 100 : assessment === 'BALANCED' ? 85 : 40;
  const overallScore = Math.round(structureScorePercent * 0.40 + metricsScore * 0.25 + ownershipScore * 0.20 + clarityScore * 0.15);

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
      ownershipPercent,
      assessment,
      label: ownershipLabel,
    },
    fillerWords: {
      totalCount: totalFillerCount,
      detected: detectedFillers,
      clarityScore,
    },
    overallScore,
    suggestions,
  };
}

/**
 * Odczytuje historię sesji treningowych z localStorage
 */
export function loadDrillHistory(profileId: string): DrillAttemptRecord[] {
  return readJson<DrillAttemptRecord[]>(profileDataKeyFor(StorageKeys.drillHistory, profileId), []);
}

/**
 * Zapisuje próbę odpowiedzi w historii ćwiczeń (max 50 ostatnich prób)
 */
export function saveDrillAttempt(profileId: string, attempt: DrillAttemptRecord): void {
  const key = profileDataKeyFor(StorageKeys.drillHistory, profileId);
  const updated = [attempt, ...loadDrillHistory(profileId).filter((h) => h.id !== attempt.id)].slice(0, 50);
  writeJson(key, updated);
}

/**
 * Czyści całą historię sesji treningowych
 */
export function clearDrillHistory(profileId: string): void {
  removeRaw(profileDataKeyFor(StorageKeys.drillHistory, profileId));
}
