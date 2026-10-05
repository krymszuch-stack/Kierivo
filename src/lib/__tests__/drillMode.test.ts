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
import { profileDataKeyFor, readJson, resetLastGoodCache, StorageKeys, writeJson } from '../storage';
import { detectDrillMetrics } from '../drillMetricDetection';

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

    it('nie zwraca undefined, gdy pula ma wyłącznie powtórzone ID', () => {
      const first = { ...DEFAULT_DRILL_QUESTIONS[0], id: 'duplicate-id' };
      const second = { ...first, question: 'Drugie pytanie z tym samym ID' };
      const pool = [first, second];

      expect(pool).toContain(getRandomDrillQuestion(pool, first.id));
    });
  });

  describe('Analiza wskaźników tekstowych STAR', () => {
    it('wykrywa sygnały STAR i liczby bez oceny faktycznego wkładu', () => {
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

      // 3. Liczymy wzmianki językowe, nie wyciągamy z nich oceny wkładu.
      expect(scorecard.ownership.iCount).toBeGreaterThanOrEqual(2);
      expect(scorecard.ownership.weCount).toBe(0);

      // 4. Heurystyka nie udaje skalibrowanej oceny całościowej.
      expect(scorecard.overallScore).toBeNull();
    });

    it('wykrywa brak metryk liczbowych i dodaje odpowiednią sugestię', () => {
      const transcript = `
        Kiedy wystąpiła awaria, moim zadaniem było szybkie usunięcie usterki.
        Zastosowałem procedury bezpieczeństwa i naprawiłem uszkodzoną pompę.
        Efektem było przywrócenie pracy bez opóźnień.
      `;

      const scorecard = analyzeDrillResponse(transcript);

      expect(scorecard.metrics.hasMetrics).toBe(false);
      expect(scorecard.suggestions.some((s) => s.includes('potwierdzoną miarę'))).toBe(true);
    });

    it('nie przyznaje punktu S za samą długość odpowiedzi', () => {
      const scorecard = analyzeDrillResponse('Pracowałem nad zadaniem i wdrożyłem poprawkę dla zespołu.');

      expect(scorecard.structure.hasSituation).toBe(false);
      expect(scorecard.structure.detectedElementsCount).toBe(2);
      expect(scorecard.structure.scorePercent).toBe(50);
    });

    it('nie wylicza wyniku całościowego ani sygnałów dla pustej odpowiedzi', () => {
      const scorecard = analyzeDrillResponse('   ');

      expect(scorecard.overallScore).toBeNull();
      expect(scorecard.ownership).toEqual({ iCount: 0, weCount: 0 });
      expect(scorecard.structure.scorePercent).toBeNull();
    });

    it('nie fabrykuje wzmianek o pierwszej osobie, gdy ich nie ma', () => {
      const scorecard = analyzeDrillResponse('Opisuję codzienną pracę nad obsługą systemów i rozwiązywanie zgłoszeń użytkowników.');

      expect(scorecard.ownership).toEqual({ iCount: 0, weCount: 0 });
      expect(scorecard.overallScore).toBeNull();
    });

    it('nie zamienia roku ani gołej liczby w wykrytą metrykę', () => {
      expect(detectDrillMetrics('W 2020 opisałem 3 wersje formularza.')).toEqual([]);
    });

    it('wykrywa liczbę opisaną jako wolumen pracy', () => {
      expect(detectDrillMetrics('Wdrożyłem automatyzację i obsłużyłem 25 zgłoszeń.')).toContain('25 zgłoszeń');
    });

    it('sugeruje doprecyzowanie własnej roli warunkowo przy większej liczbie form grupowych', () => {
      const transcript = `
        W zespole stanęliśmy przed wyzwaniem. Zrobiliśmy wspólnie refaktoring i wdrożyliśmy nowy moduł.
        Firma osiągnęła dobre wyniki.
      `;

      const scorecard = analyzeDrillResponse(transcript);

      expect(scorecard.ownership.weCount).toBeGreaterThan(scorecard.ownership.iCount);
      expect(scorecard.suggestions.some((s) => s.includes('Jeśli pytanie dotyczy Twojego wkładu'))).toBe(true);
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

    it('ukrywa uszkodzone wpisy i zachowuje je przy zapisie poprawnej próby', () => {
      const key = profileDataKeyFor(StorageKeys.drillHistory, 'profile-a');
      const existing: DrillAttemptRecord = {
        id: 'existing-attempt', questionId: 'q-old', questionText: 'Poprzednie pytanie',
        transcript: 'Poprawny zapis', durationSec: 12,
        scorecard: analyzeDrillResponse('Poprawny zapis'), recordedAt: new Date().toISOString(),
      };
      const malformedNested = { id: 'bad-scorecard', questionId: 'q', questionText: 'Uszkodzone', transcript: '', durationSec: 2, scorecard: null, recordedAt: new Date().toISOString() };
      writeJson(key, [existing, null, malformedNested]);

      expect(loadDrillHistory('profile-a')).toEqual([existing]);

      const next: DrillAttemptRecord = {
        id: 'new-attempt', questionId: 'q-new', questionText: 'Nowe pytanie',
        transcript: 'Nowa odpowiedź', durationSec: 8,
        scorecard: analyzeDrillResponse('Nowa odpowiedź'), recordedAt: new Date().toISOString(),
      };
      saveDrillAttempt('profile-a', next);

      expect(loadDrillHistory('profile-a').map(({ id }) => id)).toEqual(['new-attempt', 'existing-attempt']);
      expect(readJson<unknown>(key, [])).toEqual([next, existing, null, malformedNested]);
    });

    it('zachowuje niepoprawny korzeń danych do czasu jawnego czyszczenia historii', () => {
      const key = profileDataKeyFor(StorageKeys.drillHistory, 'profile-a');
      writeJson(key, { unexpected: 'root' });

      expect(loadDrillHistory('profile-a')).toEqual([]);
      const next: DrillAttemptRecord = {
        id: 'new-attempt', questionId: 'q-new', questionText: 'Nowe pytanie',
        transcript: 'Odpowiedź', durationSec: 8,
        scorecard: analyzeDrillResponse('Odpowiedź'), recordedAt: new Date().toISOString(),
      };
      saveDrillAttempt('profile-a', next);

      expect(readJson<unknown>(key, [])).toEqual([next, { unexpected: 'root' }]);
      clearDrillHistory('profile-a');
      expect(readJson<unknown>(key, [])).toEqual([]);
    });
  });
});
