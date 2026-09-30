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
  Test potwierdza staż, umiejętności obowiązkowe i atut w sekcji opcjonalnej. Dalsza próba wykazała, że Required/Preferred Qualifications nie były rozpoznawane jako granice sekcji; teraz test parsera i 20-ofertowy holdout przechodzą. Na ekranie z syntetycznym profilem wymóg Python został dopasowany, SQL i próg 3 lat pokazane jako braki, a opcjonalny Azure nie pojawił się na liście.
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
  (211 ostrzeżeń). Nadal brakuje ekranowego testu przełączenia dwóch profili,
  dużego Vaultu w prawdziwej przeglądarce oraz testu na koncie i deploymentcie
  produkcyjnym.
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
  zrzutu ekranu po poprawce leksykonu jeszcze nie uzyskano.
- Renderer PDF przyjmował formalne kwalifikacje z Vaultu, ale nie rysował ich
  na stronie; opisy stanowisk też znikały, gdy obok były punkty osiągnięć.
  PDF pokazuje teraz znane uprawnienia pod czytelnymi etykietami i zachowuje
  opis obok punktów. Podgląd UI wyświetla dodatkowo narzędzia, umiejętności
  interpersonalne, kwalifikacje, certyfikaty i języki przekazywane do renderera.
  Test adaptera sprawdza mapowanie ID SEP i zachowanie opisu; test integracyjny
  odczytuje wygenerowany PDF i potwierdza widoczność `SEP G1 E1 do 1 kV —
  eksploatacja`. Python 42/42, adapter/trasa Node 23/23. Ekran po poprawce i
  pełna zgodność całej treści z podglądem nadal wymagają sprawdzenia.
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
  test obejmuje stanowisko, opis, kierunek edukacji i pusty stan. Kopiowania
  przez interfejs po zmianie jeszcze nie sprawdzono.
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
  Test używa atrapy procesu Pythona; rzeczywisty PDF z backendu produkcyjnego
  nadal wymaga porównania z podglądem.
- Rzeczywisty DOCX z historycznej aplikacji zawierał nazwę pracodawcy z oferty
  w wierszu pod nazwiskiem, której podgląd CV nie pokazywał. To była metadana
  oferty, mogła wyglądać jak deklaracja kandydata. Eksport Word nie umieszcza
  jej już w treści; nazwa firmy zostaje w nazwie pliku. Regresja parsuje
  OpenXML i odrzuca znacznik firmy w tekście CV. Po poprawce UI pobrał plik
  DOCX 9 073 B (przed poprawką 9 091 B); pozostało odczytać ponownie cały
  pobrany artefakt po poprawce. PDF wciąż nie został porównany z podglądem.
- Feedback po eksporcie wiąże się najpierw po `jobId`; awaryjne dopasowanie
  wymaga zgodnej firmy, stanowiska i identycznego URL, bo dwie rekrutacje mogą
  mieć tę samą nazwę. Aktualizacja istniejącego wpisu dopina powód do notatek,
  nie zastępuje historycznego snapshotu i nie cofa zapisanego etapu rekrutacji.
  Regresje są sprawdzone syntetycznie w testach Node.
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
  4 regresje i pozostałe testy knock-outów przechodzą. Nadal potrzebny jest
  ekranowy przegląd wszystkich rodzin wymagań.
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
  obu tekstów i brak autoscalenia. Nie wykonano zrzutu zalogowanego konfliktu ani
  testu na Supabase; ten przepływ nie scala niezależnych pól automatycznie.

- Pierwsze logowanie z dwiema niepustymi wersjami miało jeszcze osobną ścieżkę
  `mergeImportedVault`, która łączyła rozłączne listy i mogła odtworzyć wpis
  usunięty lokalnie. Teraz tylko identyczne snapshoty przechodzą bez pytania;
  różne wymagają wyboru pełnej wersji. Test z usuniętą umiejętnością i test
  rozłącznych doświadczeń potwierdzają brak automatycznej sumy. Przeglądarkowy
  test zalogowanego konfliktu i test w aktywnym Supabase nadal są potrzebne.

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
