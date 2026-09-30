import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInterviewSession,
  advanceInterviewStage,
  addLiveNote,
  generateFollowUpEmail,
  loadInterviewSessions,
  saveInterviewSession,
  deleteInterviewSession,
  DEFAULT_PRE_CALL_CHECKLIST,
} from '../interviewLoopEngine';
import { MemoryStorage } from './helpers/memoryStorage';
import { resetLastGoodCache } from '../storage';

describe('Interview Loop Manager (interview-loop-manager-v1)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
    resetLastGoodCache();
  });

  describe('Tworzenie i zarządzanie sesją rozmowy', () => {
    it('tworzy nową sesję z kompletną checklistą techniczną i stanem UPCOMING', () => {
      const session = createInterviewSession('Tech Global Sp. z o.o.', 'Senior Engineer');

      expect(session.id).toBeDefined();
      expect(session.companyName).toBe('Tech Global Sp. z o.o.');
      expect(session.roleTitle).toBe('Senior Engineer');
      expect(session.status).toBe('UPCOMING');
      expect(session.preCallChecklist.length).toBe(DEFAULT_PRE_CALL_CHECKLIST.length);
      expect(session.preCallChecklist.every((i) => !i.completed)).toBe(true);
      expect(session.liveTracker.currentStage).toBe('INTRO');
    });

    it('zmienia etap rozmowy i ustawia status IN_PROGRESS', () => {
      const session = createInterviewSession('Acme Corp', 'DevOps Lead');
      const advanced = advanceInterviewStage(session, 'TECHNICAL');

      expect(advanced.status).toBe('IN_PROGRESS');
      expect(advanced.liveTracker.currentStage).toBe('TECHNICAL');
      expect(advanced.liveTracker.startedAt).toBeDefined();
    });

    it('rejestruje notatki na żywo z sentymentem i etapem', () => {
      const session = createInterviewSession('Acme Corp', 'DevOps Lead');
      const withNote = addLiveNote(session, 'Rekruter pytał o architekturę DR na AWS', 'POSITIVE');

      expect(withNote.liveTracker.notes.length).toBe(1);
      expect(withNote.liveTracker.notes[0].text).toBe('Rekruter pytał o architekturę DR na AWS');
      expect(withNote.liveTracker.notes[0].sentiment).toBe('POSITIVE');
      expect(withNote.liveTracker.notes[0].stage).toBe('INTRO');
    });
  });

  describe('Generator Maila Follow-Up', () => {
    it('generuje spersonalizowany mail z podziękowaniem i podsumowaniem dyskusji', () => {
      const session = createInterviewSession('Cloud Dynamics', 'Full Stack Developer');
      const email = generateFollowUpEmail(session, 'Jan Kowalski', {
        whatWentWell: 'wdrożenie mikroserwisów i optymalizacja bazy danych',
      });

      expect(email).toContain('Full Stack Developer');
      expect(email).toContain('wdrożenie mikroserwisów i optymalizacja bazy danych');
      expect(email).toContain('Jan Kowalski');
    });
  });

  describe('Trwałość w pamięci lokalnej (StorageKeys.interviewLoops)', () => {
    it('zapisuje, odczytuje i usuwa sesje z localStorage', () => {
      const session1 = createInterviewSession('Firma A', 'Rola A');
      const session2 = createInterviewSession('Firma B', 'Rola B');

      saveInterviewSession('profile-a', session1);
      saveInterviewSession('profile-a', session2);

      const loaded = loadInterviewSessions('profile-a');
      expect(loaded.length).toBe(2);
      expect(loaded.some((s) => s.id === session1.id)).toBe(true);

      deleteInterviewSession('profile-a', session1.id);
      const afterDelete = loadInterviewSessions('profile-a');
      expect(afterDelete.length).toBe(1);
      expect(afterDelete[0].id).toBe(session2.id);
    });

    it('nie ujawnia rozmów innego profilu i usuwa tylko własne', () => {
      const session = createInterviewSession('Tajna firma', 'Rola');
      saveInterviewSession('profile-a', session);
      expect(loadInterviewSessions('profile-b')).toEqual([]);
      deleteInterviewSession('profile-b', session.id);
      expect(loadInterviewSessions('profile-a')).toEqual([session]);
    });
  });
});
