/**
 * KROK 4 — sklep i płatność.
 *
 * Płacimy modelem **destination charge**: pieniądze wpływają na konto
 * platformy, Stripe automatycznie przelewa je na konto sprzedawcy
 * (`transfer_data.destination`), a platforma zatrzymuje prowizję
 * (`application_fee_amount`). Dzięki temu to platforma jest stroną transakcji
 * dla klienta — spójnie z `losses_collector: application` ustawionym przy
 * zakładaniu konta.
 *
 * Trasy:
 *   GET  /storefront        katalog wszystkich sprzedawców
 *   POST /checkout          utworzenie sesji płatności i przekierowanie
 *   GET  /success           powrót po zapłacie
 */

import { Request, Response, Router } from 'express';
import { wczytajKonfiguracje } from '../config';
import { stripe } from '../stripeClient';
import { wszyscySprzedawcy, znajdzSprzedawce } from '../store';
import { esc, formatujKwote, komunikatZAdresu, strona } from '../layout';
import { cenaProduktu, pobierzProdukty, KLUCZ_KONTA } from './products.routes';

export const storefrontRouter = Router();

/** GET /storefront — wszystkie produkty wszystkich sprzedawców. */
storefrontRouter.get('/storefront', async (req: Request, res: Response) => {
  const konfiguracja = wczytajKonfiguracje();
  const sprzedawcy = wszyscySprzedawcy();

  let karty = '';
  let bladListy: string | null = null;

  try {
    const produkty = await pobierzProdukty();

    karty = produkty
      .map((produkt) => {
        const cena = cenaProduktu(produkt);
        if (!cena) return '';

        const idKonta = produkt.metadata?.[KLUCZ_KONTA] ?? '';
        const sprzedawca = sprzedawcy.find((s) => s.stripeAccountId === idKonta);
        const kwota = cena.unit_amount as number;
        const prowizja = Math.round((kwota * konfiguracja.platformFeePercent) / 100);

        return `
          <article class="karta">
            <h3>${esc(produkt.name)}</h3>
            ${produkt.description ? `<p class="podpis">${esc(produkt.description)}</p>` : ''}
            <div class="cena">${esc(formatujKwote(kwota, cena.currency))}</div>
            <div class="sprzedawca">
              Sprzedawca: ${sprzedawca ? esc(sprzedawca.displayName) : esc(idKonta)}
            </div>
            <div class="podpis">
              Prowizja platformy: ${esc(formatujKwote(prowizja, cena.currency))}
              (${esc(konfiguracja.platformFeePercent)}%)
            </div>
            <form method="post" action="/checkout">
              <input type="hidden" name="productId" value="${esc(produkt.id)}">
              <button type="submit">Kup</button>
            </form>
          </article>`;
      })
      .join('');
  } catch (err) {
    bladListy = err instanceof Error ? err.message : 'Nie udało się pobrać katalogu.';
  }

  res.send(
    strona({
      tytul: 'Sklep',
      aktywny: 'sklep',
      komunikat: komunikatZAdresu(req.query as Record<string, unknown>),
      tresc: `
        <h1>Sklep</h1>
        <p class="wstep">
          Jeden katalog, wielu sprzedawców. Przy zakupie powstaje płatność typu
          destination charge: prowizja zostaje na platformie, reszta trafia na konto
          sprzedawcy.
        </p>
        ${bladListy ? `<div class="komunikat blad">${esc(bladListy)}</div>` : ''}
        ${
          karty
            ? `<div class="karty">${karty}</div>`
            : '<p class="pusty">Brak produktów w sprzedaży. Dodaj je w zakładce „Produkty".</p>'
        }

        <h2>Sprzedawcy w tym sklepie</h2>
        ${
          sprzedawcy.length === 0
            ? '<p class="pusty">Żaden sprzedawca nie ma jeszcze konta.</p>'
            : `<section class="panel" style="padding:0 6px">
                 <table>
                   <thead><tr><th>Sprzedawca</th><th>Konto połączone</th></tr></thead>
                   <tbody>${sprzedawcy
                     .map(
                       (s) => `
                     <tr>
                       <td>${esc(s.displayName)}</td>
                       <td><code>${esc(s.stripeAccountId)}</code></td>
                     </tr>`
                     )
                     .join('')}</tbody>
                 </table>
               </section>
               <p class="podpis">
                 Konto na tej liście nie znaczy jeszcze „gotowe do sprzedaży" — status
                 onboardingu jest po stronie <a href="/">panelu sprzedawców</a>, bo tylko
                 tam pobieramy go z API.
               </p>`
        }
      `,
    })
  );
});

/**
 * POST /checkout — sesja Stripe Checkout dla jednego produktu.
 *
 * Kwota i konto docelowe pochodzą **wyłącznie** z API Stripe'a, a nie
 * z formularza. Z przeglądarki przychodzi sam identyfikator produktu — gdyby
 * przychodziła cena, wystarczyłoby podmienić ją w żądaniu i kupić za grosz.
 * To ten sam mechanizm, którym broni się produkcyjne `billing.routes.ts`
 * w CVelocity: klient wysyła klucz, cenę ustala serwer.
 */
storefrontRouter.post('/checkout', async (req: Request, res: Response) => {
  const productId = String(req.body?.productId ?? '').trim();

  if (!productId) {
    res.redirect(303, '/storefront?blad=' + encodeURIComponent('Nie wskazano produktu.'));
    return;
  }

  try {
    const konfiguracja = wczytajKonfiguracje();

    // 1. Produkt i jego cena — prosto ze Stripe'a.
    const produkt = await stripe().products.retrieve(productId, { expand: ['default_price'] });
    const cena = cenaProduktu(produkt);

    if (!cena) {
      res.redirect(303, '/storefront?blad=' + encodeURIComponent('Produkt nie ma ustalonej ceny.'));
      return;
    }

    // 2. Konto docelowe — z metadanych produktu.
    const idKonta = produkt.metadata?.[KLUCZ_KONTA];
    if (!idKonta) {
      res.redirect(
        303,
        '/storefront?blad=' + encodeURIComponent('Produkt nie jest przypisany do sprzedawcy.')
      );
      return;
    }

    // Sprzedawca musi być nam znany. Produkt z podmienionymi metadanymi
    // kierowałby przelew na dowolne konto.
    if (!znajdzSprzedawce(idKonta)) {
      res.redirect(303, '/storefront?blad=' + encodeURIComponent('Nieznany sprzedawca produktu.'));
      return;
    }

    const kwota = cena.unit_amount as number;

    // 3. Prowizja platformy. Zaokrąglamy w dół: przy `Math.ceil` prowizja od
    // najmniejszych kwot potrafi przekroczyć wartość płatności, co Stripe
    // odrzuca.
    const applicationFeeAmount = Math.floor((kwota * konfiguracja.platformFeePercent) / 100);

    const sesja = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: cena.currency,
            // Wskazanie istniejącego produktu platformy — nazwa i opis
            // w Checkoucie pochodzą wtedy z katalogu, bez drugiej kopii.
            product: produkt.id,
            unit_amount: kwota,
          },
          quantity: 1,
        },
      ],

      payment_intent_data: {
        // Prowizja zostaje na koncie platformy.
        application_fee_amount: applicationFeeAmount,
        // Reszta jedzie na konto sprzedawcy. To wymaga aktywnego uprawnienia
        // `stripe_transfers` — konto bez ukończonego onboardingu odrzuci
        // płatność i tu właśnie zobaczysz tego skutek.
        transfer_data: {
          destination: idKonta,
        },
      },

      // `{CHECKOUT_SESSION_ID}` podstawia Stripe przy przekierowaniu.
      // Nawiasy klamrowe są tu celowo — to nie jest szablon JavaScriptu.
      success_url: `${konfiguracja.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${konfiguracja.baseUrl}/storefront?blad=${encodeURIComponent('Płatność anulowana.')}`,
    });

    if (!sesja.url) {
      res.redirect(303, '/storefront?blad=' + encodeURIComponent('Stripe nie zwrócił adresu płatności.'));
      return;
    }

    res.redirect(303, sesja.url);
  } catch (err) {
    console.error('[connect]', err);
    const tekst = err instanceof Error ? err.message : 'Nie udało się rozpocząć płatności.';
    res.redirect(303, '/storefront?blad=' + encodeURIComponent(tekst));
  }
});

/**
 * GET /success — powrót po zapłacie.
 *
 * Ta strona **potwierdza** płatność, ale jej nie **rozstrzyga**. Adres
 * z `?session_id=` da się wpisać ręcznie, więc stan sesji czytamy z API,
 * a w prawdziwej aplikacji dostęp nadaje dopiero webhook
 * (`checkout.session.completed`) — dokładnie tak, jak opisuje to komentarz
 * w `src/server/routes/stripe.routes.ts`.
 */
storefrontRouter.get('/success', async (req: Request, res: Response) => {
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : '';

  if (!sessionId) {
    res.redirect(303, '/storefront');
    return;
  }

  try {
    const sesja = await stripe().checkout.sessions.retrieve(sessionId);
    const zaplacone = sesja.payment_status === 'paid';

    res.send(
      strona({
        tytul: zaplacone ? 'Dziękujemy' : 'Płatność w toku',
        aktywny: 'sklep',
        tresc: `
          <h1>${zaplacone ? 'Płatność przyjęta' : 'Płatność jeszcze nie potwierdzona'}</h1>
          <section class="panel">
            <table>
              <tbody>
                <tr><th>Status</th><td>${esc(sesja.payment_status)}</td></tr>
                <tr><th>Kwota</th><td>${
                  typeof sesja.amount_total === 'number'
                    ? esc(formatujKwote(sesja.amount_total, sesja.currency ?? 'usd'))
                    : '—'
                }</td></tr>
                <tr><th>Sesja</th><td><code>${esc(sesja.id)}</code></td></tr>
              </tbody>
            </table>
          </section>
          <p class="podpis">
            Status pochodzi z <code>checkout.sessions.retrieve</code>. W aplikacji
            produkcyjnej to webhook, nie ta strona, nadaje dostęp do zakupu.
          </p>
          <a class="przycisk" href="/storefront">Wróć do sklepu</a>
        `,
      })
    );
  } catch (err) {
    console.error('[connect]', err);
    res.redirect(
      303,
      '/storefront?blad=' + encodeURIComponent('Nie udało się odczytać stanu płatności.')
    );
  }
});
