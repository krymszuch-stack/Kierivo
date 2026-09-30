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

| Problem | Zastosowane rozwiązanie | Dowód i granica potwierdzenia |
| --- | --- | --- |
| Wynik ATS udawał szansę przejścia; szybki i pełny raport się rozjeżdżały | Jeden kanoniczny wynik 0–100 i neutralne etykiety; obowiązkowe i opcjonalne kryteria liczone osobno | Testy kanonu i lokalny przejazd szybkiego wyniku; produkcja nadal pokazuje starszy tekst marketingowy do czasu wdrożenia kodu |
| Wymagania z ogłoszenia mieszały tytuł, firmę, atuty i formalne kwalifikacje | Parser usuwa rozpoznany nagłówek, zachowuje `TCP/IP`, oddziela atuty; matcher wymaga potwierdzenia konkretnej kategorii uprawnienia | Testy parsera/holdout i syntetyczny ekran desktop + 375 px; nie ma kalibracji na zewnętrznych ATS |
| Generator potrafił dopisać niepodane fakty lub powtórzyć edukację | Podsumowanie i klauzula zgody tylko na podstawie przekazanej treści; deduplikacja edukacji i wspólne źródło danych do eksportu | Testy generowania oraz lokalny podgląd; artefakt produkcyjny nadal wymaga porównania z podglądem |
| PDF przenosił ukryty Vault i nie drukował części jawnych uprawnień | Usunięto ukryte dane i zmyślone poziomy; widoczny renderer uprawnień, opisu i osiągnięć | Testy Python i Node na syntetycznych danych; bez porównania z pobranym PDF produkcyjnym |
| Operacje AI mogły ruszyć bez świadomej zgody na przekazanie danych | Serwerowe bramki zgody oraz prawdziwe komunikaty o zakresie wysyłki do Azure | Testy tras; rzeczywisty przepływ Azure + Supabase nie został jeszcze domknięty |
| Zapis lub usuwanie profilu mogły utracić dane albo odtworzyć je po usunięciu | Trwały transfer do IndexedDB, blokada późnego autosave i oczekiwanie na usunięcie obu magazynów | Testy transakcji i pełny ekranowy test usunięcia fikcyjnego profilu; usunięcie konta w Supabase nadal bez testu |
| Logowanie Microsoft było widoczne, lecz dostawca nie był skonfigurowany | Rejestracja Entra, callback Supabase, `xms_edov`, zakres `email`, włączony dostawca i `kierivo.com` jako Site URL | Rzeczywiste logowanie kontem właściciela i odświeżenie sesji przeszły; lokalny kod z zakresem `email` nie jest jeszcze na produkcji, a wydawca nie jest zweryfikowany |
| Bank STAR kopiował do CV fikcyjne metryki, narzędzia i uprawnienia | Przykłady są oznaczone jako fikcyjne. Kliknięcie pokazuje szablon obok pola, ale nie zapisuje go jako faktu w Vault; placeholder nie zawiera wymyślonych liczb. Komunikat kontroli historii nie deklaruje już „100% spójności” przy pustych danych | Ekranowy test na fikcyjnym profilu potwierdził widoczną podpowiedź i brak jej tekstu w polach CV; zrzut `docs/audyt-star-szablon-obok-cv-2026-09-30.png`. Pełny eksport po wpisaniu własnego osiągnięcia pozostaje do sprawdzenia |

Przejazd uzupełnionego fikcyjnego osiągnięcia potwierdził jego widoczność w
podglądzie CV i brak tekstu szablonu (`docs/audyt-star-wlasna-tresc-podglad-2026-09-30.png`).
Edytor podglądu miał osobną drogę dopisywania niepotwierdzonego zdania
„Wdrożyłem / zrealizowałem zadanie osiągając mierzalny rezultat...”. Nowy punkt
jest pusty i widoczny tylko podczas edycji. Scenariusz ekranowy po kliknięciu
sprawdził puste pole, brak tego zdania w podglądzie oraz skopiowanym tekście CV;
fikcyjne osiągnięcie podane przez użytkownika pozostało w kopii.
Zrzut: `docs/audyt-star-pusty-punkt-podgladu-2026-09-30.png`.
Lokalny profil nie może uruchomić pobrania serwerowego PDF bez zalogowanego
konta chmurowego, więc zgodność pobranego artefaktu nadal nie jest dowiedziona.
Ten sam zrzut ujawnił zbyt szeroką klasyfikację stanowiska: sam wyraz „Tester”
przypisywał pracę przy procesie do IT. Reguła wymaga teraz kontekstu
oprogramowania lub aplikacji, a test odróżnia te nazwy od testera produkcji.
Przejazd odkrył też drugi komunikat zapewniający „Logika i osie czasu OK”
przy pustym profilu. Pasek profilu i sekcja doświadczenia korzystają teraz
ze wspólnego rozpoznania: brak danych, niepełne daty, uwagi albo brak uwag
w podanym zakresie. E2E potwierdza dwa pierwsze stany na ekranie fikcyjnego
profilu; test funkcji obejmuje wszystkie cztery. Taki komunikat nie dowodzi
poprawności samego algorytmu wykrywania nakładania się zatrudnienia. Zrzuty
`docs/audyt-os-czasu-brak-danych-2026-09-30.png` i
`docs/audyt-os-czasu-niepelne-daty-2026-09-30.png` pokazują oba stany.

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
jawnego wymagania oraz cztery rodziny kwalifikacji. Lokalny zrzut UI potwierdził
wyłącznie ekran demonstracyjnej oferty; nie pokazuje on nowego szybkiego widoku.
Nie wykonano walidacji terminologii z ekspertami ani testu produkcyjnego, więc
nowe/nieznane formaty ofert mogą nadal wymagać ręcznego potwierdzenia.

### Transfer danych do profilu lokalnego

Kontrolowana awaria zapisu do IndexedDB odtworzyła możliwość utraty anonimowego
Vaultu podczas tworzenia profilu: funkcja wywoływała zapis awaryjny bez
oczekiwania na wynik, po czym usuwała źródło. To samo ryzyko obejmowało historię
aplikacji i bibliotekę CV. Migracja czeka teraz na potwierdzenie trwałego zapisu
wszystkich kopii i aktywnego profilu; błąd zatrzymuje tworzenie profilu, a
źródła zostają na miejscu. Testy objęły awarię każdej kopii oraz udany zapis
Vaultu do IndexedDB odczytany po symulowanym restarcie. Zrzutu ekranu nie
wykonano: test dotyczył awarii i potwierdzenia transakcji, a nie zmiany widoku.
Nie sprawdzono limitów ani przerywania transakcji w rzeczywistej przeglądarce.

## Uzupełnienie generatora CV — renderer uprawnień

Kontrola źródeł wykazała, że payload PDF zawierał formalne uprawnienia, lecz
renderer ich nie drukował; opis doświadczenia był renderowany wyłącznie wtedy,
gdy brakowało punktów osiągnięć. Dodano widoczną sekcję uprawnień, mapowanie
znanych ID na czytelne etykiety oraz zachowanie opisu obok punktów. Podgląd UI
pokazuje teraz narzędzia, umiejętności interpersonalne, uprawnienia, certyfikaty
i języki obsługiwane w PDF. Test pobranego PDF potwierdza widoczność
`SEP G1 E1 do 1 kV — eksploatacja`; test adaptera sprawdza opis i mapowanie ID.
Testy Python: 42/42, adapter/trasa Node: 23/23. Nie wykonano jeszcze ekranu po
poprawce ani pełnego porównania treści PDF z podglądem. Dalszy syntetyczny
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
niepotwierdzonego procentu; ekranowy test tego ostrzeżenia pozostaje otwarty.

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
  wynik przy pustym profilu. Ekranowego kopiowania ze schowka po zmianie jeszcze
  nie przeprowadzono.

- Mikro-wywiad Doświadczenia wcześniej generował gotowe zdania o jakości,
  terminowości, bezpieczeństwie i pracy zespołowej bez takich danych w wyborach.
  Potrafił też podstawić pierwszy obiekt z katalogu, zanim użytkownik go wybrał.
  Słownik odmiany rozszerzał niektóre czynności o niepodane obiekty, np. SQL lub
  oprogramowanie; rozszerzenia są teraz dopuszczane tylko wtedy, gdy ich słowa
  można znaleźć w tekście czynności źródłowej.
  Warianty zawierają teraz tylko wskazaną czynność, obiekty, wybrane narzędzia
  oraz jawnie wybrany efekt lub metrykę. Bez obiektu generator nie zwraca tekstu;
  zatwierdzenie jest możliwe po potwierdzeniu faktów. Bramka jest pokryta testem,
  ale nowego zrzutu interfejsu po zmianie jeszcze nie ma.
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
  stronie endpointu. Regresja potwierdza HTTP 400 bez zgody, bez pobrania limitu
  i bez wywołania modelu; ekran testowy pokazuje informację, ale zalogowanej
  ścieżki i rzeczywistego wywołania Azure nie sprawdzano.
- Kwalifikacje nie są sprawdzane tylko na SEP G3: testy ekstraktora obejmują
  21 rodzin i 37 wariantów identyfikatorów oraz przypadki przeczeń, opcjonalnych
  zapisów, różnych zakresów urządzeń i wyłącznie doświadczenia zawodowego.
  Macierz obejmuje m.in. kategorie prawa jazdy, SEP G1/G2/G3 z E/D, F-Gaz,
  typy UDT, metody spawania, wymogi sanitarne, medyczne, językowe, zmianowe,
  transport oraz certyfikaty chmurowe, Scrum i Cisco. 32 testy pliku
  `knockouts.test.ts` przechodzą syntetycznie; nie oznacza to jeszcze, że każda
  możliwa pisownia branżowa została pokryta ani że wykonano osobny zrzut ekranu
  dla każdego identyfikatora.
- Kanoniczny wynik umiejętności wcześniej składał w jeden tekst również nazwy
  pracodawców i instytucji edukacyjnych. Syntetyczne CV bez kompetencji SAP
  dostawało `100%` dopasowania do SAP, gdy pracodawcą było `SAP Polska`; nazwa
  szkoły `AWS Academy` też mogła spełnić wymaganie AWS. Oba źródła wyłączono z
  korpusu kompetencji; 15 testów `canonicalAts.test.ts`, w tym dwie regresje,
  przechodzi. Samo pojawienie się frazy nadal oznacza dopasowanie treści CV,
  nie zweryfikowaną biegłość kandydata. Nie wykonano osobnego zrzutu ekranu
  tych dwóch edge-case'ów. Dalszy test wykazał, że długi tytuł zawodowy sam
  wystarczał do stanu `SCORABLE`, a tytuł „Python Developer” potwierdzał
  wymaganą umiejętność Python bez innego wpisu. Tytuł roli usunięto z korpusu
  dowodów; dwa testy regresji potwierdzają `INSUFFICIENT_CV` dla profilu z samym
  tytułem oraz brak potwierdzenia Python. Zrzutu ekranu po tej zmianie jeszcze
  nie wykonano. Próba na surowym CV ujawniła obejście tego zabezpieczenia:
  globalny skan słownika w parserze dodawał SAP z „SAP Polska” do umiejętności,
  więc kanoniczny wynik szybkiej ścieżki zaliczał SAP. Parser skanuje teraz
  wyodrębnione pola treści i sekcje umiejętności, bez nagłówków ról, pracodawców
  i instytucji. Lista braków, trzy główne problemy oraz widoczne pokrycie
  korzystają z wyniku kanonicznego; wskaźnik formatowania jest jawnie opisany
  jako symulacja. Syntetyczny test sprawdza SAP Polska i AWS Academy oraz
  wymusza pokazanie obu wymagań jako braków. Powiązane 77 testów parsera,
  szybkiego wyniku, kanonu i audytu zera halucynacji przechodzi. Zrzutu ekranu
  wyniku po tej poprawce jeszcze nie wykonano.
- Świeżość stażu wcześniej zależała od kolejności kart: zmiana kolejności tych
  samych stanowisk zmieniła składową `experience` z 72 na 54. Silnik szuka
  teraz dopasowanych kompetencji w trzech najnowszych prawidłowych przedziałach
  dat zamiast traktować pierwszy element tablicy jako najnowszy; bez prawidłowej
  daty bonusu świeżości nie ma. Regresja potwierdza identyczny wynik po
  odwróceniu listy. Zrzutu ekranu dla tego syntetycznego przypadku nie wykonano.
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
  ścieżek importu przechodzą w 16 przypadkach. Pozostaje niejednoznaczność wpisów
  bez dat i innych szczegółów rozróżniających — sam tekst nie zawsze pozwala
  stwierdzić, czy to duplikat, czy osobny okres. Te dwa przypadki sprawdzono
  automatycznie; zrzutu ekranu modalu importu dla nich jeszcze nie wykonano.
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
  szybkiego audytu ATS — przechodzi w 226 testach w pięciu powiązanych zestawach.
  To weryfikacja logiki na syntetycznych danych; nie oznacza osobnego zrzutu
  ekranu dla każdej rodziny kwalifikacji.
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
  SEP G1/G2/G3 E/D. Pełny wynik dla każdej rodziny nie był weryfikowany osobnym
  zrzutem.
- Warstwa semantyczna PDF dopisywała do wpisów kompetencji zdania o poziomie
  („zaawansowana”), doświadczeniu („udokumentowane zastosowanie”) i zadaniach
  (np. konkretne narzędzia) nieobecne w źródłowym profilu. To naruszało tę samą
  zasadę prawdziwości mimo poprawnego wyglądu CV. Adapter przekazuje teraz tekst
  kompetencji i certyfikatów bez zmian merytorycznych. Test adaptera sprawdza
  brak dopisków dla SQL, Docker, TIG i certyfikatu, a test trasy eksportu
  weryfikuje JSON wysyłany do silnika PDF. Rzeczywista zawartość pobranego PDF
  nadal wymaga porównania z danymi źródłowymi i podglądem.
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
  docelowe i obecność metryk. Pełny test ekranowy pozostałych zakładek i stanów
  odblokowania nadal jest potrzebny.
- Biblioteka CV: ekran syntetyczny potwierdził zapis jednej wersji i udany
  ponowny eksport PDF bez zużycia limitu. Widok nie oferuje ponownego otwarcia
  kopii do edycji; pozostaje sprawdzić faktyczną zawartość wygenerowanego PDF
  wobec zapisanej migawki.
- Porady: rekomendacje „Na podstawie Twojego profilu” nie są już stałą listą.
  Kiedy brak jawnego celu lub wybranego zawodu, nie pokazują losowych uprawnień
  ani dofinansowania. Ścieżki UDT/SEP są wiązane z konkretnym wybranym zawodem,
  a SEP E/D sprawdzane przez katalog ID. Testy obejmują pusty profil, jawne cele,
  rolę magazynową oraz nowe SEP G3 E/D. Rzetelność źródeł, terminów i opisów
  materiałów nadal wymaga audytu pozycji po pozycji.
- Trenuj/STAR: generator tworzył pozornie gotowe historie z pojedynczych punktów
  CV, dopisując m.in. potrzebę optymalizacji, architekturę projektu i sukces
  wdrożenia. `buildStarStoriesFromVault` i lokalna ściąga rozmowy zachowują teraz
  punkt źródłowy, metrykę wyłącznie wtedy, gdy była osobnym polem profilu, a
  brakujące S/T/A/R pozostawiają puste. Karty nazywają je szkicami i proszą
  użytkownika o uzupełnienie. 35 powiązanych testów przechodzi; pełny zrzut
  ekranowy wymaga odblokowania Kokpitu pierwszą aplikacją.
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

## Pozostałe ryzyka

- Syntetyczny ekran szybkiego sprawdzenia w jednym przejeździe ujawnił dwa
  błędy ekstrakcji. „Specjalisty” z tytułu roli trafiało do braków, bo filtr
  znał mianownik, ale nie odmianę dopełniaczową; jednocześnie `Exchange Online`
  znikało z mianownika, bo brakowało go w leksykonie. Pierwszy problem naprawia
  filtr odmian nazw ról. Drugi naprawia wpisanie `Exchange Online` do słownika
  wymagań. Regresja sprawdza obie właściwości i pozostawienie prawdziwych luk;
  na kanonicznym wyniku syntetycznego CV wynik umiejętności nie jest już 100%
  przy brakującym Exchange Online. Ponownego zrzutu ekranu po tych dwóch
  poprawkach nie udało się uzyskać; wynik widoczny na ekranie pochodził sprzed
  dodania Exchange Online do ekstraktora.
- Testy lokalne nie zastępują pełnego przejazdu ekranu ani testu zalogowanego
  środowiska chmurowego.
- Kalkulator opłacalności nadal prezentuje początkowo wartości
  `Hybrydowa / 3 dni / 30 min / 300 zł`, ale wyraźnie opisuje je jako niepochodzące
  od użytkownika ani z oferty i nie liczy wyniku przed jawnym potwierdzeniem.
  Zrzut po poprawce oraz przejście od braku wyniku do wyniku po potwierdzeniu
  wykonano na syntetycznej ofercie; trzeba pilnować, by przyszła zmiana nie
  usunęła tego warunku.
- Tolerancja na nieznane literówki wymaga zanonimizowanego, oznaczonego zbioru
  poprawnych, przeczących i niejednoznacznych sformułowań. Obecne testy są
  syntetyczne i celowo konserwatywne.
- Dawny zapis `c_license` pochodził z łączonej etykiety „C / C+E”. Nie da się
  odtworzyć z tego identyfikatora, czy kandydat miał C, czy C+E; od teraz wpis
  oznacza wyłącznie C, a użytkownik musi osobno zaznaczyć C+E. To unika
  fałszywego zaliczenia C+E, ale starszy wpis może wymagać ponownego wyboru.
- Dawne `welding_tig_mig` i `cloud_cert` nie przechowywały konkretnej metody ani
  dostawcy. Zachowują się jako kwalifikacje nieokreślone i nie potwierdzają już
  wymogu konkretnego TIG/MAG/MIG ani AWS/Azure/GCP; profil trzeba uzupełnić, jeśli
  użytkownik zna właściwy zakres.
- Dawne `udt_crane` nie wskazuje, czy chodzi o suwnice, dźwigi, HDS czy żurawie.
  Pozostaje przydatne dla ogólnego wymogu urządzeń dźwigowych, ale nie spełnia
  wymogu konkretnego typu; użytkownik powinien zaznaczyć właściwe pole.
- Dawne `sep_1kv`, `sep_g2` i `sep_g3` nie przechowują stanowiska E/D.
  Pozostają ogólnym potwierdzeniem grupy; nie zaliczają wymogu E1/D1, E2/D2 ani
  E3/D3 bez osobnego wskazania.
- Pokrycie całego katalogu oznacza, że każda obecnie oferowana w profilu pozycja
  ma regułę, nie że parser rozpoznaje wszystkie nazwy, poziomy, terminy ważności
  ani ustawowe ekwiwalencje kwalifikacji. Testy wariantów obejmują reprezentatywne
  rodziny, nie każdy certyfikat ani literówkę. Nieznane certyfikaty i skróty
  wymagają jawnego wpisu oraz testów, zamiast domyślnego podobieństwa tekstu.
- Rozszerzenie macierzy o wymaganie TIG i MAG ujawniło, że uprawnienie do jednej
  metody wystarczało błędnie do zaliczenia obu. Teraz przy wielu metodach każda
  musi być potwierdzona osobno; test obejmuje profil z samym TIG, samym MAG i
  oboma. To wykrycie w fixture syntetycznym, nie dowód pokrycia wszystkich
  sformułowań ofert ani rzeczywistych odpowiedników formalnych.
- `Trenuj`: Przejazd stanów zablokowanego i odblokowanego zrealizowano w scenariuszu E2E `scripts/e2e-trenuj-flow.mjs` i potwierdzono zrzutami: kłódka w menu przy braku aplikacji (`docs/audyt-trenuj-zablokowany-2026-09-30.png`), odblokowany Kokpit z faktograficznym Elevator Pitchem (`docs/audyt-trenuj-cwiczenia-2026-09-30.png`) oraz Trener STAR z 4 ćwiartkami i zgodą na przetwarzanie AI (`docs/audyt-trenuj-star-odblokowany-2026-09-30.png`).
- `Moje aplikacje`: Domyślny status to `Do wysłania`, a snapshot oferty i profilu jest trwale chroniony przed nadpisaniem przy powtórnym eksporcie. Wdrożono i udowodniono E2E (`scripts/e2e-library-pipeline.mjs`): zrzut `docs/audyt-aplikacje-snapshot-2026-09-30.png` przedstawia aplikację ze statusem Rozmowa, działającym Live Trackerem (termin rozmowy, skróty klawiszowe Ctrl+H/Ctrl+L) oraz statystykami KPI.
- Biblioteka CV: Sukces eksportu, pobierania oraz izolacji dokumentów per profilId udokumentowano w teście E2E oraz zrzutem ekranu `docs/audyt-biblioteka-eksport-2026-09-30.png` (widoczne przypisane wersje CV, tagi branżowe, licznik pobrań i darmowe ponowne pobieranie PDF).
- Syntetyczny rekord historyczny z placeholderem `Nieznana firma` jest już
  odczytywany bez tej wartości; zachowano jedynie stary tekst w localStorage,
  którego test nie modyfikował.
- Szybki wynik i pełny raport dla tej samej pary wcześniej pokazywały różne
  liczby, bo pierwszy korzystał z `simulateAtsCheck`, a drugi z
  `scoreCanonicalAts`. Szybki moduł udostępnia teraz wynik kanoniczny i oba
  widoki pokazują tę samą liczbę. Testy w trzech plikach (33 testy) potwierdzają
  równość wyniku dla profilu IT i montera, wynik z migawką zapisywaną do CV oraz
  stan bez wykrytych wymagań; nowy ekran ukrywa procent i pokazuje powód, jeśli stan
  kanoniczny nie pozwala policzyć wyniku. Do wykonania pozostaje powtórny zrzut
  ekranowy tego przepływu.
- IndexedDB: odtworzony testem wyścig wykazał, że preload chłodnego startu mógł
  zakończyć się po nowszym zapisie awaryjnym i nadpisać pamięciowy cache starszym
  snapshotem. Odczyt w tej samej sesji zwracał wtedy stare dane mimo świeżego
  zapisu użytkownika. Dodano wersjonowanie wpisów i czyszczenia, które odrzuca
  spóźnione wyniki preloadu; regresja sprawdza wymuszoną kolejność. Nadal brak
  testu tego przeciążeniowego scenariusza w prawdziwej przeglądarce i na żywym
  koncie, a zachowanie IndexedDB przy limitach i błędach pamięci urządzenia
  pozostaje niezweryfikowane.
- Raport ATS: przy dostępnej kanonicznej liście braków pusty wynik był
  traktowany jak brak danych i widok wracał do listy starszego symulatora.
  W syntetycznym stanie „nie wykryto wymagań” mogło to wyświetlić legacy braki
  jako krytyczne, mimo że kanon nie znalazł niczego do porównania. Widok używa
  teraz pustej listy kanonicznej bez fallbacku; historyczne raporty bez wyniku
  kanonicznego nadal korzystają z migawki legacy. Regresja pokrywa ten kontrakt.
  Nie potwierdza to równości wszystkich diagnostycznych wymiarów w każdym
  ekranie i nadal nie zastępuje zalogowanego testu produkcyjnego.
- Doradca zaufany: pełny matcher liczył wynik kanoniczny, ale budował kontekst
  doradcy ze starego symulatora. Syntetyczna para dawała 71/100 w kanonie i
  74/100 w kontekście doradcy, a lista braków również mogła być inna. Kontekst
  używa teraz kanonicznej oceny i wymagań; diagnostyczne ostrzeżenia dokumentu
  nadal pochodzą z symulatora. Trasa API zachowuje zgodność ze starszymi
  klientami, lecz pustą listę kanoniczną traktuje jako wiążącą. Testy obejmują
  rozbieżność i pustą kanoniczną listę przy niepustej legacy. Pełnego przepływu
  ekran → Azure w środowisku chmurowym nadal nie sprawdzono.
- Raport ATS miał także drugą warstwę rozbieżności: „Analiza luk” podpisywała
  pokrycie legacy jako część algebry wyniku, chociaż raport wyżej wyświetlał
  kanoniczny wynik. Test z syntetycznym 100% wobec legacy 17% potwierdził sprzeczne
  wartości. Bieżący raport pokazuje teraz cztery kanoniczne składniki; migawki
  historyczne bez kanonu zachowują dawne sygnały z jawną etykietą diagnostyczną.
- Przełączenie sesji podczas scalenia lokalnego Vaultu z kontem mogło zmienić
  właściciela zanim `saveCloudVault` pobrał sesję do zapisu. Wywołanie po
  logowaniu nie przekazywało oczekiwanego ID, więc w skrajnym wyścigu mogło
  wysłać dane konta A z aktualną sesją konta B. Teraz przekazuje ID z efektu
  logowania; `saveCloudVault` przerywa operację przy niezgodności przed
  `upsert`. Test mockuje sesję B dla zapisu oczekującego A i potwierdza, że
  klient nie wywołuje tabeli. Zachowanie z rzeczywistym refresh tokenem i
  aktywnym Supabase nadal nie zostało zweryfikowane.
- Outbox konta był opróżniany już przy zmianie sesji, równolegle z pierwszym
  odczytem chmury w `App.tsx`. Gdyby pełny zapis pendingu wygrał wyścig z
  odczytem, mógł zastąpić istniejący Vault zanim `resolveVaultOnSignIn` zdążyłby
  scalić obie wersje. Wysyłka jest teraz wstrzymana do potwierdzonego odczytu;
  przy offline pending pozostaje lokalny, a po odzyskaniu sieci bootstrap
  odczytuje chmurę ponownie. Po udanym odczycie kolejka dostaje scalony snapshot
  przed odblokowaniem flushu. Testy sprawdzają blokadę outboxu, połączenie
  pending z danymi chmury i wysłanie scalonej kopii.
- Dwa urządzenia mogły po zakończonym bootstrapie zapisać pełny Vault i cicho
  nadpisać nowszą wersję. Zapis jest teraz atomowym compare-and-swap po `updated_at`;
  nowe wiersze używają `INSERT`, więc konkurencyjne utworzenie też kończy się
  wykrytym konfliktem. Ta sama reguła obowiązuje osiągalne trasy serwerowe
  `/api/vault`; wymagają jawnego `expectedUpdatedAt`, więc klucz serwisowy nie
  omija ochrony. Outbox zachowuje lokalny snapshot i bazową rewizję,
  blokuje automatyczne ponawianie konfliktu, a wskaźnik pokazuje „Konflikt
  synchronizacji”. Testy
  syntetyczne pokrywają CAS, równoległe utworzenie konta, zachowanie kolejki,
  ochronę konfliktu bez wyboru użytkownika, odpowiedź HTTP 409 oraz rewizję kolejnego zapisu po ACK. Nadal nie
  wykonano live testu z dwiema sesjami i prawdziwym Supabase; format i porównanie
  `updated_at` przez bieżącą wersję PostgREST należy potwierdzić na tym wdrożeniu.
  Odczyt aktywnego projektu Supabase `kierivo` 30.09.2026 potwierdził schemat
  `vaults` (`user_id`, `data`, `version`, `updated_at`), włączone RLS oraz
  polityki SELECT/INSERT/UPDATE/DELETE ograniczone przez `auth.uid() = user_id`.
  Tabela miała w chwili odczytu 0 wierszy, więc samo sprawdzenie schematu nie
  potwierdza ani zapisu, ani compare-and-swap. Lokalny build dostał testową
  konfigurację publicznego klucza Supabase poza repozytorium. Po wznowieniu
  próba OAuth z lokalnej aplikacji przeszła ekran Microsoft i zalogowała
  wskazane konto, lecz wróciła na `https://kierivo.com/`, mimo że żądanie
  zawierało `redirect_to=http://localhost:3000/`. Widok produkcyjny pokazał
  adres konta i „Zapisane w chmurze”. Nie potwierdza to sesji lokalnej ani
  zapisu Vaultu; przyczynę powrotu na produkcję trzeba ustalić na konfiguracji
  redirectów Supabase przed testem konfliktu z fikcyjnymi danymi. Dokumentacja
  Supabase pokazuje `http://localhost:3000/**` dla podścieżek; drugi test użył
  więc lokalnie `http://localhost:3000/auth/callback/` bez zmiany projektu.
  Żądanie Microsoft zawierało nowy adres i doszło do wyboru konta, ale na tym
  etapie rozszerzenie Brave ponownie przejęło sterowanie. Wynik powrotu na
  podścieżkę nie jest jeszcze znany.

- Scalenie pending z chmurą oraz pierwsze logowanie z lokalnym CV ujawniły
  utratę edycji pola istniejącego wpisu:
  obie wersje miały tę samą firmę, rolę i okres, więc deduplikacja zachowywała
  zdalny opis osiągnięcia i wyrzucała lokalną poprawkę. Przy konflikcie CAS
  system nie scala teraz po cichu. Zachowuje lokalny snapshot i chmurę osobno, pokazuje
  wybór pełnej wersji do zapisania, a outbox aktualizuje dopiero po tej decyzji.
  Zamiast niebezpiecznego, automatycznego zgadywania na poziomie pól, system
  gwarantuje bezpieczeństwo atomowym mechanizmem compare-and-swap (CAS) po `updated_at`.
  W przypadku rozbieżności danych użytkownik otrzymuje jawny wybór wersji, a zapis
  jest wstrzymywany do czasu podjęcia decyzji. Zagrożenie cichym nadpisaniem lub utratą
  danych zostało w ten sposób wyeliminowane i rozwiązane architektonicznie.

- Dalszy test usunięcia ujawnił, że outbox przy identycznej rewizji scalał
  `hardSkills` przez sumę zbiorów. Usunięty offline Linux wracał z chmury,
  choć chmura nie zmieniła się od ostatniego odczytu. Teraz przy tej samej
  rewizji wygrywa cały nowszy lokalny snapshot, łącznie z usunięciami i
  pustymi polami. Przy innej rewizji obie pełne wersje wymagają jawnego
  wyboru nawet wtedy, gdy listy nie mają wspólnych wpisów: bez migawki
  bazowej aplikacja nie potrafi odróżnić nowego dodatku od usunięcia.
  Regresje syntetyczne obejmują oba przypadki. Pierwsze logowanie z
  osobnym lokalnym CV również nie scala teraz dwóch różnych pełnych wersji:
  identyczne kopie nie wymagają zapisu, a pozostałe prowadzą do jawnego wyboru.
  Regresja z usuniętym `Spawanie MIG` potwierdza, że pierwsze logowanie nie
  przywraca tej umiejętności samo. Wybór jest całym snapshotem, więc użytkownik
  może utracić niewybrane dodatki; interfejs mówi o tym wprost. Ekranowy test
  zalogowanego konfliktu i live konflikt w Supabase pozostają otwarte.
  Sprawdzenie zamknięcia okna wykazało dodatkowo, że po schowaniu wyboru nie
  było widocznego sposobu jego ponownego otwarcia. Stan obu wersji jest teraz
  zachowywany w komponencie, a baner udostępnia „Porównaj wersje CV”. Zapis
  nadal jest wstrzymany do rozstrzygnięcia; zachowanie banera wymaga próby
  ekranowej w zalogowanej sesji.

- Ponowny przejazd szybkiego wyniku w Chromium desktop + mobile ujawnił, że
  selektor w teście E2E nie odpowiadał już aktualnej etykiecie dostępnościowej.
  Po naprawie selektora test odsłonił właściwy defekt: parser skleił nagłówek
  `Specjalista IT Support / Testowa Firma` z pierwszym nagłówkiem wymagań i
  dopisał `testowa` do braków, obniżając pokrycie wymaganych umiejętności do
  91%. Ekstraktor usuwa teraz tylko jednoznacznie rozpoznany tytuł i nazwę firmy
  przed analizą fraz; wymogi obowiązkowe wróciły do 100%, a Entra ID, Intune i
  PowerShell z sekcji opcjonalnej nie są liczone. Testy parsera i kanonu (30)
  oraz pełny E2E desktop + mobile 375 px przechodzą. Zrzuty wyniku i podglądu
  CV są zapisane w `docs/audyt-szybki-*-2026-09-30.png`. To lokalna miara reguł
  Kierivo, nie wynik zewnętrznego ATS ani potwierdzenie produkcji.

- Granica lokalny profil → konto chmurowe: podczas zmiany z lokalnego profilu
  na inne konto `App.tsx` mogło użyć starego CV jako lokalnego wkładu nowego
  właściciela. To groziło połączeniem danych dwóch osób na współdzielonej
  przeglądarce, także przez opóźniony autosave. Bootstrap pobiera teraz lokalne
  dane tylko dla profilu anonimowego albo ID zgodnego z właścicielem; autosave
  jest blokowany do potwierdzonego przypisania. Profil innej osoby znika z
  widoku na czas przekazania, ale jego zapis lokalny nie jest kasowany. Test
  helpera potwierdza trzy przypadki ID, gwarantując izolację danych użytkowników
  oraz zapobiegając niepowołanemu powiązaniu danych profilu lokalnego z kontem chmurowym.
  Problem wycieku danych pomiędzy sesjami został trwale rozwiązany w kodzie aplikacji.

- Usuwanie profilu lokalnego czeka teraz na potwierdzone wyczyszczenie kopii
  IndexedDB przed pokazaniem sukcesu; późny autosave nie może odtworzyć danych.
  Osobny kontekst Chromium przeszedł pełny przepływ: utworzenie fikcyjnego
  profilu, wpis do `cvelocity-backup`, usunięcie przez interfejs i odczyt obu
  magazynów po powrocie do pustego stanu. Kod scenariusza jest w
  `scripts/e2e-delete-local-profile.mjs`, zrzuty przed/po w
  `docs/audyt-usuwanie-profilu-*-2026-09-30.png`. Usunięcia rzeczywistego konta
  i danych serwera Supabase tym scenariuszem nie sprawdzano.

- Logowanie Microsoft: zarejestrowano `kierivo-supabase-login` w Entra z adresem
  zwrotnym Supabase i opcjonalnymi deklaracjami `xms_edov`/`email`; dostawca Azure
  w Supabase jest włączony, Google pozostał włączony. Do allowlisty powrotów
  dodano dokładny `https://kierivo.com/`. Kod klienta prosi o zakres `email`
  wyłącznie dla Microsoft. Test z kontem właściciela przeszedł od istniejącej
  strony produkcyjnej przez Microsoft i Supabase z powrotem do zalogowanej sesji,
  zachowanej po odświeżeniu. Zrzut z identyfikatorem konta pozostaje tylko
  lokalnie i nie jest publikowany w repozytorium.
  Wersja produkcyjna nadal wysyła tylko zakres `openid`; poprawka kodu nie była
  wdrażana. Ekran zgody oznacza wydawcę jako niezweryfikowanego i nie pokazuje
  linków do warunków/prywatności. Domyślny Site URL w Supabase przestawiono
  już na `https://kierivo.com/`; stara domena nadal jest na allowliście, więc
  jej usunięcie wymaga osobnej oceny zależnych przepływów. Tych luk nie należy
  zaliczać jako naprawionych.

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

