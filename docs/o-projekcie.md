# CVelocity — czym to jest, na jedną stronę

> Wersja skrócona. Pełna dokumentacja architektury i biznesu jest
> w [`RAPORT_PROJEKTU_CVELOCITY.md`](./RAPORT_PROJEKTU_CVELOCITY.md), zasady
> pracy nad kodem w [`AGENTS.md`](../AGENTS.md), a model zagrożeń
> w [`SECURITY.md`](../SECURITY.md).
>
> Ten plik istnieje po to, żeby nowa osoba — albo nowy agent — w dwie minuty
> wiedziała, o co w tym produkcie chodzi. Zawiera wyłącznie funkcje, które
> **są w kodzie**. Planów tu nie ma; są w roadmapie.

## Zdanie, od którego wszystko się zaczyna

**CVelocity nie pisze CV za kandydata — wyciąga z niego to, czego sam by nie
napisał, a potem układa to pod konkretne ogłoszenie i pod filtry ATS.**

Różnica wobec generatorów opartych na modelach językowych jest jedna
i zasadnicza: **ten produkt nie zmyśla**. Typowy generator dopisze technologię,
której kandydat nigdy nie widział — kandydat przechodzi wstępną selekcję
i kompromituje się na pierwszym pytaniu technicznym. Tutaj każde zdanie
w dokumencie pochodzi z tego, co użytkownik sam podał.

To nie jest hasło marketingowe, tylko reguła numer 1 w `AGENTS.md`, egzekwowana
w recenzji kodu. Z tego powodu z aplikacji wyleciał przycisk „Optymalizuj frazę
(AI)", który dopisywał do CV zmyślone „35% wzrostu wydajności", i ekran
logowania przepuszczający dowolne hasło. Jedno i drugie zostało **usunięte,
a nie przemalowane**.

## Sześć rzeczy, które robimy inaczej

**1. Pytamy, zamiast zgadywać.** Katalog reguł wykrywa luki w CV — osiągnięcie
bez liczby, obowiązek bez narzędzia, slogan zamiast faktu — i zamienia je
w krótkie pytania („Jaki mierzalny efekt dało planowanie pracy serwisantów
w firmie GROMGAZ?"). Odpowiedź trafia do dokumentu **dosłownie, słowo w słowo**,
a użytkownik widzi gotowy punktor, zanim kliknie „Zapisz".

**2. Zero tokenów tam, gdzie konkurencja pali budżet.** Pytania uzupełniające,
skaner ATS, ściąga na rozmowę, rozpoznanie branży i podpowiedzi w formularzach
liczą się lokalnie, w przeglądarce. U konkurencji każde takie pytanie to
wiadomość do modelu, limitowana w planie darmowym do kilku dziennie. Tutaj to
czysta funkcja: działa bez limitu, bez sieci i daje ten sam wynik przy każdym
uruchomieniu.

**3. Znamy zawody fizyczne, nie tylko IT.** Katalog obejmuje montera instalacji
gazowych, spawacza, magazyniera i elektryka razem z uprawnieniami, które
faktycznie decydują — SEP, UDT, F-Gaz, HACCP. Audyt kryteriów zerojedynkowych
sprawdza to, na czym kandydat naprawdę odpada. To segment, którego duzi gracze
nie obsługują, bo optymalizują pod ogłoszenia programistyczne.

**4. Bezpieczeństwo opisane uczciwie.** `SECURITY.md` zaczyna się od zdania
„nie ma tu żadnego twierdzenia, którego nie da się wskazać palcem w kodzie",
i zawiera listę rzeczy, które **nie** są chronione. Hasła z wycieków są
odrzucane przy rejestracji, choć u dostawcy to funkcja płatna — robimy to sami
tak, że hasło nie opuszcza urządzenia.

**5. Dane zostają u użytkownika, dopóki sam nie zdecyduje inaczej.** Tryb
lokalny działa bez konta i bez serwera. Konto w chmurze jest wyborem, nie
warunkiem wejścia. Zero plików cookie, zero analityki, zero zasobów firm
trzecich — łącznie z fontami, które hostujemy u siebie właśnie dlatego, że
Google Fonts wysyłałoby adres IP każdego odwiedzającego, zanim ktokolwiek
wyraziłby zgodę.

**6. Przygotowanie do rozmowy, nie tylko dokument.** Ściąga z punktami STAR
zbudowanymi z prawdziwej historii zatrudnienia, mosty kompetencyjne na pytania
o brakujące narzędzie, pytania demaskujące dług technologiczny pracodawcy.

## Dla kogo

| Persona | Co ją tu trzyma |
|---|---|
| Kandydat techniczny (IT, inżynieria) | Dopasowanie do ogłoszenia, obrona luk technologicznych, przygotowanie do rozmowy |
| Specjalista z zawodu fizycznego | Uprawnienia i kryteria zerojedynkowe — jedyne narzędzie, które w ogóle o nie pyta |
| Osoba po przebranżowieniu | Mosty kompetencyjne: jak obronić brak doświadczenia, nie kłamiąc |

## Czego CVelocity nie robi

Nie jest portalem z ogłoszeniami. Nie pokazuje widełek wynagrodzeń ani opinii
o firmach. Te trzy rzeczy wymagają kupionego źródła danych, a wstawienie tam
zmyślonej liczby byłoby złamaniem zasady, na której stoi cały produkt.

## Stan na dziś

**Działa:** profil kandydata, import CV z pliku, skaner ATS bez rejestracji,
dopasowanie do ogłoszenia, generowanie dokumentu, ściąga na rozmowę, pytania
uzupełniające, podpowiadacz w formularzach, konta w chmurze z synchronizacją CV.

**Jeszcze nie działa:** płatności, korpus podpowiedzi zbierany od wielu
użytkowników (schemat gotowy, czeka na skalę), powiadomienia push, wdrożony
serwer Express — na produkcji stoi sam frontend, więc trasy `/api/*` są tam
nieosiągalne.

> `RAPORT_PROJEKTU_CVELOCITY.md` deklaruje „Status: Produkcyjny / Gotowy do
> Skalowania Komercyjnego". Traktuj to jako opis ambicji, nie stanu — lista
> powyżej jest aktualna.
