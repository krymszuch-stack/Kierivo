# Linear — wspólna instrukcja pracy agentów

Zasada ustalona przez właściciela 05.10.2026: każdy agent pilnuje issues i notuje
zmiany w Linearze. Dotyczy Codex, Claude, Jules, Antigravity i innych agentów
pracujących nad projektem.

## Projekt i bieżąca praca

- Projekt Linear: [Kierivo](https://linear.app/oathcry/project/kierivo-efadf4f2bd56), ID `38abc197-7045-4392-8544-c7d85b2c8907`, zespół Adrian.
- Audyt całości: [ADR-125](https://linear.app/oathcry/issue/ADR-125/audyt-kierivo-eliminacja-bledow-logicznych-i-krytycznych-04092026).
- Publikacja snapshotu: [ADR-126](https://linear.app/oathcry/issue/ADR-126/publikacja-snapshotu-audytu-na-github-i-kierivocom-05102026).
- Repozytorium GitHub: [krymszuch-stack/Kierivo](https://github.com/krymszuch-stack/Kierivo).

## W trakcie pracy

1. Odczytaj aktualne zadanie, kryteria akceptacji i powiązane issues.
2. Wyszukaj istniejące zgłoszenie przed utworzeniem nowego. Historyczny opis
   sprawdź w bieżącym kodzie; stary status nie jest dowodem poprawności.
3. Zapisuj istotne zmiany i decyzje w komentarzu lub opisie: przyczynę błędu,
   zakres naprawy, pliki, commit/PR, wynik sprawdzeń i ograniczenia dowodu.
4. Notuj wdrożenia: commit obrazu, rewizję, domenę, health i screenshot.
5. Ustaw Done dopiero po spełnieniu kryteriów konkretnego zadania.
   Nie zamykaj całego audytu tylko dlatego, że pojedyncza regresja przechodzi.
6. Jeśli połączenie z Linear jest niedostępne, zgłoś konkretny błąd, zachowaj
   notatkę w audycie i uzupełnij Linear po przywróceniu dostępu. Nie deklaruj
   aktualizacji, której narzędzie nie potwierdziło.
7. Starsze issues aktualizuj dowodami bieżącej naprawy, zachowując historyczne
   ustalenia i techniczne identyfikatory. Nowe oraz planowane zadania przypisuj
   do istniejącego projektu Kierivo. CVelocity jest wycofaną nazwą produktu;
   nie twórz pod nią osobnego projektu ani nowych zgłoszeń.

## Dowody i prywatność

Audyt ma nazwę `docs/04.09.2026.md`, a screeny znajdują się w `docs/evidence/`.
Do Linear przekazuj techniczny opis oraz linki do dowodów z danych syntetycznych.
Nie kopiuj haseł, tokenów, prywatnych CV ani danych klienta do zgłoszeń.
