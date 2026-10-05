/**
 * Rejestr realnego zużycia modelu.
 *
 * Zarejestrowane tokeny pochodzą z `response.usageMetadata`. Nie agregujemy ich
 * w pamięci procesu: taki licznik miesza użytkowników i resetuje się po restarcie.
 * Trwałe zdarzenia zapisują `user_id` z uwierzytelnionej ścieżki i mogą być użyte
 * w odrębnej, chronionej analityce operacyjnej.
 *
 * Zapis idzie w dwa miejsca:
 *  - **ustrukturyzowana linia JSON na stdout** — Cloud Run Logging indeksuje ją
 *    automatycznie i da się po niej filtrować bez stawiania czegokolwiek;
 * Zdarzenie zapisuje się także do tabeli `ai_usage_events`, gdy backend jest
 * skonfigurowany. Nie łączymy danych różnych osób w nietrwały licznik procesu.
 *
 * Zapis do bazy jest świadomie **nieblokujący i niekrytyczny**: rozliczenie
 * zużycia nie może wywrócić żądania, które model już obsłużył. Utrata jednego
 * wiersza statystyk jest do przeżycia, utrata odpowiedzi opłaconej wywołaniem
 * modelu nie.
 */

export interface UsageEvent {
  /** Nazwa operacji, np. `parse-jd`. Nigdy treść promptu. */
  context: string;
  model: string;
  promptTokens: number;
  outputTokens: number;
  /** Właściciel wywołania, gdy jest znany. Brak = ruch nieuwierzytelniony. */
  userId?: string;
}

/**
 * Cennik w USD za milion tokenów. Zweryfikowany na cenniku Gemini API.
 * Modele spoza tabeli liczymy jako 0 i oznaczamy — lepiej pokazać brak danych
 * niż podstawić cenę innego modelu i zbudować na tym decyzję cenową.
 */
const PRICE_PER_MILLION_USD: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75 },
};

export function estimateCostUsd(model: string, promptTokens: number, outputTokens: number): number | null {
  const price = PRICE_PER_MILLION_USD[model];
  if (!price) return null;
  return (promptTokens * price.input + outputTokens * price.output) / 1_000_000;
}

/**
 * Odnotowuje jedno wywołanie modelu.
 *
 * Do logu trafiają wyłącznie liczby i nazwa operacji. Treść promptu to CV
 * użytkownika, a logi serwera nie są miejscem na dane osobowe.
 */
export function recordUsage(event: UsageEvent): void {
  const promptTokens = Number.isFinite(event.promptTokens) ? Math.max(0, event.promptTokens) : 0;
  const outputTokens = Number.isFinite(event.outputTokens) ? Math.max(0, event.outputTokens) : 0;
  const cost = estimateCostUsd(event.model, promptTokens, outputTokens);

  console.log(
    JSON.stringify({
      type: 'ai_usage',
      context: event.context,
      model: event.model,
      promptTokens,
      outputTokens,
      totalTokens: promptTokens + outputTokens,
      estimatedCostUsd: cost,
      at: new Date().toISOString(),
    })
  );

  void persistUsage(event, promptTokens, outputTokens, cost);
}

/**
 * Dopisuje wiersz do `ai_usage_events`.
 *
 * Importy są dynamiczne, żeby moduł rozliczeń nie wciągał klienta bazy w trybie
 * `BACKEND_MODE=local`, w którym żadnej bazy nie ma. Wszystkie błędy kończą się
 * ostrzeżeniem w logu i niczym więcej — patrz komentarz na górze pliku.
 */
async function persistUsage(
  event: UsageEvent,
  promptTokens: number,
  outputTokens: number,
  cost: number | null
): Promise<void> {
  try {
    const { loadConfig } = await import('./config');
    if (!loadConfig().backendEnabled) return;

    const { getSupabase } = await import('./supabase');
    const { error } = await getSupabase().from('ai_usage_events').insert({
      user_id: event.userId ?? null,
      context: event.context,
      model: event.model,
      prompt_tokens: promptTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: cost,
    });

    if (error) {
      console.warn('[usage] Nie udało się zapisać zużycia do bazy:', error.message);
    }
  } catch (err) {
    console.warn('[usage] Nie udało się zapisać zużycia do bazy:', err);
  }
}
