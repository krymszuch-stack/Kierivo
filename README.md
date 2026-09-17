# Kierivo — Public Pre-Beta `PB-2026.09` ⚡

> Narzędzie do porządkowania profilu zawodowego, dopasowania CV do konkretnego ogłoszenia i prowadzenia własnego procesu aplikacyjnego.

[![CI](https://github.com/krymszuch-stack/cvelocity/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](tsconfig.json)

[**🌐 Otwórz Public Pre-Beta**](https://cvelocity.oathcry.com/) • [**📖 Architektura**](./docs/SYSTEM_ARCHITECTURE_GUIDANCE.md) • [**🛡️ Bezpieczeństwo**](./SECURITY.md)

## Status produktu

Kierivo Public Pre-Beta `PB-2026.09` jest **bezpłatna, cena: 0 zł**. To publiczna wersja testowa przed właściwą premierą: można już korzystać z podstawowego przepływu, sprawdzać zachowanie produktu i zgłaszać uwagi, ale nie opisujemy jej jako wydania finalnego.

W Public Pre-Beta:

- nie ma aktywnego checkoutu, subskrypcji Pro ani płatnego okresu próbnego;
- nie można kupić pojedynczych szablonów ani Karnetu Aplikacyjnego;
- podstawowy przepływ testera nie wymaga płatności;
- operacje wykorzystujące modele po stronie serwera nadal podlegają limitom technicznym egzekwowanym przez backend;
- funkcje poza zakresem są oznaczane jako niedostępne zamiast prowadzić do martwej kasy.

Kod płatności pozostaje w repo jako infrastruktura na przyszłość i dla zgodności ze starszymi danymi, ale **sprzedaż jest twardo wyłączona podczas tej Public Pre-Beta**.

## Co Public Pre-Beta rzeczywiście robi

### Profil i CV

Master Vault przechowuje uporządkowane fakty podane przez użytkownika: historię zatrudnienia, projekty, umiejętności, edukację i uprawnienia. CV można wprowadzić przez obsługiwany import pliku albo przez wklejenie tekstu. Po wykorzystaniu bieżącego limitu importu pliku nadal można kontynuować przez bezpłatne wklejenie treści.

### Dopasowanie do oferty

Kierivo porównuje treść profilu/CV z konkretnym ogłoszeniem. Pokazuje m.in. wykryte frazy, brakujące wymagania, pokrycie umiejętności, sygnały strukturalne i rekomendacje redakcyjne.

**Wynik Kierivo nie jest wynikiem Workday, Greenhouse, Lever, Taleo ani jakiegokolwiek innego zewnętrznego ATS.** Nie mamy dostępu do ich prywatnych konfiguracji rekrutera. Wynik jest własną, deterministyczną oceną Kierivo i **nie gwarantuje przejścia filtra, zaproszenia na rozmowę ani zatrudnienia**.

### Spójność faktów

Walidator spójności porównuje fakty, które faktycznie dostał do sprawdzenia, z Master Vaultem. Komunikat „brak wykrytych rozbieżności” dotyczy badanego zakresu. Nie oznacza automatycznie, że każdy element całego dokumentu został zweryfikowany.

### Pipeline

Aplikacje można zapisywać i prowadzić przez własne statusy procesu. Snapshot zapisanej aplikacji pozostaje odseparowany od późniejszych zmian profilu.

### Doradca regułowy

Widoczny w interfejsie Doradca jest obecnie **lokalnym modułem regułowym**, a nie czatem LLM. Otrzymuje wyłącznie pytanie wpisane przez użytkownika albo wybrany szybki prompt. Nie czyta automatycznie Master Vaultu ani zapisanych aplikacji i nie wysyła historii tej rozmowy do modelu AI.

## Dane lokalne i chmura

Kierivo ma dwa istotne tryby:

- **lokalny**: profil roboczy jest przechowywany w pamięci przeglądarki;
- **konto chmurowe**: tam, gdzie Supabase jest skonfigurowany, vault może być synchronizowany z bazą przypisaną do zalogowanego właściciela i chronioną przez RLS.

Dlatego nie opisujemy całego produktu jako „100% client-side”. To prawda dla lokalnego przepływu danych, ale nie dla świadomie włączonej synchronizacji konta.

## Ograniczenia Public Pre-Beta

Obecna wersja nie obiecuje:

- zgodności z prywatną konfiguracją konkretnego systemu ATS pracodawcy;
- przewidywania decyzji rekrutera;
- gwarantowanego wzrostu skuteczności aplikacji;
- aktywnego planu Pro, triala lub płatnych dodatków;
- dostępu dla nowych testerów do funkcji oznaczonych jako poza zakresem, np. płatnego wcześniej Telepromptera Live HUD.

## Uruchomienie lokalne

Wymagania:

- Node.js 20+;
- npm 10+.

```bash
git clone https://github.com/krymszuch-stack/cvelocity.git
cd cvelocity
npm install
cp .env.example .env
npm run dev
```

Aplikacja deweloperska jest dostępna pod adresem podanym przez Vite/serwer. Pełny backend wymaga własnej konfiguracji środowiska opisanej w `.env.example` i dokumentacji projektu.

## Weryfikacja jakości

Nie wpisujemy do README stałej liczby testów, ponieważ zmienia się wraz z kodem. Aktualny stan pokazuje CI.

```bash
# testy jednostkowe
npm test

# ESLint + TypeScript
npm run lint

# klient + serwer
npm run build
```

Dla zmian dotyczących kont i RLS istnieje również osobny odbiór integracyjny na izolowanym Supabase.

## Zasada treści produktu

Jeśli ekran pokazuje liczbę, nazwę systemu lub obietnicę, musi ona odpowiadać temu, co kod rzeczywiście mierzy albo udostępnia. Makiety i przykłady muszą być oznaczone jako przykłady. Funkcja niedostępna w becie ma powiedzieć „niedostępna”, a nie prowadzić użytkownika do nieczynnego zakupu.

## Licencja

Projekt Kierivo — Copyright (c) 2026 Adrian Koziński. Wszelkie prawa zastrzeżone.
Pełna treść w pliku [LICENSE](./LICENSE): użytek osobisty, niekomercyjny; zakaz
kopiowania i rozpowszechniania bez pisemnej zgody autora. Nazwy produktów i usług
stron trzecich należą do ich właścicieli; ewentualne wzmianki służą wyłącznie
opisowi ograniczeń lub interoperacyjności i nie oznaczają integracji ani partnerstwa.
