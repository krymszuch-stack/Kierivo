# ARCHIWUM: poprzednia droga CVELOCITY do działającego backendu

> Ten dokument opisuje wycofaną ścieżkę Google Cloud. Nie wykonuj z niego
> komend ani nie twórz sekretów Google. Obowiązująca ścieżka Azure jest w
> [`wdrozenie-azure-beta.md`](./wdrozenie-azure-beta.md).

Ten dokument prowadzi od pustego konta do wdrożonej aplikacji z kontami użytkowników, bazą danych i płatnościami.

**Podział ról między dokumentami:**

| Dokument | Odpowiada na pytanie |
|---|---|
| [`docs/SETUP.md`](./SETUP.md) | *Jakie konta założyć i skąd wziąć klucze?* — konta, karty, DNS, formalności, RODO |
| **ten plik** | *Co wpisać w terminal?* — komendy, migracje, sekrety, wdrożenie, weryfikacja |
| [`SECURITY.md`](../SECURITY.md) | *Co jest, a co nie jest zabezpieczone dzisiaj?* |

> **O aktualności:** panele Google Cloud, Supabase i Stripe zmieniają się co kilka miesięcy. Opisane są **ścieżki i intencje**, nie położenie przycisków. Komendy CLI są znacznie stabilniejsze niż interfejsy graficzne i dlatego wszędzie, gdzie to możliwe, podana jest komenda.

---

## Co kosztuje 0 zł, a co nie

| Element | Darmowa opcja | Kiedy przestaje być darmowa |
|---|---|---|
| Backend + frontend | **Cloud Run** — 2 mln żądań/mc, 180 tys. vCPU-s, skalowanie do zera | przy ruchu, którego na starcie nie będzie |
| Baza danych i konta | **Supabase Free** — 500 MB | **od pierwszego płacącego klienta** — Free nie ma kopii zapasowych, a te są wymagane przez art. 32 RODO |
| Rejestr obrazów | **Artifact Registry** — 0,5 GB | obraz waży ~250 MB, więc po kilku wersjach ~$0.10/GB/mc (grosze) |
| Model AI | ❌ **nigdy** | darmowy tier Gemini API trenuje modele na przesłanych danych — przy CV realnych osób odpada z powodów prawnych, nie budżetowych |
| Poczta transakcyjna | **Resend** — 3000 maili/mc | przy skali, której na starcie nie będzie |

**Wniosek: 0 zł do pierwszego płacącego klienta**, przy czym karta przy koncie Google Cloud jest potrzebna od początku — wymusza ją płatny tier Gemini, nie Cloud Run.

⚠️ **Vercel Hobby (darmowy) zabrania użytku komercyjnego.** Z chwilą uruchomienia Stripe'a wymagałby planu Pro. Dlatego ten projekt serwuje frontend **z tego samego kontenera co API** — jeden obraz, jeden URL, zero CORS i zero dodatkowego rachunku.

---

## Kolejność prac

| Etap | Krok | Co odblokowuje | Stan realizacji |
|---|---|---|---|
| 1 | [Wymagania wstępne](#1--wymagania-wstępne) | wszystko | ✅ **Zrealizowane** (Node 22, Docker, zestaw narzędzi, CI) |
| 2 | [Supabase lokalnie](#2--supabase-lokalnie) | pracę nad bazą bez dotykania produkcji | ✅ **Zrealizowane** (migracje, lokalny stos w workflow CI) |
| 3 | [Schemat i RLS](#3--schemat-bazy-i-rls) | konta i trwałe dane | ✅ **Zrealizowane** (odebrane w D02–D04, RLS na 7 tabelach, `test:rls`) |
| 4 | [Uruchomienie end-to-end](#4--uruchomienie-lokalne-end-to-end) | rejestrację i logowanie | ✅ **Zrealizowane** (tryby local/cloud, cykl auth i outbox w D03–D04) |
| 5 | [Stripe w trybie testowym](#5--stripe-w-trybie-testowym) | płatności | ⏸️ **Wstrzymane operacyjnie** (kod i webhook gotowe, checkout celowo zablokowany na czas Pre-Bety 0 zł) |
| 6 | [Wdrożenie na Cloud Run](#6--wdrożenie-na-cloud-run) | publiczny adres | 🔄 **Zastąpione przez Azure** (wdrożenie na Azure Container Apps wg [`docs/wdrozenie-azure-beta.md`](./wdrozenie-azure-beta.md)) |
| 7 | [Domena i budżet](#7--domena-i-budżet) | wydanie produkcyjne | 🟡 **Skonfigurowane** (skrypt `prepare-cloudflare-domain.ps1` pod Azure Container Apps) |
| 8 | [Weryfikacja](#8--weryfikacja-przed-wydaniem) | spokojny sen | 🟡 **Częściowo** (bramki CI, RLS, auth lifecycle, RODO art. 17 ✅; płatne funkcje czekają na start komercyjny) |

---

## 1 · Wymagania wstępne

```bash
node --version     # musi być 22.x — Dockerfile i CI używają node:22
docker --version   # do zbudowania i przetestowania obrazu lokalnie
```

Node 22, nie 20: `safeFetch` przypina zwalidowane IP przez własny `lookup` w `http.request` i cała weryfikacja SSRF była robiona na tej wersji.

Narzędzia wiersza poleceń:

```bash
npm i -g supabase                                    # https://supabase.com/docs/guides/local-development
curl -sSL https://sdk.cloud.google.com | bash        # https://cloud.google.com/sdk/docs/install
# Stripe CLI: https://stripe.com/docs/stripe-cli
```

Klucze i konta bierzesz z [`docs/SETUP.md`](./SETUP.md) §1 (Gemini), §2 (Supabase) i §3 (Stripe). Wróć tutaj, gdy je masz.

---

## 2 · Supabase lokalnie

Cała praca nad schematem odbywa się na lokalnej instancji. Do produkcji migracje trafiają dopiero wtedy, gdy działają.

```bash
supabase start          # podnosi Postgresa, Auth, Studio i resztę w Dockerze
```

Komenda wypisze komplet adresów i kluczy — zapisz je do `.env`:

```
API URL     → SUPABASE_URL / VITE_SUPABASE_URL
anon key    → VITE_SUPABASE_ANON_KEY      (publiczny, chroniony przez RLS)
service_role→ SUPABASE_SERVICE_ROLE_KEY   (⚠️ omija całe RLS — nigdy z prefiksem VITE_)
Studio URL  → podgląd danych w przeglądarce
```

> ⚠️ **`service_role` omija każdą politykę RLS.** Jeśli kiedykolwiek trafi do zmiennej z prefiksem `VITE_`, wyląduje w pakiecie przeglądarki i każdy odwiedzający uzyska pełny dostęp do bazy. Sprawdzenie tego jest krokiem automatycznym w CI — patrz [§8](#8--weryfikacja-przed-wydaniem).

Pozostałe komendy, których będziesz używać:

```bash
supabase db reset       # kasuje lokalną bazę i odtwarza ją z supabase/migrations/ — bezpieczne lokalnie
supabase migration new  nazwa_migracji    # tworzy pusty plik migracji ze znacznikiem czasu
supabase stop           # zatrzymuje kontenery
```

Podłączenie projektu zdalnego (dopiero gdy schemat jest gotowy):

```bash
supabase login
supabase link --project-ref TWOJ_REF      # REF znajdziesz w URL-u panelu Supabase
supabase db push                          # wysyła migracje na projekt zdalny
```

📖 [Local development](https://supabase.com/docs/guides/local-development) · [Managing migrations](https://supabase.com/docs/guides/deployment/database-migrations)

---

## 3 · Schemat bazy i RLS

Migracja `supabase/migrations/0001_init.sql` zakłada siedem tabel. Każda ma **włączone RLS bez wyjątku** — to jest różnica między „status Pro to etykieta w `localStorage`" a „status Pro to fakt w bazie".

| Tabela | Co trzyma | Kto może pisać |
|---|---|---|
| `profiles` | nazwa wyświetlana, data założenia | właściciel |
| `vaults` | `MasterVault` jako `jsonb` | właściciel |
| `applications` | historia wysłanych aplikacji | właściciel |
| `plans` | cennik: `stripe_price_id`, kwoty limitów | **tylko `service_role`** |
| `subscriptions` | status subskrypcji, `stripe_customer_id` | **tylko `service_role`** |
| `ai_usage_events` | zużycie tokenów per wywołanie | **tylko `service_role`** |
| `usage_counters` | miesięczne liczniki kwot | **tylko funkcja SQL** |

### Dlaczego akurat tak

**`subscriptions` jest niezapisywalna dla użytkownika.** Gdyby właściciel konta mógł edytować własny wiersz, mógłby sobie wpisać `status = 'active'` i korzystać z planu Pro bez płacenia. Jedynym źródłem prawdy o płatności jest webhook Stripe'a, który działa na kluczu `service_role`.

**Kwoty pobiera funkcja `consume_quota(p_user, p_kind)`, nie kod aplikacji.** Sprawdzenie limitu i jego pobranie dzieje się w jednym `INSERT … ON CONFLICT … DO UPDATE … WHERE`, czyli w jednej transakcji. Gdyby to były dwa osobne zapytania z aplikacji, dwie równolegle otwarte karty przeglądarki mogłyby obie przeczytać „został 1 kredyt" i obie go zużyć.

### Zastosowanie i test

```bash
supabase db reset                         # stosuje migracje od zera
```

Sprawdzenie, że RLS faktycznie działa — to jest jedyny test, który potwierdza, że dane jednego użytkownika są niedostępne dla drugiego:

```bash
npm run test:rls
```

Skrypt zakłada dwóch użytkowników, zapisuje vault pierwszemu i próbuje odczytać go kluczem `anon` drugiego. **Musi zwrócić zero wierszy.** Jeśli zwraca dane — nie wdrażaj niczego, dopóki nie naprawisz polityk.

📖 [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## 4 · Uruchomienie lokalne end-to-end

Plik `.env` (wzór w [`.env.example`](../.env.example)):

```env
# Tryb pracy backendu:
#   local — bez Supabase, dane w przeglądarce (dotychczasowe zachowanie)
#   cloud — konta, baza i kwoty po stronie serwera
BACKEND_MODE=cloud

GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-lite

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=eyJ...
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJ...

PORT=3000
NODE_ENV=development
TRUST_PROXY=false          # ⚠️ true DOPIERO na Cloud Run
APP_URL=http://localhost:3000
```

```bash
npm install
npm run dev                # http://localhost:3000
```

Ścieżka do przejścia ręcznie:

1. Załóż konto przez formularz rejestracji.
2. W lokalnym Supabase Studio → *Authentication* potwierdź, że użytkownik istnieje.
3. Uzupełnij profil i zapisz.
4. W Studio → *Table editor* → `vaults` sprawdź, że wiersz się pojawił i `user_id` się zgadza.
5. Wyloguj się, zaloguj ponownie — dane muszą wrócić.

**Tryb `BACKEND_MODE=local` działa nadal i nie wymaga Supabase.** Serwer wystartuje z samym `GEMINI_API_KEY`, tak jak dotychczas — dzięki temu można pracować nad frontendem bez podnoszenia bazy.

---

## 5 · Stripe w trybie testowym

Klucze testowe dostajesz od ręki, bez weryfikacji firmy. Produkty i ceny zakładasz wg [`docs/SETUP.md`](./SETUP.md) §3.

```bash
stripe login
stripe listen --forward-to http://localhost:3000/api/stripe-webhook
# wypisze whsec_... → wpisz do .env jako STRIPE_WEBHOOK_SECRET
```

W drugim terminalu:

```bash
stripe trigger checkout.session.completed
```

Po tym w tabeli `subscriptions` musi pojawić się wiersz ze statusem `active`. **Powtórzenie tego samego zdarzenia nie może utworzyć drugiego wiersza** — zdarzenia są odrzucane po `stripe_event_id`, bo Stripe z założenia dostarcza je co najmniej raz, czasem kilka razy.

Karty testowe: `4242 4242 4242 4242` sukces · `4000 0000 0000 9995` odmowa · `4000 0025 0000 3155` 3D Secure. Dowolna przyszła data, dowolne CVC.

### Dlaczego nie ma tu Stripe.js

Sesja płatności powstaje **po stronie serwera** (`POST /api/billing/checkout-session`), a przeglądarka jedynie przechodzi pod zwrócony adres. Skutki:

- do strony nie jest doładowywany żaden skrypt firmy trzeciej, więc CSP zostaje przy `script-src 'self'` bez wyjątków;
- cena pochodzi z tabeli `plans` w bazie, a nie z pola w kodzie przeglądarki, którego użytkownik nie może podmienić;
- poprzednia implementacja używała `stripe.redirectToCheckout({ lineItems })` — integracji wyłączonej dla nowych kont Stripe.

📖 [Checkout Sessions](https://stripe.com/docs/api/checkout/sessions) · [Weryfikacja podpisu webhooka](https://stripe.com/docs/webhooks/signatures) · [Karty testowe](https://stripe.com/docs/testing)

---

## 6 · Wdrożenie na Cloud Run

### Przygotowanie projektu

```bash
export PROJECT=cvelocity-prod
export REGION=europe-central2          # Warszawa; europe-west1 też jest blisko i bywa tańszy

gcloud auth login
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com
```

### Rejestr obrazów

```bash
gcloud artifacts repositories create cvelocity \
  --repository-format=docker --location=$REGION
```

### Sekrety — nigdy jako zmienne środowiskowe

```bash
printf '%s' "$GEMINI_API_KEY"             | gcloud secrets create gemini-api-key --data-file=-
printf '%s' "$SUPABASE_SERVICE_ROLE_KEY"  | gcloud secrets create supabase-service-role --data-file=-
printf '%s' "$STRIPE_SECRET_KEY"          | gcloud secrets create stripe-secret --data-file=-
printf '%s' "$STRIPE_WEBHOOK_SECRET"      | gcloud secrets create stripe-webhook-secret --data-file=-
```

> `--set-env-vars` zapisuje wartość w konfiguracji usługi, gdzie widzi ją każdy z dostępem do odczytu opisu usługi i gdzie ląduje w logach audytowych. Secret Manager trzyma wartość osobno, wersjonuje ją i pozwala nadać dostęp wyłącznie kontu usługi.

### Budowa i wdrożenie

```bash
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT/cvelocity/app

gcloud run deploy cvelocity \
  --image $REGION-docker.pkg.dev/$PROJECT/cvelocity/app \
  --region $REGION \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --set-env-vars NODE_ENV=production,BACKEND_MODE=cloud,TRUST_PROXY=true,SUPABASE_URL=https://TWOJ_REF.supabase.co,APP_URL=https://twoja-domena.pl \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest,STRIPE_SECRET_KEY=stripe-secret:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest
```

### Dlaczego akurat te flagi

| Flaga | Powód |
|---|---|
| `--min-instances 0` | To są właśnie te 0 zł. Usługa śpi, gdy nikt jej nie używa. Kosztem jest zimny start ~1–2 s przy pierwszym żądaniu. |
| `--max-instances 3` | Limiter zapytań (`src/server/middleware/rateLimiter.ts`) trzyma liczniki **w pamięci instancji**. Przy 10 instancjach limit jest faktycznie dziesięciokrotnie wyższy. Trzy to kompromis; twarde limity kwot i tak są w bazie. |
| `--memory 512Mi` | Zmierzone zużycie procesu Node z tym bundlem. Poniżej 512 Mi zdarzają się zabicia procesu przy większych dokumentach. |
| `TRUST_PROXY=true` | **Wyłącznie tutaj.** Cloud Run jest reverse proxy i podaje adres klienta w `X-Forwarded-For`. Bez tej flagi wszyscy użytkownicy trafiają do jednego kubełka limitera. Włączona *bez* proxy pozwala podszyć się pod dowolny adres i ominąć limiter — dlatego jest jawna, a nie domyślna. |

### Zmienne `VITE_` to osobna sprawa

Wszystko z prefiksem `VITE_` jest **wbudowywane w pakiet przeglądarki w trakcie `npm run build`**, a nie odczytywane w czasie działania. Ustawienie ich przez `--set-env-vars` nie zadziała — muszą być dostępne podczas budowania obrazu. W `cloudbuild.yaml` przekazuje się je jako `--build-arg`, a `Dockerfile` przyjmuje przez `ARG`.

Konsekwencja: `VITE_SUPABASE_ANON_KEY` i `VITE_STRIPE_PUBLISHABLE_KEY` są **publiczne z definicji**. To jest w porządku — pierwszy chroni RLS, drugi jest kluczem publicznym Stripe'a. `SUPABASE_SERVICE_ROLE_KEY` i `STRIPE_SECRET_KEY` nie mogą tam trafić nigdy.

### Webhook Stripe'a na produkcji

W panelu Stripe → *Developers → Webhooks → Add endpoint*:

```
https://twoja-domena.pl/api/stripe-webhook
```

Zdarzenia do subskrypcji: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

Panel poda **nowy** `whsec_...` — inny niż lokalny ze `stripe listen`. Podmień sekret:

```bash
printf '%s' "whsec_PRODUKCYJNY" | gcloud secrets versions add stripe-webhook-secret --data-file=-
gcloud run services update cvelocity --region $REGION   # przeładowanie sekretu
```

📖 [Cloud Run pricing i free tier](https://cloud.google.com/run/pricing) · [Sekrety w Cloud Run](https://cloud.google.com/run/docs/configuring/services/secrets)

---

## 7 · Domena i budżet

### Domena

```bash
gcloud run domain-mappings create --service cvelocity --domain twoja-domena.pl --region $REGION
```

Alternatywnie Cloudflare przed Cloud Run — wygodniejsze, jeśli DNS i tak trzymasz na Cloudflare ([`docs/SETUP.md`](./SETUP.md) §4).

### Budżet

Ustaw go **zanim** usługa stanie się publiczna: [`docs/SETUP.md`](./SETUP.md) §1 krok 2.

> ⚠️ **Budżet Google nie odcina usług — wysyła wyłącznie e-mail.** Twarde odcięcie wymaga Cloud Function reagującej na alert budżetowy przez Pub/Sub. Przy `--max-instances 3` i limitach kwot w bazie ryzyko jest ograniczone, ale nie zerowe. Dopóki tego nie ma, alert budżetowy jest jedynym sygnałem, że coś idzie nie tak.

---

## 8 · Weryfikacja przed wydaniem

Kolejność jest celowa — każdy punkt zakłada, że poprzedni przeszedł.

```bash
npm run lint && npm test          # typy, ESLint, testy jednostkowe
npm run test:rls                  # użytkownik A nie widzi danych użytkownika B
```

Kontener lokalnie, przed jakimkolwiek wdrożeniem:

```bash
docker build -t cvelocity .
docker run --rm -p 8080:8080 --env-file .env cvelocity

curl -s http://localhost:8080/api/health          # {"status":"ok",...}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/    # 200 — frontend jest serwowany
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/me   # 401 — bez tokenu ani kroku dalej
```

Sekrety poza pakietem przeglądarki:

```bash
grep -rE "service_role|sk_live|sk_test|SUPABASE_SERVICE" dist/client/ && echo "❌ SEKRET W PAKIECIE" || echo "✓ czysto"
```

Ten sam `grep` jest krokiem w CI (`.github/workflows/ci.yml`), więc nie da się go pominąć przez zapomnienie.

### Checklista przed pierwszym płacącym klientem

Pozycje produktowe i formalne są w [`docs/SETUP.md`](./SETUP.md). Poniżej wyłącznie to, co dokłada backend:

- [ ] `npm run test:rls` przechodzi na **projekcie zdalnym**, nie tylko lokalnym *(w CI weryfikowane w odizolowanym środowisku Supabase w D04; zdalny projekt ma bezpiecznik opt-in)*
- [ ] Webhook produkcyjny odpowiada `200` na `stripe trigger` *(wstrzymane — w Pre-Beta wyłączono sprzedaż, 0 zł)*
- [x] Powtórzone zdarzenie webhooka nie tworzy duplikatu w `subscriptions` *(zaimplementowane: idempotencja po `stripe_event_id`)*
- [x] `DELETE /api/me` czyści **wszystkie** tabele dla danego `user_id` — potwierdzone testem automatycznym (RODO art. 17, PR #111 / D04)
- [ ] Supabase przełączony na **Pro** — Free nie ma kopii zapasowych (RODO art. 32) *(do włączenia przy pierwszym płacącym kliencie)*
- [x] `TRUST_PROXY=true` obsłużone w kontenerze produkcyjnym (Azure Container Apps) i **`false` domyślnie lokalnie**
- [ ] Budżet z alertami na 50 / 90 / 100%
- [x] `SECURITY.md` zaktualizowany — pozycje „Znane ograniczenia", które przestały być prawdą, usunięte, a te które zostały, opisane uczciwie

---

## Dodatek · Powiadomienia push — przygotowane, niewdrożone

Klucz publiczny VAPID dla tego projektu istnieje i leży w `.env.example` jako
`VITE_VAPID_PUBLIC_KEY`. **Nie ma jeszcze ani jednej linijki kodu, która by go
używała** i jest to celowe — ta sekcja opisuje, dlaczego i co będzie potrzebne.

### Dlaczego to czeka na backend

VAPID służy do **identyfikacji serwera nadającego** wobec serwisu push. Cały
mechanizm zakłada, że istnieje coś, co wysyła: przy każdym powiadomieniu serwer
podpisuje token JWT swoim kluczem prywatnym i dokłada dwa nagłówki:

| nagłówek | zawartość |
|---|---|
| `Authorization` | `WebPush <JWT>` — podpis, adresat (pochodzenie serwisu push), czas wygaśnięcia, kontakt |
| `Crypto-Key` | `p256ecdsa=<klucz publiczny base64url>` |

Pod `kierivo.com` działa jeden kontener z frontendem i `/api/*`
oddaje `index.html`, bo trafia w regułę przepisującą. Nie ma czego podpisać ani
kto miałby wysłać. Push wchodzi po wdrożeniu z §6.

### Czego **nie** będzie potrzeba

Zależności `firebase` w przeglądarce. Historycznie Chrome wymagał FCM
z własnymi nagłówkami i polem `gcm_sender_id` w manifeście; VAPID to znosi
i pozwala trzymać się standardowego Web Push Protocol, tego samego w Chrome
i Firefoksie ([Chrome for Developers, „Web Push
Interop Wins"](https://developer.chrome.com/blog/web-push-interop-wins)).

Po stronie klienta wystarczają wbudowane API przeglądarki:

```js
const registration = await navigator.serviceWorker.register('/sw.js');
await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey, // klucz publiczny jako Uint8Array
});
```

Zero dodatkowych kilobajtów w pakiecie. Po stronie serwera biblioteka
podpisująca JWT (np. `web-push`) — tam rozmiar nie ma znaczenia.

### Podział kluczy

- **publiczny** — trafia do pakietu przeglądarki i jest przekazywany serwisowi
  push jako `applicationServerKey`. Jest publiczny z definicji, więc `VITE_`
  jest tu poprawnym prefiksem i wersjonowanie go w repozytorium nie szkodzi;
- **prywatny** — wyłącznie serwerowy, podpisuje JWT. Nigdy z prefiksem `VITE_`,
  nigdy w repozytorium, na produkcji w Secret Managerze — te same zasady co
  `STRIPE_SECRET_KEY` i `service_role` (patrz §6, „Sekrety").

### Co trzeba będzie dopisać

1. Service worker (`public/sw.js`) z obsługą zdarzenia `push`
2. Prośbę o zgodę — **nie przy wejściu na stronę**, tylko przy akcji, z której
   powiadomienie wynika, bo zgoda odrzucona raz jest trudna do odzyskania
3. Trwałe przechowywanie subskrypcji (tabela w Supabase, powiązana z `user_id`)
4. Nadawcę po stronie serwera i sprzątanie subskrypcji, na które serwis push
   odpowiada `404`/`410` — inaczej tabela rośnie o martwe wpisy

---

## Rozwiązywanie problemów

| Objaw | Przyczyna | Naprawa |
|---|---|---|
| Serwer nie startuje, `Nieprawidłowa konfiguracja serwera` | Brak wymaganej zmiennej. Przy `BACKEND_MODE=cloud` wymagane są też klucze Supabase | Uzupełnij `.env` wg `.env.example`. To zachowanie jest celowe — patrz `src/server/config.ts` |
| Webhook zwraca `400 Invalid signature` | Ciało żądania zostało sparsowane przed weryfikacją podpisu, albo `whsec_` jest z innego środowiska | `/api/stripe-webhook` musi być zarejestrowany z `express.raw` **przed** globalnym `express.json` w `server.ts`. Sprawdź, czy używasz sekretu produkcyjnego, nie lokalnego |
| Użytkownik widzi cudze dane | Brak polityki RLS na tabeli albo zapytanie idzie na `service_role` | `npm run test:rls`. Każda tabela musi mieć `enable row level security` |
| Limit zapytań resetuje się losowo | Zimny start Cloud Run czyści liczniki z pamięci | Zachowanie oczekiwane. Twarde limity są w `usage_counters` w bazie, limiter IP to tylko zgrubna warstwa |
| `VITE_*` puste w produkcji | Ustawione przez `--set-env-vars` zamiast `--build-arg` | Zmienne `VITE_` są wbudowywane podczas `npm run build`, nie odczytywane w czasie działania |
| Pierwsze żądanie trwa 2 s | `--min-instances 0` | To jest cena za 0 zł. `--min-instances 1` kosztuje ~20–30 zł/mc |
