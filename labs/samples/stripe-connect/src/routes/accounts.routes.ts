/**
 * KROK 1 i 2 — zakładanie kont połączonych i onboarding.
 *
 * Trasy:
 *   GET  /                      lista sprzedawców + status onboardingu na żywo
 *   POST /accounts              utworzenie konta połączonego (API V2)
 *   GET  /accounts/:id/onboard  wygenerowanie Account Link i przekierowanie
 */

import { Request, Response, Router } from 'express';
import { wczytajKonfiguracje } from '../config';
import { stripe } from '../stripeClient';
import { dodajSprzedawce, wszyscySprzedawcy, type Sprzedawca } from '../store';
import { esc, komunikatZAdresu, strona } from '../layout';

export const accountsRouter = Router();

/**
 * Status konta, policzony **wyłącznie** z odpowiedzi API.
 *
 * Świadomie nie ma tu pola „zapisany status": patrz komentarz otwierający
 * `store.ts`. Konto, które dziś przyjmuje wypłaty, jutro może mieć nowe
 * wymagania nałożone przez regulatora albo sieć kartową.
 */
interface StatusKonta {
  /** Czy konto może przyjmować przelewy od platformy. */
  readyToReceivePayments: boolean;
  /** Czy Stripe nie czeka na żadne dokumenty z terminem. */
  onboardingComplete: boolean;
  /** Surowy status wymagań — pokazujemy go, bo tłumaczy „dlaczego jeszcze nie". */
  requirementsStatus: string | null;
  /** Wypełnione, gdy odczyt statusu się nie powiódł. Nie udajemy wtedy „gotowe". */
  bladOdczytu: string | null;
}

/**
 * Pobiera status jednego konta.
 *
 * `include` jest obowiązkowe: bez niego API V2 nie zwraca ani konfiguracji,
 * ani wymagań, a kod czytałby `undefined` i uznał każde konto za niegotowe.
 */
async function pobierzStatus(stripeAccountId: string): Promise<StatusKonta> {
  try {
    const konto = await stripe().v2.core.accounts.retrieve(stripeAccountId, {
      include: ['configuration.recipient', 'requirements'],
    });

    // Uprawnienie `stripe_transfers` decyduje o tym, czy platforma może
    // przesłać temu kontu pieniądze z płatności. Dopóki nie jest `active`,
    // destination charge na to konto się nie powiedzie.
    const readyToReceivePayments =
      konto.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status ===
      'active';

    // `minimum_deadline.status` mówi, czy Stripe czeka na dokumenty i jak pilnie:
    // `currently_due` = do zebrania teraz, `past_due` = termin minął,
    // `eventually_due` = kiedyś, nie blokuje. Brak pola = nie ma nic w kolejce.
    const requirementsStatus = konto.requirements?.summary?.minimum_deadline?.status ?? null;
    const onboardingComplete =
      requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due';

    return { readyToReceivePayments, onboardingComplete, requirementsStatus, bladOdczytu: null };
  } catch (err) {
    // Nieudany odczyt to nie jest „konto niegotowe" — to jest brak wiedzy.
    // Rozróżnienie widać w interfejsie, żeby nikt nie wyciągnął wniosku
    // z awarii sieci.
    return {
      readyToReceivePayments: false,
      onboardingComplete: false,
      requirementsStatus: null,
      bladOdczytu: err instanceof Error ? err.message : 'Nieznany błąd odczytu konta.',
    };
  }
}

/** GET / — panel sprzedawcy: formularz rejestracji i lista kont ze statusem. */
accountsRouter.get('/', async (req: Request, res: Response) => {
  const sprzedawcy = wszyscySprzedawcy();

  // Statusy pobieramy równolegle. Szeregowo lista dziesięciu kont to dziesięć
  // kolejnych round-tripów do API i widocznie wolniejsza strona.
  const statusy = await Promise.all(sprzedawcy.map((s) => pobierzStatus(s.stripeAccountId)));

  const wiersze = sprzedawcy
    .map((sprzedawca, i) => wierszSprzedawcy(sprzedawca, statusy[i]))
    .join('');

  res.send(
    strona({
      tytul: 'Sprzedawcy',
      aktywny: 'sprzedawcy',
      komunikat: komunikatZAdresu(req.query as Record<string, unknown>),
      tresc: `
        <h1>Sprzedawcy</h1>
        <p class="wstep">
          Każdy sprzedawca to konto połączone w Stripie. Platforma odpowiada za ceny
          i pobiera prowizję, więc konta zakładamy z <code>fees_collector: application</code>
          i <code>losses_collector: application</code>.
        </p>

        <section class="panel">
          <h2 style="margin-top:0">Nowy sprzedawca</h2>
          <form method="post" action="/accounts">
            <div class="pola">
              <div>
                <label for="displayName">Nazwa wyświetlana</label>
                <input id="displayName" name="displayName" required maxlength="100"
                       placeholder="np. Pracownia Kowalski">
              </div>
              <div>
                <label for="contactEmail">E-mail kontaktowy</label>
                <input id="contactEmail" name="contactEmail" type="email" required
                       placeholder="kontakt@przyklad.pl">
              </div>
            </div>
            <button type="submit">Utwórz konto połączone</button>
          </form>
        </section>

        <h2>Konta i status onboardingu</h2>
        ${
          sprzedawcy.length === 0
            ? '<p class="pusty">Nie ma jeszcze żadnego sprzedawcy. Utwórz pierwszego powyżej.</p>'
            : `<section class="panel" style="padding:0 6px">
                 <table>
                   <thead>
                     <tr>
                       <th>Sprzedawca</th><th>Konto</th><th>Wypłaty</th>
                       <th>Wymagania</th><th></th>
                     </tr>
                   </thead>
                   <tbody>${wiersze}</tbody>
                 </table>
               </section>
               <p class="podpis">
                 Status pochodzi z <code>v2.core.accounts.retrieve</code> przy każdym
                 odświeżeniu strony — nigdy z lokalnego zapisu.
               </p>`
        }
      `,
    })
  );
});

/** Jeden wiersz tabeli kont. Wydzielone, żeby trasa wyżej dała się przeczytać. */
function wierszSprzedawcy(sprzedawca: Sprzedawca, status: StatusKonta): string {
  const znacznik = (ok: boolean, tekstOk: string, tekstNie: string) =>
    `<span class="znacznik ${ok ? 'gotowe' : 'czeka'}">${ok ? tekstOk : tekstNie}</span>`;

  const kolumnaWymagan = status.bladOdczytu
    ? `<span class="znacznik czeka">brak odczytu</span>
       <div class="podpis">${esc(status.bladOdczytu)}</div>`
    : `${znacznik(status.onboardingComplete, 'nic nie zalega', 'do uzupełnienia')}
       ${status.requirementsStatus ? `<div class="podpis">${esc(status.requirementsStatus)}</div>` : ''}`;

  // Przycisk prowadzi do onboardingu również wtedy, gdy konto jest gotowe —
  // sprzedawca musi mieć jak wrócić i poprawić dane, gdy Stripe dołoży wymagania.
  const etykietaPrzycisku = status.onboardingComplete
    ? 'Uzupełnij dane'
    : 'Rozpocznij onboarding, aby przyjmować płatności';

  return `
    <tr>
      <td>
        <strong>${esc(sprzedawca.displayName)}</strong>
        <div class="podpis">${esc(sprzedawca.contactEmail)}</div>
      </td>
      <td><code>${esc(sprzedawca.stripeAccountId)}</code></td>
      <td>${
        status.bladOdczytu
          ? '<span class="znacznik czeka">nieznane</span>'
          : znacznik(status.readyToReceivePayments, 'aktywne', 'nieaktywne')
      }</td>
      <td>${kolumnaWymagan}</td>
      <td><a class="przycisk wtorny" style="margin:0"
             href="/accounts/${encodeURIComponent(sprzedawca.stripeAccountId)}/onboard"
          >${etykietaPrzycisku}</a></td>
    </tr>`;
}

/**
 * POST /accounts — utworzenie konta połączonego przez API V2.
 *
 * Uwaga na to, czego tu **nie** ma: parametru `type` na najwyższym poziomie.
 * W API V2 nie istnieją konta „express"/„standard"/„custom" jako typ — o tym,
 * jak konto działa, decydują `dashboard`, `defaults.responsibilities`
 * i `configuration`.
 */
accountsRouter.post('/accounts', async (req: Request, res: Response) => {
  const displayName = String(req.body?.displayName ?? '').trim();
  const contactEmail = String(req.body?.contactEmail ?? '').trim();

  if (!displayName || !contactEmail) {
    res.redirect(303, '/?blad=' + encodeURIComponent('Podaj nazwę i adres e-mail sprzedawcy.'));
    return;
  }

  try {
    const konfiguracja = wczytajKonfiguracje();

    const konto = await stripe().v2.core.accounts.create({
      display_name: displayName,
      contact_email: contactEmail,

      // Kraj rozstrzyga o dostępnych metodach płatności i o tym, jakich
      // dokumentów Stripe zażąda w onboardingu. Musi być obsługiwany przez
      // kraj platformy — stąd zmienna środowiskowa, a nie stała w kodzie.
      identity: {
        country: konfiguracja.connectedAccountCountry,
      },

      // `express` = sprzedawca dostaje panel Stripe'a z ograniczonym zakresem,
      // a onboarding prowadzi Stripe. Platforma nie musi zbierać dokumentów
      // ani obsługiwać weryfikacji tożsamości.
      dashboard: 'express',

      defaults: {
        responsibilities: {
          // Prowizję pobiera platforma (my), nie Stripe.
          fees_collector: 'application',
          // Ryzyko zwrotów i chargebacków bierze na siebie platforma.
          // To jest decyzja finansowa, nie techniczna — przy tym ustawieniu
          // reklamacja klienta obciąża nas, nie sprzedawcę.
          losses_collector: 'application',
        },
      },

      configuration: {
        // Konfiguracja `recipient` = konto ma **przyjmować** pieniądze od
        // platformy. Do sprzedaży destination charge to wystarcza; nie prosimy
        // o `merchant`, bo to sprzedawca nie przyjmuje płatności bezpośrednio.
        recipient: {
          capabilities: {
            stripe_balance: {
              // Bez tego uprawnienia `transfer_data.destination` przy płatności
              // zostanie odrzucone. `requested: true` uruchamia jego weryfikację.
              stripe_transfers: {
                requested: true,
              },
            },
          },
        },
      },
    });

    // Mapowanie „nasz użytkownik → konto Stripe". Zapis dopiero po udanym
    // utworzeniu konta, żeby nie powstał wpis wskazujący donikąd.
    dodajSprzedawce({
      displayName,
      contactEmail,
      stripeAccountId: konto.id,
    });

    // Od razu wysyłamy sprzedawcę do onboardingu: konto bez uzupełnionych
    // wymagań nie przyjmie ani złotówki, więc zatrzymanie go na liście byłoby
    // pokazaniem stanu, z którym i tak nic nie zrobi.
    res.redirect(303, `/accounts/${encodeURIComponent(konto.id)}/onboard`);
  } catch (err) {
    res.redirect(303, '/?blad=' + encodeURIComponent(opisBledu(err, 'Nie udało się utworzyć konta.')));
  }
});

/**
 * GET /accounts/:id/onboard — Account Link i przekierowanie do Stripe'a.
 *
 * Link jest **jednorazowy i krótko żyjący**. Dlatego nie zapisujemy go
 * i nie wysyłamy mailem — generujemy przy każdym kliknięciu.
 */
accountsRouter.get('/accounts/:id/onboard', async (req: Request, res: Response) => {
  const stripeAccountId = req.params.id;

  try {
    const konfiguracja = wczytajKonfiguracje();

    const accountLink = await stripe().v2.core.accountLinks.create({
      account: stripeAccountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          // Zbieramy wymagania dla tej konfiguracji, o którą prosiliśmy przy
          // tworzeniu konta. Lista musi się z nią zgadzać.
          configurations: ['recipient'],

          // `refresh_url` — Stripe tu odsyła, gdy link wygasł albo został już
          // użyty. Ta trasa generuje świeży link i przekierowuje ponownie,
          // więc sprzedawca po prostu wraca do onboardingu zamiast zobaczyć błąd.
          refresh_url: `${konfiguracja.baseUrl}/accounts/${encodeURIComponent(stripeAccountId)}/onboard`,

          // `return_url` — tu wraca po zakończeniu. Powrót **nie** oznacza,
          // że onboarding się powiódł; oznacza tylko, że użytkownik skończył
          // klikać. Prawdę o stanie konta czytamy z API na liście sprzedawców.
          return_url: `${konfiguracja.baseUrl}/?sukces=${encodeURIComponent(
            'Powrót ze Stripe. Status poniżej pochodzi z API i jest aktualny.'
          )}`,
        },
      },
    });

    res.redirect(303, accountLink.url);
  } catch (err) {
    res.redirect(
      303,
      '/?blad=' + encodeURIComponent(opisBledu(err, 'Nie udało się otworzyć onboardingu.'))
    );
  }
});

/**
 * Komunikat błędu do pokazania użytkownikowi.
 *
 * Wiadomości Stripe'a są konkretne („No such account: acct_...") i w próbce
 * pomagają bardziej, niż szkodzą. W aplikacji produkcyjnej byłby tu ten sam
 * mechanizm co w `src/server/middleware/errorHandler.ts`: `requestId` dla
 * użytkownika, szczegóły do logu.
 */
function opisBledu(err: unknown, zapasowy: string): string {
  console.error('[connect]', err);
  return err instanceof Error ? `${zapasowy} ${err.message}` : zapasowy;
}
