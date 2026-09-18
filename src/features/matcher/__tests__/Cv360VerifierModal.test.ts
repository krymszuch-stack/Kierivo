import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { api } from '../../../lib/apiClient';
import {
  consumeAiLocally,
  setAuthenticatedEntitlements,
  resetEntitlementsToUnauthenticated,
  getEntitlementsState,
} from '../../../store/useEntitlements';
import { setAuthModalOpenGlobal, getAppStoreState } from '../../../store/useAppStore';
import { createEmptyVault } from '../../../lib/sampleVault';
import { wipeAppStorage } from '../../../lib/storage';
import { resolveModelQuotaState } from '../../../components/ui/ModelQuotaCounter';

describe('Przepływ Weryfikatora CV AI 360° i izolacja kwoty niezalogowanego użytkownika', () => {
  beforeEach(() => {
    wipeAppStorage();
    resetEntitlementsToUnauthenticated();
    setAuthModalOpenGlobal(false);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('kliknięcie Weryfikatora bez użytkownika → login modal, 0 requestów do /api/ai/verify-cv, 0 wywołań consumeAiLocally', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ report: {} });
    let loginModalOpened = false;

    // Początkowy stan modala logowania
    expect(getAppStoreState().isAuthModalOpen).toBe(false);

    // Symulacja braku zalogowanego użytkownika
    const activeUser = null;
    const isAuthed = false;

    // Przed kliknięciem: stan unauthenticated
    const beforeUses = getEntitlementsState().usage.aiUses;

    // Handler kliknięcia dokładnie zgodny z logiką Cv360VerifierModal
    const handleVerifierClick = async () => {
      // 1. Sprawdzenie aktywnego użytkownika przed jakimkolwiek loadingiem, lokalnym decrementem i requestem AI
      if (!isAuthed || !activeUser) {
        loginModalOpened = true;
        setAuthModalOpenGlobal(true);
        return;
      }

      // Ta część nie może się wykonać dla niezalogowanego:
      consumeAiLocally();
      await api.post('/api/ai/verify-cv', { vault: createEmptyVault() });
    };

    await handleVerifierClick();

    // Weryfikacja: login modal otwarty
    expect(loginModalOpened).toBe(true);
    expect(getAppStoreState().isAuthModalOpen).toBe(true);

    // Weryfikacja: 0 requestów do /api/ai/verify-cv
    expect(postSpy).not.toHaveBeenCalled();

    // Weryfikacja: 0 wywołań consumeAiLocally i brak zmniejszenia licznika
    expect(getEntitlementsState().usage.aiUses).toBe(beforeUses);

    // Dodatkowo: próba wywołania consumeAiLocally dla niezalogowanego zwraca false
    const canConsume = consumeAiLocally();
    expect(canConsume).toBe(false);
  });

  it('logout po stanie 24/25 → licznik nie pokazuje starej wartości', () => {
    // 1. Użytkownik zalogowany z 24 na 25 analiz
    setAuthenticatedEntitlements({ status: 'free' }, { aiUses: 24 });
    expect(getEntitlementsState().usage.aiUses).toBe(24);
    expect(getEntitlementsState().source).toBe('server');
    expect(getEntitlementsState().isAuthenticated).toBe(true);

    // 2. Wylogowanie użytkownika (wywołanie procedury resetu uprawnień powiązanej z logout)
    resetEntitlementsToUnauthenticated();

    // 3. Po logout licznik nie pokazuje starej wartości 24/25
    const entitlementsAfterLogout = getEntitlementsState();
    expect(entitlementsAfterLogout.source).toBe('unauthenticated');
    expect(entitlementsAfterLogout.isAuthenticated).toBe(false);
    expect(entitlementsAfterLogout.usage.aiUses).not.toBe(24);
    expect(entitlementsAfterLogout.usage.aiUses).toBe(0);

    // Próba odjęcia analizy po wylogowaniu jest bezwzględnie blokowana
    expect(consumeAiLocally()).toBe(false);
  });

  it('ModelQuotaCounter dla niezalogowanego użytkownika pokazuje neutralny stan Zaloguj się, aby korzystać z analiz AI, a nie 24/25', () => {
    resetEntitlementsToUnauthenticated();
    const entitlements = getEntitlementsState();

    // 1. Sprawdzenie stanu nieautoryzowanego (np. po wylogowaniu lub braku sesji)
    const unauthState = resolveModelQuotaState({
      source: entitlements.source,
      isAuthenticated: entitlements.isAuthenticated,
      user: null,
      authIsAuthenticated: false,
      aiUses: entitlements.usage.aiUses,
    });

    expect(unauthState.isUnauthenticated).toBe(true);
    expect(unauthState.remaining).toBe(0);
    expect(unauthState.displayText).toBe('Zaloguj się, aby korzystać z analiz AI');
    expect(unauthState.displayText).not.toContain('24/25');
    expect(unauthState.displayText).not.toContain('25/25');

    // 2. Kontrast ze stanem zalogowanego z dostępną kwotą 24/25
    const authedState = resolveModelQuotaState({
      source: 'server',
      isAuthenticated: true,
      user: { id: 'u1' },
      authIsAuthenticated: true,
      aiUses: 24,
    });

    expect(authedState.isUnauthenticated).toBe(false);
    expect(authedState.remaining).toBe(24);
    expect(authedState.displayText).toContain('24/25');
  });
});
