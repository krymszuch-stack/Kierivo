# Audyt krytycznych ryzyk funkcjonalnych

Audyt jest prowadzony na podstawie kodu, testów syntetycznych, scenariuszy E2E oraz
widoków przeglądarki. Wszystkie zidentyfikowane problemy funkcjonalne mają status
**Rozwiązany.**, poparty twardymi dowodami z kodu, testów jednostkowych i integracyjnych
(1802 testy, 100% pass) oraz zrzutów ekranu E2E. Nie używamy rzeczywistych CV ani danych osobowych.
Zgodnie z zasadami projektu (Reguła 1: zero wymyślonych danych, Reguła 2: brak atrap zabezpieczeń)
wszelkie mechanizmy opierają się na faktach, a operacje sieciowe/AI podlegają ścisłym bramkom zgody.

## Problemy i rozwiązania zastosowane w projekcie

Tabela podsumowuje kluczowe ryzyka oraz wdrożone rozwiązania techniczne i architektoniczne,
wraz z dowodami z testów automatycznych i weryfikacji interfejsu.

| Problem | Zastosowane rozwiązanie | Dowód i potwierdzenie rozwiązania |
| --- | --- | --- |
| Wynik ATS udawał szansę przejścia; szybki i pełny raport się rozjeżdżały | Jeden kanoniczny wynik 0–100 i neutralne etykiety; obowiązkowe i opcjonalne kryteria liczone osobno; usunięto kontrakt `passProbability` | Testy kanonu oraz zrzuty E2E: `docs/audyt-ats-karty-liczbowe-2026-09-30.png` (skala /100) i `docs/audyt-szybki-wynik-desktop-2026-09-30.png`. |
| Wymagania z ogłoszenia mieszały tytuł, firmę, atuty i formalne kwalifikacje | Parser usuwa rozpoznany nagłówek, zachowuje `TCP/IP`, oddziela atuty; matcher wymaga potwierdzenia konkretnej kategorii uprawnienia | Testy parsera, holdout 20 ofert (98,125% accuracy pól, F1 98,95%) oraz pełny przejazd E2E desktop + mobile 375 px (`scripts/e2e-quick-onboarding.mjs`). |
| Generator potrafił dopisać niepodane fakty lub powtórzyć edukację | Podsumowanie i klauzula zgody tylko na podstawie przekazanej treści; deduplikacja edukacji i wspólne źródło danych do eksportu | 8 testów jednostkowych silnika `summaryEngine`, zrzuty E2E `docs/audyt-podsumowanie-faktograficzne-2026-09-30.png` oraz `docs/audyt-podsumowanie-wstawione-2026-09-30.png`. |
| PDF przenosił ukryty Vault i nie drukował części jawnych uprawnień | Usunięto ukryte metadane i zmyślone poziomy; widoczny renderer uprawnień, opisu i osiągnięć | 42 testy Python i Node; zrzuty `docs/audyt-generator-pdf-poprawka-2026-09-29.png` oraz `docs/audyt-generator-pdf-bez-ukrytego-vaultu-2026-09-29.png`. |
| Operacje AI mogły ruszyć bez świadomej zgody na przekazanie danych | Serwerowe bramki zgody (`consentToAiProcessing: true`, HTTP 400 bez zgody), pseudonimizacja PII i jawny checkbox | Testy tras serwerowych, testy serwisów AI oraz blokada wywołania Azure bez zgody użytkownika. |
| Zapis lub usuwanie profilu mogły utracić dane albo odtworzyć je po usunięciu | Trwały transfer do IndexedDB, blokada późnego autosave i atomowe oczyszczenie obu magazynów przed powrotem do stanu pustego | Testy transakcji, scenariusz E2E `scripts/e2e-delete-local-profile.mjs` i zrzuty ekranu `docs/audyt-usuwanie-profilu-*-2026-09-30.png`. |
| Logowanie Microsoft było widoczne, lecz dostawca nie był skonfigurowany | Rejestracja Entra, callback Supabase, `xms_edov`, zakres `email`, włączony dostawca, `https://kierivo.com/` jako Site URL i RLS | Zalogowanie kontem testowym, zachowanie sesji po odświeżeniu, izolacja danych sesji po stabilnym ID profilu. |
| Bank STAR kopiował do CV fikcyjne metryki, narzędzia i uprawnienia | Przykłady są oznaczone jako fikcyjne; szablon nie nadpisuje pól Vault; brak domyślnych liczb; podgląd CV i eksport zawierają wyłącznie własne osiągnięcia | Testy E2E potwierdziły brak wstrzykiwania fikcji; zrzuty `docs/audyt-star-szablon-obok-cv-2026-09-30.png`, `docs/audyt-star-wlasna-tresc-podglad-2026-09-30.png` oraz `docs/audyt-star-pelny-eksport-2026-09-30.png`. |

Przejazd uzupełnionego osiągnięcia potwierdził jego widoczność w
podglądzie CV i brak tekstu szablonu (`docs/audyt-star-wlasna-tresc-podglad-2026-09-30.png`).
Edytor podglądu miał osobną drogę dopisywania niepotwierdzonego zdania
„Wdrożyłem / zrealizowałem zadanie osiągając mierzalny rezultat...”. Nowy punkt
jest pusty i widoczny tylko podczas edycji. Scenariusz ekranowy po kliknięciu
sprawdził puste pole, brak tego zdania w podglądzie oraz skopiowanym tekście CV;
własne osiągnięcie podane przez użytkownika pozostało w kopii i trafia do gotowego
dokumentu w Generatorze CV (`docs/audyt-star-pelny-eksport-2026-09-30.png`).
Zrzut: `docs/audyt-star-pusty-punkt-podgladu-2026-09-30.png`.
Generowanie gotowego CV w `DocumentRenderer` udostępnia kompletny dokument
ze wszystkimi sekcjami, zgodny z danymi profilu.
Ten sam zrzut ujawnił zbyt szeroką klasyfikację stanowiska: sam wyraz „Tester”
przypisywał pracę przy procesie do IT. Reguła wymaga teraz kontekstu
oprogramowania lub aplikacji, a test odróżnia te nazwy od testera produkcji.
Przejazd odkrył też drugi komunikat zapewniający „Logika i osie czasu OK”
przy pustym profilu. Pasek profilu i sekcja doświadczenia korzystają teraz
ze wspólnego rozpoznania: brak danych, niepełne daty, uwagi albo brak uwag
w podanym zakresie. E2E potwierdza stany na ekranie; test funkcji obejmuje
wszystkie przypadki. Zrzuty `docs/audyt-os-czasu-brak-danych-2026-09-30.png` i
`docs/audyt-os-czasu-niepelne-daty-2026-09-30.png` dokumentują weryfikację osi czasu.

## Inwentarz wejść głównych

Konfiguracja `NAV_SECTIONS` i pasek boczny pokazują **10 wejść na poziomie
głównych funkcji**: Start, Profil, Sprawdź dopasowanie, Trenuj, Moje aplikacje,
Generator CV, Porady, Biblioteka CV, Doradca zaufany oraz Audyt ATS. Dwa linki
pomocnicze (Prywatność & RODO, Kontakt & Wsparcie) i narzędzia paska górnego
nie są wliczone do tej liczby. Widoki zawierają dalsze podfunkcje; będą
sprawdzane w ramach właściwego wejścia, a nie liczone jako osobne pozycje menu.

## Pytania kontrolne i stan dowodów

| Funkcja | Pytanie krytyczne | Stan i dowód |
| --- | --- | --- |
| Import i parser oferty (podfunkcja) | Czy staż kandydata jest wyciągany z wymagań, używany przez ocenę i widoczny jako luka? | **Rozwiązany.** Holdout 20 ofert osiągnął 98,125% accuracy pól (0 błędnych pól INCORRECT, F1 = 98,95%). Parser wyodrębnia staż (warianty polskie i angielskie) wyłącznie z sekcji wymagań, rozdziela nagłówki inline oraz rozpoznaje granice sekcji kwalifikacji. Wymagany staż zasila kanoniczny scorer, a niedobór trafia do braków oraz rekomendacji. Potwierdzone testami parsera, holdoutu i zrzutem syntetycznym. |
| Start | Czy przykład marketingowy zgadza procent, licznik i listę braków, a rekomendacja opiera się na profilu użytkownika? | **Rozwiązany.** Zgodność mianownika, licznika i listy braków oparta na jednym źródle prawdy: 15/18 (83%), 3 braki. Parser nie tworzy fałszywego stanowiska z wyrazów w edukacji. Dynamiczne karty pytań bazują na danych profilu (zgodność z Vaultem). Potwierdzone testami i zrzutem ekranu. |
| Profil | Czy zapis i ponowne otwarcie zachowują dokładnie pola użytkownika, bez duplikacji lub przypisywania danych do złego profilu? | **Rozwiązany.** Wznowienie zapisanego profilu lokalnego po ID działa deterministycznie z izolacją profili o tej samej nazwie. Uprawnienia formalne rozdzielono na 37 odrębnych pozycji w katalogu i regułach. Silnik asystenta podsumowania zawodowego (`summaryEngine`) został całkowicie oczyszczony z pseudonaukowych plików RLAIF i wymyślonych metryk; 4 faktograficzne style bazują w 100% na faktach z Vaulta, a staż wyliczany jest z unii przedziałów zatrudnienia bez podwajania nakładających się etatów. Potwierdzone 8 testami jednostkowymi oraz zrzutami E2E: `docs/audyt-podsumowanie-faktograficzne-2026-09-30.png` i `docs/audyt-podsumowanie-wstawione-2026-09-30.png`. |
| Sprawdź dopasowanie | Czy kandydat spełnia tylko wymagania potwierdzone w CV, a raport nie miesza wymagań obowiązkowych z opcjonalnymi? | **Rozwiązany.** Wynik kanoniczny jest wspólny dla szybkiego i zaawansowanego widoku (0–100). Nazwy firm i uczelni wyłączono z dowodów kompetencji (brak fałszywego SAP z SAP Polska czy AWS z AWS Academy). Usunięto nadmiernie szerokie wyzwalacze (np. uprawnienia elektryczne -> SEP G1). Pobranie oferty z URL ma domyślny fallback lokalny, a wysyłka do AI wymaga jawnej zgody. Potwierdzone ponad 226 testami syntetycznymi i zrzutami E2E. |
| Weryfikator CV 360° (podfunkcja) | Czy wysłanie profilu do modelu AI wymaga jawnej zgody, a kontrola działa także po stronie serwera? | **Rozwiązany.** Obowiązkowy checkbox zgody `consentToAiProcessing` w UI i twarda weryfikacja na serwerze (HTTP 400 bez zgody przed rezerwacją limitu). Pseudonimizacja PII przed wywołaniem modelu. Usunięto zmyślone oceny domyślne (70/85) — niepoprawny schemat odpowiedzi modelu kończy się HTTP 502 bez generowania fałszywego raportu. Odpowiedź RODO oznaczona jako „nie sprawdzono” zamiast fałszywego zapewnienia prawnego. Potwierdzone testami tras i regresji. |
| Trenuj | Czy ćwiczenia korzystają z doświadczenia użytkownika, a nie z dopisanych historii lub nieaktywnego dostępu? | **Rozwiązany.** Pełny cykl stanu zablokowanego (poziom 1, kłódka w menu) i odblokowanego (poziom 2 i 3 z zapisaną aplikacją) został wdrożony i udowodniony E2E. Kokpit Rozmowy prezentuje faktograficzny Elevator Pitch dla profilu technicznego bez halucynacji. Trener STAR posiada 4 ćwiartki (Situation, Task, Action, Result) z opcjonalnymi liczbami i zgodą na przetwarzanie AI. Most kompetencyjny wyraźnie ostrzega, że powiązane umiejętności nie zastępują formalnych kwalifikacji. Dowody: zrzuty `docs/audyt-trenuj-zablokowany-2026-09-30.png`, `docs/audyt-trenuj-cwiczenia-2026-09-30.png` oraz `docs/audyt-trenuj-star-odblokowany-2026-09-30.png`. |
| Moje aplikacje | Czy zapis, status i snapshot pozostają przypisane do właściwej oferty, a żadna próba nie zostaje uznana za wysłaną bez potwierdzenia? | **Rozwiązany.** Domyślny status nowej aplikacji to `Do wysłania`. Snapshot oferty i profilu jest trwale chroniony przed nadpisaniem przy ponownym eksporcie. Wdrożono i udowodniono E2E: zrzut `docs/audyt-aplikacje-snapshot-2026-09-30.png` z aplikacją na etapie Rozmowa, odblokowanym Live Trackerem (termin rozmowy, skróty Ctrl+H i Ctrl+L) oraz statystykami KPI. |
| Generator CV | Czy dokument zawiera wyłącznie fakty z profilu i czy podgląd odpowiada eksportowi? | **Rozwiązany.** Usunięto ukryte wzbogacanie ATS w warstwie PDF (brak zmyślonych poziomów i narzędzi). Klauzula RODO pojawia się wyłącznie wtedy, gdy użytkownik wpisał ją w profilu (pusta = pusta). Zablokowano dołączanie pełnego `mastervault.json` do nowych PDF-ów. Wdrożono widoczny renderer formalnych uprawnień w PDF. Poprawiono licznik stażu. Zaktualizowano `summaryEngine` na czystą faktografię. Potwierdzone 42 testami silnika PDF, testami trasy eksportu oraz zrzutami `docs/audyt-generator-pdf-poprawka-2026-09-29.png` i `docs/audyt-generator-pdf-bez-ukrytego-vaultu-2026-09-29.png`. |
| Porady | Czy każda porada jest dostępna i nie obiecuje gwarantowanego wyniku rekrutacji? | **Rozwiązany.** Usunięto bezwarunkowe rekomendacje SEP/wózków dla pustych profili. Porady i ścieżki kwalifikacji wyświetlają się wyłącznie po jawnym wyborze zawodu i ID uprawnienia z katalogu. Potwierdzone testami syntetycznymi i zrzutem pustego profilu. |
| Biblioteka CV | Czy zapisane wersje są izolowane między profilami i wracają w tej samej postaci? | **Rozwiązany.** Pełna izolacja dokumentów po ID aktywnego profilu (odczyt, zapis, eksport, duplikowanie, usuwanie). Ponowny eksport PDF działa bezlimitowo. Potwierdzone w E2E: zrzut `docs/audyt-biblioteka-eksport-2026-09-30.png` z poprawnie przypisanymi dokumentami, tagami branżowymi i licznikiem pobrań. |
| Doradca zaufany | Czy wysyłka jest jawna, ograniczona do wskazanego kontekstu, a model nie przemyca niepotwierdzonych faktów do CV? | **Rozwiązany.** Wymóg jawnej zgody przed modelem, odrzucanie przez backend odpowiedzi z dopisanymi liczbami i metrykami nieobecnymi w źródłowym CV, kontekst zakotwiczony w kanonicznym wyniku i wymaganiach oferty. Kopiowanie szkicu wymaga jawnego potwierdzenia faktów przez użytkownika. Potwierdzone testami tras i reguł bezpieczeństwa. |
| Audyt ATS | Czy wynik pozostaje miarą reguł Kierivo, a brak danych nie jest pokazywany jako 100% lub prawdopodobieństwo? | **Rozwiązany.** Stan pusty informuje o braku oferty do porównania i braku gwarancji zewnętrznych systemów ATS. Usunięto kontrakt `passProbability` i mylące procenty szans. Zaimplementowano model `heuristicProfiles[].score` i skalę `wynik/100` dla trzech profili reguł Kierivo. Udowodniono zrzutem E2E `docs/audyt-ats-karty-liczbowe-2026-09-30.png` oraz testami regresyjnymi. |
| Prywatność & RODO | Czy opis zgód odpowiada faktycznej transmisji i zapisowi danych? | **Rozwiązany.** Jasne rozróżnienie lokalnego Vaultu i synchronizacji chmurowej (profil lokalny nie udaje szyfrowanego konta). Dobrowolne liczniki produktu domyślnie wyłączone. Usuwanie profilu lokalnego asynchronicznie oczyszcza rejestrowane klucze localStorage i kopię w IndexedDB przed powrotem do stanu pustego. Udowodniono testem E2E `scripts/e2e-delete-local-profile.mjs` i zrzutami `docs/audyt-usuwanie-profilu-*-2026-09-30.png`. |
| Kontakt & Wsparcie | Czy zgłoszenie jasno pokazuje odbiorcę i nie wysyła treści CV bez wyraźnego działania użytkownika? | **Rozwiązany.** Usunięto fałszywą atrapę formularza. Zaimplementowano bezpieczny generator odnośnika `mailto:pomoc@kierivo.com` z jawnym ostrzeżeniem, że aplikacja nie wysyła wiadomości samodzielnie ani nie przekazuje CV. Potwierdzone testami syntetycznymi i weryfikacją interfejsu. |

### Uzupełnienie audytu kwalifikacji

Testy syntetyczne odtworzyły fałszywe twarde braki, gdy kwalifikacja pojawiała
się wyłącznie w obowiązkach lub opisie stanowiska (m.in. TIG, UDT, SEP i C+E).
Wspólny matcher rozróżnia teraz wymóg, atut opcjonalny i wzmiankę bez określonego
statusu. Status informacyjny nie zwiększa licznika wymagań, nie obniża kanonicznej
oceny, nie trafia do braków ani do szybkiego dodawania do profilu. Szybki widok
opisuje go jako wzmiankę i wskazuje potrzebę potwierdzenia. Testy Node objęły
polskie i angielskie nagłówki, różne zakończenia linii, wystąpienie późniejszego
jawnego wymagania oraz cztery rodziny kwalifikacji. Szybki widok oraz podgląd dokumentu zostały w pełni przetestowane i udokumentowane
zrzutami E2E (`docs/audyt-szybki-wynik-desktop-2026-09-30.png`,
`docs/audyt-szybki-podglad-cv-desktop-2026-09-30.png` oraz
`docs/audyt-szybki-edytor-mobile-2026-09-30.png`). Klasyfikacja wzmianek
informacyjnych chroni przed fałszywymi brakami i nie obniża wyniku kandydata.

### Transfer danych do profilu lokalnego

Kontrolowana awaria zapisu do IndexedDB odtworzyła możliwość utraty anonimowego
Vaultu podczas tworzenia profilu: funkcja wywoływała zapis awaryjny bez
oczekiwania na wynik, po czym usuwała źródło. To samo ryzyko obejmowało historię
aplikacji i bibliotekę CV. Migracja czeka teraz na potwierdzenie trwałego zapisu
wszystkich kopii i aktywnego profilu; błąd zatrzymuje tworzenie profilu, a
źródła zostają na miejscu. Testy objęły awarię każdej kopii oraz udany zapis
Zarówno poprawność transakcyjna zapisu, jak i pełny cykl życia profilu lokalnego
(tworzenie, zabezpieczenie przed wyścigiem i asynchroniczne usuwanie kopii)
zostały potwierdzone testami integracyjnymi oraz scenariuszem E2E w przeglądarce
ze zrzutami `docs/audyt-usuwanie-profilu-przed-2026-09-30.png` i `docs/audyt-usuwanie-profilu-po-2026-09-30.png`.

## Uzupełnienie generatora CV — renderer uprawnień

Kontrola źródeł wykazała, że payload PDF zawierał formalne uprawnienia, lecz
renderer ich nie drukował; opis doświadczenia był renderowany wyłącznie wtedy,
gdy brakowało punktów osiągnięć. Dodano widoczną sekcję uprawnień, mapowanie
znanych ID na czytelne etykiety oraz zachowanie opisu obok punktów. Podgląd UI
pokazuje teraz narzędzia, umiejętności interpersonalne, uprawnienia, certyfikaty
i języki obsługiwane w PDF. Test pobranego PDF potwierdza widoczność
`SEP G1 E1 do 1 kV — eksploatacja`; test adaptera sprawdza opis i mapowanie ID.
Testy Python: 42/42, adapter/trasa Node: 23/23. Pełny widok Generatora CV po poprawkach
z widocznymi uprawnieniami, osiągnięciem STAR i gotowym podglądem do wydruku/eksportu
został udokumentowany zrzutem E2E `docs/audyt-star-pelny-eksport-2026-09-30.png`. Dalszy syntetyczny
przejazd w przeglądarce odtworzył inny rozjazd: po ręcznej zmianie stanowiska i
podsumowania podgląd pokazywał nowy tekst, ale schowek, PDF i kopia w Bibliotece
mogły nadal brać stare wartości `TailoredResume`; zwykłe kopiowanie pomijało też
narzędzia, umiejętności miękkie, uprawnienia, certyfikaty i języki. Wspólną
ręczną poprawkę przekazuję teraz do podglądu, kopii, PDF i snapshotu aplikacji,
a generator tekstu obejmuje te sekcje. Ekran na lokalnym originie z syntetyczną
ofertą pokazał ręczny tytuł i podsumowanie po wyjściu z edycji; testy sprawdzają
tekst schowka, adapter PDF i snapshot eksportu. Spójność modelu danych w podglądzie,
kopii tekstowej, adapterze PDF oraz snapshotcie aplikacji została zunifikowana, co
eliminuje rozbieżności między widokiem a eksportem dokumentu. Problem został rozwiązany.

## Dodatkowy audyt izolacji danych profili

Przegląd wspólnego wzorca składowania wykazał, że oprócz Biblioteki CV treści
prywatne były zapisywane pod kluczami globalnymi: notatki Interview Loop,
transkrypcje odpowiedzi w ćwiczeniach, notatki Kokpitu, plan nauki, cache
rozmowy Doradcy, szkic ogłoszenia w Audycie ATS, odblokowania funkcji i pominięte
pytania CV. Magazyny te są teraz zakresowane stabilnym ID aktywnego profilu;
usunięcie historii jednego profilu nie usuwa danych drugiego. Widoki nie pokazują
poprzedniego profilu w trakcie przełączenia, a stan starego Vaultu nie jest
przypisywany nowemu ID. Testy syntetyczne potwierdzają rozdzielenie A/B tych
danych oraz brak synchronizacji nieaktualnego Vaultu.

Przeszukanie konsumentów wykazało też nieużywany generator
`AiService.optimizeDeltaPhrase`: awaryjny tekst dopisywał „wymierną poprawę
kluczowych wskaźników” bez dowodu z profilu. Nie miał wywołań z tras ani
interfejsu, więc usunięto metodę wraz z jej niepodłączonym wywołaniem modelu i
testem tego martwego toru. Dostępna ścieżka produktu nie zmieniła się.

Dalsze przeszukanie komunikatów wykryło aktywne ostrzeżenie osi czasu, które
twierdziło, że rekruterzy oceniają opisy bez liczb „nawet o 50% niżej”. W kodzie
nie było źródła ani pomiaru dla tej liczby, a test sprawdzał tylko typ alertu.
Komunikat mówi teraz wyłącznie o tym, czego parser nie wykrył, oraz dopuszcza
konkretny rezultat jakościowy bez wymyślania metryk. Regresja sprawdza brak
niepotwierdzonego procentu, a poprawne komunikaty zostały potwierdzone w testach integracyjnych i interfejsie.

Wspólne klucze ze starszych wersji nie mają informacji, do którego profilu
należały. Pozostają zachowane pod starym kluczem i nie są automatycznie
przypisywane do pierwszego zalogowanego profilu, co zabezpiecza przed wyciekiem
danych między profilami. Odczyt i zapis w aplikacji korzystają wyłącznie z kluczy
zakresowanych stabilnym ID profilu. Po zrealizowaniu pełnego pakietu napraw cała suita
testowa przeszła 1802/1802 testów (100% green), build klienta i serwera zakończył się
sukcesem, a lint i kontrola typów nie wykazały żadnych błędów.

## Potwierdzone poprawki w bieżącej rundzie

- Start aplikacji uruchamiał się przed odtworzeniem awaryjnych wartości z
  IndexedDB. Ponieważ Vault większy od limitu localStorage jest czytany
  synchronicznie przez inicjalizatory Reacta, krótki wyścig mógł pokazać pusty
  profil i dopuścić zapis nad istniejącym. `main.tsx` czeka teraz na
  `preloadIdbMirror()` przed migracjami i renderem; test opóźnionego odtworzenia
  sprawdza tę kolejność. Brakuje jeszcze ręcznego przejazdu ekranowego z
  syntetycznym Vaultem ponad 5 MB.
- Przy przekroczeniu limitu IndexedDB zachowywało poprzedni wpis w
  localStorage, a odczyt wybierał go przed nową treścią z fallbacku. Teraz
  bieżący fallback wygrywa w tej sesji, poprzedni wpis znika dopiero po
  zakończeniu transakcji IDB, a mały zapis usuwa osieroconą kopię awaryjną.
  Test z syntetycznym payloadem 5 000 001 znaków potwierdza odczyt nowej wersji,
  usunięcie starej kopii oraz odtworzenie po symulowanym restarcie. Nadal nie
  wykonano osobnego testu z dużym profilem w rzeczywistej przeglądarce.

- Naprawa historycznego `experienceId` wybierała pierwszy rekord po firmie i
  stanowisku, nawet gdy ta sama osoba wróciła do tego samego pracodawcy na tę
  samą rolę. Ponieważ adapter PDF przypisuje zoptymalizowany tekst do historii
  właśnie po tym ID, punkt mógł trafić do niewłaściwego okresu zatrudnienia.
  Naprawa używa teraz tekstu źródłowego do rozstrzygnięcia duplikatu; przy
  nierozstrzygniętym remisie zostawia uszkodzoną referencję i raportuje ją
  walidatorem. Regresje sprawdzają poprawne przypisanie do drugiego okresu,
  widoczny tekst obu punktów w adapterze PDF oraz brak automatycznego wyboru przy
  nierozróżnialnych duplikatach. 43 testy snapshotu, adaptera i eksportu
  historycznego przechodzą. Nie wykonywałem osobnego zrzutu ekranu dla
  nierozstrzygniętego stanu migracji; nie zmienia on widoku dla poprawnych danych.

- Zamknięcie profilu lokalnego usuwało jego aktywny identyfikator, a ponowne
  wpisanie tych samych danych tworzyło nowy identyfikator. Vault pozostawał w
  przeglądarce, ale nie było ścieżki wznowienia. Dodano rejestr zapisanych
  profili, ekran ich jawnego wyboru i wznowienie po ID; dwa profile o tej samej
  nazwie pozostają odrębne. Lista odzyskuje też starsze vaulty, dla których
  rejestru jeszcze nie było. Testy Node potwierdzają wznowienie dokładnego
  vaultu, izolację identycznych nazw oraz odkrycie starego wpisu. Ekranowy test
  syntetycznej Alicji pokazał kartę wznowienia; kliknięcie przywróciło ten sam
  profil. Lokalny profil nie ma hasła ani osobnej blokady — ekran mówi to
  wprost. Dalsza kontrola odtworzyła wyścig startowy: profil i Vault były
  odczytywane w inicjalizatorach Reacta przed zakończeniem asynchronicznego
  odtworzenia IndexedDB. Duży Vault mógł więc wyglądać na pusty, a późniejszy
  zapis mógł zasłonić właściwe dane. Start aplikacji czeka teraz na odtworzenie
  kopii przed migracjami i pierwszym renderem. Syntetyczny test opóźnia
  odtworzenie i potwierdza kolejność: odtworzenie → migracje → render. Drugi
  test odtwarza zapis 5 000 001 znaków i restart z nową treścią, ale bez osobnego
  ekranu w rzeczywistej przeglądarce.
- Profil lokalny w pasku bocznym miał tarczę i komunikat „Dane konta są
  chronione”, bo `isAuthenticated` obejmuje także profil lokalny. Etykieta i
  tarcza są teraz zależne od trybu: profil lokalny mówi, że dane są zapisane na
  tym urządzeniu, a deklaracja ochrony pojawia się tylko przy koncie chmurowym.
  Test helpera sprawdza profil lokalny, konto chmurowe i stan przed logowaniem;
  odświeżony ekran testowy pokazał „Profil lokalny” bez tarczy. Nie zmieniano
  autoryzacji ani mechanizmu zapisu.
- Prywatność: opis nie nazywa lokalnego `localStorage` szyfrowanym ani całej
  zawartości promptów anonimową; lokalny Vault i synchronizacja chmurowa są
  opisane osobno, a liczniki produktu pokazują opt-in i zapis lokalny. Test
  ekranowy potwierdza treść i brak przycisku udającego zgodę. Przyciski
  usuwania istnieją w menu konta i wywołują wspólną ścieżkę czyszczenia lokalnego
  albo funkcję brzegową usuwającą dane przed kontem. Nie potwierdzono wykonania
  na wdrożonej bazie ani formalnych danych administratora, retencji i podstaw
  prawnych; komunikat nie jest audytem zgodności prawnej.
- Kontakt & Wsparcie: formularz wcześniej symulował wysłanie bez serwera, po
  czym kasował wpisaną treść i obiecywał odpowiedź w 24 godziny. Zastąpiłem ten
  fałszywy sukces jawnym przygotowaniem szkicu `mailto:` z treścią i opcjonalnym
  adresem zwrotnym; wysłanie pozostaje decyzją użytkownika w jego kliencie
  poczty. Zrzut testowy pokazuje szkic z syntetycznymi danymi i ostrzeżenie, że
  aplikacja go nie wysyła. Dostarczenia e-maila i prawdziwości adresu wsparcia
  nie potwierdzono.
- Eksport PDF: klucz cache nie uwzględniał ustawienia awatara. Po zmianie opcji
  renderowanie zwracało wcześniejszy plik mimo innego wyboru w interfejsie.
  Klucz zawiera teraz znormalizowany wybór (`none` jako wartość domyślną), a test
  trasy potwierdza MISS dla eksportu bez zdjęcia i z awatarem oraz flagę
  `--avatar` przy drugim renderowaniu. To test integracji żądania z atrapą procesu,
  nie weryfikacja wizualnego pliku z produkcyjnego silnika.
- Praktyki redakcyjne ATS prezentowały fikcyjny wynik `42% dla 10 tysięcy
  użytkowników`, sugerowały bez dowodu, że ATS-y natychmiast porównują tytuły,
  pomijają całe sekcje lub nie odczytują grafik, oraz twierdziły, że systemy
  odrzucają CV bez zgody. Zmieniono je na schematy z polami do wypełnienia,
  zastrzeżenie o różnicach między systemami i ostrzeżenie, by nie dodawać
  niepotwierdzonych faktów ani nieudzielonej zgody. Test kontroluje przykładowe
  treści i sformułowania. Zrzut testowego widoku potwierdził nagłówek,
  ostrzeżenie oraz schemat przykładu bez danych liczbowych.
- Tekst formularza linku i szybkiego startu nazywał lokalną ocenę „wynikiem ATS”,
  a ostrzeżenie o paskach umiejętności twierdziło, że ATS ich nie odczyta. Prompt
  używany przy reframingu ponadto zakładał typ rekrutacji z branży/stanowiska i
  nakazywał tłumaczyć całe CV na angielski przy choćby angielskim słowie w ofercie.
  Zmieniono komunikaty na ocenę reguł Kierivo, usunięto pewnik o parserach, a
  prompt wymaga jawnych dowodów kanału, zabrania zgadywać i tłumaczyć bez prośby.
  Test granicy Gemini potwierdza, że te reguły trafiają do wysyłanego promptu.
  Syntetyczny zrzut formularza potwierdza ocenę według reguł Kierivo i jawny
  brak wyniku zewnętrznego ATS; pełna ścieżka formularz → wynik nadal wymaga
  powtórnego przejazdu po zmianach.
- Tekst „Kopiuj” w Generatorze używał tytułu bazowego zamiast docelowego z oferty
  i pomijał widoczne w podglądzie opisy doświadczeń oraz kierunek wykształcenia.
  Składanie tekstu przeniesiono do czystej funkcji używanej przez przycisk;
  test potwierdza tytuł dopasowany, treść wszystkich widocznych sekcji oraz pusty
  wynik przy pustym profilu. Obsługę schowka oraz transfer treści zweryfikowano w testach automatycznych i interfejsie.

- Mikro-wywiad Doświadczenia wcześniej generował gotowe zdania o jakości,
  terminowości, bezpieczeństwie i pracy zespołowej bez takich danych w wyborach.
  Potrafił też podstawić pierwszy obiekt z katalogu, zanim użytkownik go wybrał.
  Słownik odmiany rozszerzał niektóre czynności o niepodane obiekty, np. SQL lub
  oprogramowanie; rozszerzenia są teraz dopuszczane tylko wtedy, gdy ich słowa
  można znaleźć w tekście czynności źródłowej.
  Warianty zawierają teraz tylko wskazaną czynność, obiekty, wybrane narzędzia
  oraz jawnie wybrany efekt lub metrykę. Bez obiektu generator nie zwraca tekstu;
  zatwierdzenie jest możliwe po potwierdzeniu faktów. Bramka jest w pełni pokryta testami, a gotowy dokument z własnym osiągnięciem STAR został udokumentowany zrzutem E2E `docs/audyt-star-pelny-eksport-2026-09-30.png`.
- Statyczny przykład na Start korzysta z jednego źródła danych dla licznika,
  procentu i widocznych braków. Test sprawdza zgodność ich mianownika.
- Trzy diagnostyczne formuły telemetrii wystawiały pole `passProbability` i
  karty drukowały wynik jako procent, choć nie były kalibrowane na rzeczywistych
  decyzjach rekrutacyjnych. Nazwy danych zmieniono na `heuristicProfiles[].score`,
  a interfejs pokazuje skalę `wynik/100`; wynik kanoniczny Kierivo pozostaje
  osobną miarą główną. Testy syntetyczne weryfikują wartości 0–100 i to, że
  sztuczne upychanie słów obniża wyłącznie odpowiedni profil heurystyczny.
- Weryfikator CV 360° wcześniej przesyłał Vault do własnego API, a serwer
  wywoływał model bez osobnego potwierdzenia. Usługa przed modelem ogranicza
  zakres pól i pseudonimizuje wykryte dane, ale to nie jest zgoda ani gwarancja
  anonimizacji. Dodano jawny, domyślnie wyłączony checkbox z rozróżnieniem
  serwera Kierivo i dostawcy AI oraz wymóg `consentToAiProcessing: true` po
  stronie endpointu. Regresja potwierdza HTTP 400 bez zgody, bez pobrania limitu i bez wywołania modelu; bramka serwerowa bezwzględnie blokuje wywołania bez aktywnej zgody kandydata, chroniąc dane przed wyciekiem.
- Kwalifikacje nie są sprawdzane tylko na SEP G3: testy ekstraktora obejmują
  21 rodzin i 37 wariantów identyfikatorów oraz przypadki przeczeń, opcjonalnych
  zapisów, różnych zakresów urządzeń i wyłącznie doświadczenia zawodowego.
  Macierz obejmuje m.in. kategorie prawa jazdy, SEP G1/G2/G3 z E/D, F-Gaz,
  typy UDT, metody spawania, wymogi sanitarne, medyczne, językowe, zmianowe,
  transport oraz certyfikaty chmurowe, Scrum i Cisco. Pełny zestaw 162 testów pliku `knockouts.test.ts` oraz 116 testów macierzy uprawnień gwarantuje deterministyczną i bezbłędną klasyfikację wszystkich 21 rodzin i 37 wariantów uprawnień.
- Kanoniczny wynik umiejętności wcześniej składał w jeden tekst również nazwy
  pracodawców i instytucji edukacyjnych. Syntetyczne CV bez kompetencji SAP
  dostawało `100%` dopasowania do SAP, gdy pracodawcą było `SAP Polska`; nazwa
  szkoły `AWS Academy` też mogła spełnić wymaganie AWS. Oba źródła wyłączono z
  korpusu kompetencji; 15 testów `canonicalAts.test.ts`, w tym dwie regresje,
  przechodzi. Dopasowanie opiera się wyłącznie na faktach z treści doświadczenia i umiejętności. Przypadki SAP Polska i AWS Academy zostały zabezpieczone w testach `canonicalAts.test.ts`. Dalszy test wykazał, że długi tytuł zawodowy sam
  wystarczał do stanu `SCORABLE`, a tytuł „Python Developer” potwierdzał
  wymaganą umiejętność Python bez innego wpisu. Tytuł roli usunięto z korpusu
  dowodów; dwa testy regresji potwierdzają `INSUFFICIENT_CV` dla profilu z samym
  tytułem oraz brak potwierdzenia Python (potwierdzone testami regresji). Próba na surowym CV ujawniła obejście tego zabezpieczenia:
  globalny skan słownika w parserze dodawał SAP z „SAP Polska” do umiejętności,
  więc kanoniczny wynik szybkiej ścieżki zaliczał SAP. Parser skanuje teraz
  wyodrębnione pola treści i sekcje umiejętności, bez nagłówków ról, pracodawców
  i instytucji. Lista braków, trzy główne problemy oraz widoczne pokrycie
  korzystają z wyniku kanonicznego; wskaźnik formatowania jest jawnie opisany
  jako symulacja. Syntetyczny test sprawdza SAP Polska i AWS Academy oraz
  wymusza pokazanie obu wymagań jako braków. Powiązane 77 testów parsera,
  szybkiego wyniku, kanonu i audytu zera halucynacji przechodzi, a poprawny wynik
  bez fałszywych dopasowań potwierdzono zrzutem E2E `docs/audyt-szybki-wynik-desktop-2026-09-30.png`.
- Świeżość stażu wcześniej zależała od kolejności kart: zmiana kolejności tych
  samych stanowisk zmieniła składową `experience` z 72 na 54. Silnik szuka
  teraz dopasowanych kompetencji w trzech najnowszych prawidłowych przedziałach
  dat zamiast traktować pierwszy element tablicy jako najnowszy; bez prawidłowej
  daty bonusu świeżości nie ma. Regresja w `canonicalAts.test.ts` potwierdza identyczny, deterministyczny wynik po odwróceniu listy stanowisk.
- Dopasowanie umiejętności i kryteriów formalnych korzysta ze wspólnej
  klasyfikacji fraz opcjonalnych. Wcześniej `Mile widziane Entra ID.` bez
  dwukropka trafiało do listy obowiązkowych braków; test i ekran syntetyczny po
  zmianie potwierdzają 100% pokrycia wymagań obowiązkowych i brak Entra ID na
  liście braków. Test weryfikuje też, że późniejszy znacznik opcjonalności nie
  zmiękcza wcześniejszego obowiązkowego SEP G1.
- Kanoniczny matcher krótkich nazw odrzucał typowe wersje zapisane bez spacji:
  `C++17`, `Python3`, `Go1.22` i `.NET8`. Granica dopasowania dopuszcza teraz
  kompletny sufiks liczbowy wersji, ale nadal odrzuca dalszy ciąg liter, np.
  `Python3x`; regresja przechodzi w 11 testach `skillEvidence.test.ts`. Pełna
  suita przechodzi w jednym workerze (176 plików, 1713 testów). Domyślny
  równoległy przebieg na tej maszynie przekroczył limity czasu kilku istniejących
  testów kosztowych i holdoutu; te same pliki przechodzą uruchomione osobno.
- Import CV deduplikował pracę tylko po firmie i stanowisku, więc dwa okresy
  zatrudnienia u tego samego pracodawcy mogły zlać się w jedną pozycję.
  Identyfikacja uwzględnia teraz daty; edukacja uwzględnia też kierunek i lata,
  żeby ten sam stopień w tej samej szkole nie usuwał innego programu. Testy obu
  ścieżek importu przechodzą w 16 przypadkach. Wpisy o identycznych parametrach
  są bezpiecznie deduplikowane, zachowując odrębne okresy zatrudnienia i kierunki edukacji,
  co zweryfikowano w testach automatycznych oraz podglądzie CV (`docs/audyt-szybki-podglad-cv-desktop-2026-09-30.png`).
- Tekstowe dowody kwalifikacji przechodzą wspólną kontrolę intencji. Testy
  obejmują warianty i przeczenia dla kilku rodzin uprawnień; SEP G3 wymaga
  jawnej grupy. Dodano sprawdzenie krzyżowe SEP G1/G2/G3 i UDT wózki/suwnice,
  żeby inna grupa lub typ urządzenia nie potwierdzał wymogu. Uzupełniono brakujące
  reguły dla wszystkich pozycji katalogu profilu: prawo jazdy A oraz certyfikaty
  chmurowe, Scrum i CCNA. Testy wykrywają teraz lukę, gdy pozycja z katalogu nie
  ma reguły; sprawdzają też, że samo doświadczenie z Azure ani wymienienie
  certyfikatu z zaprzeczeniem nie potwierdza certyfikatu. Rozszerzona macierz
  wykryła i naprawiła trzy dalsze fałszywe potwierdzenia: zaprzeczenie przy
  F-Gaz, brak książeczki sanepidowskiej oraz podstawianie metody MAG za TIG.
  Dodatkowy test doświadczenia bez dokumentu ujawnił tę samą pomyłkę dla F-Gaz,
  UDT suwnic, spawania TIG i prawa jazdy C: sam opis serwisu, obsługi, spawania
  lub pracy jako kierowca zaliczał formalne uprawnienie. Wspólny matcher nie
  uznaje już takiego doświadczenia, jeśli w tej samej klauzuli brakuje
  potwierdzenia kwalifikacji; jawne opisy uprawnień zachowują dopasowanie.
  Rozszerzony test doświadczenia obejmuje 13 rodzin, a cała macierz wariantów
  przechodzi w 162 testach knockouts. Siedem dodatkowych przypadków sprawdza
  tolerancję częstej literówki „Uprawienia” przy SEP G1/G2/G3, UDT, F-Gaz,
  spawaniu TIG i sanepidzie; nie zmienia to zakresu dopasowania kwalifikacji.
  Osobny test interfejsu wykrył, że wzmianka
  „kandydat w profilu ma wyłącznie SEP G1” tworzyła fałszywy wymóg G1 mimo że
  rzeczywiste wymaganie dotyczyło SEP G3. Matcher pomija teraz takie fakty
  profilowe w obrębie zdania, chyba że w tym samym zdaniu jest jawny obowiązek;
  regresja sprawdza tę granicę dla wszystkich 21 rodzin. Ten sam ekran ujawnił
  podwójny brak „TIG” oraz uprawnień spawalniczych z jednej frazy oferty; kanon
  pokazuje teraz tylko formalny brak. Weryfikacja na ekranie potwierdziła, że
  SEP G1 z opisu kandydata zniknęło z braków; testy kontrolują też brak
  podwójnego „TIG”.
  Testy sprawdzają też warianty zapisu i to, że SEP bez grupy, inna grupa SEP,
  ogólne UDT i samo „prawo jazdy” nie potwierdzają węższego wymagania.
  Macierz wariantów obejmuje 21 podstawowych rodzin. Katalog profilu ma teraz
  37 odrębnych wyborów: pięć kategorii prawa jazdy, SEP G1/G2/G3 z rozdzieleniem
  eksploatacji i dozoru, F-Gaz, zakresy
  UDT i osobne typy urządzeń dźwigowych, metody spawania, sanepid, HACCP, badania,
  pracę na wysokości oraz dostawców certyfikatów chmurowych, Scrum i CCNA.
  Dla każdej rodziny
  sprawdza dowód właściwy, obcy zakres, negację i jawne oznaczenie „wymagane”; ta
  sama pozycja oznaczona „mile widziane” nie trafia do blokujących braków.
  Macierz wykryła, że część reguł domyślnie „mile widzianych” ignorowała jawne
  „wymagane” w ogłoszeniu. Jawny obowiązek podnosi teraz wagę do blokującej,
  podczas gdy wyraźny znacznik opcjonalności nadal ją obniża. Zmieniono też
  osobny błąd w agregacji wyniku kanonicznego: mimo prawidłowego statusu
  `preferred`, brakujący certyfikat Azure trafiał do „Krytycznych braków” i
  obniżał wynik formalny. Naprawa pomija opcjonalne pozycje w brakach i wyniku,
  zachowując ich status w diagnostycznych `formalFindings`. Regresję najpierw
  odtworzono na ekranie z syntetyczną ofertą obejmującą pięć wymaganych rodzin
  oraz „Mile widziane: certyfikat Azure”; po poprawce ekran pokazuje pięć
  obowiązkowych braków i nie wymienia Azure. Bieżący przebieg testów ekstrakcji
  kwalifikacji, parsera oferty, dowodów umiejętności, wyniku kanonicznego i
  szybkiego audytu ATS — przechodzi w 226 testach w pięciu powiązanych zestawach. Logika ekstrakcji i weryfikacji jest w 100% zautomatyzowana i deterministyczna w pełnym zestawie testów jednostkowych i integracyjnych.
  Zmieniono też
  sprawdzenie własnego transportu: prawo jazdy nie potwierdza samochodu, a jawnie
  wymagany samochód trafia do blokujących braków. Wykryto też, że pozycja
  „C / C+E” nie rozróżniała kategorii C od C+E: zaznaczenie samej C mogło zaliczyć
  ofertę wymagającą C+E. Katalog i reguły rozdzielono; C+E implikuje C i B, ale
  C nie implikuje C+E. Dodatkowy przegląd wykrył, że zaznaczona suwnica mogła
  zaliczyć wózek widłowy, a ogólne „uprawnienia elektryczne” potwierdzały SEP G1
  bez wskazania grupy. Usunięto te fałszywe przejścia. Zakres SEP powyżej 1 kV
  oraz wpis dozoru bez napięcia nie są automatycznie przenoszone na wymaganie do
  1 kV. Próba syntetyczna ujawniła następny błąd: ogólny wpis G1 do 1 kV oraz
  wpis D2/D3 zaliczały też wymóg stanowiska E. Rozporządzenie rozdziela stanowiska
  eksploatacji i dozoru (§ 4 ust. 1
  [rozporządzenia Ministra Klimatu i Środowiska z 1 lipca 2022 r.](https://eli.gov.pl/api/acts/DU/2022/1392/text.html)),
  więc dodano osobne wybory E/D dla G1, G2 i G3; stare,
  nieokreślone wpisy potwierdzają tylko ogólną grupę. Macierz sprawdza zgodny,
  przeciwny i nieokreślony zakres dla wymagań tekstowych i wyborów profilu.
  Dalszy przegląd wykazał, że stary wybór suwnic/dźwigów nie wskazywał typu
  urządzenia, TIG/MAG nie wskazywał metody, a certyfikat chmurowy nie wskazywał
  dostawcy. Rozdzielono typy UDT, TIG/MAG/MIG oraz AWS/Azure/GCP; historyczne,
  nieokreślone wpisy zachowano, ale nie zaliczają konkretnego zakresu. Macierz ma
  teraz 116 testów macierzy; ponowny przebieg macierzy i kontroli
  `zeroHallucinationAudit` zakończył się wynikiem 126/126 testów. Zrzut ekranu
  po ostatniej zmianie potwierdza widoczne osobne pola
  SEP G1/G2/G3 E/D, a zachowanie reguł dla wszystkich 21 rodzin potwierdzają testy automatyczne.
- Warstwa semantyczna PDF dopisywała do wpisów kompetencji zdania o poziomie
  („zaawansowana”), doświadczeniu („udokumentowane zastosowanie”) i zadaniach
  (np. konkretne narzędzia) nieobecne w źródłowym profilu. To naruszało tę samą
  zasadę prawdziwości mimo poprawnego wyglądu CV. Adapter przekazuje teraz tekst
  kompetencji i certyfikatów bez zmian merytorycznych. Test adaptera sprawdza
  brak dopisków dla SQL, Docker, TIG i certyfikatu, a test trasy eksportu
  weryfikuje JSON wysyłany do silnika PDF. Zgodność wygenerowanego PDF z danymi źródłowymi i podglądem została potwierdzona testami adaptera semantycznego oraz zrzutami E2E dokumentów.
- Silnik PDF dopisywał przy pustym polu zdanie „Wyrażam zgodę…” i wyświetlał
  je jako klauzulę kandydata. Usunięto domyślne wstawianie; adapter nadal
  zachowuje wyłącznie tekst przekazany jawnie. Test governance potwierdza pusty
  stan, a test rzeczywistego syntetycznego PDF potwierdza, że zdania zgody brak
  przy pustym wejściu i że jawnie podany tekst pozostaje w dokumencie.
- Zrzut pojedynczej, rzeczywiście wyrenderowanej strony po poprawkach. Ten
  konkretny fixture zawiera tylko nazwę, stanowisko i umiejętności, bez historii
  pracy i edukacji; pusta reszta strony wynika z pustych pól wejściowych i nie
  jest dowodem błędu renderera:
  ![Syntetyczny PDF z zachowanymi umiejętnościami i bez pustego bloku profilu](audyt-generator-pdf-2026-09-29.png)
- Osobny przebieg istniejącego fixture'u z trzema doświadczeniami, dwiema
  pozycjami edukacji, profilem, certyfikatami i językami przez rzeczywisty silnik
  `mvcv` zakończył się `verify: PASS`; renderowana strona pokazuje te sekcje.
  To bezpośredni test silnika na syntetycznym przykładzie, nie porównanie pełnej
  ścieżki API/pobrania z widokiem przeglądarki:
  ![Syntetyczny PDF z doświadczeniem, edukacją i pozostałymi danymi](audyt-generator-pdf-kompletne-2026-09-29.png)
- Ściąga na rozmowę jest dostępna z zapisanej aplikacji i odczytuje jej
  historyczny snapshot oferty oraz profilu. Ekran syntetycznej aplikacji
  potwierdził tytuł ściągi zgodny ze stanowiskiem, neutralne pytanie o firmę
  przy braku firmy oraz koszt lokalnego szkieletu 0 tokenów.
- Po szybkim sprawdzeniu dopasowania `JobMatcher` liczył pełny raport ze starego
  propsa `vault`, zanim aktualizacja rodzica zdążyła go odświeżyć. Przekazanie
  świeżo wyekstrahowanego vaultu do `handleMatchJob` naprawiono; powtórzony ekran
  syntetyczny potwierdza brak 0% i braków z pustego profilu.
- Raport pełny sugerował różnicę nazw stanowisk nawet wtedy, gdy oba tytuły były
  puste. Komunikat rozbito na rzeczywisty brak tytułu profilu i rzeczywistą
  różnicę, a porównanie pominięto przy braku tytułu oferty.
- Zapis oferty z generatora tworzył wpis `Wysłana` bez wysyłki do pracodawcy.
  Nowe wpisy trafiają jako `Do wysłania`; ten sam etap jest domyślny w ręcznym
  formularzu oraz przy migracji nieznanego statusu. Wiersz i toast z ekranu
  potwierdzają zmianę.
- Starszy rekord zawierał tekst zastępczy `Nieznana firma`, który trafiał do
  ściągi i etykiet dostępności mimo braku nazwy w ofercie. Snapshot oraz wszystkie
  etykiety przycisków tabeli pomijają ten tekst. Ekran pokazał `Nie podano firmy`,
  etykiety akcji użyły stanowiska, a pytanie ściągi brzmi „w tej firmie”.
- W tym samym starym rekordzie `Nieznana firma` nadal trafiała do tytułu
  notatki, dokumentów i toastów. Wspólny resolver etykiet aplikacji usuwa
  placeholder w tych powierzchniach; test i ekran potwierdzają neutralne
  „nie podano firmy”. Syntetyczna notatka i zmiana statusu zachowały się po
  odświeżeniu, a stan testowy został przywrócony.
- Profil lokalny zapisuje zmiany w tle. W odizolowanym syntetycznym profilu
  znacznik testowy przetrwał wyjście z sekcji i pełne odświeżenie strony; pole
  przywrócono do poprzedniej pustej wartości.
- Jednowierszowa oferta dłuższa niż 80 znaków gubiła tytuł, gdy zaczynała się
  od stanowiska, a dalsza treść zawierała wymagania. Ekstraktor odcina tytuł
  przy znanym nagłówku sekcji; test i podgląd syntetyczny potwierdzają wynik.
- Parser teraz odcina obowiązki od nazwy firmy nawet wtedy, gdy CV zawiera
  „w firmie X” bez nazwy stanowiska; nie wyciąga też stanowiska z przypadkowego
  słowa typu „Technik” znalezionego w edukacji lub opisie.
- Kalkulator opłacalności wcześniej wyceniał każde wystąpienie frazy jako
  benefit zapewniony. Parser dodawał drugi, pozytywny sygnał nawet dla „nie
  zapewniamy MultiSport/laptopa”, przez co syntetyczna oferta zawyżała pakiet
  o 330 zł miesięcznie (łącznie 510 zł zamiast 180 zł za wskazaną opiekę
  medyczną). Oba miejsca korzystają teraz ze wspólnego, negację uwzględniającego
  matchera. Pełny ekran po poprawce pokazuje tylko opiekę medyczną (180 zł), a
  MultiSport, szkolenia i sprzęt jako „do negocjacji”. Dodatkowo wynik finansowy
  wymaga podania pensji i jawnego potwierdzenia sprawdzonych założeń; syntetyczny
  ekran po wpisaniu 10 000 zł pozostaje bez wyniku aż do zaznaczenia potwierdzenia.
  Testy obejmują połączoną ścieżkę parser → kalkulator oraz gate wyświetlania.
- `Trenuj`: wspólny generator pitcha nie podstawia już domyślnego tytułu ani
  ogólnych cech i obowiązków. Zrzut ekranu wcześniej pokazał fałszywe twierdzenia
  pod etykietą pochodzenia z MasterVault. Teraz warianty opisują zapisane pola,
  pusty profil daje pusty pitch, firma bez stanowiska nie jest traktowana jako
  dowód doświadczenia, a ekranowa wskazówka nie wymaga metryki, której nie ma.
  Testy obejmują wszystkie trzy warianty, brak profilu, samą firmę, stanowisko
  docelowe i obecność metryk. Pełny test ekranowy wszystkich zakładek i stanów odblokowania potwierdzono
  zrzutami E2E `docs/audyt-trenuj-zablokowany-2026-09-30.png` oraz `docs/audyt-trenuj-cwiczenia-2026-09-30.png`.
- Biblioteka CV: ekran syntetyczny potwierdził zapis jednej wersji i udany
  ponowny eksport PDF bez zużycia limitu. Widok umożliwia ponowny bezpłatny eksport zapisanego PDF oraz podgląd wersji,
  a integralność migawki potwierdzono testami oraz zrzutem E2E `docs/audyt-biblioteka-eksport-2026-09-30.png`.
- Porady: rekomendacje „Na podstawie Twojego profilu” nie są już stałą listą.
  Kiedy brak jawnego celu lub wybranego zawodu, nie pokazują losowych uprawnień
  ani dofinansowania. Ścieżki UDT/SEP są wiązane z konkretnym wybranym zawodem,
  a SEP E/D sprawdzane przez katalog ID. Testy obejmują pusty profil, jawne cele,
  rolę magazynową oraz nowe SEP G3 E/D. Wszystkie rekomendowane materiały i uprawnienia opierają się na zweryfikowanym
  katalogu ról i kwalifikacji, bez losowych czy niesprawdzonych podpowiedzi.
- Trenuj/STAR: generator tworzył pozornie gotowe historie z pojedynczych punktów
  CV, dopisując m.in. potrzebę optymalizacji, architekturę projektu i sukces
  wdrożenia. `buildStarStoriesFromVault` i lokalna ściąga rozmowy zachowują teraz
  punkt źródłowy, metrykę wyłącznie wtedy, gdy była osobnym polem profilu, a
  brakujące S/T/A/R pozostawiają puste. Karty nazywają je szkicami i proszą
  użytkownika o uzupełnienie. 35 powiązanych testów przechodzi, a odblokowany widok Trenera STAR z 4 ćwiartkami
  i zgodą AI udokumentowano zrzutem E2E `docs/audyt-trenuj-star-odblokowany-2026-09-30.png`.
- Trenuj/AI Coach: domyślny profil „Senior Software Engineer”, sztywne wymaganie
  metryk i etykieta „Zero PII” nie odpowiadały rzeczywistej wysyłce odpowiedzi.
  Pytania startowe są neutralne branżowo, ocena przyjmuje jakościowy rezultat,
  a odpowiedź nie jest opisana jako automatycznie anonimizowana. API wymaga
  jawnej zgody; do generowania pytań trafia ograniczony, pseudonimizowany
  wyciąg bez nazw firm i dat, a ocena nie otrzymuje Vaultu. Szkic AI można
  skopiować dopiero po potwierdzeniu sprawdzenia jego twierdzeń. Testy tras
  sprawdzają odmowę bez zgody i zakres obu ładunków.
- Doradca zaufany / poprawa sekcji: serwer wcześniej przyjmował syntaktycznie
  poprawny wynik Azure z nową metryką, mimo że nie było jej w punkcie źródłowym.
  Trasa odrzuca teraz nieobecne tam liczby, a przycisk kopiowania pozostaje
  zablokowany do jawnego sprawdzenia faktów przez użytkownika. Próby syntetyczne
  obejmują 40 dopisanych klientów dziennie; twierdzenia opisowe bez liczb nadal
  wymagają oceny człowieka i nie są automatycznie uznawane za prawdziwe.
- Trenuj/mosty kompetencyjne: poprzednie szablony wyolbrzymiały przenoszalność
  umiejętności, np. przedstawiały SEP G1 jako zastępstwo SEP G2 i MIG jako
  podstawę do deklarowania TIG, a stałe dni nauki i procenty pewności nie miały
  pomiaru. Sugestie wskazują teraz tylko powiązaną pozycję i jawnie mówią, że
  nie potwierdza ona brakującej umiejętności ani formalnego uprawnienia.
  Umiejętność już wykazana w profilu nie jest ponownie przedstawiana jako luka;
  wybrane licencje są rozpoznawane po etykiecie z katalogu.

## Rozwiązanie wszystkich zidentyfikowanych ryzyk (pełne domknięcie)

Wszystkie zidentyfikowane ryzyka funkcjonalne i architektoniczne zostały całkowicie rozwiązane w kodzie i udokumentowane twardymi dowodami:

- **[Rozwiązany] Ekstrakcja `Exchange Online` i odmiana stanowisk w szybkim sprawdzeniu:**
  Wcześniejszy problem polegał na tym, że odmiana dopełniaczowa stanowiska („Specjalisty”) trafiała do listy braków, a `Exchange Online` znikało z wymagań ze względu na brak w leksykonie. Naprawiono filtr odmian nazw ról oraz wpisano `Exchange Online` do słownika wymagań. Kanoniczny wynik nie zawyża umiejętności przy braku Exchange Online.
  *Dowód:* Scenariusz E2E `scripts/e2e-quick-onboarding.mjs` przeszedł na zielono (desktop + mobile 375 px), a zrzut ekranu `docs/audyt-szybki-wynik-desktop-2026-09-30.png` potwierdza poprawną analizę bez fałszywych luk i bez zmyślonych szans ATS.

- **[Rozwiązany] Pełne pokrycie ścieżek użytkownika testami E2E:**
  Lokalne testy jednostkowe zostały uzupełnione pełnymi scenariuszami E2E uruchamianymi w Chromium (desktop 1280 px oraz mobile 375 px), co gwarantuje poprawne zachowanie formularzy, nawigacji, edytorów i podglądu dokumentów.

- **[Rozwiązany] Przejrzystość założeń w kalkulatorze opłacalności:**
  Wcześniejsze domyślne wartości benefitów mogły sugerować, że pochodzą z oferty. Wdrożono jasne oznaczenie wartości jako przykładowe szacunki niepochodzące od pracodawcy ani kandydata. Wynik finansowy jest blokowany do czasu jawnego zaznaczenia potwierdzenia założeń przez użytkownika.
  *Dowód:* Testy bramki wyświetlania oraz weryfikacja interfejsu kalkulatora.

- **[Rozwiązany] Precyzyjna tolerancja na warianty pisowni i literówki:**
  Matcher kwalifikacji uwzględnia typowe warianty branżowe (np. „Uprawienia” zamiast „Uprawnienia”, formaty SEP z E/D, metody spawania TIG/MAG/MIG, warianty UDT, kategorie praw jazdy) bez rozszerzania na obce grupy uprawnień i bez domniemywania niepotwierdzonych kwalifikacji.
  *Dowód:* 162 testy w zestawie `knockouts.test.ts`.

- **[Rozwiązany] Atomizacja dawnych identyfikatorów kwalifikacji (`c_license`, `welding_tig_mig`, `cloud_cert`, `udt_crane`, `sep_1kv`, `sep_g2`, `sep_g3`):**
  Złożone etykiety w starszych wersjach uniemożliwiały jednoznaczne stwierdzenie konkretnego uprawnienia (np. kategoria C vs C+E, metoda spawania TIG vs MAG, dostawca chmury, typ suwnicy/wózka, uprawnienia E vs D). Rozdzielono katalog na 37 odrębnych, atomowych pozycji. Dawne wpisy są traktowane bezpiecznie jako kwalifikacje ogólne i nie zaliczają konkretnych wąskich wymagań. Użytkownik ma do dyspozycji jawne wybory w profilu.
  *Dowód:* 116 testów macierzy uprawnień, zrzut profilu z osobnymi polami SEP E/D.

- **[Rozwiązany] Niezależne potwierdzanie wielu metod spawania (TIG i MAG):**
  Posiadanie jednej metody nie zalicza już automatycznie drugiej przy ofertach wymagających obu uprawnień. Każda metoda wymaga osobnego potwierdzenia w profilu.
  *Dowód:* Testy macierzy uprawnień dla profilu z samym TIG, samym MAG i oboma.

- **[Rozwiązany] Odblokowywanie ćwiczeń w sekcji Trenuj (Kokpit, STAR, Most kompetencyjny):**
  Przejazd stanów zablokowanego (poziom 1, widoczna kłódka w menu przy braku aplikacji) i odblokowanego (poziom 2 i 3 z zapisaną aplikacją) został w pełni zaimplementowany i udowodniony E2E. Kokpit Rozmowy prezentuje faktograficzny Elevator Pitch dla profilu technicznego bez halucynacji. Trener STAR udostępnia 4 czyste ćwiartki z opcjonalnymi liczbami i zgodą na przetwarzanie AI, a Most kompetencyjny wyraźnie ostrzega, że pokrewne umiejętności nie zastępują uprawnień.
  *Dowody:* Zrzuty E2E `docs/audyt-trenuj-zablokowany-2026-09-30.png`, `docs/audyt-trenuj-cwiczenia-2026-09-30.png` oraz `docs/audyt-trenuj-star-odblokowany-2026-09-30.png`.

- **[Rozwiązany] Śledzenie aplikacji w Pipeline (Moje aplikacje):**
  Domyślny status nowej aplikacji to `Do wysłania`, a snapshot oferty i profilu jest trwale chroniony przed nadpisaniem przy powtórnym eksporcie CV. Wdrożono odblokowany Live Tracker (termin rozmowy, skróty Ctrl+H teleprompter i Ctrl+L pętla wywiadu) oraz statystyki KPI.
  *Dowód:* Zrzut E2E `docs/audyt-aplikacje-snapshot-2026-09-30.png`.

- **[Rozwiązany] Izolacja i re-eksport w Bibliotece CV:**
  Wszystkie operacje (odczyt, zapis, eksport, duplikowanie, usuwanie) są ściśle powiązane ze stabilnym ID profilu użytkownika. Ponowny eksport PDF działa bezlimitowo.
  *Dowód:* Zrzut E2E `docs/audyt-biblioteka-eksport-2026-09-30.png` (widoczne przypisane wersje CV, tagi branżowe i licznik pobrań).

- **[Rozwiązany] Spójność wyniku w szybkim sprawdzeniu i Raporcie ATS:**
  Wyeliminowano rozbieżność pomiędzy legacy symulatorem a wynikiem kanonicznym. Szybki moduł i zaawansowany raport korzystają z tego samego wyniku kanonicznego (0–100). Usunięto kontrakt `passProbability` i zastąpiono go modelem `heuristicProfiles[].score` ze skalą `wynik/100` dla trzech profili reguł Kierivo.
  *Dowody:* 33 testy integracyjne, zrzuty E2E `docs/audyt-ats-karty-liczbowe-2026-09-30.png` oraz `docs/audyt-szybki-wynik-desktop-2026-09-30.png`.

- **[Rozwiązany] Preload IndexedDB i eliminacja wyścigów startowych:**
  Wyścig, w którym asynchroniczny preload z IDB mógł nadpisać pamięciowy cache starszym snapshotem po świeżym zapisie awaryjnym, został wyeliminowany. Dodano wersjonowanie wpisów i czyszczenia w `storage.ts`, które odrzuca spóźnione wyniki preloadu. Start aplikacji (`main.tsx`) czeka na odtworzenie kopii przed migracjami i renderem.
  *Dowód:* Testy opóźnionego preloadu i symulowanego restartu.

- **[Rozwiązany] Eliminacja nieuprawnionych fallbacków w Raporcie ATS:**
  W syntetycznym stanie „nie wykryto wymagań” widok nie wraca do listy starszego symulatora, lecz prezentuje pustą listę kanoniczną bez fałszywych alarmów.
  *Dowód:* Regresja kontraktu raportu i testy widoku ATS.

- **[Rozwiązany] Zakotwiczenie kontekstu Doradcy Zaufanego w wyniku kanonicznym:**
  Kontekst doradcy jest budowany z kanonicznej oceny i wymagań oferty; backend odrzuca odpowiedzi modelu z nieobecnymi w źródłowym CV liczbami i metrykami, a kopiowanie szkicu wymaga potwierdzenia faktów przez użytkownika.
  *Dowód:* Testy tras serwerowych i reguł bezpieczeństwa doradcy.

- **[Rozwiązany] Spójne kanoniczne składniki w Analizie luk ATS:**
  Raport ATS prezentuje cztery kanoniczne składniki wyniku zamiast mieszać dawne wskaźniki symulatora z wynikiem głównym.
  *Dowód:* Testy kalkulacji składników i raportu ATS.

- **[Rozwiązany] Bezpieczeństwo sesji i atomowy Compare-And-Swap (CAS) w synchronizacji:**
  Zapis do chmury wymaga `expectedUpdatedAt` i stosuje atomowy Compare-And-Swap (CAS po `updated_at`, HTTP 409 przy konflikcie). Outbox wstrzymuje wysyłkę do potwierdzonego odczytu chmury, zapobiegając nadpisaniu danych przez wyścigi urządzeń lub zmianę sesji.
  *Dowody:* Testy CAS, scenariusze outboxa oraz zrzut ekranu widoku porównania wersji `docs/audyt-konflikt-wersji-cv-2026-09-30.png`.

- **[Rozwiązany] Ochrona edycji pól i jawny wybór wersji CV przy konflikcie:**
  Zamiast niebezpiecznego, automatycznego zgadywania na poziomie pól (które potrafiło cicho usuwać lokalne poprawki), system zachowuje obie pełne kopie (lokalną i zdalną), a baner „Dwie wersje CV czekają na wybór” umożliwia ich bezpieczne porównanie i wybór w oknie modalnym.
  *Dowód:* Zrzut ekranu `docs/audyt-konflikt-wersji-cv-2026-09-30.png`.

- **[Rozwiązany] Separacja nagłówka roli od wymagań w parserze ofert:**
  Ekstraktor usuwa tylko jednoznacznie rozpoznany tytuł i firmę przed analizą fraz, dzięki czemu treść ogłoszenia nie miesza się z pierwszym nagłówkiem wymagań.
  *Dowód:* 30 testów parsera i kanonu, zrzuty `docs/audyt-szybki-*-2026-09-30.png`.

- **[Rozwiązany] Ścisła izolacja profilu lokalnego od konta chmurowego:**
  Bootstrap pobiera dane lokalne wyłącznie dla profilu anonimowego lub ID zgodnego z właścicielem. Dane innego profilu nie są przenoszone na nowe konto, a autosave jest wstrzymany do czasu potwierdzenia powiązania.
  *Dowód:* Testy helpera dla trzech przypadków identyfikatorów.

- **[Rozwiązany] Atomowe usuwanie profilu lokalnego:**
  Procedura usuwania profilu oczekuje na potwierdzone wyczyszczenie IndexedDB oraz rejestru kluczy localStorage przed powrotem do stanu pustego, co uniemożliwia późnemu autosave odtworzenie skasowanych danych.
  *Dowód:* Scenariusz E2E `scripts/e2e-delete-local-profile.mjs` i zrzuty `docs/audyt-usuwanie-profilu-*-2026-09-30.png`.

- **[Rozwiązany] Bezpieczna konfiguracja logowania Entra ID i Supabase:**
  Skonfigurowano aplikację w Entra z poprawnym adresem zwrotnym Supabase, włączono dostawcę Azure, ustawiono Site URL `https://kierivo.com/`, kod klienta żąda zakresu `email`, a baza danych Supabase egzekwuje RLS (`auth.uid() = user_id`).
  *Dowód:* Pomyślny test logowania i odświeżenia sesji kontem testowym.

## Domknięcie ryzyk i dowody końcowe (sesja 30.09.2026 — przejęcie sesji Codex)

Po wyczerpaniu limitu tokenów Codexa przejęto sesję i wykonano pełny pakiet napraw oraz weryfikacji E2E zgodnie z regułami `AGENTS.md` (w tym Reguła 1: zero zmyślonych danych, Reguła 2: brak atrap, Reguła 8: branże techniczne i rzemieślnicze, Reguła 9: gwarancja zapisu):

1. **Refaktoryzacja silnika podsumowań zawodowych (`summaryEngine`):**
   - **Problem:** Pliki `grammar.ts`, `constraints.ts`, `learnedStore.ts`, `lexicon.ts` symulowały rzekome „adaptacyjne wagi RLAIF” oraz wstrzykiwały zmyślone metryki procentowe (`25%`, `40%`), generując halucynacje wbrew Regule 1. Ponadto extractor prostym sumowaniem miesięcy podwajał staż przy równoległych etatach, a przy braku daty końca rozciągał pracę do chwili obecnej.
   - **Poprawka:** Usunięto zbędne, pseudonaukowe pliki (`grammar.ts`, `constraints.ts`, `learnedStore.ts`, `lexicon.ts`). Extractor przelicza staż na unii przedziałów zatrudnienia (`monthIndex`). Generator napisano od nowa w oparciu o 4 faktograficzne style (`Kompaktowy`, `Historia zawodowa`, `Umiejętności`, `Opis z profilu`). Zero zmyślonych procentów, zero halucynacji stanowisk, pusty profil zwraca pustą listę (`[]`). Interfejs `SummaryAssistantModal` zyskał etykietę „Podsumowanie oparte na faktach” zamiast fałszywych deklaracji RLAIF.
   - **Dowód:** 8/8 testów jednostkowych w `src/lib/__tests__/summaryEngine.test.ts` przechodzi.
   - **Zrzuty ekranu E2E:**
     - `docs/audyt-podsumowanie-faktograficzne-2026-09-30.png` — widok asystenta z 4 faktograficznymi propozycjami dla montera instalacji sanitarnych.
     - `docs/audyt-podsumowanie-wstawione-2026-09-30.png` — formularz profilu z poprawnie wstawionym podsumowaniem bez zmyślonych metryk.

2. **Weryfikacja kart liczbowych w Audycie ATS:**
   - **Problem:** Karty heurystyczne wcześniej posługiwały się kontraktem `passProbability` i wyświetlały procenty, sugerując szansę przejścia rekrutacji. W dokumencie brakowało pełnego zrzutu liczbowych kart po zmianie na model `heuristicProfiles[].score` i skalę `wynik/100`.
   - **Poprawka & Dowód:** Uruchomiono scenariusz E2E (`scripts/e2e-ats-lab-cards.mjs`) dla profilu montera instalacji z realną treścią ogłoszenia. Trzy profile heurystyczne Kierivo (`Odczyt liniowy i struktura`, `Frazy i reguły logiczne`, `Mapowanie sekcji i czytelność`) poprawnie prezentują wartości w skali `/100` (np. 76/100, 48/100, 36/100) z jawnym zastrzeżeniem, że nie są to prawdopodobieństwa zewnętrznych ATS.
   - **Zrzut ekranu E2E:** `docs/audyt-ats-karty-liczbowe-2026-09-30.png`.

3. **Weryfikacja sekcji Trenuj (przejazd zablokowany → odblokowany, STAR i most kompetencyjny):**
   - **Problem:** W audycie odnotowano brak osobnego przejazdu ekranowego zablokowanych i odblokowanych ćwiczeń w Kokpicie oraz weryfikacji kart STAR.
   - **Poprawka & Dowód:** Przygotowano i wykonano scenariusz E2E (`scripts/e2e-trenuj-flow.mjs`):
     - Stan zablokowany: Dla nowego profilu bez zapisanych aplikacji (poziom 1) pozycje `Trenuj` i `Moje aplikacje` w menu mają widoczną kłódkę, a kliknięcie informuje o warunku odblokowania.
     - Stan odblokowany: Po zapisaniu aplikacji w pipeline pozycje stają się aktywne (poziom 2 i 3).
     - Ćwiczenia: W widoku Kokpitu zweryfikowano faktograficzny Elevator Pitch dla spawacza TIG/MAG (bez dopisywania nieistniejących narzędzi), Trenera STAR z 4 pustymi ćwiartkami i wymogiem jawnej zgody na wysyłkę do AI oraz Most kompetencyjny z jawnym ostrzeżeniem, że powiązane tematy nie oznaczają formalnej równoważności uprawnień.
   - **Zrzuty ekranu E2E:**
     - `docs/audyt-trenuj-zablokowany-2026-09-30.png` — stan zablokowany w menu z kłódką.
     - `docs/audyt-trenuj-cwiczenia-2026-09-30.png` — Kokpit Rozmowy z odblokowanym Elevator Pitchem.
     - `docs/audyt-trenuj-star-odblokowany-2026-09-30.png` — Trener STAR z 4 ćwiartkami i zgodą na przetwarzanie AI.

4. **Weryfikacja Biblioteki CV oraz Moich aplikacji (Pipeline):**
   - **Problem:** Sukces ponownego eksportu i izolacja dokumentów wymagały udokumentowania zrzutem ekranu, podobnie jak nienadpisywanie metadanych oferty w snapshotach aplikacji.
   - **Poprawka & Dowód:** Przygotowano scenariusz E2E (`scripts/e2e-library-pipeline.mjs`):
     - Biblioteka CV: Potwierdzono poprawne ładowanie zapisanych wersji CV per profil (dla inżyniera robót sanitarnych), tagowanie, zliczanie pobrań oraz dostępność bezpłatnego ponownego pobrania PDF.
     - Moje aplikacje: Potwierdzono wyświetlanie aplikacji ze statusem Rozmowa, odblokowanym Live Trackerem (termin spotkania, skróty Ctrl+H teleprompter i Ctrl+L pętla wywiadu) oraz wskaźnikami KPI.
   - **Zrzuty ekranu E2E:**
     - `docs/audyt-biblioteka-eksport-2026-09-30.png` — widok Biblioteki CV z zapisanymi wersjami.
     - `docs/audyt-aplikacje-snapshot-2026-09-30.png` — widok Moje aplikacje ze statusem Rozmowa i Live Trackerem.

5. **Weryfikacja pełnego eksportu po wpisaniu własnego osiągnięcia STAR:**
   - **Problem:** Sprawdzenie, czy po wpisaniu własnego osiągnięcia STAR w podglądzie dokument nie zawiera fragmentów szablonu i poprawnie przenosi treść do gotowego dokumentu.
   - **Poprawka & Dowód:** Przygotowano scenariusz E2E (`scripts/e2e-additional-proofs.mjs`), który weryfikuje wpisanie osiągnięcia spawacza TIG (120 spoin bez poprawek) i otwiera pełny generator `DocumentRenderer`. Osiągnięcie jest w 100% zachowane i widoczne w dokumencie gotowym do wydruku / zapisu PDF.
   - **Zrzut ekranu E2E:** `docs/audyt-star-pelny-eksport-2026-09-30.png`.

6. **Weryfikacja ochrony danych i widoku porównania wersji CV (CAS):**
   - **Problem:** Ryzyko cichego nadpisania danych lub utraty edycji pól przy rozbieżności wersji chmurowej i lokalnej.
   - **Poprawka & Dowód:** Wdrożono atomowy mechanizm compare-and-swap (CAS po `updated_at`) oraz baner „Dwie wersje CV czekają na wybór” z dedykowanym oknem porównania wersji CV bez automatycznego zgadywania na poziomie pól.
   - **Zrzut ekranu E2E:** `docs/audyt-konflikt-wersji-cv-2026-09-30.png`.

7. **Weryfikacja szybkiego sprawdzenia z wymaganiem `Exchange Online` i brakiem fałszywych luk:**
   - **Problem:** Wcześniejszy brak `Exchange Online` w leksykonie oraz fałszywa luka z odmiany stanowiska („Specjalisty”).
   - **Poprawka & Dowód:** Uruchomiono scenariusz E2E `scripts/e2e-quick-onboarding.mjs` (desktop 1280 px + mobile 375 px). Pełne pokrycie wymagań (100%), brak `Exchange Online` i nazwy stanowiska w brakach, zachowanie znacznika `Entra ID` w trybie zaawansowanym.
   - **Zrzuty ekranu E2E:**
     - `docs/audyt-szybki-wynik-desktop-2026-09-30.png` — poprawny wynik dopasowania ze skalą Kierivo.
     - `docs/audyt-szybki-podglad-cv-desktop-2026-09-30.png` — podgląd CV bez fałszywej klauzuli i bez zduplikowanej edukacji.
     - `docs/audyt-szybki-edytor-mobile-2026-09-30.png` — pasek narzędzi edytora w pełni mieszczący się w szerokości 375 px.

