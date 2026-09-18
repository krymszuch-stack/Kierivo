import { SAMPLE_MANUAL_JD } from '../../../src/lib/exampleJd';

/**
 * Scenariusz demo na stronie startowej: para „CV + ogłoszenie”, na której
 * `HomeLiveDemo` liczy wynik **prawdziwym silnikiem** (`runQuickAtsCheck`
 * + `scoreCanonicalAts`). Plik trzyma wyłącznie treści — żadnych wyników.
 *
 * Reguła 1 z AGENTS.md: demo nie może pokazać liczby, której nie policzył
 * kod produkcyjny. Stąd każdy tekst zaczyna się oznaczeniem „PRZYKŁAD”
 * (konwencja z `JDInputModes.tsx`), a test strażnik pilnuje, żeby etykieta
 * przeżyła jakiekolwiek przyszłe redakcje tych treści.
 *
 * Celowo kandydat z realną luką (3,5 roku stażu vs wymagane 5, brak części
 * stosu chmurowego): demo ma pokazywać uczciwy, pośredni wynik z widocznymi
 * brakami — nie reklamowy „95%”.
 */
export const EXAMPLE_CV = `[PRZYKŁAD — fikcyjne CV do pokazania działania narzędzia]

Jan Przykładowski
jan.przykladowski@example.com · Warszawa

Podsumowanie
Frontend developer z 3,5-letnim doświadczeniem w aplikacjach e-commerce. Pracuję w React i TypeScript, współtworzę design system i dbam o dostępność interfejsów.

Umiejętności
JavaScript (ES6+), TypeScript, React, Redux, HTML5, CSS3, Sass, Vite, REST API, Git, testy jednostkowe (Vitest)

Umiejętności miękkie
Komunikacja z klientem, praca w zespole, code review

Języki obce
Angielski — B2, polski — ojczysty

Doświadczenie zawodowe
Frontend Developer, Sklepik.pl (firma przykładowa)
03.2022 - obecnie
- Rozwój panelu sprzedawcy w React i TypeScript używanego codziennie przez 2 000 sprzedawców
- Wdrożenie testów jednostkowych w Vitest, które zmniejszyły liczbę błędów w wydaniach o 30%
- Skrócenie czasu ładowania listy produktów z 3,2 s do 1,4 s

Junior Frontend Developer, Agencja Pixelform (firma przykładowa)
06.2021 - 02.2022
- Budowa stron reklamowych w React i Sass dla klientów z branży HoReCa
- Migracja komponentów klasowych na hooki w 12 projektach

Wykształcenie
Politechnika Przykładowska, Inżynieria oprogramowania, inżynier, 2017 - 2021`;

/** To samo ogłoszenie, które klika „Wypróbuj na przykładzie” w sekcji Aplikuj. */
export const EXAMPLE_JD = SAMPLE_MANUAL_JD;

/** Tytuł stanowiska wyczytany z ogłoszenia — przekazywany do scoreCanonicalAts. */
export const EXAMPLE_ROLE_TITLE = 'Senior Full-Stack React / Node.js Developer';
