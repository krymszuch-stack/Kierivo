# Spostrzeżenia i notatki

> Notatnik roboczy projektu. Stan produktu i reguły rozstrzygają kod, testy,
> `AGENTS.md` oraz protokoły w `docs/historia/`. Stare decyzje pozostają w
> historii Gita, ale nie są utrzymywane tutaj jako równoległa dokumentacja.

---

## 🆕 Nowe

- Publiczne wydanie testowe ma nazwę **Kierivo Public Pre-Beta** i kod
  **`PB-2026.09`**. Kod wersji nie oznacza procentu ukończenia produktu; służy
  tylko do jednoznacznego rozpoznania przedpremierowego builda pokazywanego
  testerom i w materiałach zewnętrznych.
- Publiczna witryna ma stale widoczną wstążkę: `Public Pre-Beta · PB-2026.09 ·
  otwarte testy · premiera wkrótce · 0 zł`.
- Nie dodajemy obowiązkowego watermarku do eksportowanego CV. Oznaczenie etapu
  produktu ma być widoczne w aplikacji, ale gotowy dokument kandydata pozostaje
  profesjonalny i bez stempla wersji testowej.
- Doradca regułowy został przeniesiony z samego dołu sidebara do grupy głównych
  narzędzi obok Porad i Audytu, bo w realnym teście był zbyt łatwy do przeoczenia.
- Suita podpakietu `semantic-work-graph` potrafi zakończyć proces na Node 22 / Windows
  natywnym błędem `better-sqlite3` podczas teardownu. Testy jednostkowe kończą
  właściwe asercje; osobno do sprawdzenia pozostaje kompatybilność ABI / sposób
  zamykania procesu.

- W starszym eksporcie deweloperskim krążył publikowalny testowy klucz Stripe.
  Nie znajduje się w historii tego repo. Jeżeli dawny projekt Stripe nadal jest
  używany, rotacja klucza publishable pozostaje rozsądną ostrożnością.

- Wynik kanoniczny `scoreCanonicalAts` (`src/lib/canonicalAts.ts`, F6) został
  podpięty pod UI — `AtsLabView`, `JobMatcher` oraz `AtsSimulatorView` prezentują
  wynik kanoniczny jako główny rozstrzygający wskaźnik dopasowania wraz z 4 filarami
  wagowymi (umiejętności 40%, staż 25%, struktura 20%, formalia 15%) oraz stanami
  pustymi (INSUFFICIENT_CV, INSUFFICIENT_JD, NO_REQUIREMENTS_DETECTED). Symulator
  wielosilnikowy i telemetria pozostają jako moduły diagnostyczne w laboratorium.

---

## Stan Public Pre-Beta · 2026-09-11

- **Cena: 0 zł.** Zakupy, plan Pro, trial, pojedyncze szablony i Karnet
  Aplikacyjny nie są obecnie sprzedawane.
- Checkout jest blokowany także po stronie serwera. Sama obecność konfiguracji
  Stripe nie uruchamia sprzedaży.
- Podstawowy przepływ testera nie wymaga płatności. Po wykorzystaniu limitu
  importu pliku tester może wkleić tekst CV i kontynuować.
- Limity operacji AI są nadal egzekwowane po stronie serwera. Licznik w UI jest
  tylko informacją pomocniczą.
- Teleprompter Live HUD jest poza zakresem nowych kont beta. Ekran ma informować
  o niedostępności, a nie proponować zakup.
- Gamifikacja nie jest elementem aktualnej oferty produktu. Historyczne tabele,
  migracje lub kod kompatybilności nie są obietnicą funkcji dla testera.
- Konto chmurowe i synchronizacja Vaultu są funkcją techniczną D02–D04, a nie
  płatnym pakietem. Tryb lokalny pozostaje dostępny bez konta.
- Doradca widoczny w interfejsie jest **lokalnym modułem regułowym**. Dostaje
  wyłącznie wpisane pytanie / szybki prompt. Nie czyta automatycznie Vaultu ani
  zapisanych aplikacji i nie wywołuje modelu AI.
- Wyniki Kierivo są ocenami własnych reguł i mierzonych cech dokumentu. Nie są
  wynikami konkretnych zewnętrznych ATS i nie gwarantują decyzji rekrutacyjnej.
- Walidator spójności raportuje brak wykrytych rozbieżności w sprawdzonym
  zakresie. Nie używamy fallbacku „100% zgodności”, gdy zakres nie jest znany.

---

## ✅ Załatwione / źródła historii

- D02: tożsamość, sesja i separacja właściciela.
- D03: trwały zapis/outbox, kolejność zapisów, bezpieczny import i owner scope.
- D04: PASSWORD_RECOVERY, usunięcie konta, RLS, granty i izolowany pełny cykl Auth.
- D05: uczciwy zakres bezpłatnej bety, neutralne profile ATS, wyłączony checkout
  i formalny browser acceptance.
- Szczegółowe dowody odbioru są w `docs/historia/` i przy odpowiadających PR-ach.
- Dawne eksperymenty z gamifikacją, rabatami rangowymi, trialem i komercyjnymi
  pakietami należy traktować jako historię implementacji, nie aktualny zakres bety.
