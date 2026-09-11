# Spostrzeżenia i notatki

> Notatnik roboczy projektu. Stan produktu i reguły rozstrzygają kod, testy,
> `AGENTS.md` oraz protokoły w `docs/historia/`. Stare decyzje pozostają w
> historii Gita, ale nie są utrzymywane tutaj jako równoległa dokumentacja.

---

## 🆕 Nowe

- Suita podpakietu `semantic-work-graph` potrafi zakończyć proces na Node 22 / Windows
  natywnym błędem `better-sqlite3` podczas teardownu. Testy jednostkowe kończą
  właściwe asercje; osobno do sprawdzenia pozostaje kompatybilność ABI / sposób
  zamykania procesu.

- W starszym eksporcie deweloperskim krążył publikowalny testowy klucz Stripe.
  Nie znajduje się w historii tego repo. Jeżeli dawny projekt Stripe nadal jest
  używany, rotacja klucza publishable pozostaje rozsądną ostrożnością.

---

## Stan bezpłatnej bety · 2026-09-11

- **Cena bety: 0 zł.** Zakupy, plan Pro, trial, pojedyncze szablony i Karnet
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
- Wyniki CVelocity są ocenami własnych reguł i mierzonych cech dokumentu. Nie są
  wynikami konkretnych zewnętrznych ATS i nie gwarantują decyzji rekrutacyjnej.
- Walidator spójności raportuje brak wykrytych rozbieżności w sprawdzonym
  zakresie. Nie używamy fallbacku „100% zgodności”, gdy zakres nie jest znany.

---

## ✅ Załatwione / źródła historii

- D02: tożsamość, sesja i separacja właściciela.
- D03: trwały zapis/outbox, kolejność zapisów, bezpieczny import i owner scope.
- D04: PASSWORD_RECOVERY, usunięcie konta, RLS, granty i izolowany pełny cykl Auth.
- Szczegółowe dowody odbioru są w `docs/historia/` i przy odpowiadających PR-ach.
- Dawne eksperymenty z gamifikacją, rabatami rangowymi, trialem i komercyjnymi
  pakietami należy traktować jako historię implementacji, nie aktualny zakres bety.
