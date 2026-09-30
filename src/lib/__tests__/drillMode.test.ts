import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRandomDrillQuestion,
  analyzeDrillResponse,
  loadDrillHistory,
  saveDrillAttempt,
  clearDrillHistory,
  DEFAULT_DRILL_QUESTIONS,
  DrillAttemptRecord,
} from '../drillEngine';
import { MemoryStorage } from './helpers/memoryStorage';
import { resetLastGoodCache } from '../storage';

describe('DrillEngine (Tryb Mock Drill Mode - mock-drill-mode-v1)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
    resetLastGoodCache();
  });

  describe('Losowanie pytań rekrutacyjnych', () => {
    it('zwraca losowe pytanie z domyślnej puli', () => {
      const q = getRandomDrillQuestion();
      expect(q).toBeDefined();
      expect(q.question).toBeTruthy();
      expect(q.targetDurationSec).toBe(60);
    });

    it('wyklucza poprzednie ID pytania przy losowaniu kolejnego', () => {
      const first = DEFAULT_DRILL_QUESTIONS[0];
      const next = getRandomDrillQuestion(DEFAULT_DRILL_QUESTIONS, first.id);
      expect(next.id).not.toBe(first.id);
    });
  });

  describe('Analiza Scorecard (Struktura STAR, Metryki, Sprawczość Ja vs My)', () => {
    it('poprawnie ocenia pełną odpowiedź STAR z metrykami i wysoką sprawczością', () => {
      const transcript = `
        W firmie Cloud Corp zadaniem było zoptymalizowanie powolnych zapytań SQL.
        Zaprojektowałem i wdrożyłem indeksy oraz partycjonowanie w PostgreSQL.
        W rezultacie czas odpowiedzi bazy skrócił się o 65%, a przepustowość wzrosła do 2500 TPS.
      `;

      const scorecard = analyzeDrillResponse(transcript);

      // 1. Structure (STAR)
      expect(scorecard.structure.hasSituation).toBe(true);
      expect(scorecard.structure.hasTask).toBe(true);
      expect(scorecard.structure.hasAction).toBe(true);
      expect(scorecard.structure.hasResult).toBe(true);
      expect(scorecard.structure.scorePercent).toBe(100);

      // 2. Metrics
      expect(scorecard.metrics.hasMetrics).toBe(true);
      expect(scorecard.metrics.detectedMetrics.length).toBeGreaterThan(0);

      // 3. Ownership ("I" vs "We")
      expect(scorecard.ownership.iCount).toBeGreaterThanOrEqual(2);
      expect(scorecard.ownership.weCount).toBe(0);
      expect(scorecard.ownership.assessment).toBe('HIGH_OWNERSHIP');

      // 4. Overall Score
      expect(scorecard.overallScore).toBeGreaterThanOrEqual(90);
    });

    it('wykrywa brak metryk liczbowych i dodaje odpowiednią sugestię', () => {
      const transcript = `
        Kiedy wystąpiła awaria, moim zadaniem było szybkie usunięcie usterki.
        Zastosowałem procedury bezpieczeństwa i naprawiłem uszkodzoną pompę.
        Efektem było przywrócenie pracy bez opóźnień.
      `;

      const scorecard = analyzeDrillResponse(transcript);

      expect(scorecard.metrics.hasMetrics).toBe(false);
      expect(scorecard.suggestions.some((s) => s.includes('metryki liczbowe'))).toBe(true);
    });

    it('wykrywa rozmytą odpowiedzialność (dominacja formy My / Zespół)', () => {
      const transcript = `
        W zespole stanęliśmy przed wyzwaniem. Zrobiliśmy wspólnie refaktoring i wdrożyliśmy nowy moduł.
        Firma osiągnęła dobre wyniki.
      `;

      const scorecard = analyzeDrillResponse(transcript);

      expect(scorecard.ownership.weCount).toBeGreaterThan(scorecard.ownership.iCount);
      expect(scorecard.ownership.assessment).toBe('DIFFUSED_OWNERSHIP');
      expect(scorecard.suggestions.some((s) => s.includes('pierwszej osoby'))).toBe(true);
    });
  });

  describe('Historia sesji treningowych (StorageKeys.drillHistory)', () => {
    it('zapisuje i odczytuje próby drill z localStorage', () => {
      const dummyAttempt: DrillAttemptRecord = {
        id: 'drill_123',
        questionId: 'drill_1',
        questionText: 'Opowiedz o błędzie...',
        transcript: 'W firmie X wdrożyłem poprawkę...',
        durationSec: 45,
        scorecard: analyzeDrillResponse('W firmie X wdrożyłem poprawkę skracając czas o 30%'),
        recordedAt: new Date().toISOString(),
      };

      saveDrillAttempt('profile-a', dummyAttempt);
      const history = loadDrillHistory('profile-a');
      expect(history.length).toBe(1);
      expect(history[0].id).toBe('drill_123');

      clearDrillHistory('profile-a');
      expect(loadDrillHistory('profile-a').length).toBe(0);
    });

    it('nie ujawnia transkrypcji ćwiczeń innemu profilowi', () => {
      const attempt: DrillAttemptRecord = {
        id: 'private-attempt', questionId: 'q', questionText: 'Pytanie',
        transcript: 'Prywatna odpowiedź', durationSec: 10,
        scorecard: analyzeDrillResponse('Prywatna odpowiedź'), recordedAt: new Date().toISOString(),
      };
      saveDrillAttempt('profile-a', attempt);
      expect(loadDrillHistory('profile-b')).toEqual([]);
      clearDrillHistory('profile-b');
      expect(loadDrillHistory('profile-a')).toEqual([attempt]);
    });
  });
});
