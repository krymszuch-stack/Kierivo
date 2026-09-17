/**
 * Punkt wejścia próbki Stripe Connect.
 *
 * Uruchomienie:
 *   cd samples/stripe-connect
 *   npm install
 *   cp .env.example .env      # i uzupełnij STRIPE_SECRET_KEY
 *   npm run dev
 *
 * Kolejność montowania middleware ma tu znaczenie i jest opisana niżej.
 */

import express from 'express';
import { BladKonfiguracji, wczytajKonfiguracje } from './config';
import { accountsRouter } from './routes/accounts.routes';
import { productsRouter } from './routes/products.routes';
import { storefrontRouter } from './routes/storefront.routes';
import { webhooksRouter } from './routes/webhooks.routes';
import { strona } from './layout';

const app = express();

// ─────────────────────────────────────────────────────────────────────────────
// 1. WEBHOOK — MUSI BYĆ PRZED `express.json()`
// ─────────────────────────────────────────────────────────────────────────────
// Podpis zdarzenia liczy się z surowych bajtów ciała żądania. Gdyby najpierw
// zadziałał globalny parser JSON, do weryfikacji trafiłby obiekt ponownie
// zserializowany — z inną kolejnością pól i innymi białymi znakami — i podpis
// nigdy by się nie zgodził. Ten sam układ ma produkcyjny `server.ts` aplikacji.
app.use(express.raw({ type: 'application/json' }), webhooksRouter);

// ─────────────────────────────────────────────────────────────────────────────
// 2. FORMULARZE
// ─────────────────────────────────────────────────────────────────────────────
// Cały interfejs próbki to zwykłe formularze HTML, więc wystarczy parser
// `application/x-www-form-urlencoded`. `express.json()` jest tu niepotrzebny:
// jedyne żądanie JSON-owe przychodzi na webhooka, a ten czyta surowe bajty.
app.use(express.urlencoded({ extended: false }));

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRASY INTERFEJSU
// ─────────────────────────────────────────────────────────────────────────────
app.use(accountsRouter); //   /                     — sprzedawcy i onboarding
app.use(productsRouter); //   /products             — katalog platformy
app.use(storefrontRouter); // /storefront, /success — sklep i płatność

// ─────────────────────────────────────────────────────────────────────────────
// 4. OBSŁUGA BŁĘDÓW
// ─────────────────────────────────────────────────────────────────────────────
// Błąd konfiguracji ma inny status i inną treść niż awaria: mówi wprost, której
// zmiennej brakuje i skąd ją wziąć. Bez tego rozróżnienia brak klucza wygląda
// w przeglądarce jak awaria serwera.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof BladKonfiguracji) {
    console.error(`\n[konfiguracja] ${err.message}\n`);
    res.status(500).send(
      strona({
        tytul: 'Brak konfiguracji',
        tresc: `
          <h1>Próbka nie jest skonfigurowana</h1>
          <div class="komunikat blad"><pre style="margin:0;white-space:pre-wrap">${err.message
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')}</pre></div>
          <p class="wstep">
            Uzupełnij plik <code>samples/stripe-connect/.env</code> według wzoru
            z <code>.env.example</code> i uruchom serwer ponownie.
          </p>`,
      })
    );
    return;
  }

  console.error('[serwer]', err);
  res.status(500).send(
    strona({
      tytul: 'Błąd serwera',
      tresc: '<h1>Coś poszło nie tak</h1><p class="wstep">Szczegóły są w logu serwera.</p>',
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. START
// ─────────────────────────────────────────────────────────────────────────────
// Konfigurację czytamy **przed** nasłuchem, żeby brak klucza zatrzymał start
// z czytelnym komunikatem, zamiast czekać na pierwsze żądanie.
try {
  const konfiguracja = wczytajKonfiguracje();

  app.listen(konfiguracja.port, () => {
    console.info(`\n  Próbka Stripe Connect działa: ${konfiguracja.baseUrl}`);
    console.info(`  Prowizja platformy: ${konfiguracja.platformFeePercent}%`);
    console.info(
      `  Webhooki: ${konfiguracja.stripeWebhookSecret ? 'włączone' : 'wyłączone (brak STRIPE_WEBHOOK_SECRET)'}\n`
    );
  });
} catch (err) {
  if (err instanceof BladKonfiguracji) {
    console.error(`\n[konfiguracja] ${err.message}\n`);
    process.exit(1);
  }
  throw err;
}
