/**
 * KROK 5 — nasłuch zmian wymagań na kontach połączonych.
 *
 * Wymagania konta zmieniają się bez naszego udziału: regulatorzy, sieci
 * kartowe i banki dokładają warunki, a konto, które wczoraj przyjmowało
 * wypłaty, dziś może ich nie przyjmować. Bez tego nasłuchu dowiadujemy się
 * o tym dopiero z odrzuconej płatności.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ZDARZENIA „CIENKIE" (THIN EVENTS)
 * ─────────────────────────────────────────────────────────────────────────
 * API V2 wysyła zdarzenia cienkie: ładunek zawiera identyfikator zdarzenia,
 * jego typ i wskazanie obiektu (`related_object`) — **nie** zawiera samego
 * obiektu. Pełne dane pobiera się osobnym żądaniem. To jest różnica wobec
 * webhooków V1, gdzie `event.data.object` niosło całą treść.
 *
 * Konsekwencja praktyczna: pobrany obiekt jest **aktualny w chwili pobrania**,
 * a nie w chwili zdarzenia. Przy dwóch zmianach pod rząd zobaczysz stan po
 * drugiej z nich — i to jest zachowanie pożądane, bo interesuje nas stan
 * dzisiejszy, a nie historia.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NAZWA METODY SDK
 * ─────────────────────────────────────────────────────────────────────────
 * Dokumentacja i starsze przykłady pokazują `stripe.parseThinEvent(...)`.
 * W SDK, którego używa ta próbka (22.6.0), ta metoda **nie istnieje**:
 * została przemianowana na `parseEventNotification`, a interfejs
 * `Stripe.ThinEvent` usunięty (CHANGELOG pakietu, sekcja o zmianach łamiących:
 * „Rename function `StripeClient.parseThinEvent` to
 * `StripeClient.parseEventNotification`"). Zwracany obiekt jest teraz
 * unią typów po `type`, z gotowymi metodami `fetchEvent()`
 * i `fetchRelatedObject()`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LOKALNY NASŁUCH
 * ─────────────────────────────────────────────────────────────────────────
 *   stripe listen \
 *     --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.recipient].capability_status_updated' \
 *     --forward-thin-to localhost:4242/webhooks/stripe
 *
 * Konfiguracja docelowego odbiorcy w Dashboardzie jest opisana w README.
 */

import { Request, Response, Router } from 'express';
import type Stripe from 'stripe';
import { wczytajKonfiguracje } from '../config';
import { stripe } from '../stripeClient';
import { znajdzSprzedawce } from '../store';

export const webhooksRouter = Router();

/**
 * POST /webhooks/stripe
 *
 * Trasa jest zarejestrowana w `server.ts` z `express.raw` **przed** globalnym
 * `express.json`. To nie jest szczegół stylistyczny: podpis liczy się
 * z dokładnych bajtów ładunku, razem z kolejnością pól i białymi znakami.
 * Po sparsowaniu do obiektu i ponownej serializacji weryfikacja zawsze zawodzi.
 */
webhooksRouter.post('/webhooks/stripe', async (req: Request, res: Response) => {
  const konfiguracja = wczytajKonfiguracje();

  // Bez sekretu nie ma czym zweryfikować podpisu. Odpowiadamy 501 zamiast
  // przyjmować ładunek bez weryfikacji — trasa, która ufa każdemu żądaniu,
  // jest gorsza niż brak trasy (reguła 2 z AGENTS.md).
  if (!konfiguracja.stripeWebhookSecret) {
    res.status(501).json({
      error:
        'Brak STRIPE_WEBHOOK_SECRET. Uruchom `stripe listen` i wpisz wypisany sekret do .env.',
    });
    return;
  }

  const podpis = req.headers['stripe-signature'];
  if (typeof podpis !== 'string') {
    res.status(400).json({ error: 'Brak nagłówka stripe-signature.' });
    return;
  }

  let powiadomienie: Stripe.V2.Core.EventNotification;
  try {
    // Weryfikacja podpisu i parsowanie w jednym kroku. `req.body` jest tu
    // Bufferem dzięki `express.raw`.
    powiadomienie = stripe().parseEventNotification(
      req.body as Buffer,
      podpis,
      konfiguracja.stripeWebhookSecret
    );
  } catch (err) {
    // Zły podpis to odrzucone żądanie, nie awaria serwera. Logujemy skąpo —
    // ta trasa jest dostępna publicznie.
    console.warn('[webhook] Odrzucono zdarzenie z nieprawidłowym podpisem.');
    res.status(400).json({ error: 'Nieprawidłowy podpis.' });
    return;
  }

  try {
    await obsluzZdarzenie(powiadomienie);
  } catch (err) {
    // Zwracamy 500, żeby Stripe ponowił dostarczenie. Odpowiedź 200 przy
    // nieudanej obsłudze oznacza ciche zgubienie zdarzenia.
    console.error('[webhook] Błąd obsługi zdarzenia:', err);
    res.status(500).json({ error: 'Błąd obsługi zdarzenia.' });
    return;
  }

  // 200 dopiero po udanej obsłudze.
  res.json({ received: true });
});

/**
 * Rozdzielnik zdarzeń.
 *
 * `switch` po `powiadomienie.type` zawęża typ do konkretnego wariantu unii,
 * więc `related_object` i `fetchEvent()` są dostępne bez rzutowania.
 */
async function obsluzZdarzenie(powiadomienie: Stripe.V2.Core.EventNotification): Promise<void> {
  switch (powiadomienie.type) {
    // Zmieniły się wymagania konta — Stripe potrzebuje (albo przestał
    // potrzebować) dokumentów.
    case 'v2.core.account[requirements].updated':
      await odswiezStanKonta(powiadomienie.related_object.id, 'zmiana wymagań');
      break;

    // Zmienił się status uprawnienia w konfiguracji `recipient` — tu żyje
    // `stripe_balance.stripe_transfers`, od którego zależy, czy można wysłać
    // temu kontu pieniądze.
    case 'v2.core.account[configuration.recipient].capability_status_updated':
      await odswiezStanKonta(powiadomienie.related_object.id, 'zmiana statusu uprawnienia');
      break;

    default:
      // Nieobsługiwany typ nie jest błędem: docelowy odbiorca może dostawać
      // więcej zdarzeń, niż ta próbka rozpoznaje. Logujemy i potwierdzamy
      // odbiór, żeby Stripe nie ponawiał w nieskończoność.
      console.info(`[webhook] Zdarzenie bez obsługi: ${powiadomienie.type}`);
  }
}

/**
 * Pobiera aktualny stan konta i wypisuje go do logu.
 *
 * W próbce reakcją jest log, bo statusu nigdzie nie zapisujemy — interfejs
 * czyta go z API przy każdym odświeżeniu. W prawdziwej aplikacji to jest
 * miejsce na: powiadomienie sprzedawcy mailem, wstrzymanie jego oferty
 * w sklepie albo oznaczenie konta jako wymagającego uwagi.
 *
 * Pobieramy konto ponownie z `include`, zamiast użyć `fetchRelatedObject()`:
 * ta metoda zwraca konto bez rozwiniętych sekcji, więc `configuration`
 * i `requirements` byłyby puste, a kod uznałby każde konto za niegotowe.
 */
async function odswiezStanKonta(stripeAccountId: string, powod: string): Promise<void> {
  const konto = await stripe().v2.core.accounts.retrieve(stripeAccountId, {
    include: ['configuration.recipient', 'requirements'],
  });

  const transfery =
    konto.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ??
    'brak';
  const wymagania = konto.requirements?.summary?.minimum_deadline?.status ?? 'brak zaległości';

  // Nazwa sprzedawcy bierze się z naszego magazynu — Stripe nie zna naszych
  // użytkowników. Gdy konta nie ma w magazynie, zdarzenie dotyczy konta
  // spoza tej próbki i warto to widzieć w logu.
  const sprzedawca = znajdzSprzedawce(stripeAccountId);

  console.info(
    `[webhook] ${powod} — ${sprzedawca?.displayName ?? 'konto spoza próbki'} (${stripeAccountId}): ` +
      `wypłaty=${transfery}, wymagania=${wymagania}`
  );
}
