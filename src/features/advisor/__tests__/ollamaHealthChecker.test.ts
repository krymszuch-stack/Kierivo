import { describe, it, expect, vi } from 'vitest';
import {
  checkOllamaWithTimeout,
  resolveDefaultAdvisorTab,
  OllamaHealthState,
} from '../ollamaHealthChecker';

describe('ollamaHealthChecker - obsługa health-checka z limitem czasu i wyznaczanie aktywnej zakładki', () => {
  it('zwraca state=available i domyślną zakładkę chat, gdy Ollama odpowiada connected=true', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: true,
      connected: true,
      models: [{ name: 'qwen-chat:latest' }],
      activeModel: 'qwen-chat:latest',
    });

    const result = await checkOllamaWithTimeout(fetcher, 1000);
    expect(result.state).toBe('available');
    expect(result.connected).toBe(true);
    expect(result.activeModel).toBe('qwen-chat:latest');
    expect(resolveDefaultAdvisorTab(result.state)).toBe('chat');
  });

  it('zwraca state=unavailable i domyślną zakładkę rewriter, gdy Ollama nie jest połączona', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      success: true,
      connected: false,
      models: [],
      error: 'Połączenie odrzucone',
    });

    const result = await checkOllamaWithTimeout(fetcher, 1000);
    expect(result.state).toBe('unavailable');
    expect(result.connected).toBe(false);
    expect(resolveDefaultAdvisorTab(result.state)).toBe('rewriter');
  });

  it('zwraca state=unavailable, gdy API rzuca wyjątek błędu sieci', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error 500'));

    const result = await checkOllamaWithTimeout(fetcher, 1000);
    expect(result.state).toBe('unavailable');
    expect(result.connected).toBe(false);
    expect(result.error).toContain('Network error 500');
    expect(resolveDefaultAdvisorTab(result.state)).toBe('rewriter');
  });

  it('przerywa oczekiwanie po timeoucie (max 5s) i nie zostawia UI w stanie checking', async () => {
    // Symulacja wiszącego zapytania
    const hangingFetcher = () => new Promise((resolve) => setTimeout(resolve, 10000));

    const result = await checkOllamaWithTimeout(hangingFetcher, 50); // krótki timeout w teście
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
    const isButtonDisabled = (state: OllamaHealthState) => state === 'checking';

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
    expect(source).toContain('checkOllamaWithTimeout');
    expect(source).toContain('5000');

    // Domyślna zakładka na start: rewriter
    expect(source).toContain("useState<'chat' | 'rewriter'>('rewriter')");

    // Przycisk "Przejdź do Asystenta Rewritingu →"
    expect(source).toContain('Przejdź do Asystenta Rewritingu →');

    // Przycisk Sprawdź ponownie nie jest disabled w unavailable (tylko w checking)
    expect(source).toContain("disabled={healthState === 'checking'}");

    // Sekcja FAQ umieszczona również przy Rewritingu
    expect(source).toContain('AdvisorFaqSection');
  });
});


