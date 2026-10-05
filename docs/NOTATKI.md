# Spostrzeżenia i notatki

> Notatnik roboczy projektu. Stan produktu i reguły rozstrzygają kod, testy,
> `AGENTS.md` oraz protokoły w `./historia/`. Stare decyzje pozostają w
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
- Kierunek Doradcy zmienił się na **Doradcę zaufanego**: feedback ma pochodzić z
  Azure OpenAI wywoływanego przez API. Kod wymaga trybu chmurowego, zalogowanego
  konta, limitu serwerowego i jawnego potwierdzenia wysyłki. Stary cache rozmów
  Ollamy nie jest przenoszony do Azure. Integracja kodu ma testy syntetyczne;
  dostępność wdrożonego deploymentu Azure wymaga jeszcze testu na środowisku.
- Audyt innych wysyłek AI znalazł lukę w Weryfikatorze CV 360°: przeglądarka
  przekazywała Vault do API, a serwer uruchamiał model bez odrębnego
  potwierdzenia. Dodano checkbox opisujący przesłanie profilu do serwera
  Kierivo oraz wybrane pola przekazywane dostawcy AI; endpoint odrzuca żądanie
  bez jawnej flagi przed rezerwacją limitu. Usługa nadal pseudonimizuje
  wykryte dane, ale nie gwarantuje pełnej anonimizacji. Test syntetyczny
  potwierdza blokadę i zachowanie ścieżki z potwierdzeniem; ekran pokazał
  informację, lecz konto testowe nie pozwoliło sprawdzić zalogowanej ścieżki.
- Holdout 20 syntetycznych ofert ujawnił, że parser gubił progi `2/3 years of
  experience` i szukał stażu w całym ogłoszeniu, co mogło pomylić lata firmy z
  wymaganiem wobec kandydata. Parsowanie lat ograniczono do sekcji wymagań;
  rozpoznaje też `minimum of`, staż zawodowy i apostrof w zapisie angielskim.
  Test potwierdza wymagane 3 lata oraz brak wymogu przy 25-letnim stażu firmy.
  Holdout po poprawce: accuracy pól 96,25% → 98,125%, błędnych pól INCORRECT
  3 → 0; F1 fraz umiejętności pozostał bez zmian na 98,95%. Śledzenie kodu
  wykazało, że główny scorer ignorował wyekstrahowane `experienceMinYears`;
  teraz wymóg wpływa na komponent stażu, a niespełniony próg trafia do listy
  braków. W syntetycznym ekranie dwuletni profil osiągnął komponent stażu 100%
  i wynik 66% przy progu 2 lat oraz 58% i 53% przy progu 5 lat, mimo że w tekście
  podano 25 lat doświadczenia firmy. Ekran potwierdza widoczny brak
  `Min. 5 lat doświadczenia` i tę samą pozycję w rekomendacji. Próba formatu
  `Wymagania: ...` w jednym wierszu odtworzyła kolejny brak parsera; wspólna
  normalizacja dzieli nagłówek z treścią także dla pozostałych znanych sekcji.
  Test potwierdza staż, umiejętności obowiązkowe i atut w sekcji opcjonalnej. Dalsza próba wykazała, że Required/Preferred Qualifications nie były rozpoznawane jako granice sekcji; teraz test parsera i 20-ofertowy holdout przechodzą. Na ekranie z syntetycznym profilem wymóg Python został dopasowany, SQL i próg 3 lat pokazane jako braki, a opcjonalny Azure nie pojawił się na liście. Kolejny przypadek elektryka ujawnił lukę taksonomii, nie segmentacji nagłówka; dopisano typowane kompetencje instalacyjne, a widok pokazuje jawnie niepotwierdzone czytanie projektów (dowód: `docs/evidence/ats-electrical-requirements-2026-10-02.png`).
- „Ściąga na rozmowę” jest dostępna z wiersza aplikacji i korzysta z jej
  historycznego snapshotu oferty oraz profilu. Usunięto ją z zakładek bieżącej
  analizy dopasowania, żeby przygotowanie nie mieszało się z inną ofertą.
- Biblioteka CV wcześniej trzymała dokumenty wszystkich lokalnych profili pod
  jednym kluczem, więc drugi profil w tej samej przeglądarce mógł zobaczyć
  cudze CV. Odczyt, zapis i wszystkie modyfikacje są teraz zakresowane ID
  aktywnego profilu. Dane anonimowe przechodzą przy utworzeniu profilu, a stara
  wspólna biblioteka pozostaje ukryta do jawnego przypisania. Regresje sprawdzają
  dwa profile, brak automatycznego ujawnienia, jawne przypisanie i migrację
  anonimowego profilu; testy logiki biblioteki, lokalnych profili i Pipeline
  przechodzą 29/29. Ekran testowy na odizolowanym originie pokazuje pustą
  bibliotekę dla profilu bez dokumentów; nie wykonano pełnego ekranowego zapisu
  i przełączenia dwóch profili.
- Ten sam wzorzec globalnego klucza obejmował rozmowy Interview Loop, pełne
  transkrypcje ćwiczeń, notatki Kokpitu, plan nauki, cache Doradcy, szkic oferty
  Audytu ATS, odblokowania funkcji i pominięte pytania CV. Zapis jest teraz
  kluczowany ID profilu; odblokowania odrzucają też stary Vault w trakcie
  przełączenia konta. Dawne wpisy pod wspólnymi kluczami zostają nietknięte,
  ale nie są automatycznie przypisywane ani pokazywane; odzyskanie wymaga
  osobnej, jawnej ścieżki. Testy regresji izolacji przechodzą. Cała suita:
  1738/1738, build klienta i serwera przechodzi, lint/typecheck 0 błędów
  (211 ostrzeżeń). Ekranowy test Playwright `test:e2e:local-profile-isolation` obejmuje teraz A → B → odświeżenie → A, czeka na stabilny nagłówek `Profil`, asercje braku przeciwnego znacznika w obu widokach oraz zachowanie obu Vaultów. Obejrzałem zrzuty z bieżącego przebiegu w `docs/evidence/local-profile-a-2026-10-02.png` i `docs/evidence/local-profile-b-2026-10-02.png`. Nadal nie badano dużego Vaultu ani profili na koncie/deploymentcie produkcyjnym.
- Usunięto nieużywaną metodę `AiService.optimizeDeltaPhrase` i jej jedynego
  klienta serwerowego `optimizeDeltaPhrases`: gdy model nie zwrócił wyniku,
  fallback dopisywał niepotwierdzone „wymierne poprawy wskaźników”. Repo nie
  miało wywołań z tras ani interfejsu, więc usunięto niepodłączony tor zamiast
  zostawiać go jako przyszłą pułapkę.
- Macierz kwalifikacji obejmuje obecnie wszystkie pozycje katalogu, ale test
  łączonych metod spawania ujawnił błąd logiczny: przy wymaganiu TIG i MAG
  zaznaczenie tylko jednej metody zaliczało wymóg. Zmiana wymaga każdej metody
  osobno; regresja sprawdza TIG, MAG i komplet. To nadal test syntetyczny, bez
  walidacji nazw i równoważności przez eksperta branżowego.
- Syntetyczna edycja CV pokazała, że ręczny tytuł i podsumowanie wracały do
  poprzedniej wersji z `TailoredResume` w schowku, PDF i kopii w Bibliotece.
  Kopiowany tekst pomijał też sekcje widoczne w CV. Ręczne poprawki trafiają
  teraz do podglądu, wszystkich tych wyjść i snapshotu eksportu; tekst CV zawiera
  także narzędzia, umiejętności miękkie, uprawnienia, certyfikaty i języki.
  Lokalny ekran syntetyczny potwierdził tytuł i podsumowanie po zakończeniu edycji.
- Ekranowy test szybkiego audytu na syntetycznej ofercie wykrył dwa błędy:
  odmiana „specjalisty” była pokazywana jako skill, a brak `Exchange Online` w
  leksykonie pozwalał pokazać 100% pokrycia mimo brakującej technologii.
  Ekstraktor pomija teraz sprawdzone odmiany nazw ról i rozpoznaje Exchange
  Online. Regresja sprawdza, że fraza z tytułu znika, Exchange Online pozostaje
  luką, a prawdziwe luki z fixture nie są pomijane. Test silnika przechodzi;
  ekran E2E potwierdza lukę w rzeczywistym widoku, a nieczytelny komunikat
  ograniczonych danych poprawiono tokenami zależnymi od motywu. Kontrast nagłówka
  w aktualnym ciemnym motywie wynosi 10,97:1; zrzut:
  `docs/evidence/quick-ats-exchange-gap-2026-10-02.png`.
  Osobny E2E sprawdza szybki ekran z wymaganym SEP G1: widok oznacza go jako
  niepotwierdzony wymóg obowiązkowy, pokazuje lukę w sekcji wniosków i używa
  poprawnych polskich znaków. Zrzut:
  `docs/evidence/quick-ats-required-qualification-2026-10-02.png`.
- Renderer PDF przyjmował formalne kwalifikacje z Vaultu, ale nie rysował ich
  na stronie; opisy stanowisk też znikały, gdy obok były punkty osiągnięć.
  PDF pokazuje teraz znane uprawnienia pod czytelnymi etykietami i zachowuje
  opis obok punktów. Podgląd UI wyświetla dodatkowo narzędzia, umiejętności
  interpersonalne, kwalifikacje, certyfikaty i języki przekazywane do renderera.
  Test adaptera sprawdza mapowanie ID SEP i zachowanie opisu; test integracyjny
  odczytuje wygenerowany PDF i potwierdza widoczność `SEP G1 E1 do 1 kV —
  eksploatacja`. Python 42/42, adapter/trasa Node 23/23. E2E Chromium na syntetycznym
  profilu potwierdza zgodność 31 jawnych faktów podglądu i jednostronicowego PDF,
  łącznie z projektami, linkiem, uprawnieniami, certyfikatami i językami. Nie
  obejmuje wszystkich motywów/układów ani długich CV; szczegóły i zrzuty są w
  `docs/04.09.2026.md`.
- Podgląd historycznego CV wcześniej łączył treść z snapshotu z nazwą firmy
  i stanowiskiem pobranymi z bieżących, edytowalnych metadanych. Syntetyczny
  test zmienił oba metadane po zapisie; modal nadal pokazał stanowisko i firmę
  z pierwotnej oferty oraz etykietę „Niezmienna migawka”. Późniejsza wartość
  firmy nie uzupełnia pustego pola w istniejącym snapshocie. Status pozostał
  „Do wysłania”; niczego nie wysłano.
- Naprawa starych referencji punktów CV wybierała pierwszy wpis historii z tą
  samą firmą i rolą. Przy dwóch okresach pracy w tym samym miejscu mogło to
  przypisać redakcję punktu do niewłaściwego okresu. Teraz unikalny tekst
  źródłowy rozstrzyga duplikat; gdy nadal pasuje kilka wpisów, referencja
  pozostaje nierozstrzygnięta i walidator ją zgłasza zamiast zgadywać.
- Ekstrakcja kwalifikacji sprawdza tekstowe potwierdzenia i przeczenia wspólnym
  matcherem; SEP G3 wymaga jawnego numeru grupy. Macierz obejmuje 21 rodzin i
  37 wariantów identyfikatorów, a 134 testy obejmują także przeczenia, wymogi
  opcjonalne, podtypy uprawnień i przypadki, gdzie sama praca w zawodzie nie
  potwierdza formalnej kwalifikacji. Testy są syntetyczne — rozszerzanie
  tolerancji literówek wymaga zebranej listy rzeczywistych, anonimowych
  wariantów i błędnych dopasowań. Rozszerzony
  test doświadczenia bez dokumentu wykrył też fałszywe zaliczenie prawa jazdy C
  na podstawie pracy jako kierowca; opis doświadczenia nie potwierdza już
  żadnej sprawdzanej tu formalnej kwalifikacji. Łącznie 162 testy ekstrakcji
  kwalifikacji przechodzi dla tych syntetycznych przypadków. Test macierzy na 21 rodzinach
  ujawnił, że zdanie „kandydat w profilu ma wyłącznie SEP G1” potrafiło samo
  utworzyć wymóg SEP G1; matcher pomija teraz fakty o profilu osadzone w treści
  oferty, o ile zdanie nie zawiera jawnego obowiązku. Regresja pokrywa wszystkie
  21 rodzin. Raport ATS dublował także samą metodę „TIG” obok jednego formalnego
  braku uprawnień spawalniczych — kanoniczna lista pokazuje tę lukę raz.
  Ekran z pięcioma wymogami z
  różnych rodzin pokazuje osobne braki SEP G3 E, UDT wózki, F-Gaz, spawanie i
  C+E; opcjonalny certyfikat Azure nie trafia do listy. Rekomendacja wskazuje
  trzy najważniejsze luki i jawnie podaje łączną liczbę pozycji.
- Matcher benefitów kalkulatora opłacalności uznawał każde trafienie słowa za
  benefit zapewniony, także w zdaniach „nie zapewniamy MultiSport”, „brak
  dofinansowania szkoleń” i „nie zapewniamy laptopa”. Regresja odtworzyła trzy
  fałszywe naliczenia; parser JD dokładał drugi pozytywny sygnał ze swojego
  zgrubnego pola `benefits`. Oba miejsca korzystają teraz ze wspólnego matchera
  odrzucającego negację w tej samej klauzuli i zachowującego niezależny pozytywny
  benefit w innej klauzuli. Na ekranie ten sam syntetyczny tekst zawyżał wartość
  pakietu z 180 do 510 zł/mies.; po poprawce zostało wyłącznie 180 zł za LuxMed,
  a MultiSport, szkolenia i laptop są oznaczone „do negocjacji”. Testy parsera,
  kalkulatora i ich połączenia: 39/39. Wynik finansowy po wpisaniu pensji nadal
  jest ukryty do jawnego potwierdzenia formy umowy, trybu pracy i dojazdu; zrzut
  ekranu potwierdza brak wyniku przed kliknięciem i widoczny wynik po nim.
- Mapa dojazdu rysowała punkt pracodawcy zawsze 85 px w prawo i 45 px w górę
  od domu. Zastąpiono go końcem rzeczywistej geometrii trasy Azure; jeśli lokalna
  estymacja nie zwraca współrzędnych, linia i pinezka celu nie są rysowane.
  Ekranowy test komponentu sprawdza obie ścieżki. Etykieta „Poranny szczyt
  (07:45)” również nie odpowiadała żądaniu: przy braku `departAt` Azure liczy
  przejazd na teraz. Interfejs opisuje teraz „Ruch teraz” i „Czas bez korków”;
  prognoza konkretnej godziny wymaga osobnego wejścia czasu wyjazdu.
- Kanoniczny wynik wcześniej przywracał brakujące pozycje `preferred` z audytu
  formalnego jako wymagane braki i obniżał nimi wynik. Pozycje opcjonalne nie
  wchodzą teraz do listy braków ani wyniku formalnego; test integracyjny
  porównuje wszystkie 21 rodzin z bazową ofertą bez atutu opcjonalnego.
- W kanonicznym pokryciu umiejętności nazwa firmy lub szkoły mogła być
  potraktowana jak kompetencja. Syntetyczne CV bez SAP dostało 100% pokrycia,
  bo pracodawca nazywał się `SAP Polska`; samo `AWS Academy` mogło zaliczyć
  wymaganie AWS. Nazwy pracodawców i instytucji nie wchodzą już do korpusu
  dowodów kompetencji. Regresje dla obu przypadków przechodzą; słowo kluczowe
  znalezione w pozostałym tekście nadal nie stanowi niezależnego potwierdzenia
  poziomu biegłości. Dalszy test surowej ścieżki szybkiego sprawdzenia wykazał,
  że leksykon parsowania przeszukiwał cały dokument i wstawiał SAP z nazwy
  pracodawcy do `hardSkills`/`toolsAndTech`. Skanowanie ograniczono do sekcji
  umiejętności i opisowych pól CV, z pominięciem nagłówków ról, pracodawców oraz
  instytucji. Lista braków i pokrycie w szybkim ekranie korzystają teraz z
  kanonicznego wyniku; syntetyczny fixture sprawdza `SAP Polska` i `AWS Academy`
  oraz wyświetlanie obu jako braków. Test ekranowy ujawnił jednak, że etykieta
  pokrycia nadal czytała procent ze starego symulatora: widniało `100%` obok
  brakujących SAP i AWS. Wskaźnik podłączono do kanonicznego składnika
  umiejętności; po poprawce syntetyczny ekran pokazuje `0%` i oba braki.
- Składowa świeżości stażu zakładała, że pierwsza karta w `history` jest
  najnowsza, choć edytor pozwala swobodnie przestawiać doświadczenie. Ten sam
  profil zmieniał przez to wynik stażu 72 → 54. Dopasowanie świeżości korzysta
  teraz z trzech najnowszych poprawnych przedziałów według dat; błędne lub
  brakujące daty nie dostają bonusu, a nazwy firm nie dowodzą umiejętności.
  Test potwierdza identyczny wynik po zmianie kolejności.
- Diagnostyczne profile ATS nie są prawdopodobieństwami: ich kontrakt nazywał
  jednak pole `passProbability`, a karty pokazywały procent. Dane zmieniono na
  `heuristicProfiles[].score`, a widoczna skala to wynik na 100; ocena
  kanoniczna Kierivo pozostaje oddzielnym wynikiem głównym.
- Przykłady porad ATS zawierały wymyśloną metrykę i przedstawiały niepotwierdzone
  zachowania parserów oraz decyzje o zgodzie jako pewniki. Przykłady są teraz
  schematami do uzupełnienia własnymi faktami; tekst wyjaśnia ograniczenia i
  zabrania generatorowi dopisywać zgodę. Syntetyczny widok po zmianie pokazuje
  nagłówek, ostrzeżenie i przykład oparty na jawnych polach do uzupełnienia.
- Ekran dopasowania i materiały pomocnicze określały własny wynik reguł jako
  „wynik ATS”, a część ostrzeżeń zakładała, co potrafi każdy system. Reframing
  AI zakładał też kanał rekrutacji na podstawie branży i automatyczne tłumaczenie
  CV po wykryciu angielskich słów. Zmieniono nazewnictwo na ocenę Kierivo,
  osłabiono twierdzenia parserów i ograniczono prompt do jawnych dowodów kanału;
  język CV zachowuje się bez prośby o tłumaczenie. Syntetyczny zrzut formularza
  potwierdza nowe nazewnictwo; pełny przebieg wyniku i eksportu tłumaczenia
  nadal wymaga weryfikacji.
- Tekst kopiowany z Generatora używał bazowego stanowiska zamiast docelowego i
  gubił część widocznego opisu. Wspólny czysty formatter składa tekst z podglądem;
  test obejmuje stanowisko, opis, kierunek edukacji i pusty stan. Kopiowanie sprawdziłem też w Chromium: nowy `test:e2e:cv-copy-parity` analizuje syntetyczną ofertę, otwiera Generator, klika rzeczywisty przycisk kopiowania i odczytuje Clipboard API. Schowek zawiera docelową rolę, dane kontaktowe, umiejętność, widoczne podsumowanie i opis doświadczenia, bez bazowego tytułu.
- Ekran Prywatność & RODO rozróżnia local Vault i chmurę, przyznaje, że lokalne
  dane nie są szyfrowane osobno i że tekst AI może nadal zawierać dane osobowe.
  Kod potwierdza lokalne, domyślnie wyłączone liczniki oraz ścieżkę usuwania
  profilu i konta. Nie potwierdzono na wdrożeniu usunięcia w Supabase ani
  prawdziwości nazwy administratora, kontaktu, retencji i podstaw prawnych;
  te dane musi uzupełnić i zweryfikować właściciel projektu. Widok sprawdzono
  syntetycznie zrzutem ekranu, bez wykonywania destrukcyjnego usunięcia.
- Formularz wsparcia i zgłaszania problemu pokazywał fałszywy komunikat wysłania
  mimo braku transportu, a kasował wpisaną treść. Teraz tworzy tylko szkic
  `mailto:` z jawnym adresem i nie obiecuje odpowiedzi; wysłanie wykonuje
  użytkownik w swoim kliencie. Syntetyczny ekran i test formattera są
  potwierdzone. Nie zweryfikowano dostarczenia ani własności adresu
  `pomoc@kierivo.com`.
- Eksport PDF cache'ował wynik bez uwzględnienia ustawienia awatara. Po zmianie
  kształtu zdjęcia mógł zwrócić wcześniejszy plik. Klucz SHA-256 uwzględnia teraz
  znormalizowany wybór, a regresja trasy wymaga osobnego renderowania wariantów.
  Test trasy używa atrapy procesu Pythona. Osobny lokalny E2E na syntetycznym
  profilu potwierdził obecność 31 wybranych faktów w podglądzie i w wygenerowanym
  PDF, a także obsługę jawnej klauzuli RODO. Nie obejmuje uwierzytelnionego
  eksportu produkcyjnego ani zgodności układu szablonu ekranowego z motywem PDF.
  Audyt długiego CV wykazał, że limit dwóch stron usuwał starsze wpisy, część
  punktów, umiejętności i skracał podsumowanie bez ujawnienia tego w raporcie ATS.
  Eksporter zwraca teraz jawne liczniki pominięć, zachowuje je w cache i wstrzymuje
  pobranie do potwierdzenia użytkownika. Szczegóły i render stron w
  `docs/04.09.2026.md` oraz `docs/evidence/pdf-long-cv-synthetic-2026-10-02.pdf`.
- Rzeczywisty DOCX z historycznej aplikacji zawierał nazwę pracodawcy z oferty
  w wierszu pod nazwiskiem, której podgląd CV nie pokazywał. To była metadana
  oferty, mogła wyglądać jak deklaracja kandydata. Eksport Word nie umieszcza
  jej już w treści; nazwa firmy zostaje w nazwie pliku. Regresja parsuje
  OpenXML i odrzuca znacznik firmy w tekście CV. Po poprawce UI pobrał plik
  DOCX 9 073 B (przed poprawką 9 091 B). Test przechwytuje Blob przekazywany
  do `file-saver`, rozpakowuje go jako OpenXML i sprawdza treść: rola, dane
  kontaktowe i projekt są obecne, nazwa firmy nie trafia do CV, ale pozostaje
  w nazwie pliku. Potwierdza to zawartość artefaktu eksportera na syntetycznym
  profilu, nie fizyczny zapis z zalogowanego UI w przeglądarce. Lokalny E2E PDF potwierdził obecność tych samych
  31 kontrolowanych faktów w podglądzie i eksporcie; jego żądanie jawnie użyło
  układu `classic/sidebar`, podczas gdy widok ekranowy pokazywał szablon
  `Minimalny`. Nie rozstrzyga to zgodności wizualnej w uwierzytelnionym przepływie;
  szczegóły: `docs/04.09.2026.md`.
- Feedback po eksporcie wiąże się najpierw po `jobId`; awaryjne dopasowanie
  wymaga zgodnej firmy, stanowiska i identycznego URL, bo dwie rekrutacje mogą
  mieć tę samą nazwę. Aktualizacja istniejącego wpisu dopina powód do notatek,
  nie zastępuje historycznego snapshotu i nie cofa zapisanego etapu rekrutacji.
  Regresje są sprawdzone syntetycznie w testach Node.
- Suita podpakietu `semantic-work-graph` potrafi zakończyć proces na Node 22 / Windows
  natywnym błędem `better-sqlite3` podczas teardownu. Testy jednostkowe kończą
  właściwe asercje; osobno do sprawdzenia pozostaje kompatybilność ABI / sposób
  zamykania procesu. Ponowny przebieg 01.10.2026 na Node 24.19.0, po odtworzeniu
  brakującej zależności z lokalnego manifestu, zakończył się 240/240 i buildem
  TypeScript bez błędu teardownu; Node 22 nie jest zainstalowany, więc obserwacja
  dla tej wersji pozostaje niezweryfikowana. `npm audit --omit=dev`: 0 podatności.

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
- Doradca w trybie lokalnym jest niedostępny. W trybie chmurowym feedback
  generuje Azure OpenAI na podstawie wysłanej treści i ograniczonego kontekstu;
  nie dołącza automatycznie całego Vaultu. Ten przepływ wymaga potwierdzenia
  użytkownika, logowania i limitu po stronie serwera.
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
- Szczegółowe dowody odbioru są w `./historia/` i przy odpowiadających PR-ach.
- Dawne eksperymenty z gamifikacją, rabatami rangowymi, trialem i komercyjnymi
  pakietami należy traktować jako historię implementacji, nie aktualny zakres bety.

- Lokalna trasa `/api/cv/export-pdf` ma teraz test końca-do-końca z prawdziwym
  rendererem Python i odczytem zwróconego PDF przez PDF.js. Test potwierdza,
  że ręczny tytuł i podsumowanie trafiają do rzeczywistego pliku, a stare
  podsumowanie nie zostaje. Nie dowodzi zgodności pikselowej z UI ani działania
  deploymentu produkcyjnego; te kontrole są nadal otwarte.

- `scripts/audit-cv-suite.ts` nie wykonuje wywołań API i nie mierzy pętli
  rekrutera ani zgodności: dawne punkty 360°/werdykt były stałymi. Skrypt
  raportuje teraz wyłącznie faktycznie policzone składowe. Pseudonimizację
  sprawdza tylko dla podsumowania, a pokrycie semantyczne oznacza jako
  `NIEZMIERZONE`, gdy zależności grafu nie są dostępne. Wynik nie jest oceną
  gotowości prawdziwego CV do wysłania.

- Walidacja PDF z pustą albo nierozpoznaną listą `vendorIds` wcześniej zwracała
  `PASS` mimo braku sprawdzonych profili. Zwraca teraz `NOT_CHECKED` i `null`,
  a panel nie prezentuje zera jako wyniku. Regresja jest w
  `src/lib/__tests__/atsPdfValidator.test.ts`. E2E na nieznanym ID profilu
  regułowego potwierdza w panelu „Nie wykonano”, 0 profili i brak wyniku
  procentowego; zrzut: `docs/evidence/ats-pdf-not-checked-2026-10-01.png`.

- Weryfikator CV 360° podstawiał stałe wyniki przy niekompletnym JSON modelu:
  brak punktacji dawał `70`/`85`, brak statusu chronologii lub RODO oznaczał
  `true`, a punktacja `0` była zastępowana przez `||`. Odpowiedź jest teraz
  walidowana przed pokazaniem raportu; braki kończą się błędem 502, poprawne
  zera pozostają zerami, a werdykt jest wyliczany z wyniku. Wygenerowane
  konteksty bez oferty i stanowiska opisują brak zamiast wstawiać „Specjalista”
  lub „Firma Rekrutująca”. Testy serwisu potwierdzają oba przypadki; żywe
  wywołanie Azure nie było wykonywane.
- Weryfikator 360° nie dostawał treści klauzuli, mimo to LLM mógł zwrócić
  `rodoCompliant: true`, a UI ogłaszał zgodność z RODO. Status tej kontroli
  jest teraz `null` i ekran mówi, że klauzuli nie sprawdzono. Procent punktów
  doświadczenia z mierzalnym wynikiem liczy istniejący lokalny detektor;
  brak punktów oznacza brak wskaźnika. Ekran lokalny potwierdził brak konta
  chmurowego i dostępności analizy; nie weryfikowano raportu po zalogowaniu ani
  Azure.
- Silnik knock-outów przypisywał niejednoznaczne frazy do konkretnych
  kwalifikacji: samo „uprawnienia elektryczne” tworzyło SEP G1,
  „cieplne/energetyczne” tworzyło SEP G2, a doświadczenie z czynnikiem
  chłodniczym tworzyło F-Gaz. To myli obowiązek formalny z ogólnym zakresem
  pracy. Dopasowanie wymaga teraz jawnego SEP/G1/G2 lub certyfikatu F-Gaz;
  Ekranowy E2E w lokalnym Chromium przechodzi dla wszystkich 21 rodzin:
  komplet identyfikatorów reguł, kanonicznych braków i etykiet jest widoczny
  na ekranie. Obejrzany zrzut: `docs/evidence/knockout-families-screen-2026-10-02.png`;
  przebieg używa danych syntetycznych.
- Wyniki trzech pętli Weryfikatora 360° były prezentowane jako procenty, a
  trzecia pętla nazywała się „Logika i Zgodność”. Zmieniono etykiety na
  „ocena AI /100” i „Spójność i logika”; to oceny modelu, nie kalibracja ani
  wynik z zewnętrznego ATS. W UI klauzula RODO jawnie ma stan „nie sprawdzono”.
- Audyt kwalifikacji traktował część samych wzmianek jako obowiązkowe braki:
  TIG w obowiązkach, wózek widłowy w opisie pracy albo C+E przy nazwie zawodu
  mogły uruchomić twardy knockout. Parser rozróżnia teraz jawny wymóg, atut
  opcjonalny i wzmiankę o nieokreślonym statusie. Nagłówki sekcji działają też
  z polskimi i angielskimi wariantami oraz CRLF. Wzmianki informacyjne nie
  obniżają kanonicznego wyniku ani nie trafiają do braków; ekran szybkiego
  sprawdzenia nie nazywa ich wymogiem i prosi o potwierdzenie statusu. Testy
  obejmują SEP, UDT, TIG i C+E, ale wyłącznie syntetycznie. Nieznany format
  ogłoszenia nadal może wymagać ręcznego potwierdzenia przez użytkownika.
- Transfer danych anonimowych przy tworzeniu profilu usuwał źródło zaraz po
  wywołaniu zapisu docelowego. Test z awarią IndexedDB odtworzył utratę jedynego
  Vaultu. Tworzenie profilu czeka teraz na potwierdzenie trwałego zapisu Vaultu,
  aplikacji, biblioteki CV, indeksu i aktywnego profilu; przy błędzie przerywa
  aktywację i zachowuje źródła. Testy symulują awarię zapisu każdego z trzech
  przenoszonych typów oraz udaną migrację Vaultu przez IndexedDB i ponowny
  odczyt po restarcie. To nadal test kontrolowany; quota i przerwanie transakcji
  na rzeczywistej przeglądarce nie zostały sprawdzone.
- Przy wejściu z lokalnego profilu do innego konta chmurowego `App.tsx` mógł
  potraktować poprzedni vault jako lokalny wkład nowego właściciela; dodatkowo
  opóźniony zapis miał dostęp do tego samego stanu. Bootstrap dopuszcza teraz
  wyłącznie profil anonimowy lub profil o ID zgodnym z właścicielem, a autosave
  czeka na przypisanie vaultu do zalogowanego ID. Zmienny lokalny profil jest
  ukryty w trakcie przekazania, lecz jego zapis na urządzeniu pozostaje nietknięty.
  Test helpera potwierdza odrzucenie obcego ID i dopuszczenie anonima/właściciela;
  brak jeszcze ekranowego testu przełączenia dwóch rzeczywistych sesji.
- Po konflikcie rewizji automatyczne `mergeImportedVault(chmura, pending)`
  mogło zgubić lokalną poprawkę istniejącego wpisu: deduplikacja po firmie,
  roli i datach zachowywała wersję z chmury. Ten sam problem dotyczył pierwszego
  logowania, gdy lokalny profil i istniejące konto miały różne wersje tej samej
  encji. W obu scenariuszach wersje są teraz pokazywane osobno, a użytkownik
  jawnie wybiera pełny snapshot; dopiero wtedy
  outbox dostaje nową rewizję i próbuje zapisu. Regresje potwierdzają zachowanie
  obu tekstów i brak autoscalenia. Lokalny E2E z syntetyczną sesją oraz
  przechwyconymi odpowiedziami Supabase otwiera rzeczywisty modal, sprawdza obie
  wersje i po wyborze weryfikuje payload pełnego snapshotu oraz opróżnienie
  outboxa. Zrzut: `docs/evidence/cloud-vault-conflict-2026-10-02.png`.
  Test nie łączy się z Supabase ani nie weryfikuje RLS; sprawdzenie na aktywnym
  lokalnym lub produkcyjnym Supabase pozostaje otwarte. Konflikt nadal wymaga
  jawnego wyboru i nie scala niezależnych pól automatycznie.

- Pierwsze logowanie z dwiema niepustymi wersjami miało jeszcze osobną ścieżkę
  `mergeImportedVault`, która łączyła rozłączne listy i mogła odtworzyć wpis
  usunięty lokalnie. Teraz tylko identyczne snapshoty przechodzą bez pytania;
  różne wymagają wyboru pełnej wersji. Test z usuniętą umiejętnością i test
  rozłącznych doświadczeń oraz lokalny E2E ekranu konfliktu potwierdzają brak
  automatycznej sumy. E2E używa kontrolowanej sesji i atrap odpowiedzi sieci;
  nie zastępuje testu dwóch kont na działającym Supabase.
- Migrator uznawał każdy Vault ze `schemaVersion: 1` i kilkoma sekcjami
  najwyższego poziomu za kompletny. Stary wpis historii bez `highlights` trafiał
  więc do kokpitu, gdzie pomiar następnego kroku wywoływał `highlights.length`
  i kończył się ekranem awarii. Szybka ścieżka migracji sprawdza teraz listę
  punktów każdego wpisu; brak oznacza pustą listę, a nie dopisane osiągnięcia.
  Regresja migracji potwierdza zachowanie firmy i roli oraz bezpieczny pomiar.
  Test ekranowy użył wyłącznie fikcyjnego Vaultu.

- Pełny test szybkiego dopasowania w Chromium wykrył, że nazwa firmy z nagłówka
  oferty mogła zostać sklejona z tytułem i nagłówkiem „Wymagania”, a następnie
  pokazać się jako brakująca umiejętność `testowa`. Wspólna ekstrakcja usuwa teraz
  wyłącznie jednoznacznie rozpoznany tytuł i nazwę firmy przed analizą wymagań;
  nieznany nagłówek pozostaje nietknięty. Regresja potwierdza, że pięć wymagań
  IT trafia do ekstraktora, a nagłówek i umiejętności opcjonalne nie. Przejazd
  Chromium desktop + mobile 375 px potwierdził pełne pokrycie tych pięciu
  wymaganych umiejętności, brak `testowa` i Entra ID na liście braków oraz
  poprawne przeniesienie firmy, edukacji i TCP/IP do podglądu CV. Zrzuty są w
  `docs/audyt-szybki-wynik-desktop-2026-09-30.png`,
  `docs/audyt-szybki-podglad-cv-desktop-2026-09-30.png` i
  `docs/audyt-szybki-edytor-mobile-2026-09-30.png`. To syntetyczny test lokalny,
  nie dowód działania wdrożonego ATS.
- Walidator PDF: nie używać statycznych kar formatowania bez wykrycia konkretnego elementu w dokumencie. Alert o niewidocznym tekście ma opisywać wyłącznie obserwację Tr 3; nie przypisywać ATS-om pewnej intencji oszustwa ani dyskwalifikacji.
- `validatePdfForAts` nie ma parsera binarnego PDF. Sam `ArrayBuffer` musi dawać `NOT_CHECKED`, a nie ocenę pustego/zepsutego CV; jeśli tekst został już wyekstrahowany, przekazuj go jawnie i zachowuj dostarczone metadane ekstrakcji.
- Nie wywnioskowywać zachowania ATS wobec kolumn/tabel na podstawie samego tekstu po normalizacji; brak geometrii PDF oznacza brak takiego pomiaru. Nie symulować utraty linii bez danych potwierdzających układ.
- Liczniki wpisów doświadczenia/edukacji wyliczane regexami z płaskiego tekstu mogą być fałszywe; jeśli nie mają konsumenta i nie ma wiarygodnego ekstraktora sekcji, usuń je z kontraktu zamiast wymuszać pozorny wynik.
- Nie publikować punktacji zgodności parsera ATS z ręcznie dobranych wag/progów. Jeżeli test dotyczy lokalnych reguł na tekście, zwracać obserwacje i braki, nazywać zakres w UI i nie dodawać werdyktu pass/fail sugerującego wynik dostawcy.
- Szybki onboarding nie dopełnia już listy braków trzema poradami niezwiązanymi z wynikiem. Pokazuje najwyżej trzy ustalenia faktycznie zwrócone przez analizę; pusty stan nie sugeruje, że CV jest kompletne ani że przeszło zewnętrzny ATS. Szczegóły regresji i zrzut są w `docs/04.09.2026.md`.
- Szybka analiza formalna nie może promować wpisu `preferred` ani `information` do krytycznego braku. W aktualnym kodzie `extractTopThreeProblems()` filtrował wyłącznie po `satisfied === false`, przez co opcjonalny SEP G3 oraz sama wzmianka informacyjna trafiały jako `severity: critical`. Filtr wymaga teraz `severity === 'knockout'`; testy dla obu stanów najpierw odtworzyły błąd, a po poprawce przechodzą.

- E2E UI z 01.10.2026: zastosowanie i cofnięcie sugestii CV oraz przełączenie lokalnych profili A → B → odświeżenie → A zaliczone na syntetycznych danych; zrzuty w `docs/evidence/` (`suggestion-undo-*`, `local-profile-a/b-*`). Szybki onboarding przechodzi pełną ścieżkę desktop/mobile; aktualny zakres i zrzuty są dopisane do `docs/04.09.2026.md`.
- Przy zmianach parsera JD nie traktuj pierwszej linii wyczyszczonej z portalu jako tytułu bez walidacji: może to być lokalizacja, wynagrodzenie, ważność lub firma. Zachowaj jawny tytuł źródłowy i kandydata segmentera, a samodzielne „Remote” odróżniaj od ról takich jak „Remote Frontend Developer”. Regresja i ekranowy dowód są w `docs/04.09.2026.md`.
- Nie publikuj liczbowego `confidence` dla przygotowania ogłoszenia, dopóki nie ma realnej kalibracji i konsumenta. Dotychczasowe stałe były wyłącznie pozorną miarą; raport ma używać kategorii kompletności i wymogu ręcznego sprawdzenia.
- Przy zmianie `JobOfferPreparation` sprawdź wszystkich konsumentów przed utrzymaniem diagnostycznych pól. `classification`, `completeness`, `needsUserReview`, `rawText` i `sourceType` były nieużywane; logika „uncertain” nie trafiała do UI ani analizy. Segmenter zwraca teraz wyłącznie tekst i metadane potrzebne do wyboru/odrzucenia segmentu.
- W `resolveVaultOnSignIn` znacznik `updatedAt` nie jest treścią CV. Jeśli lokalna i chmurowa treść są identyczne, różne czasy zapisu nie powinny blokować logowania; zmiany w dowolnym polu treści nadal muszą kończyć się konfliktem.
- Nie oferować `.doc` ani kopii MasterVault JSON jako tekstowego CV. Przy sygnaturze OLE podać jasną konwersję do DOCX/PDF, a JSON skierować do importera profilu; utrzymać zgodność deklaracji formatów w każdym selektorze CV.
- Nie uznawać wklejonego CV wyłącznie na podstawie liczby znaków. Walidacja musi przejść parser i tę samą kanoniczną bramkę treści co wynik ATS; nierozpoznane pliki tekstowe zatrzymać przed podglądem i scaleniem, nie podstawiając ciągu znaków jako danych profilu.
- W `validateRawCvText` ponownie używać wyniku `ParsedCVResult` podczas budowy podglądu; import tekstu był parsowany dwa razy. Zmierzony syntetyczny przebieg 43 874 znaków skrócił medianę z 6,94 ms do 4,18 ms.
- Nie parsować podsumowania CV wielowierszowym regexem nad surowym dokumentem: regex może wciągnąć kolejne sekcje. Korzystać z wyniku `splitIntoSections`. W doświadczeniu nie awansować dowolnego wiersza opisu do pola firmy; fallback wymaga rozpoznanego sygnału roli/pracodawcy. Regresja w `cv_parser.test.ts` obejmuje format „rola, firma”.

- Przy imporcie CV nie wstawiać technologii znalezionych wyłącznie w negacji albo zdaniu o nauce. Współdziel `hasPositiveSkillEvidence` przy parsowaniu listy umiejętności i skanowaniu leksykonu; sprawdź także, że całe zdanie nie trafia do Vaultu jako jedna umiejętność. Regresje `cv_parser.test.ts` i `quickAtsCheck.test.ts` pokrywają „nie znam SAP/AWS” oraz „w trakcie nauki Kubernetes”.
- Identyczne wejście `parseTextToMasterVault` musi dawać identyczne ID rekordów. Nie używaj `Date.now()` ani losowości dla wpisów doświadczenia, punktów CV, edukacji, certyfikatów, języków i projektów; stabilizuj ID na podstawie treści oraz pozycji elementu, zachowując różne ID dla powtórzonych wpisów w jednej liście.
- W ocenie holdoutu nie używaj zawierania podciągu jako dokładnej zgodności pola: liczby wymagają równości, a fragment tekstu może być najwyżej PARTIAL. Dodaj kontrprzykłady numeryczne, bo 3/30 nie może zawyżać jakości ekstrakcji stażu.
- W metrykach ekstrakcji traktuj tekst złożony z białych znaków jak wartość pustą przed porównywaniem. Placeholder UNKNOWN również normalizuj ze spacjami brzegowymi i bez rozróżniania wielkości liter.
- Rozstrzygnięte w audycie 01.10.2026: oba harnessy używają wspólnej normalizacji braków, liczb i tekstu. Regresje potwierdzają, że 3/30 jest błędem, whitespace/UNKNOWN nie jest CORRECT, niepowiązane tryby są INCORRECT, a wspólny znaczący termin daje co najwyżej PARTIAL; szczegóły i zmiana 6/6 → 4/4 znanych pól są w `docs/04.09.2026.md`.
- Nagłówek `Required qualifications` był błędnie wyciągany jako wymaganie `required`, ponieważ słowo `Required` powtarzało się w treści oferty. Dodano je do wspólnego słownika angielskiego boilerplate'u; szybka analiza i ekstraktor kanoniczny nie pokazują go już jako brakującej umiejętności. Regresja jest w `src/lib/__tests__/quickAtsCheck.test.ts`, a syntetyczny przebieg ekranowy i dowód — w `docs/04.09.2026.md`.
- W polskim znaczniku `wymagają` końcowa litera `ą` nie mieści się w semantyce ASCII `\b`. Wymóg SEP G1 w zdaniu „Pracodawcy wymagają…” trafiał więc do `information`, choć w tej samej formie zaprzeczenie też musiało pozostać rozpoznawalne. Wspólny regex markerów w `jdOptionality.ts` używa teraz granic Unicode, a `knockouts.ts` korzysta z niego zamiast utrzymywać osobną, rozjeżdżającą się kopię. Regresja obejmuje zdanie dodatnie i „Pracodawcy nie wymagają…”; 194 testy knock-outów przechodzą. Test ekranowy i zrzut są opisane w `docs/04.09.2026.md`.
- Zbiorczy `/api/usage/stats` nie miał konsumenta, a ujawniał bez uwierzytelnienia agregat AI całej instancji. Trasa, DTO i nieużywany agregator procesu zostały usunięte; pozostał zapis rzeczywistych zdarzeń operacyjnych. Agregat procesu nie rozdziela użytkowników i znika po restarcie, więc nie jest bezpieczną analityką produktu. Przy pracach wokół statystyk utrzymuj wyłącznie rozdzielone, rzeczywiste zdarzenia z uwierzytelnionym `user_id`; bez konsumenta nie przywracaj endpointu ani agregatu.
- Procent w kafelku Pipeline opisuje biezacy udzial aplikacji, ktorych status to Rozmowa lub Oferta; nie jest historyczna konwersja ani odpowiedzia pracodawcy. Rekordy aplikacji nie archiwizuja historii etapow, wiec nie podpisuj tej liczby jako „przejscie” ani response rate. Kafelki i test E2E sa opisane w `docs/04.09.2026.md`.
- Przy szkicu mailto formularza wsparcia waliduj opcjonalny adres odpowiedzi jawnie; klikniecie linku nie uruchamia walidacji HTML dla pola `type=email`. Bledny adres i pusta tresc nie moga tworzyc szkicu. Formularz nadal tylko otwiera klienta poczty; wlasciciel i dostarczalnosc `pomoc@kierivo.com` pozostaja niezweryfikowane.
- Start ma tylko rekomendowac przygotowanie follow-upu: klikniecie prowadzi do karty Pipeline, gdzie uzytkownik recznie odznacza/wpisuje stan wyslania. Dopoki nie ma konsumenta tworzacego szkic lub wysylajacego poczte, nie nazywaj akcji ?Wyslij follow-up?; pokaz jawnie, ze wiadomosc wysyla uzytkownik.
- Limit operacji AI ma jedno zrodlo: `src/lib/aiQuotaPolicy.ts`. Doba serwera jest liczona w UTC, wiec interfejs podaje reset o 00:00 UTC. Nie opisuj wdrozenia jako Azure/gpt-4o ani nie podawaj regionu, dopoki konfiguracja srodowiska nie potwierdza tych danych; cennik musi pozostac zgodny z konfigurowalnym dostawca.
- Kazdy gotowy prompt przed `generateWithUsage` przechodzi przez `preparePromptForModel` po zlozeniu wszystkich pol, a nie tylko przez pseudonimizacje wybranych fragmentow. Dane z request body sa niezaufane nawet wtedy, gdy standardowy klient juz je oczyszcza. Przy regule telefonu zachowaj daty `YYYY-MM` i uzywaj dolnego progu 9 cyfr, inaczej miesiace pracy moga zniknac z kontekstu.
- Po każdym żądaniu AI, które wcześniej zmniejsza licznik lokalny, uzgadniaj wynik z `/api/me` także po błędzie. Błąd sieciowy nie dowodzi, że serwer odrzucił operację; lokalny zwrot limitu może zawyżyć pozostałe użycia, jeśli odpowiedź zaginęła po wykonaniu.
