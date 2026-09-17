# AUDYT TREŚCI MARKETINGOWEJ I COPY UŻYTKOWNIKA — CVELOCITY

> **Data:** 2026-08-26 · **Zakres:** audit-only (zero zmian w kodzie) · **Gałąź:** `fix/ui-audit-p0-p2`
>
> **Jak czytać:** każde stwierdzenie ma dowód `plik:linia`. Priorytety:
> **P0** — twierdzenie materialnie fałszywe (obiecuje pieniądze, bezpieczeństwo,
> pomiar albo funkcję, której nie ma); **P1** — obietnica bez implementacji albo
> sprzeczność między powierzchniami; **P2** — język, terminologia, typografia.
> Klasyfikacja idzie za regułami 1, 2, 3 i 5 z [`AGENTS.md`](../AGENTS.md);
> incydenty-wzorce: „fałszywe 100% ATS", trasa statystyk zwracająca zmyślone
> stałe, klucze schowka w ośmiu plikach.

---

## 0. Metodologia

Przejrzano całość tekstu widocznego dla użytkownika: `src/views/`
(`HomeView`, `PricingView`, `LandingView`), `src/components/**` (51 plików),
`src/features/**` (50 plików), `index.html`. Każde twierdzenie marketingowe
zweryfikowano względem kodu (`src/server/**`, `supabase/migrations/**`,
`src/lib/**`) — twierdzenie bez mechanizmu w kodzie jest tu traktowane jak
atrapa, bo UI jest jedyną jego gwarancją.

Powiązane otwarte uwagi w [`NOTATKI.md`](./NOTATKI.md): karnet aplikacyjny bez
strony odczytu, limity kwot bez decyzji produktowej — ten raport je potwierdza
z perspektywy copy (§2.1, §2.6) i nie dubluje ich rozwiązań.

---

## 1. Werdykt ogólny

Warstwa wizualna i architektura informacji przeszły już audyt UI/UX
([`AUDYT-UI-LOVABLE.md`](./AUDYT-UI-LOVABLE.md)). Ten audyt pokazuje, że
**tekst nie nadążał za naprawami**: te same klasy błędów, które usunięto
z danych (wymyślone rekordy, fałszywe procenty ATS), żyją dalej w copy —

1. **Monetyzacja opisuje sklep, którego nie ma** (§2.1): ceny i SKU bez
   reprezentacji w bazie, trial bez konfiguracji, limity z trzema różnymi
   wartościami, przyciski prowadzące do atrapy obok realnego endpointu.
2. **Liczby bez pomiaru** (§2.2) wróciły przez okno marketingu: `92%`,
   „mniej niż 3 minuty", „~40% → ponad 90%", „Mediana Rynkowa",
   prawdopodobieństwa przejścia przez nazwane systemy komercyjne.
3. **Stany startowe fabrykują treści** (§2.3) w pięciu miejscach — dokładnie
   klasa błędu usunięta z Trackera i `sampleVault`.
4. **Trzy funkcje udają AI** (§2.4) i jedna obiecuje synchronizację z chmurą,
   która nigdzie nie wychodzi (§2.5).

Równolegle raport dokumentuje **miejsca wzorcowe** (§7) — aplikacja już wie,
jak pisać uczciwie; wystarczy uogólnić te wzorce.

---

## 2. P0 — twierdzenia materialnie fałszywe

### 2.1. Pieniądze: cennik opisuje niedziałający sklep

| # | Twierdzenie w UI | Stan rzeczywisty | Dowód |
|---|---|---|---|
| A | Ceny 49/39 zł, szablon 19 zł, SKU `price_cvelocity_pro_monthly` / `_annual` / `_template_*` | Wszystkie SKU to placeholdery; w tabeli `plans` zseedowano wyłącznie `price_free_placeholder` i `price_karnet_placeholder`. Serwer waliduje cenę po tej tabeli — każdy checkout z UI dostanie „Nieznany plan." | `PricingView.tsx:47–58`, `CVParserModal.tsx:325`; seed: `0001_init.sql:315`, `0004_karnet_aplikacyjny.sql:64`; walidacja: `billing.routes.ts:72–82` |
| B | „30 dni darmowego okresu próbnego", „Trial 30 dni", „30 dni za 0 zł" (sześć wariantów tej obietnicy) | Mechanizm `trial_period_days` istnieje na serwerze, ale **żadna migracja nie ustawia `trial_days > 0`** (domyślnie 0). Długość triala ustala dziś ręczny wpis w bazie, który nie istnieje | UI: `PricingView.tsx:52,206,445,481–487`; modal: `StripeCheckoutModal.tsx:138`; mechanizm: `billing.routes.ts:103`, `0001_init.sql:119` |
| C | „1 darmowy Instant-Import / mc" i „5 darmowych operacji AI / mc" | Trzy różne wartości tego samego limitu: cennik mówi 1/mc i 5/mc, kod klienta egzekwuje `FREE_IMPORTS = 10` (i to w localStorage), a kwoty AI na serwerze resetują się **dziennie**, nie miesięcznie | `PricingView.tsx:173–174,285,291`; `useEntitlements.ts:45`; `0002_quota_atomic.sql:43–52` |
| D | „Nielimitowany Instant-Import" i „Nielimitowany asystent AI Gap-Fixer" w Pro | Serwer hardcoduje `tier = 'FREE'`, więc płacący Pro dostaje te same 5/dzień; import plików w ogóle nie przechodzi przez serwer, więc „limit" nie istnieje dla nikogo | `ai.routes.ts:29,85`; `quota.ts:170` |
| E | „Opcjonalny pakiet 5 szablonów za 79 zł" | Zero konsumenta: ani SKU, ani ścieżki zakupu w całym repo. Tekst sprzedaje opcję, której nie da się kupić (reguła 5) | `PricingView.tsx:228` (jedyna wzmianka „79 zł" w `src/`) |
| F | „Kup wybrany szablon" | Przepływ nie pozwala wybrać: handler otwiera zawsze sztywno `Executive` | `PricingView.tsx:234–235` |
| G | „Anulowanie w 2 kliknięciach (Stripe Portal)" ×3 oraz menu „Zarządzaj subskrypcją" / „Faktury i rozliczenia" | Endpoint `POST /api/billing/portal-session` **jest zaimplementowany**, ale przyciski go nie wołają — pokazują toast „będą dostępne po podłączeniu kluczy Stripe". Oba wpisy menu robią dokładnie to samo | atrapa: `Topbar.tsx:75–81,247,257`; realny endpoint: `billing.routes.ts:144–147`; obietnica: `PricingView.tsx:207,246,556`, `StripeCheckoutModal.tsx:132` |
| H | „Szablony Executive / Creative" jako produkt za 19 zł | Cztery szablony istnieją, ale przełącznik i eksport **nie sprawdzają uprawnień** — płatność niczego nie blokuje, a jej SKU i tak nie ma w `plans` | `DocumentRenderer.tsx:26,97,147–155`; odrzut zakupu: `billing.routes.ts:80–82` |
| I | „Pro Insights (trendy, wskaźniki odpowiedzi)", „wykresy konwersji i estymacja czasu do oferty" | „Wykresy" pod LockCoverem to zaszyte dekoracyjne słupki `[38,52,60,74,88,100]` z miesiącami sty–cze; trendy i estymacja nie istnieją nigdzie w kodzie. Jedyna realna analityka (Response Rate z danych użytkownika) jest darmowa | `PricingView.tsx:440–477`; `ApplicationTracker.tsx:77`; `stats.routes.ts:18–27` |
| J | Chip „Cena brutto (z VAT)" | Brak Stripe Tax / `automatic_tax` w tworzeniu sesji — deklaracja VAT nie ma mechanizmu w kodzie | `StripeCheckoutModal.tsx:125`; `billing.routes.ts:89–107` |
| K | „Subskrypcja odnawialna miesięcznie." | Hardcoded „miesięcznie" — modal powie to także użytkownikowi, który wybrał rozliczenie roczne (39 zł × 12) | `StripeCheckoutModal.tsx:132` vs `PricingView.tsx:190–196` |
| L | TrustRow „VISA · MASTERCARD · BLIK · APPLE PAY · GOOGLE PAY · SSL 256-BIT" | Sesja Checkout tworzona jest **bez** `payment_method_types` — metody decyduje dashboard Stripe; BLIK/Apple Pay wymagają tam ręcznego włączenia. „SSL 256-BIT" nie ma żadnego odzwierciedlenia w repo | `PricingView.tsx:242`; `TrustChip.tsx:10`; `billing.routes.ts:89–107` |
| M | „Najczęściej wybierany" (badge Pro) / „Najpopularniejszy" (landing) | Aplikacja nie zbiera żadnych statystyk wyboru planów — czyste twierdzenie statystyczne, dodatkowo sprzeczne z własnym filarem „Zero Dark Patterns" | `PricingCard.tsx:45`; `LandingView.tsx:684`; filar: `PricingView.tsx:539–542` |

**Wniosek §2.1:** do momentu wpisania prawdziwych `stripe_price_id`, ustawienia
`trial_days` i decyzji o Stripe Tax cała zakładka „Cennik & Plany" jest
transakcyjną fikcją — zgodnie z regułą 2 powinna mówić o tym wprost (jak czyni
to zresztą `StripeCheckoutModal.tsx:203`: „Płatności nie są jeszcze uruchomione").

### 2.2. Liczby bez pomiaru

| Liczba | Kontekst | Dowód |
|---|---|---|
| **92%** jako gigantyczne KPI „oszczędności czasu" | Komentarz w kodzie wskazuje źródło: `prototyp-monetyzacji.html`, czyli prototyp, nie pomiar. W `RAPORT_PROJEKTU_CVELOCITY.md:127` „92%" oznacza co innego (marżę na tokenach) — nawet semantyka jest zajęta | `PricingView.tsx:76–83` |
| **„mniej niż 3 minuty na ofertę"** | Żadna telemetria czasu tej ścieżki nie istnieje; „perfekcyjnie dopasowane" to superlatyw niemierzalny | `PricingView.tsx:82` |
| **„Wzrost przejścia przez filtry ATS z ~40% do ponad 90% na każdym zgłoszeniu"** | Stoi w filarze o nazwie „**Mierzalny Efekt**", a nie ma za sobą pomiaru; kwantyfikator „na każdym" to absolut. Bezpośredni krewny usuniętego „fałszywego 100% ATS" | `PricingView.tsx:519–522` |
| **„Oszczędność ~1h ręcznego przepisywania"** | Estymata bez źródła | `PricingView.tsx:326` |
| **„Rekruterzy przeglądają CV średnio przez 6–8 sekund"** | Treść edukacyjna w bazie porad, ale twarda liczba bez źródła | `HomeView.tsx:103` |
| **„Mediana Rynkowa"** | To mediana **10 wewnętrznych silników CVelocity** — żaden rynek nie brał udziału. Nazwa tworzy fałszywy benchmark w centralnym punkcie ekranu | `AtsLabView.tsx:142`; `atsSimulator.ts:944–947` |
| **Prawdopodobieństwo przejścia przez nazwane systemy: Taleo/Workday, Greenhouse/Lever, eRecruiter/Traffit** | Procenty liczone arbitralnymi wagami własnej heurystyki, prezentowane jako wiedza o komercyjnych produktach, których nikt tu nie mierzył (dwa niezależne miejsca) | `AtsLabView.tsx:341–352`; `atsScorer.ts:393–483`; `AtsSimulatorView.tsx:28–33` |
| **Fallbacki `?? 75 / ?? 80 / ?? 85 / ?? 70`** | Gdy warstwy analizy nie istnieją, użytkownik widzi cztery wymyślone procenty jako wynik „algebry scoringowej ATS" — najdosłowniejsze złamanie reguły 1 w całym kopiu | `GapAnalysis.tsx:15–18,33` |
| **„+X% ATS" przy każdej sugestii** oraz „Potencjał z MasterVault: Y%" | Estymata podana z precyzją do procenta, hipotetyczny wynik obok realnego bez oznaczenia jako szacunek | `JDKeywordMapper.tsx:164,289` |
| **„{score}% Pewności Mostu"** | Heurystyka jako twardy procent, bez objaśnienia skali | `SkillBridgeCard.tsx:69` |
| **„+50 XP do dyscypliny"** | XP nigdzie nie jest przyznawane: `toggleChallengeCompletion` nie woła `grantXp`, `XP_EVENTS` nie zna kokpitu | `InterviewCockpitView.tsx:189–190`; `gamification.ts:32–37` |
| **„Czas wdrożenia: ~{learningCurveDays \|\| 5} dni"** | Fallback `|| 5` wymyśla wartość sprzeczną z domyślną silnika (**7**) — UI może pokazać liczbę, której silnik nigdy nie policzył | `InterviewCockpitView.tsx:491`; `skillBridgeEngine.ts:223` |
| **Znaczniki faz timera 18s/32s/68s/90s** | Hardcoded, mimo że cel trwania jest propem — dla historii 60 s lub 120 s oś pokazuje fałszywe punkty fazowe | `PracticeTimer.tsx:106–110` |

### 2.3. Wymyślone dane w stanach startowych (reguła 1)

Ta klasa błędu była już dwa razy usuwana z repo (tracker z czterema fałszywymi
aplikacjami, demo-dane formularza). Obecny stan:

| Miejsce | Co fabrykuje | Dowód |
|---|---|---|
| HUD teleprompter | Gdy brak `summary`, panel generuje **syntetyczny pitch** („…łączący X, Y, Z z orientacją na wyniki") i wystawia go jako „Kluczowy Elevator Pitch" podczas prawdziwej rozmowy; forma „łączący" wyłącznie męska | `ReactFloatingPanel.tsx:275–277` |
| Skill Bridge Matrix | Modal otwiera się z lukami `['Kafka','AWS','Kubernetes']`, których nikt nie wpisał, i od razu generuje dla nich „mosty" | `SkillBridgeMatrixModal.tsx:48–52` |
| Debrief rozmowy | Pole „Co poszło najlepiej?" wstępnie wypełnione („dyskusja o architekturze systemu…"), ocena preselekcjonowana na **4/5**; `salaryNotes` zbierane do archiwum bez pola w UI (martwa ścieżka zapisu) | `PostCallDebriefView.tsx:41–45,78,50–52` |
| Interview Loop Manager | Sesja startowa „Firma Docelowa" zapisywana od razu do magazynu; mosty z listy `['Kafka','AWS','Kubernetes','GraphQL']`; chip liczy 4 mosty, lista pokazuje 2 (`slice(0,2)`); sam komponent nie ma żadnego konsumenta (reguła 5) | `InterviewLoopManager.tsx:73–81,120,273–278` |
| STAR Slot 2 w HUD | Fallback „Zweryfikowane wdrożenia" — tekst udający twardy wynik użytkownika, gdy metryka nie istnieje | `STARStoryView.tsx:185` |
| Matryca języków | Nowy język dostaje fabrykowany kontekst „Komunikacja biznesowa i techniczna", który wchodzi do vaultu i do CV | `SkillsMatrix.tsx:135` |
| Edukacja | Nowy wpis dostaje prefabrykowany stopień **„Inżynier"** — fałszywy tytuł może trafić do dokumentu | `EducationSection.tsx:25` |
| Kokpit Rozmowy | Ukryty startowy input `'AWS'`; element checklisty z cudzą metryką „(+40% TPS, 0 awarii)" | `InterviewCockpitView.tsx:64,76` |
| Doradca „Gemini" | Gotowiec każe użytkownikowi wpisać do CV „redukując czas odpowiedzi endpointów o 42% dla 150k użytkowników" — namawianie do fabrykowania metryk | `GeminiAdvisorModal.tsx:80` |

Kontrast: `JobFeasibilityAdvisor.tsx:280–283` pisze wprost „Bez niej nie
zgadujemy — wolimy pustkę niż liczbę wziętą z powietrza", a `JDInputModes.tsx`
oznacza przykład jako „[PRZYKŁAD — fikcyjne ogłoszenie]". To jest standard,
którego reszta ma dotrzymać.

### 2.4. „AI", którego nie ma

| Miejsce | Obietnica | Rzeczywistość |
|---|---|---|
| `GeminiAdvisorModal.tsx` | Tytuł „Okienko Doradcy Kariery (Gemini Advisor)" (:131), powitanie „Jestem Twoim Doradcą Kariery i Ekspertem ds. Systemów ATS…" (:38), gwarancja „szablon jednokolumnowy daje **100% gwarancji** poprawnego odczytania" (:82) | Odpowiedzi to `setTimeout(700)` i cztery gałęzie po `includes()` (:75–96). Serwerowy Gemini istnieje (`geminiClient.ts`), ale **ten modal go nie woła** |
| `DrillModeModal.tsx:371–403` | „Trening odpowiedzi w 60s • Ewaluacja STAR & Metryk" (:166) + opcjonalne nagrywanie głosu | Callback nagrania jest pusty (:400), ocena liczy wyłącznie `responseText` (:115) — audio nie wpływa na scorecard ani historię. Funkcja pozorna |
| `STARStoryCard.tsx:170` | „Sugerowane tagi **(NLP)**:" | Sugestie generuje regułowy `suggestTagsForSTARStory`; żaden model językowy nie uczestniczy |
| `JobMatcher.tsx:234` | „silnik CVELOCITY **zweryfikuje Twoje CV przeciwko algorytmom ATS** i wygeneruje **spersonalizowane dokumenty** aplikacyjne" | Weryfikacja idzie przez własną symulację; `optimizedText === originalText` (:87–96), a summary to szablon „Dopasowany profil inżynierski pod stanowisko X w firmie Y" (:86). Nic nie jest personalizowane |
| `CoverLetterView.tsx:79` | „Styl #X/8" | Silnik traktuje numer wyłącznie jako seed — gwarancji ośmiu odrębnych stylów nigdzie nie ma |

Nazwa „AI Gap-Fixer" sama w sobie też jest umową bez konsumenta: endpointów AI
jest dokładnie dwa (`/api/parse-jd`, `/api/generate-cheat-sheet`), a najbliższy
odpowiednik Gap-Fixera (`optimizeDeltaPhrase`) czeka bez trasy HTTP
(`ai.service.ts:14–17`). Użytkownik nie może dziś wykonać żadnej „operacji
Gap-Fixera", za którą cennik mu oferuje limit 5/mc.

### 2.5. Bezpieczeństwo, prywatność, trwałość danych

| Twierdzenie | Problem | Dowód |
|---|---|---|
| „Profil został zsynchronizowany i zabezpieczony w chmurze." po kliknięciu „Zapisz w Chmurze" / „Zakończ & Zapisz" | Handler to wyłącznie `showNotification(...)` — **zero sieci, zero zapisu**. Obietnica trwałości i „zabezpieczenia" jest kłamstwem materialnym w głównym przepływie edytora vaultu | `MasterVaultEditor.tsx:140–142,205,335` |
| Badge „spójność potwierdzona" | Pięć miejsc przekazuje `isConsistent={true}` na stałe — zielony lock zawsze, niezależnie od stanu danych (tryb ostrzegawczy badge'a nigdy nie zajdzie) | `MasterVaultEditor.tsx:167`; `DocumentRenderer.tsx:282,296,320,361` |
| „Twoje dotychczasowe CV zostanie automatycznie zachowane!" | Brak widocznej ścieżki scalenia local→cloud po rejestracji; wykrzyknik wzmacnia obietnicę bez pokrycia | `StripeCheckoutModal.tsx:161` |
| „Link działa przez godzinę" (reset hasła) | TTL linka ustawia Supabase, nie kod — zmiana w dashboardzie sprawia, że tekst kłamie | `AuthModal.tsx:432` |
| Chip „SSL 256-BIT" | Konkretny parametr kryptograficzny jako ozdobnik; jedyne TLS tej aplikacji to redirect do Stripe, poza jej kontrolą | `PricingView.tsx:242` |
| Meta „**Bezpieczne**, inteligentne zarządzanie CV" (title/description/OG/Twitter) | `SECURITY.md` i polityka prywatności wprost przyznają zapis plaintext w localStorage; „bezpieczne" w meta to obietnica, którą dokumentacja bezpieczeństwa ogranicza | `index.html:6,7,10,14–15`; `SECURITY.md`; `docs/polityka-prywatnosci.md` |
| „ATS LOKALNIE" (TrustRow) | Nieostra wobec funkcji serwerowych (doradca Gemini, parse-jd) — użytkownik nie dowie się z chipa, co dokładnie działa lokalnie | `HomeView.tsx:601` |
| `index.html:8,12` | `<link rel="canonical" href="/">` i `og:url="/"` — adresy względne; canonical jest bezużyteczny (powinien być absolutny) | `index.html:8,12` |

Do chwały: sekcja prywatności HomeView (`HomeView.tsx:166–192,577–622`) jest
świadomie zbudowana z twierdzeń weryfikowalnych i sama wymienia, czego **nie**
chroni — to właściwy ton, którym należy zastąpić powyższe.

### 2.6. Absolutyzmy „100%"/„gwarancja" przy treści edytowalnej lub fabrykowanej

`100% Vault Verified` (`EditableTextWithTimer.tsx:150`) — chip stoi mimo że
skrypt pitcha jest dowolnie edytowalny; `100% Vault` i `MasterVault Verified`
(`ReactFloatingPanel.tsx:177,304`) — towarzyszą także fabrykowanemu pitchowi
(§2.3); `100% zweryfikowane` i „Gwarancja Single Source of Truth"
(`ConsistencyGuardView.tsx:132,291`) oraz statyczne „Ciągłość bez rozbieżności
>0.5r" (:300), które wyświetla się nawet gdy symulacja właśnie wykazała
rozbieżność; „Zero-Hallucination Engine" (`LandingView.tsx:370`) jako badge
hero — po §2.3 i §2.4 to twierdzenie obecnie falsyfikuje własny produkt;
„Wygenerowano w 100% z faktów i metryk MasterVault"
(`InterviewCockpitView.tsx:397`); „w 100% lokalnie/bezpłatne"
(`CoverLetterView.tsx:84`, `CVParserModal.tsx:275` — to drugie pokryte,
ale absolut znów przyciąga wyjątki).

---

## 3. P1 — obietnice funkcji bez implementacji

### 3.1. Martwe skróty klawiszowe (interfejs dla funkcji, której nie ma)

| Reklamowany skrót | Miejsce | Stan handlera |
|---|---|---|
| `(Ctrl+B)` | `SkillBridgeMatrixModal.tsx:95`, `JDKeywordMapper.tsx:452` | Żaden `keydown` w repo nie obsługuje „b" |
| `Cmd+D / Ctrl+D` | `DrillModeModal.tsx:162` | j.w. |
| `Ctrl+P` | `ElevatorPitchModal.tsx:55` | j.w.; ironia: `InterviewPanel.tsx` chwali się usunięciem przechwytywania Ctrl+P, a skrót druku przeglądarki by zderzył się z wydrukiem CV |
| `Cmd+K` w tooltipie | `Topbar.tsx:118` vs wyświetlane `Ctrl+K` (:123) vs stopka palety „Cmd+K / Ctrl+K" (`CommandPalette.tsx:395`) | Trzy zapisy jednego faktu; na Windows tooltip obiecuje skrót, który nie zadziała |

### 3.2. Pozostałe obietnice bez konsumenta

- Empty state Trackera kieruje: „zaimportuj z modułu **JobMatcher**" — akcja
  importu nie istnieje w tym widoku, a nazwa „JobMatcher" nie występuje w
  nawigacji (zakładka nazywa się „Aplikuj") · `TrackerTable.tsx:40`;
  `navigation.ts:56`.
- „Uruchom przewodnik" tylko nawiguje na zakładkę Profil — żaden przewodnik
  nie startuje · `WelcomeWizard.tsx:94`.
- Hinty szablonów obiecują „Bezpieczny dla systemów ATS", „Poważna typografia",
  „maksimum treści" — realnie wybór szablonu zmienia **tylko kolor akcentu**
  (`DocumentRenderer.tsx:35–40` vs `:219–235,:277–280`).
- „Notion-Style Toolbar" w WordBuilderze: każdy przycisk B/I/H/lista dokleja na
  koniec dokumentu dosłowne `**Wpisz tekst...**`, nie formatuje zaznaczenia ·
  `CVWordBuilder.tsx:55–57`.
- „Wpływają na wstępną selekcję parsera" o liście dealbreakerów (lista pochodzi
  z symulatora), a gratulacje mówią o wymaganiach „twardych **i formalnych**",
  choć liczone są tylko `missingHardSkills` · `DealbreakerList.tsx:33,41`.
- „4. O To **Na Pewno** Zapytają" — pewność dla heurystycznej predykcji ·
  `InterviewCheatSheetView.tsx:380`.
- `paymentsAvailable` mierzy konfigurację **Supabase**, a komunikat mówi o
  płatnościach (klucz Stripe leży po stronie serwera) ·
  `StripeCheckoutModal.tsx:79,203`; `clientEnv.ts:45`.
- „Live Recruitment CRM… wskaźnik skuteczności w czasie rzeczywistym" — dane
  lokalne; „Response Rate" liczy proxy `(rozmowy+oferty)/wszystkie`, nie
  odpowiedzi rekruterów · `ApplicationTracker.tsx:140–141,77,195–199`.
- Wycieki identyfikatorów wewnętrznych do UI: `(interview-loop-manager-v1)`
  `InterviewLoopModal.tsx:120`, `(elevator-pitch-gen-v1)`
  `ElevatorPitchModal.tsx:52`, `(live-hud-v1)` i `(onZoomStart)`
  `ReactFloatingPanel.tsx:174,188`, `(mock-drill-mode-v1)`
  `DrillModeModal.tsx:159`, `(skill-bridge-matrix-v1)`
  `SkillBridgeMatrixModal.tsx:92`, surowe enumy `DATE_MISMATCH` /
  `SKILL_CONTRADICTION` (`ConsistencyAlertBanner.tsx:45`), `note.stage`
  INTRO/TECHNICAL… (`LiveTrackerView.tsx:201`), poziomy `ENTRY`/`PIVOT`
  (`ProfilerSection.tsx:93`), `v2.0` w logo i hero
  (`CVelocityLogo.tsx:60`, `LandingView.tsx:370`).
- Defekty treści wynikające z logiki: `meta.label.split(' ')[0]` produkuje trzy
  identyczne kafelki „Pytania" na osi etapów (`LiveTrackerView.tsx:97` vs
  `interviewLoopEngine.ts:57–80`); „Nowe Elementy +N" liczy tylko
  skills+historię+edukację, choć diff obejmuje też projekty/certyfikaty/języki
  (`DiffView.tsx:73` vs `CVParserModal.tsx:164–191`);
  `planStatus='trialing'` wyświetli „Plan Podstawowy" (`Sidebar.tsx:43,161`);
  pasek postępu parsowania teatralizuje natychmiastową pracę sztucznymi
  `setTimeout` (20→50→80→100%) · `CVParserModal.tsx:79–112`.

### 3.3. Sprzeczności między powierzchniami ofertowymi (Landing ↔ Cennik)

Landing (`LandingView.tsx`) renderuje się nowym użytkownikom (`HomeView.tsx:321`)
i jest pod tym względem najnowszą powierzchnią marketingową:

| Temat | Landing | Cennik | Kod |
|---|---|---|---|
| Pipeline aplikacji | Funkcja **Pro**: „Pełny pipeline aplikacji" (:698) | Funkcja **Free**: „Pipeline zgłoszeń (CRM)" (:172) | Tracker nie ma gating-u |
| Kokpit Rozmowy | Funkcja **Pro**: „Kokpit Rozmowy i przygotowanie do negocjacji" (:697) | Niewspomniany w żadnym planie | Nic nie gate'uje kokpitu |
| „Przepisanie doświadczenia metodą STAR" | Pro (:696) | Brak takiej pozycji (Pro sprzedaje AI Gap-Fixer) | — |
| Nazwy szablonów free | „Szablon **Nowoczesny i Minimalny**" (:661) | „Modern/Minimal" (:279,401) | `TemplateId = modern \| minimal \| executive \| creative` |
| Limit importu Free | brak wzmianki | „1 plik / mc" | `FREE_IMPORTS = 10` |

Dodatkowo logika CTA karty Free ma zamienione stany: użytkownik Free widzi
„Twój obecny plan" na klikalnej karcie, Pro widzi „Plan Podstawowy" na
zablokowanej · `PricingView.tsx:182–184` vs wbudowany fallback
`PricingCard.tsx:84`.

---

## 4. Niespójności terminologiczne (reguła 3)

Jeden fakt — wiele nazw. Każdy wiersz to kandydat do jednego słownika terminów.

| Pojęcie | Warianty (plik:linia) |
|---|---|
| **Funkcja ATS** | „audytor ATS" `PricingView.tsx:72` · „Symulator ATS" `:170`, `JobMatcher.tsx:234` · „Audyt ATS i analiza luk" `PricingView.tsx:272` · „Ocena ATS" `HomeView.tsx:174` · „Laboratorium Audytu ATS 360°" `Topbar.tsx:42` · „Analiza ATS" `LandingView.tsx:429` · „Rentgen ATS" `LandingView.tsx:56` |
| **Magazyn danych** | „MasterVault" · „Master Vault" · „Master Vaultu" (`InterviewCheatSheetView.tsx:230`) · „Vault" · „Skarbiec" (`CommandPalette.tsx:126,242` — tylko tam) · „profil" (`HomeView.tsx:364,399,405` w jednej siatce kafli obok „Vault") |
| **Plan użytkownika** | „Pro"/„Free" `Topbar.tsx:166` · „CVELOCITY Pro/Free" `:222` · „Plan Pro • Active"/„Plan Podstawowy" `Sidebar.tsx:161` · „Twój obecny plan" `PricingCard.tsx:84` · „Start" `LandingView.tsx:653` |
| **Trial 30 dni** | 6 wariantów: „Wypróbuj Pro przez 30 dni", „30 dni darmowego okresu próbnego", „Trial 30 dni", „Aktywuj trial", „Okres próbny: 30 dni za 0 zł", „Rozpocznij 30 dni za darmo" |
| **Doradca AI** | „Doradca AI" `AdvisorButton.tsx:17` · „Zapytaj Doradcę AI" `Sidebar.tsx:134` · „Okienko Doradcy AI (Gemini Advisor)" `CommandPalette.tsx:161` · „Okienko Doradcy Kariery (Gemini Advisor)" `GeminiAdvisorModal.tsx:131` |
| **Most kompetencyjny** | „Skill Bridging" `InterviewCockpitView.tsx:130,422` · „most transferowy" `:425` · „Generuj Most" `:472` · „Most Kompetencyjny" `JDKeywordMapper.tsx:452` · „most kompetencyjny" `SkillBridgeMatrixModal.tsx:189` · „Most (Bridge)" `SkillBridgeCard.tsx:56` |
| **Tryb treningu rozmowy** | „Mock Drill Mode" · „DrillMode" `DrillScorecardView.tsx:39` · „drill/drillu" wewnątrz jednego modala · „Live Tracker" `PreCallChecklistView.tsx:144` · „Zasobnik Rozmowy" `InterviewPanel.tsx:133` · „Interview Loop Manager" |
| **Follow-up** | „Follow-up" `PostCallDebriefView.tsx:164` · „Follow-Up Email" `:182` · „mail z podziękowaniem (Follow-Up)" `LiveTrackerView.tsx:227` |
| **Okno tokenów designu** | „Podgląd Tokenów Design System" `Topbar.tsx:146` · „Paletę Tokenów Design System" `CommandPalette.tsx:175` · „Design Tokens Living Architecture" `DesignTokensShowcaseModal.tsx:60` · „Zamknij Podgląd Tokenów" `:274` |
| **Ekran cennika** | „Cennik i pakiety" `Topbar.tsx:41,241` · „Cennik & Pakiety Pro" `CommandPalette.tsx:154` · „Przejrzysty Cennik & Monetyzacja Win-Win" `PricingView.tsx:71` |
| **Szablony bazowe** | „Modern/Minimal" `PricingView.tsx:279,401` · „Modern & Minimal" `:411` · „Nowoczesny i Minimalny" `LandingView.tsx:661` · analogicznie Executive/Creative przez ukośnik vs ampersand |
| **CRM / pipeline** | „Pipeline zgłoszeń (CRM)" `PricingView.tsx:172` · „Pro Insights CRM" `:296,440` · „CRM Rejestr" `HomeView.tsx:263` · „Live Recruitment CRM" `ApplicationTracker.tsx:141` · „rejestr aplikacji" `PricingView.tsx:450` |
| **Import CV** | „Instant-Import" `PricingView.tsx` · „Wczytaj istniejące CV" `HomeView.tsx:251` · „Universal Ingestion" `CVParserModal.tsx:209` · „Zaimportuj plik" |
| **Krążek wyniku** | dwa komponenty `ScoreRing` (`src/components/ui/ScoreRing.tsx` i `src/features/matcher/ScoreRing.tsx`) z **różnymi progami** barw (60 vs 65) — dwie geometrie i dwie semantyki tego samego sygnału |
| **Marka** | „CVELOCITY" (wersaliki: `JobMatcher.tsx:234`, `Topbar.tsx:222`, `Shell.tsx:94`…) vs „CVelocity" (`AtsLabView.tsx:120,439`, `WelcomeWizard.tsx:56,83`, `LandingView.tsx:600`) vs „CVelocity" w meta `index.html:6–15` |
| **Katalog uprawnień** | duplikat w `SkillsMatrix.tsx:51–60` z etykietami rozjazdanymi względem `data/licenses.ts` („UDT (Wózki)" vs „UDT (Wózki Widłowe)", „SEP (do 1kV)" vs „SEP (Grupa 1 do 1kV)") i pozycją `first_aid` **spoza katalogu** — silnik knockoutów nigdy jej nie dopasuje; ta sama klasa błędu co SeedImporter |
| **Poziomy seniority** | `PreferencesSection.tsx:21–26` vs `ProfilerSection.tsx:26–31` (SENIOR: „Senior / Lead" vs „Senior"; PIVOT: „Przebranżowienie" vs „Lead / Pivot"); „0-2 lata" łącznikiem vs „0–2 lata" półpauzą |
| **Slot 3 HUD** | hardkod w trzech plikach: `STARStoryCard.tsx:59`, `StarTagCloud.tsx:73`, `ReactFloatingPanel.tsx:254` |

---

## 5. Język polski — katalog błędów

### 5.1. Odmiana liczebników (widoczne każdemu użytkownikowi z małym stanem)

- „**1 pozycji**" / „2 pozycji" — `${historyCount} pozycji` · `HomeView.tsx:247`
- „**+ 1 certyfikatów**" · `HomeView.tsx:393`
- „**1 rozbieżności**" · `ConsistencyLockBadge.tsx:83`
- „**{n} lat**" bez odmiany („1 lat", „22 lat") · `ConsistencyGuardView.tsx:298`
- „**2.0 dnia roboczego**" (liczebnik ułamkowy + dopełniacz) ·
  `JobFeasibilityAdvisor.tsx:232`
- „**Za 1 dni**" · `InterviewPanel.tsx:64`

### 5.2. Kropka dziesiętna z `toFixed` (polska konwencja: przecinek)

`JobFeasibilityAdvisor.tsx:231–232,244,248,267` („31.25 zł/h") ·
`AtsLabView.tsx:293` („1.5x") · `GapAnalysis.tsx:41` („3.0x") ·
`ConsistencyAlertBanner.tsx:58,65,71` („2.50 lat", „> 0.5 roku").
Rekomendacja: jeden helper formatujący liczby dla `pl-PL`, zamiast poprawiania
pojedynczych wystąpień.

### 5.3. Title Case (anglicyzm typograficzny, masowy i nieregularny)

Obok naturalnych zdań funkcjonują: „Menu Główne" (`MobileSidebar.tsx:16`),
„Aktywny Etap" (`LiveTrackerView.tsx:111`), „Wynik Jakości"
(`DrillScorecardView.tsx:51`), „Gotowość Przed Rozmową"
(`PreCallChecklistView.tsx:75`), „Chmura Tagów Kompetencyjnych"
(`StarTagCloud.tsx:42`), „Rozpocznij Mowę" (`EditableTextWithTimer.tsx:186`),
„Kopiuj Mail" (`PostCallDebriefView.tsx:203`), „O To Na Pewno Zapytają"
(`InterviewCheatSheetView.tsx:380`), „6 Zasad Tworzenia CV…"
(`AtsLabView.tsx:620`). Wewnętrzna niespójność: „Przełącz Motyw"
(`CommandPalette.tsx:182`) vs „Przełącz motyw…" (`ThemeToggle.tsx:26`).

### 5.4. Rodzaj męski jako uniwersalny

„Podaj adres, na który **zakładałeś** konto" (`AuthModal.tsx:407`) ·
„**łączący**…" w fabrykowanym pitche (`ReactFloatingPanel.tsx:277`) ·
„**Nie wykonałeś** jeszcze żadnego drillu" (`DrillModeModal.tsx:277`) ·
„Tak, **zaaplikowałem**!" / „**Miałem** problem"
(`ApplicationFeedbackModal.tsx:199,206`) · „**Gotowy**" ×2
(`CommuteMap.tsx:79`, `ProfilerSection.tsx:86`) · „O co **chciałbyś** zapytać?"
(`GeminiAdvisorModal.tsx:38`).

### 5.5. Rekcja i składnia

„Uczuiwa Ocena Predyspozycjs **na** to Stanowisko" → *do stanowiska*
(`AtsLabView.tsx:401`; uwaga: w pliku jest też literówka „Uczuiwa") ·
„Sugerowana Odpowiedź **na Rozmowie** Rekrutacyjnej" → *na rozmowę*
(`SkillBridgeCard.tsx:88`) · „Sprawdź **obronę** dla brakującej umiejętności"
(`SkillBridgeMatrixModal.tsx:116`) · „**wygeneruj mail**" → *maila/e-maila*
(`LiveTrackerView.tsx:227`) · „Wszystko **co** w planie Free" → przecinek przed
„co" (`PricingView.tsx:201`) · „z zerowym użyciem klas zabronionych"
(`DesignTokensShowcaseModal.tsx:69`).

### 5.6. Anglojęzyczne przeploty poza nazwami własnymi

Najbardziej rażące: chip `100% Vault Verified` (`EditableTextWithTimer.tsx:150`),
`Plan Pro • Active` (`Sidebar.tsx:161`), `Confidence: High`
(`LandingView.tsx:523`), kolumna kanban „Screening" obok polskich
(`LandingView.tsx:294`), „claimów" (`ConsistencyLockBadge.tsx:40`), „bridge'e"
(`InterviewCockpitView.tsx:175`), „stuffing?" (`AtsLabView.tsx:288`),
„Tokens w profilu" (`AtsLabView.tsx:254`), „(Actionable Tips)"
(`AtsSimulatorView.tsx:111`), „sub-skille" (`InterviewLoopModal.tsx:127`),
„(Dense)" (`LicenseGrid.tsx:81`), angielskie nazwy kolorów jako etykiety
szablonów (`DocumentRenderer.tsx:54–61`), `ATS Score` jako domyślna etykieta
(`matcher/ScoreRing.tsx:16`), „1-Liner" obok „30 Sekund"
(`EditableTextWithTimer.tsx:121`).

### 5.7. Typografia i interpunkcja

Dywiz tam, gdzie półpauza (i odwrotnie), w obrębie pojedynczych list:
„6–8 sekund" (`HomeView.tsx:103`) vs „2-3 projekty" (:111), „10-15%" (:126),
„0-2 lata" vs „0–2 lata" (seniority) · separator checklisty raz „–" raz „—"
(`PricingView.tsx:552,564`) · skrót „mc" obok pełnego „miesiąc"
(`PricingView.tsx:173–174` vs `:192`) · trzy kropki „..." zamiast „…" · emoji
rozrzucone nieregularnie po przyciskach (📝💾🎙️🎯⚡📖✔️❌🔒⚠️) podczas gdy
większość przycisków ich nie ma · „Audio" wielką literą
(`DrillAudioRecorder.tsx:107`).

### 5.8. Duplikaty komunikatów (reguła 3)

„Konta w chmurze nie są tu skonfigurowane." — pięć identycznych literałów
(`AuthContext.tsx:181–250`) · `GoogleIcon` zdublowany 1:1
(`StripeCheckoutModal.tsx:46–65`, `AuthModal.tsx:47–64`) · obietnica
„anulowania w 2 kliknięciach" w trzech plikach · cztery warianty CTA Google
(„Kontynuuj z Google" / „Zaloguj się przez Google" / „Zarejestruj się przez
Google" / „Zaloguj się przez Google i kontynuuj").

---

## 6. Treść edukacyjna (Baza Wiedzy) — uwagi osobne

Porady w `HomeView.tsx:50–152` są wartościowe i same krytykują niemierzalne
metryki („HTML 90%, CSS 75% – są niemierzalne", :106) — ale obok stoi
„Rekruterzy przeglądają CV średnio przez 6–8 sekund" (:103), czyli dokładnie
ten typ liczby, którego porada ostrzega. Do tego „przygotowane przez ekspertów
rekrutacji technicznej" (:485–486) — treści są zaszyte w tablicy, bez jakiejkolwiek
sygnatury autora; deklaracja ekspertyzy bez pokrycia. Daty porad („15.08.2026")
są zaszyte na stałe i z czasem skłamią (treść „aktualna w 2026" zestarzeje się
bez redakcji).

---

## 7. Miejsca wzorcowe — chronić i powielać

| Miejsce | Co robi dobrze |
|---|---|
| `LandingView.tsx:6–25` | Komentarz nagłówkowy wprost zakazuje opinii klientów, logotypów i procentów; makiety podpisane „przykład" i „makiety poglądowe — dane przykładowe"; mapa ciepła opisana jako model, nie eye-tracking |
| `JobFeasibilityAdvisor.tsx` | „Liczymy stawkę za godzinę Twojego życia… żadna z tych liczb nigdzie nie wychodzi"; pusty stan zamiast zgadywania (:280–283); każda wycena oznaczona „(szacunek)"/„założenia kalkulatora" |
| `QuickAtsCheck.tsx` | Obietnica zawężona do mierzalnego („spełniasz X z Y wymogów oferty"), komunikaty o lokalności przy każdym kroku, komentarz :338–342 deklaruje „nic nie trafia do profilu automatycznie" |
| `AuthModal.tsx` | Hint hasła 1:1 z `passwordPolicy.ts` (12 znaków, mała+wielka+cyfra), realna integracja HIBP z uczciwym fallbackiem, komunikat resetu nie ujawniający istnienia konta, Alert o nieodwracalności profilu lokalnego |
| `SpecializationPicker.tsx:127–128` | „Nic nie zostanie dodane bez Twojego kliknięcia" — i kod tego pilnuje |
| `CvQuestionsCard.tsx:146` | „trafi do CV dokładnie tak, jak to napiszesz" — obietnica zgodna z `previewAnswer/applyAnswer` |
| `JDInputModes.tsx:138–143` | Uczciwe wyliczenie portali blokujących pobieranie i deklaracja „Nie obchodzimy tych zabezpieczeń" |
| `NextActionCard.tsx:100`, `SkillBridgeCard.tsx:120` | „Szacowany czas" konsekwentnie oznaczony jako szacunek |
| `DropZone.tsx`, `RichTextCvEditor.tsx`, `StatusSelect.tsx`, `AdvisorModalHost.tsx` | Copy minimalne, zgodne z zachowaniem, poprawna polszczyzna |
| Sekcja prywatności `HomeView.tsx:166–192,603–622` | Twierdzenia weryfikowalne + wprost lista „czego jeszcze nie chronimy" |

---

## 8. Rekomendowana kolejność napraw

**Fala 1 — P0 (zanim jakiekolwiek copy poleci do obcej osoby):**

1. Monetyzacja: doprowadzić do jednej prawdy — albo realne SKU/trial/VAT
   w konfiguracji, albo jawny komunikat „płatności w przygotowaniu" na całym
   widoku cennika (wzorcowy tekst już istnieje: `StripeCheckoutModal.tsx:203`).
   Usunąć pakiet 79 zł, naprawić „Kup wybrany szablon", podpiąć Topbar pod
   realny `/api/billing/portal-session` albo ukryć oba przyciski menu.
   Jedno źródło prawdy dla limitów (1 vs 10 vs dzienny) — decyzja produktowa,
   potem jedna stała.
2. Usunąć lub przepisać liczby z §2.2: „92%" i towarzystwo — według ducha
   reguły 1 (trasa statystyk zwraca `501`, nie zmyśloną liczbę); „Mediana
   Rynkowa" → np. „mediana naszych 10 filtrów"; prawdopodobieństwa dla
   nazwanych systemów → opisać jako niewalidowany model albo usunąć; fallbacki
   `?? 75/80/85/70` → pusty stan.
3. Fabrykane starty z §2.3 → puste stany (osiem miejsc, każde mechaniczne).
4. Nazwać rzeczy po imieniu w §2.4: doradcę heurystycznego nie nazywać
   „Gemini Advisor"; audio w Drille albo ocenia, albo znika z obietnicy;
   „NLP" usunąć; copy JobMatchera o „algorytmach ATS" i „personalizacji"
   zawęzić do tego, co robi symulacja.
5. Fałszywa chmura w `MasterVaultEditor` i hardcoded `isConsistent={true}`
   (pięć miejsc) — reguła 2 dosłownie.

**Fala 2 — P1:** martwe skróty klawiszowe (dodać handlery albo usunąć chipy),
sprzeczności Landing↔Cennik (§3.3) po decyzji, co jest naprawdę darmowe,
wycieki identyfikatorów `-v1` i enumów, hinty DocumentRenderer, empty state
Trackera, „Na pewno Zapytają", absolutyzmy „100%"/„Gwarancja" (§2.6).

**Fala 3 — P2:** jeden słownik terminów produktowych (funkcja ATS, magazyn,
plany, trial — jedna nazwa na fakt, reguła 3), helper pluralizacji i helper
formatu liczb `pl-PL`, przegląd Title Case, ujednolicenie marki
(CVELOCITY/CVelocity), typografia (pauzy, „mc", emoji), duplikaty komunikatów
do stałych.

**Zasada poprawek:** każda naprawa z fal 1–2 powinna przechodzić test na
monterze/spawaczu/magazynierze (reguła 8) — copy typu „silnik", „algebra
scoringowa", „claimy" mówi do informatyka, a produktem są też zawody fizyczne.

---

*Raport powstał metodą pełnego przejrzenia tekstu UI z weryfikacją każdego
twierdzenia w kodzie. Pełne inwentaryzacje per plik prowadzone były roboczo;
tu trafiły tylko ustalenia z dowodami. Naprawy — osobnymi PR-ami per obszar
(jeden plik = jeden otwarty PR, AGENTS.md).*
