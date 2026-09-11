/**
 * KROK 3 — produkty.
 *
 * Produkty powstają **na platformie**, nie na koncie połączonym. To jest
 * świadoma konsekwencja modelu z zadania: platforma odpowiada za ceny i pobiera
 * prowizję, więc katalog należy do niej. Gdyby produkt powstał na koncie
 * sprzedawcy (nagłówek `Stripe-Account`), platforma nie mogłaby ustalać ceny
 * ani zbudować z tych produktów jednego sklepu.
 *
 * Trasy:
 *   GET  /products   formularz i lista produktów
 *   POST /products   utworzenie produktu z ceną domyślną
 */

import { Request, Response, Router } from 'express';
import type Stripe from 'stripe';
import { wczytajKonfiguracje } from '../config';
import { stripe } from '../stripeClient';
import { wszyscySprzedawcy } from '../store';
import { esc, formatujKwote, komunikatZAdresu, strona } from '../layout';

export const productsRouter = Router();

/**
 * Klucz metadanych łączący produkt ze sprzedawcą.
 *
 * Jedna stała zamiast wpisywania napisu w trzech miejscach — literówka
 * w jednym z nich dałaby produkt, którego sklep nie umie przypisać do nikogo,
 * i błąd widoczny dopiero przy próbie zapłaty (reguła 3 z AGENTS.md).
 */
export const KLUCZ_KONTA = 'connected_account_id';

/**
 * Pobiera produkty platformy razem z ceną domyślną.
 *
 * `expand: ['data.default_price']` oszczędza osobne zapytanie o każdą cenę.
 * Bez tego `default_price` jest samym identyfikatorem i nie da się pokazać kwoty.
 */
export async function pobierzProdukty(): Promise<Stripe.Product[]> {
  const lista = await stripe().products.list({
    active: true,
    limit: 100,
    expand: ['data.default_price'],
  });

  // Interesują nas wyłącznie produkty tej próbki. Konto Stripe może mieć
  // produkty z zupełnie innych integracji — bez tego filtra sklep pokazałby
  // cudzy katalog.
  return lista.data.filter((produkt) => Boolean(produkt.metadata?.[KLUCZ_KONTA]));
}

/** Cena domyślna produktu, o ile jest rozwinięta i ma kwotę jednorazową. */
export function cenaProduktu(produkt: Stripe.Product): Stripe.Price | null {
  const cena = produkt.default_price;
  if (!cena || typeof cena === 'string') return null;
  if (typeof cena.unit_amount !== 'number') return null;
  return cena;
}

/** GET /products — formularz dodania produktu i lista tego, co już jest. */
productsRouter.get('/products', async (req: Request, res: Response) => {
  const konfiguracja = wczytajKonfiguracje();
  const sprzedawcy = wszyscySprzedawcy();

  let produkty: Stripe.Product[] = [];
  let bladListy: string | null = null;
  try {
    produkty = await pobierzProdukty();
  } catch (err) {
    bladListy = err instanceof Error ? err.message : 'Nie udało się pobrać produktów.';
  }

  const opcjeSprzedawcow = sprzedawcy
    .map(
      (s) =>
        `<option value="${esc(s.stripeAccountId)}">${esc(s.displayName)} — ${esc(s.stripeAccountId)}</option>`
    )
    .join('');

  const wierszeProduktow = produkty
    .map((produkt) => {
      const cena = cenaProduktu(produkt);
      const idKonta = produkt.metadata?.[KLUCZ_KONTA] ?? '';
      const sprzedawca = sprzedawcy.find((s) => s.stripeAccountId === idKonta);

      return `
        <tr>
          <td>
            <strong>${esc(produkt.name)}</strong>
            ${produkt.description ? `<div class="podpis">${esc(produkt.description)}</div>` : ''}
          </td>
          <td>${
            cena
              ? esc(formatujKwote(cena.unit_amount as number, cena.currency))
              : '<span class="znacznik czeka">brak ceny</span>'
          }</td>
          <td>
            ${sprzedawca ? esc(sprzedawca.displayName) : '<span class="znacznik czeka">nieznany sprzedawca</span>'}
            <div class="podpis"><code>${esc(idKonta)}</code></div>
          </td>
          <td><code>${esc(produkt.id)}</code></td>
        </tr>`;
    })
    .join('');

  res.send(
    strona({
      tytul: 'Produkty',
      aktywny: 'produkty',
      komunikat: komunikatZAdresu(req.query as Record<string, unknown>),
      tresc: `
        <h1>Produkty</h1>
        <p class="wstep">
          Produkty należą do platformy. Przypisanie do sprzedawcy trzymamy
          w metadanych produktu (<code>${esc(KLUCZ_KONTA)}</code>), więc źródłem prawdy
          jest Stripe — nie druga kopia w naszej bazie.
        </p>

        ${
          sprzedawcy.length === 0
            ? `<div class="komunikat blad">
                 Najpierw utwórz sprzedawcę — produkt musi mieć właściciela.
                 <a href="/">Przejdź do sprzedawców</a>.
               </div>`
            : `<section class="panel">
                 <h2 style="margin-top:0">Nowy produkt</h2>
                 <form method="post" action="/products">
                   <div class="pola">
                     <div>
                       <label for="name">Nazwa</label>
                       <input id="name" name="name" required maxlength="120">
                     </div>
                     <div>
                       <label for="amount">Cena brutto (${esc(konfiguracja.defaultCurrency.toUpperCase())})</label>
                       <input id="amount" name="amount" type="number" min="1" step="0.01" required
                              placeholder="49.00">
                     </div>
                     <div>
                       <label for="accountId">Sprzedawca</label>
                       <select id="accountId" name="accountId" required>${opcjeSprzedawcow}</select>
                     </div>
                     <div class="szerokie">
                       <label for="description">Opis (opcjonalny)</label>
                       <textarea id="description" name="description" rows="2" maxlength="500"></textarea>
                     </div>
                   </div>
                   <button type="submit">Utwórz produkt</button>
                 </form>
               </section>`
        }

        <h2>Katalog</h2>
        ${bladListy ? `<div class="komunikat blad">${esc(bladListy)}</div>` : ''}
        ${
          produkty.length === 0
            ? '<p class="pusty">Katalog jest pusty.</p>'
            : `<section class="panel" style="padding:0 6px">
                 <table>
                   <thead><tr><th>Produkt</th><th>Cena</th><th>Sprzedawca</th><th>ID</th></tr></thead>
                   <tbody>${wierszeProduktow}</tbody>
                 </table>
               </section>`
        }
      `,
    })
  );
});

/** POST /products — utworzenie produktu wraz z ceną domyślną. */
productsRouter.post('/products', async (req: Request, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const accountId = String(req.body?.accountId ?? '').trim();
  const surowaKwota = String(req.body?.amount ?? '').trim();

  const konfiguracja = wczytajKonfiguracje();

  // Kwotę przeliczamy na najmniejszą jednostkę waluty (grosze/centy) —
  // Stripe nie przyjmuje wartości ułamkowych. `Math.round` zamiast `Math.floor`,
  // bo 49.99 * 100 to w arytmetyce zmiennoprzecinkowej 4998.999...
  const kwotaWMinorUnits = Math.round(Number(surowaKwota) * 100);

  if (!name || !accountId || !Number.isFinite(kwotaWMinorUnits) || kwotaWMinorUnits < 1) {
    res.redirect(
      303,
      '/products?blad=' + encodeURIComponent('Podaj nazwę, sprzedawcę i cenę większą od zera.')
    );
    return;
  }

  // Produkt można przypisać wyłącznie do sprzedawcy, którego znamy. Bez tego
  // sprawdzenia dowolny `accountId` z podmienionego formularza trafiłby do
  // metadanych, a przy zakupie — do `transfer_data.destination`.
  const znanySprzedawca = wszyscySprzedawcy().some((s) => s.stripeAccountId === accountId);
  if (!znanySprzedawca) {
    res.redirect(303, '/products?blad=' + encodeURIComponent('Nieznany sprzedawca.'));
    return;
  }

  try {
    await stripe().products.create({
      name,
      ...(description ? { description } : {}),

      // Cena domyślna powstaje razem z produktem — jedno wywołanie zamiast
      // `products.create` + `prices.create`, i produkt nigdy nie istnieje
      // w stanie „bez ceny".
      default_price_data: {
        unit_amount: kwotaWMinorUnits,
        currency: konfiguracja.defaultCurrency,
      },

      // Mapowanie produkt → konto połączone. Sklep czyta stąd, na które konto
      // ma trafić przelew przy zakupie.
      metadata: {
        [KLUCZ_KONTA]: accountId,
      },
    });

    res.redirect(303, '/products?sukces=' + encodeURIComponent(`Produkt „${name}" został utworzony.`));
  } catch (err) {
    console.error('[connect]', err);
    const tekst = err instanceof Error ? err.message : 'Nie udało się utworzyć produktu.';
    res.redirect(303, '/products?blad=' + encodeURIComponent(tekst));
  }
});
