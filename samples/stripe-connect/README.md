# Próbka integracji Stripe Connect

Kompletny, działający przykład rynku (marketplace) na Stripe Connect:
**sprzedawcy → onboarding → produkty → sklep → płatność z prowizją platformy**.

To jest **próbka referencyjna**, a nie funkcja CVelocity. Stoi w osobnym pakiecie
npm, ma własne zależności i własny serwer — nie dotyka kodu aplikacji ani jej
płatności (`src/server/routes/billing.routes.ts`, `stripe.routes.ts`), które
obsługują zupełnie inny model: jeden sprzedawca, jeden produkt, żadnych kont
połączonych.

---

## Model rozliczeń

Platforma odpowiada za ceny i pobiera prowizję. W praktyce oznacza to trzy
decyzje, przenikające cały kod:

| Decyzja | Ustawienie | Gdzie w kodzie |
|---|---|---|
| Prowizję pobiera platforma | `fees_collector: 'application'` | `routes/accounts.routes.ts` |
| Ryzyko zwrotów bierze platforma | `losses_collector: 'application'` | `routes/accounts.routes.ts` |
| Płatność typu destination charge | `transfer_data.destination` + `application_fee_amount` | `routes/storefront.routes.ts` |

Klient płaci platformie, Stripe przelewa sprzedawcy jego część, prowizja
zostaje na koncie platformy.

---

## Uruchomienie

```bash
cd samples/stripe-connect
npm install
cp .env.example .env          # i uzupełnij STRIPE_SECRET_KEY
npm run dev                   # http://localhost:4242
```

Wymagany jest wyłącznie klucz testowy platformy (`sk_test_...`). Bez niego
serwer nie wystartuje i wypisze, czego brakuje i skąd to wziąć — nie ma tu
wartości zastępczych, które pozwoliłyby próbce „prawie działać".

Zależności są własne, więc `npm install` w katalogu głównym repozytorium **nie**
instaluje tej próbki. Katalog `samples/` jest wykluczony z `tsconfig.json`
i `eslint.config.js` katalogu głównego — dokładnie tak samo jak
`semantic-work-graph/`.

---

## Ścieżka przez interfejs

| Ekran | Adres | Co robi |
|---|---|---|
| Sprzedawcy | `/` | Zakłada konta połączone, pokazuje **status onboardingu pobierany na żywo z API** |
| Produkty | `/products` | Tworzy produkty **na platformie**, przypisane do sprzedawcy przez metadane |
| Sklep | `/storefront` | Jeden katalog wszystkich sprzedawców, zakup przez Stripe Checkout |
| Powrót | `/success` | Odczytuje stan sesji płatności |

Kolejność ma znaczenie: produkt wymaga sprzedawcy, a zakup wymaga konta
z aktywnym uprawnieniem do przyjmowania przelewów.

---

## Webhooki — zmiany wymagań na kontach

Wymagania konta zmieniają się bez udziału platformy: regulatorzy, sieci kartowe
i banki dokładają warunki. Konto, które wczoraj przyjmowało wypłaty, dziś może
ich nie przyjmować — bez nasłuchu dowiesz się o tym z odrzuconej płatności.

### Lokalnie, przez Stripe CLI

```bash
stripe listen \
  --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.recipient].capability_status_updated' \
  --forward-thin-to localhost:4242/webhooks/stripe
```

CLI wypisze przy starcie sekret podpisu (`whsec_...`) — wpisz go do `.env`
jako `STRIPE_WEBHOOK_SECRET` i uruchom serwer ponownie. Bez sekretu trasa
`/webhooks/stripe` odpowiada `501`, zamiast przyjmować niezweryfikowane
żądania.

### Docelowy odbiorca w Dashboardzie

1. **Developers → Webhooks → + Add destination**.
2. W **Events from** wybierz **Connected accounts**.
3. **Show advanced options** → **Payload style: Thin**.
4. W polu zdarzeń wpisz `v2` i zaznacz:
   - `v2.core.account[requirements].updated`
   - `v2.core.account[configuration.recipient].capability_status_updated`

### Zdarzenia cienkie — na co uważać

Ładunek zdarzenia V2 zawiera identyfikator, typ i wskazanie obiektu
(`related_object`), **ale nie sam obiekt**. Pełne dane pobiera się osobnym
żądaniem, więc widzisz stan z chwili pobrania, a nie z chwili zdarzenia.

**Nazwa metody w SDK.** Dokumentacja i starsze przykłady pokazują
`stripe.parseThinEvent(...)`. W wersji użytej tutaj (`stripe@22.6.0`) ta metoda
nie istnieje — została przemianowana na **`parseEventNotification`**,
a interfejs `Stripe.ThinEvent` usunięty. Zwracany obiekt jest unią typów po
polu `type`, z metodami `fetchEvent()` i `fetchRelatedObject()`.
Szczegóły w komentarzu otwierającym `src/routes/webhooks.routes.ts`.

---

## Układ plików

```
src/
  config.ts                    odczyt i walidacja .env — jedyne miejsce z process.env
  stripeClient.ts              jeden StripeClient na proces
  store.ts                     mapowanie użytkownik → konto połączone (plik JSON)
  layout.ts                    szkielet HTML, style, ucieczka znaków
  server.ts                    montaż tras (kolejność middleware ma znaczenie)
  routes/
    accounts.routes.ts         KROK 1–2: tworzenie konta V2 i Account Link
    products.routes.ts         KROK 3: produkty platformy + metadane sprzedawcy
    storefront.routes.ts       KROK 4: sklep i destination charge
    webhooks.routes.ts         KROK 5: zdarzenia cienkie o zmianach wymagań
```

---

## Decyzje, które łatwo przeoczyć

**Konta V2 nie mają parametru `type`.** Nie ma `type: 'express'` ani
`'standard'`, ani `'custom'` na najwyższym poziomie. O zachowaniu konta
decydują `dashboard`, `defaults.responsibilities` i `configuration`.

**Status konta nie jest nigdzie zapisywany.** Każde wyświetlenie listy
sprzedawców pobiera go z `v2.core.accounts.retrieve` z `include:
['configuration.recipient', 'requirements']`. Zapisany status rozjeżdża się
z prawdą przy pierwszej zmianie wymagań, a użytkownik widzi wtedy „gotowe"
przy koncie, które nie przyjmie płatności.

**`include` jest obowiązkowe.** Bez niego API V2 nie zwraca ani konfiguracji,
ani wymagań — kod czytałby `undefined` i uznał każde konto za niegotowe.

**Cena nigdy nie przychodzi z przeglądarki.** Formularz zakupu wysyła sam
identyfikator produktu; kwotę i konto docelowe serwer odczytuje ze Stripe'a.
Gdyby cena przychodziła z formularza, wystarczyłoby podmienić ją w żądaniu.

**Webhook stoi przed `express.json()`.** Podpis liczy się z dokładnych bajtów
ładunku. Po sparsowaniu i ponownej serializacji weryfikacja zawsze zawodzi.

**Wersji API nie ustawiamy w kodzie.** SDK przypina wersję, pod którą został
wygenerowany (włącznie z podglądową `2026-08-26.dahlia` dla V2). Wpisanie jej
ręcznie oznaczałoby, że przy aktualizacji pakietu typy mówią co innego niż
nagłówek żądania.

**Zero danych przykładowych.** Puste listy zamiast wymyślonych sprzedawców
i produktów — reguła 1 z [`AGENTS.md`](../../AGENTS.md). Wszystko, co widać
na ekranie, powstało z prawdziwego wywołania API.

---

## Czego tu nie ma

- **Uwierzytelniania.** Każdy, kto otworzy próbkę, jest każdym sprzedawcą.
  W prawdziwej aplikacji `accountId` bierze się z sesji zalogowanego
  użytkownika, nigdy z formularza.
- **Bazy danych.** Mapowanie sprzedawców leży w pliku `.dane/sprzedawcy.json`
  (poza repozytorium). W CVelocity byłaby to kolumna przy użytkowniku
  w Supabase — interfejs `store.ts` jest tak napisany, żeby podmiana
  implementacji nie ruszała żadnej trasy.
- **Nadawania dostępu po zakupie.** Strona `/success` odczytuje stan sesji,
  ale go nie rozstrzyga — adres z `?session_id=` da się wpisać ręcznie.
  W produkcji dostęp nadaje webhook `checkout.session.completed`, tak jak
  w `src/server/routes/stripe.routes.ts` aplikacji.
- **Obsługi zwrotów i sporów.** Przy `losses_collector: 'application'`
  obciążają one platformę i wymagają osobnej decyzji produktowej.

---

## Stan weryfikacji

Sprawdzone na `stripe@22.6.0` (najnowsza wersja stabilna w chwili pisania):

- `npx tsc --noEmit` — bez błędów, przy `strict` i `noUnusedLocals`;
- start bez `STRIPE_SECRET_KEY` — czytelny komunikat i kod wyjścia 1;
- start z kluczem — wszystkie trzy ekrany zwracają 200, puste stany renderują się poprawnie;
- błąd API przy liście produktów — komunikat w interfejsie, nie 500;
- webhook bez sekretu → 501, bez nagłówka → 400, zły podpis → 400;
- webhook z **poprawnym podpisem** (`webhooks.generateTestHeaderString`) →
  ładunek zweryfikowany, zdarzenie `v2.core.account[requirements].updated`
  trafia do właściwego handlera.

Nie zweryfikowano na żywym koncie Stripe — próbka nie była uruchomiona
z prawdziwym kluczem `sk_test_`, więc odpowiedzi API (tworzenie konta,
Account Link, Checkout) nie zostały potwierdzone końcem na koniec.
