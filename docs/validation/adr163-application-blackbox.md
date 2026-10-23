# ADR-163 — odbiór lokalnego Application Blackbox

## Zakres

Producentem jest rozszerzenie `kierivo-hunter`, odbiorcą Kierivo. Lokalny plik
`KIERIVO_APPLICATION_IMPORT` zawiera zatwierdzoną migawkę i/lub niezmieniony receipt
v1. Odpowiedzi nie przechodzą przez URL, postMessage, API ani telemetryczny log.
Wiadomość postMessage starego receipt nadal przyjmuje wyłącznie ścisły kontrakt v1.

`applicationBlackbox` jest opcjonalnym polem istniejącego rekordu aplikacji,
odrębnym od `documentSnapshot`. Brak migawki pozostaje poprawnym rekordem legacy.
Nie dodano endpointu, tabeli ani globalnego klucza magazynu. Dane są lokalne,
jawne i zakresowane ID profilu, zgodnie z zaakceptowaną decyzją ADR-36. Interfejs
pokazuje brak szyfrowania i przechowywanie do usunięcia migawki/aplikacji/profilu.
Pobrane pliki pozostają na dysku do osobnego usunięcia przez użytkownika.

## Zachowanie

- Podgląd pliku nie zapisuje danych. Zatwierdzenie wymaga aktywnego profilu;
  każda zmiana właściciela lub usunięcie danych odmontowuje podgląd i unieważnia
  spóźniony odczyt. Błąd trwałego zapisu nie publikuje sukcesu ani nowego cache.
- Sama migawka tworzy `Do wysłania`, bez `application_sent`. Receipt tworzy jedno
  kanoniczne zdarzenie z `verificationStatus:user_declared`. Żaden import nie
  nadaje `ats_verified`; odbiór ATS pozostaje niepotwierdzony.
- Identyczne ID są idempotentne. Receipt istniejący przed migawką może zostać
  uzupełniony. Dołączenie późniejszego receipt do samodzielnej migawki wymaga
  jawnego wyboru odpowiadającej aplikacji, zamiast zgadywania po domenie.
- Inna próba tego samego pracodawcy nie współdzieli pamięci. Konflikt tożsamości
  lub starszy plik po korekcie powoduje odmowę bez nadpisania danych.
- Korekta zastępuje bieżący wpis i ustawia `correctedAfterApprovalAt`. Nie ma
  tablicy poprzednich wersji. Ponowny odczyt z nowym zatwierdzeniem również
  otrzymuje ten znacznik przy zmianie treści zapisanej migawki.
- Firma i rola bez danych pozostają puste; przed zapisaniem aplikacji trzeba
  jawnie podać przynajmniej jedno z nich. Rewizje CV/profilu mogą być nieznane;
  rewizja nie dowodzi załączenia CV. Nie przechwytujemy plików.
- JD można jawnie dodać w karcie jako `snapshot.job.description` (do 20 000
  znaków). Eksport zachowuje JD, odpowiedzi, rewizje i datę korekty. Interview
  Prep korzysta z istniejącego modułu i zapisanej oferty. Gdy brak historycznego
  profilu, UI mówi o użyciu bieżącego. Odpowiedzi Blackbox nie trafiają do AI.
- Usunięcie migawki usuwa odpowiedzi i rewizje; zachowuje aplikację i events[].
  Usunięcie całej aplikacji/profilu obejmuje również osadzony Blackbox.
- Pusty Pipeline jest dostępny od pierwszej wizyty, aby dało się zaimportować
  pierwszą aplikację. Nie wymyśla kamienia milowego ani wysłania.

Filtr słów wyklucza rozpoznane dane wrażliwe i sekrety; nie dowodzi, że dowolny
swobodny tekst nie zawiera informacji osobowych. Otwarty tekst wymaga jawnego
wyboru w Hunterze i pełnego podglądu przed importem. Nie obcinamy odpowiedzi.

## Powtarzalny odbiór

Node 22, `npm ci`, Chromium Playwright. Dwa checkouty testowane są kolejno;
operator nie podaje prywatnego profilu ani rzeczywistego ATS.

```sh
npm run lint
npm test
npm run build
HUNTER_CHECKOUT=/sciezka/do/kierivo-hunter npm run test:e2e:blackbox
```

Ostatnia komenda uruchamia rzeczywiste rozszerzenie MV3 i dwa syntetyczne
formularze przez harness producenta. Formularz React zawiera controlled input,
blur/remount, edycję i Next/Back automatu użytkownika. Jawny Submit na makietach
ma preventDefault; rozszerzenie nigdy go nie klika. Rzeczywiste pobrane pliki
są następnie wczytywane przez UI Kierivo na osobnym lokalnym originie. Test
sprawdza podgląd przed zapisem, oba porządki importów, retry i reload, events[],
korektę, eksport zgodny z producentem, Interview Prep, izolację profili, usunięcie
migawki oraz spóźniony File.text po usunięciu danych. Żądania zapisujące są
blokowane; odpowiedzi nie trafiają do raportu. Tymczasowe profile i pliki są
usuwane po teście. Brak Chromium kończy test odmową z instrukcją instalacji,
nigdy fałszywym PASS/SKIPPED.

Nie jest to dowód odbioru na publicznym ATS, skuteczności modelu AI ani audytu
czytnikiem ekranu. Badania z ludźmi, Windows/NVDA i ręczny egzamin pozostają ADR-168.

## Dowody bieżącego wycinka

Wyniki komend i SHA są publikowane w opisach dwóch powiązanych PR-ów i ADR-163.
Historia audytu przed poprawkami obejmuje trzy naprawione problemy Huntera:
kontekst medycznej grupy, przezroczysty przodek kontrolki i spóźniony import po
clear/lock. Regresje wykonują się także w rzeczywistym MV3.
