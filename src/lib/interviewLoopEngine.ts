import {
  InterviewLoopSession,
  PreCallChecklistItem,
  InterviewStage,
  LiveNoteItem,
  PostCallDebrief,
} from '../types';
import { StorageKeys, profileDataKeyFor, readJson, writeJson } from './storage';
import { getFollowUpEmailOpenings, selectVariantIndex } from './phrasingVariations';

export const DEFAULT_PRE_CALL_CHECKLIST: Omit<PreCallChecklistItem, 'completed'>[] = [
  // Techniczne
  {
    id: 'chk_mic',
    category: 'TECHNICAL',
    label: 'Test mikrofonu i redukcji szumów',
  },
  {
    id: 'chk_cam',
    category: 'TECHNICAL',
    label: 'Kamera na wysokości oczu i neutralne tło',
  },
  {
    id: 'chk_net',
    category: 'TECHNICAL',
    label: 'Stabilne łącze internetowe i wyciszone powiadomienia',
  },
  // Przygotowanie merytoryczne
  {
    id: 'chk_pitch',
    category: 'RESEARCH',
    label: 'Kluczowy Elevator Pitch (30s) przećwiczony i gotowy',
  },
  {
    id: 'chk_company',
    category: 'RESEARCH',
    label: 'Przejrzany profil firmy, produkty i model biznesowy',
  },
  {
    id: 'chk_star',
    category: 'RESEARCH',
    label: 'Przygotowane 2-3 historie STAR z twardymi metrykami',
  },
  // Otoczenie
  {
    id: 'chk_water',
    category: 'ENVIRONMENT',
    label: 'Szklanka wody w zasięgu ręki',
  },
  {
    id: 'chk_notes',
    category: 'ENVIRONMENT',
    label: 'Otwarty Live HUD / notatnik z pytaniami do pracodawcy',
  },
];

/**
 * `shortLabel` istnieje obok pełnego `label`, bo oś etapów w Live Trackerze
 * mieści kilka znaków na kafelek — ucinanie pierwszego słowa pełnej nazwy
 * dawało trzy identyczne kafelki „Pytania” (audyt treści §3.2).
 */
export const STAGE_LABELS: Record<
  InterviewStage,
  { shortLabel: string; label: string; description: string }
> = {
  INTRO: {
    shortLabel: 'Intro',
    label: 'Wstęp & Rozgrzewka (Intro)',
    description: 'Small talk, autoprezentacja (Elevator Pitch 30s) i przedstawienie agendy spotkania.',
  },
  TECHNICAL: {
    shortLabel: 'Techniczne',
    label: 'Pytania Techniczne & Narzędzia',
    description: 'Weryfikacja twardych umiejętności, technologii, uprawnień i architektury.',
  },
  SYSTEM_DESIGN: {
    shortLabel: 'Zadanie',
    label: 'System Design / Studia Przypadków',
    description: 'Projektowanie rozwiązania, analiza kompromisów technicznych i skalowalności.',
  },
  BEHAVIORAL: {
    shortLabel: 'Behawioralne',
    label: 'Pytania Behawioralne (STAR)',
    description: 'Praca zespołowa, rozwiązywanie konfliktów, reakcja na awarie i trudne sytuacje.',
  },
  CANDIDATE_QA: {
    shortLabel: 'Twoje pytania',
    label: 'Pytania Kandydata do Rekrutera',
    description: 'Zadawanie strategicznych pytań o zespół, architekturę, roadmapę i kulturę.',
  },
  WRAP_UP: {
    shortLabel: 'Podsumowanie',
    label: 'Podsumowanie & Kolejne Kroki',
    description: 'Ustalenie timeline rekrutacji, widełek i terminu kolejnego kontaktu.',
  },
};

/**
 * Tworzy nową sesję pętli rekrutacyjnej (Interview Loop)
 */
export function createInterviewSession(
  companyName: string,
  roleTitle: string,
  scheduledAt = new Date().toISOString(),
  jobOfferId?: string,
  jdText?: string,
  tags: string[] = []
): InterviewLoopSession {
  return {
    id: `loop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    jobOfferId,
    companyName: companyName.trim() || 'Firma',
    roleTitle: roleTitle.trim() || 'Stanowisko',
    jdText,
    scheduledAt,
    status: 'UPCOMING',
    tags,
    selectedStories: [],
    selectedBridges: [],
    preCallChecklist: DEFAULT_PRE_CALL_CHECKLIST.map((item) => ({
      ...item,
      completed: false,
    })),
    liveTracker: {
      currentStage: 'INTRO',
      notes: [],
      interviewerQuestions: [],
      stageDurations: {},
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Przełącza etap w trakcie trwania rozmowy na żywo
 */
export function advanceInterviewStage(
  session: InterviewLoopSession,
  nextStage: InterviewStage
): InterviewLoopSession {
  return {
    ...session,
    status: 'IN_PROGRESS',
    liveTracker: {
      ...session.liveTracker,
      currentStage: nextStage,
      startedAt: session.liveTracker.startedAt || new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Dodaje notatkę ze spotkania na żywo
 */
export function addLiveNote(
  session: InterviewLoopSession,
  text: string,
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'CHALLENGING' = 'NEUTRAL'
): InterviewLoopSession {
  const trimmed = text.trim();
  if (!trimmed) return session;

  const newNote: LiveNoteItem = {
    id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    stage: session.liveTracker.currentStage,
    text: trimmed,
    sentiment,
  };

  return {
    ...session,
    liveTracker: {
      ...session.liveTracker,
      notes: [...session.liveTracker.notes, newNote],
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generuje treść wiadomości e-mail z podziękowaniem po rozmowie (Follow-up Email)
 * z bogatym i zróżnicowanym doborem przywitań i wstępów.
 */
export function generateFollowUpEmail(
  session: InterviewLoopSession,
  candidateName = '',
  debriefData?: Partial<PostCallDebrief>,
  variantIndex?: number
): string {
  const role = session.roleTitle;
  const highlightPoint =
    debriefData?.whatWentWell?.trim() ||
    session.liveTracker.notes[0]?.text ||
    'możliwość szczegółowego poznania zakresu roli i planów zespołu';

  const openings = getFollowUpEmailOpenings(role, highlightPoint);
  const idx = selectVariantIndex(variantIndex ?? session.companyName + role, openings.length);
  const opening = openings[idx];

  const signLine = candidateName.trim() && candidateName.trim().toLowerCase() !== 'kandydat'
    ? `\n\nZ poważaniem,\n${candidateName.trim()}`
    : '\n\nZ poważaniem';

  return (
    `${opening}\n\n` +
    `Potwierdzam duże zainteresowanie dołączeniem do Państwa zespołu i z przyjemnością poznam kolejne kroki w procesie rekrutacyjnym.` +
    signLine
  );
}

/**
 * Zapis i odczyt z pamięci lokalnej (StorageKeys.interviewLoops)
 */
export function loadInterviewSessions(profileId: string): InterviewLoopSession[] {
  const parsed = readJson<unknown>(profileDataKeyFor(StorageKeys.interviewLoops, profileId), []);
  return Array.isArray(parsed) ? (parsed as InterviewLoopSession[]) : [];
}

export function saveInterviewSession(profileId: string, session: InterviewLoopSession): void {
  const key = profileDataKeyFor(StorageKeys.interviewLoops, profileId);
  const existing = loadInterviewSessions(profileId);
  const idx = existing.findIndex((s) => s.id === session.id);
  const updated =
    idx >= 0
      ? existing.map((s, i) => (i === idx ? session : s))
      : [session, ...existing];
  writeJson(key, updated);
}

export function deleteInterviewSession(profileId: string, sessionId: string): void {
  const key = profileDataKeyFor(StorageKeys.interviewLoops, profileId);
  const existing = loadInterviewSessions(profileId);
  writeJson(
    key,
    existing.filter((s) => s.id !== sessionId)
  );
}
