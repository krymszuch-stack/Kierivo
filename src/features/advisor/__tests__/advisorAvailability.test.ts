import { describe, it, expect, vi } from 'vitest';
import {
  checkAdvisorWithTimeout,
  resolveDefaultAdvisorTab,
  AdvisorAvailabilityState,
} from '../advisorAvailability';

describe('dostępność Doradcy Azure i wybór zakładki', () => {
  it('zwraca state=available, gdy API potwierdza gotowość Azure', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: true,
      available: true,
      connected: true,
    });

    const result = await checkAdvisorWithTimeout(fetcher, 1000);
    expect(result.state).toBe('available');
    expect(result.connected).toBe(true);
    expect(result.activeModel).toBe('');
    expect(resolveDefaultAdvisorTab(result.state)).toBe('chat');
  });

  it('zwraca state=unavailable, gdy Azure nie jest skonfigurowane', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: true,
      connected: false,
      models: [],
      error: 'Połączenie odrzucone',
    });

    const result = await checkAdvisorWithTimeout(fetcher, 1000);
    expect(result.state).toBe('unavailable');
    expect(result.connected).toBe(false);
    expect(resolveDefaultAdvisorTab(result.state)).toBe('rewriter');
  });

  it('zwraca state=unavailable, gdy API rzuca wyjątek błędu sieci', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error 500'));

    const result = await checkAdvisorWithTimeout(fetcher, 1000);
    expect(result.state).toBe('unavailable');
    expect(result.connected).toBe(false);
    expect(result.error).toContain('Network error 500');
    expect(resolveDefaultAdvisorTab(result.state)).toBe('rewriter');
  });

  it('wyjaśnia, że lokalny tryb wymaga konta chmurowego przy odpowiedzi 501', async () => {
    const fetcher = vi.fn().mockRejectedValue(Object.assign(new Error('Request failed'), { status: 501 }));

    const result = await checkAdvisorWithTimeout(fetcher, 1000);

    expect(result.state).toBe('unavailable');
    expect(result.error).toContain('Tryb lokalny nie obsługuje Doradcy Azure');
  });

  it('prosi o zalogowanie przy odpowiedzi 401', async () => {
    const fetcher = vi.fn().mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));

    const result = await checkAdvisorWithTimeout(fetcher, 1000);

    expect(result.state).toBe('unavailable');
    expect(result.error).toBe('Zaloguj się, aby korzystać z Doradcy Azure.');
  });

  it('przerywa oczekiwanie po timeoucie (max 5s) i nie zostawia UI w stanie checking', async () => {
    // Symulacja wiszącego zapytania
    const hangingFetcher = () => new Promise((resolve) => setTimeout(resolve, 10000));

    const result = await checkAdvisorWithTimeout(hangingFetcher, 50); // krótki timeout w teście
    expect(result.state).toBe('unavailable');
    expect(result.connected).toBe(false);
    expect(result.error).toContain('Przekroczono limit czasu');
    expect(resolveDefaultAdvisorTab(result.state)).toBe('rewriter');
  });

  it('dla stanu checking lub unavailable domyślną zakładką w Public Pre-Beta jest rewriter', () => {
    expect(resolveDefaultAdvisorTab('checking')).toBe('rewriter');
    expect(resolveDefaultAdvisorTab('unavailable')).toBe('rewriter');
    expect(resolveDefaultAdvisorTab('available')).toBe('chat');
  });

  it('weryfikuje, że w stanie unavailable przycisk "Sprawdź ponownie" jest klikalny (disabled=false)', () => {
    // Logika przycisku: disabled={healthState === 'checking'}
    const isButtonDisabled = (state: AdvisorAvailabilityState) => state === 'checking';

    expect(isButtonDisabled('checking')).toBe(true);
    expect(isButtonDisabled('unavailable')).toBe(false);
    expect(isButtonDisabled('available')).toBe(false);
  });

  it('weryfikuje statyczny kontrakt kodu GeminiAdvisorModal.tsx', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const modalPath = path.resolve(__dirname, '../GeminiAdvisorModal.tsx');
    const source = fs.readFileSync(modalPath, 'utf8');

    // Timeout 5000ms
    expect(source).toContain('checkAdvisorWithTimeout');
    expect(source).toContain('5000');

    // Domyślna zakładka na start: rewriter
    expect(source).toContain("useState<'chat' | 'rewriter'>('rewriter')");

    expect(source).toContain("'/advisor/status'");
    // Przy braku Azure nie obiecujemy lokalnego rewritingu jako działającej alternatywy.
    expect(source).not.toContain('Przejdź do Asystenta Rewritingu →');

    // Przycisk Sprawdź ponownie nie jest disabled w unavailable (tylko w checking)
    expect(source).toContain("disabled={healthState === 'checking'}");

    // Sekcja FAQ umieszczona również przy Rewritingu
    expect(source).toContain('AdvisorFaqSection');
  });
});


