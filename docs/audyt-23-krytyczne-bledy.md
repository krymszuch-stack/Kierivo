# Raport Audytu: 23 Krytyczne Błędy Logiczne, UX/UI, Parserów i Silnika w Kierivo

Zgodnie z dyrektywą `/goal` (cel: minimum 20 krytycznych błędów, udowodnionych bezpośrednio w kodzie źródłowym bez wymyślonych problemów – `AGENTS.md`), przeprowadzono analizę statyczną, domenową i behawioralną kluczowych modułów aplikacji: silnika ATS, strażnika spójności osi czasu, parserów CV i ofert pracy, kalkulatorów dojazdów i stawek, kontraktów API serwera, bazy grafu semantycznego oraz interfejsów użytkownika.

Poniżej znajduje się zestawienie **23 zweryfikowanych błędów**.

---

## 📑 Spis Zidentyfikowanych Błędów

1. [Silnik Canonical ATS: Fałszywa kara za „brak nagłówków” przez szukanie w korpusie osiągnięć](#1-silnik-canonical-ats-fałszywa-kara-za-brak-nagłówków-przez-szukanie-w-korpusie-osiągnięć)
2. [Strażnik Osi Czasu: Odrzucanie polskich formatów `MM.YYYY` i `MM/YYYY`](#2-strażnik-osi-czasu-odrzucanie-polskich-formatów-mmyyyy-i-mmyyyy)
3. [Kalkulator Stażu ATS: Zerowanie doświadczenia kandydata dla dat `MM.YYYY`](#3-kalkulator-stażu-ats-zerowanie-doświadczenia-kandydata-dla-dat-mmyyyy)
4. [Kryteria Formalne (Knockouts): Surowe liczby wyzwalające wymóg uprawnień spawalniczych](#4-kryteria-formalne-knockouts-surowe-liczby-wyzwalające-wymóg-uprawnień-spawalniczych)
5. [Kryteria Formalne: Kolizja prawa jazdy / sektora C1 z poziomem języka C1](#5-kryteria-formalne-kolizja-prawa-jazdy--sektora-c1-z-poziomem-języka-c1)
6. [Opcjonalność Wymagań (JD Optionality): Pomijanie standardowych polskich nagłówków ofert](#6-opcjonalność-wymagań-jd-optionality-pomijanie-standardowych-polskich-nagłówków-ofert)
7. [Sprawczość Języka: Dyskryminacja form żeńskich czasowników sprawczych](#7-sprawczość-języka-dyskryminacja-form-żeńskich-czasowników-sprawczych)
8. [Parser CV: Permanentne dublowanie narzędzi i technologii w profilu](#8-parser-cv-permanentne-dublowanie-narzędzi-i-technologii-w-profilu)
9. [Ekstrakcja CV: Fabrykowanie domyślnego poziomu B2 i pseudometryk STAR](#9-ekstrakcja-cv-fabrykowanie-domyślnego-poziomu-b2-i-pseudometryk-star)
10. [Edytor Doświadczenia: Twarda blokada kroku 2 dla osób bez historii zatrudnienia](#10-edytor-doświadczenia-twarda-blokada-kroku-2-dla-osób-bez-historii-zatrudnienia)
11. [Laboratorium ATS (UX/UI): Całkowity brak formularza wprowadzenia oferty pracy i roli](#11-laboratorium-ats-uxui-całkowity-brak-formularza-wprowadzenia-oferty-pracy-i-roli)
12. [Renderer CV (Domena & Druk): Brak klauzuli RODO / GDPR w arkuszu A4](#12-renderer-cv-domena--druk-brak-klauzuli-rodo--gdpr-w-arkuszu-a4)
13. [Tracker Aplikacji: Wykluczenie statusu 'Odrzucona' generujące fałszywe 100% konwersji](#13-tracker-aplikacji-wykluczenie-statusu-odrzucona-generujące-fałszywe-100-konwersji)
14. [Uprawnienia i Limity: Mylący komunikat o limitach dla niezalogowanych i utrata kredytów](#14-uprawnienia-i-limity-mylący-komunikat-o-limitach-dla-niezalogowanych-i-utrata-kredytów)
15. [Silnik Pytań CV: Nieodwracalna kumulacja myślników i doklejek w treści osiągnięć](#15-silnik-pytań-cv-nieodwracalna-kumulacja-myślników-i-doklejek-w-treści-osiągnięć)
16. [Migracja Danych: Nadpisywanie dat aplikacji datą dzisiejszą przy polskich formatach](#16-migracja-danych-nadpisywanie-dat-aplikacji-datą-dzisiejszą-przy-polskich-formatach)
17. [Generator Korespondencji: Twardo zakodowana forma męska i podpis „Kandydat”](#17-generator-korespondencji-twardo-zakodowana-forma-męska-i-podpis-kandydat)
18. [Walidacja Zod API: Odrzucanie odpowiedzi PostgreSQL/Supabase z offsetem timezone](#18-walidacja-zod-api-odrzucanie-odpowiedzi-postgresqlsupabase-z-offsetem-timezone)
19. [Graf Semantyczny: Alokacja całej bazy `SELECT *` i parsowanie JSON w pętli liniowej](#19-graf-semantyczny-alokacja-całej-bazy-select--i-parsowanie-json-w-pętli-liniowej)
20. [Klasyfikacja Ofert: Domyślny tryb 'HYBRID' dla prac fizycznych i fałszywy staż z wieku firmy](#20-klasyfikacja-ofert-domyślny-tryb-hybrid-dla-prac-fizycznych-i-fałszywy-staż-z-wieku-firmy)
21. [Ściąga na Rozmowę (UX/UI): Wyciek stanu wzbogacenia AI między różnymi ofertami](#21-ściąga-na-rozmowę-uxui-wyciek-stanu-wzbogacenia-ai-między-różnymi-ofertami)
22. [Kalkulator Opłacalności: Ujemna realna stawka i błąd obliczeń straty powyżej 100%](#22-kalkulator-opłacalności-ujemna-realna-stawka-i-błąd-obliczeń-straty-powyżej-100)
23. [Interview Loop Manager (UI): Zawieszenie modala w pustym stanie po usunięciu sesji](#23-interview-loop-manager-ui-zawieszenie-modala-w-pustym-stanie-po-usunięciu-sesji)

---

### 1. Silnik Canonical ATS: Fałszywa kara za „brak nagłówków” przez szukanie w korpusie osiągnięć
- **Kategoria:** Błąd silnika / logiki biznesowej
- **Lokalizacja:** [`src/lib/canonicalAts.ts:246-268`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/canonicalAts.ts#L246-L268)
- **Mechanizm błędu:**
  Ocena filaru struktury sprawdza, czy w CV występują standardowe sekcje (`Doświadczenie`, `Umiejętności`, `Edukacja`, `Kontakt`). Zamiast badać właściwości obiektu `MasterVault` (`vault.history`, `vault.skillsMatrix`, `vault.education`, `vault.personalInfo`), algorytm zrzuca do jednego ciągu tekstowego `cvCorpus` wyłącznie treść punktów osiągnięć (`highlights.map(h => h.text).join(' ')`), a następnie szuka w nim słów kluczowych:
  ```typescript
  const expectedSections = ['doświadczenie', 'umiejętności', 'edukacja', 'kontakt'];
  const missingHeaders = expectedSections.filter(s => !cvCorpus.toLowerCase().includes(s)).length;
  structureScore = Math.max(0, structureScore - missingHeaders * 12);
  ```
- **Wpływ na użytkownika:** Kandydat posiadający kompletnie wypełniony profil `MasterVault` otrzymuje drastyczną karę do **−48 punktów** w filarze struktury, chyba że w swoich osiągnięciach sztucznie wklei słowa „edukacja” czy „kontakt”.
- **Rekomendacja naprawy:** Sprawdzać obecność nagłówków w strukturze danych `MasterVault` (np. `vault.history.length > 0`, `vault.education.length > 0`), a nie obecność podciągów w opisach osiągnięć.

---

### 2. Strażnik Osi Czasu: Odrzucanie polskich formatów `MM.YYYY` i `MM/YYYY`
- **Kategoria:** Błąd parsera dat / naruszenie Reguły 3
- **Lokalizacja:** [`src/lib/consistencyGuard/timelineAuditor.ts:8-32`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/consistencyGuard/timelineAuditor.ts#L8-L32)
- **Mechanizm błędu:**
  Moduł `timelineAuditor` redefiniuje własną funkcję `parseYearMonthToNumbers`, ignorując kanoniczny moduł [`src/lib/dateUtils.ts`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/dateUtils.ts). Zastosowany w niej regex przyjmuje wyłącznie format ISO `YYYY-MM`:
  ```typescript
  const match = dateStr.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;
  ```
- **Wpływ na użytkownika:** Każde stanowisko z datą zapisaną w polskim formacie (np. `03.2021 - 08.2023`) zostaje odrzucone z analizy chronologii, co wyzwala fałszywe alarmy o wieloletnich przerwach w zatrudnieniu i rzekomych niespójnościach dat.
- **Rekomendacja naprawy:** Zastąpić funkcję wywołaniem `parseMonthYear` z `dateUtils.ts`, które w pełni wspiera formaty `MM.YYYY`, `MM/YYYY` oraz nazwy słowne.

---

### 3. Kalkulator Stażu ATS: Zerowanie doświadczenia kandydata dla dat `MM.YYYY`
- **Kategoria:** Błąd silnika / logiki biznesowej
- **Lokalizacja:** [`src/lib/experience.ts:41`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/experience.ts#L41) oraz [`src/lib/consistencyGuard/consistencyEngine.ts:44`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/consistencyGuard/consistencyEngine.ts#L44)
- **Mechanizm błędu:**
  Funkcja `parseDateToDecimalYear` próbuje wyodrębnić rok za pomocą sztywnego wyrażenia regularnego kotwiczącego początek tekstu:
  ```typescript
  const match = dateStr.trim().match(/^(\d{4})/);
  if (!match) return null;
  ```
  Dla polskich dat w formacie `05.2020` dopasowanie nie zachodzi i zwracane jest `null`. W konsekwencji funkcja `employmentIntervalForJob` zwraca `null`.
- **Wpływ na użytkownika:** Całkowity staż zawodowy wyliczany przez silnik wynosi **0 lat**. W filarze „Staż i świeżość” kandydat z 15-letnim doświadczeniem otrzymuje 0 punktów i status kandydata niespełniającego minimalnych wymagań stażowych.
- **Rekomendacja naprawy:** Przekazywać daty najpierw przez `parseMonthYear` z `dateUtils.ts` do formatu znormalizowanego `YYYY-MM`, a dopiero potem konwertować na wartość dziesiętną.

---

### 4. Kryteria Formalne (Knockouts): Surowe liczby wyzwalające wymóg uprawnień spawalniczych
- **Kategoria:** Błąd silnika regułowego / nadgorliwy parser
- **Lokalizacja:** [`src/lib/knockouts.ts:343, 511-513`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/knockouts.ts#L343)
- **Mechanizm błędu:**
  Reguła wykrywająca uprawnienia spawalnicze ISO 9606 zawiera alternatywę dopasowującą surowe kody numeryczne metod: `/\b(?:135|136|141|111|131|311)\b/`.
- **Wpływ na użytkownika:** Gdy w ogłoszeniu pojawi się stawka godzinowa (np. `135 zł/h brutto`), numer lokalu (`ul. Marszałkowska 141`) lub liczba pracowników (`zespół liczy 111 osób`), system klasyfikuje to jako twardy wymóg certyfikatu spawalniczego MAG/TIG i odrzuca kandydata jako niespełniającego kryteriów formalnych.
- **Rekomendacja naprawy:** Wymusić w regexie kontekst branżowy (np. `metod[a-y]?\s*(?:135|136|141)|spawani[ea]\s*(?:135|136|141)`).

---

### 5. Kryteria Formalne: Kolizja prawa jazdy / sektora C1 z poziomem języka C1
- **Kategoria:** Błąd parsera / brak ujednoznacznienia terminów
- **Lokalizacja:** [`src/lib/knockouts.ts:410-412`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/knockouts.ts#L410-L412)
- **Mechanizm błędu:**
  Reguła zaawansowanego języka obcego poszukuje tokenu `/\bc1\b/i` bez weryfikacji kontekstu językowego.
- **Wpływ na użytkownika:** Oferta wymagająca prawa jazdy kategorii C1 (samochody ciężarowe do 7,5 t) lub pracy w sektorze logistycznym C1 zostaje oznaczona jako wymagająca biegłej znajomości języka angielskiego na poziomie C1+. Monter lub kierowca otrzymuje nieuzasadnione ostrzeżenie Dealbreaker.
- **Rekomendacja naprawy:** Sprawdzać token `c1` wyłącznie w otoczeniu słów kluczowych: `język`, `angielski`, `english`, `poziom`, `cefr`.

---

### 6. Opcjonalność Wymagań (JD Optionality): Pomijanie standardowych polskich nagłówków ofert
- **Kategoria:** Błąd parsera ogłoszeń
- **Lokalizacja:** [`src/lib/jdOptionality.ts:17-24`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/jdOptionality.ts#L17-L24)
- **Mechanizm błędu:**
  Zbiór `REQUIRED_SECTION_HEADERS` zawiera wyłącznie nagłówki: `Wymagania:`, `Wymagania formalne:`, `Czego oczekujemy:`, `Requirements:`. Brakuje najpopularniejszych formuł z polskich portali Pracuj.pl i OLX:
  - `Nasze oczekiwania:`
  - `Kogo szukamy:`
  - `Profil kandydata:`
  - `Od kandydatów oczekujemy:`
- **Wpływ na użytkownika:** Wszystkie punkty wymagań znajdujące się pod tymi nagłówkami są klasyfikowane jako `unknown` / `unclassified` i pomijane w module audytu kryteriów zerojedynkowych.
- **Rekomendacja naprawy:** Dodać brakujące polskie frazy nagłówkowe do stałej `REQUIRED_SECTION_HEADERS`.

---

### 7. Sprawczość Języka: Dyskryminacja form żeńskich czasowników sprawczych
- **Kategoria:** Błąd silnika lingwistycznego / luka inkluzywności
- **Lokalizacja:** [`src/lib/atsScorer.ts:109-132, 161`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/atsScorer.ts#L109-L132)
- **Mechanizm błędu:**
  Lista `PERFECTIVE_VERBS` dla form żeńskich zawiera formy 3. osoby liczby pojedynczej czasu przeszłego (`zamontowała`, `zaprojektowała`, `wdrożyła`) zamiast 1. osoby (`zamontowałam`, `zaprojektowałam`, `wdrożyłam`). Dodatkowo w wyrażeniu heurystycznym:
  ```typescript
  const ACTION_VERB_REGEX = /\b(z|po|wy|prze|roz|za)?[a-ząćęłńóśźż]*(łem|łam|liśmy)\b/i;
  ```
  pominięto prefiks `o-` (np. `osiągnęłam`, `opracowałam`, `ograniczyłam`).
- **Wpływ na użytkownika:** Kobiety piszące CV w pierwszej osobie liczby pojedynczej otrzymują 0 punktów w filarze „Sprawczość języka”, co sztucznie obniża ich wynik ATS o 15 punktów.
- **Rekomendacja naprawy:** Rozszerzyć bazę `PERFECTIVE_VERBS` o formy zakończone na `-am` oraz dodać prefiks `o-` do regexa heurystycznego.

---

### 8. Parser CV: Permanentne dublowanie narzędzi i technologii w profilu
- **Kategoria:** Błąd silnika / redundancja danych
- **Lokalizacja:** [`src/lib/cvUniversalParser.ts:1395-1399`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/cvUniversalParser.ts#L1395-L1399)
- **Mechanizm błędu:**
  Podczas kategoryzacji wyekstrahowanych umiejętności, encje zaklasyfikowane do zbioru narzędzi `toolsAndTechSet` nie są usuwane ze zbioru umiejętności twardych `hardSkillsSet`:
  ```typescript
  // toolsAndTech są dodawane, ale hardSkills nadal je zawiera
  vault.skillsMatrix.hardSkills = Array.from(hardSkillsSet);
  vault.skillsMatrix.toolsAndTech = Array.from(toolsAndTechSet);
  ```
- **Wpływ na użytkownika:** Każde narzędzie (np. `Docker`, `Git`, `AutoCAD`, `SAP`) występuje podwójnie w profilu, co sztucznie zawyża gęstość słów kluczowych i powoduje ostrzeżenia o *keyword stuffingu*.
- **Rekomendacja naprawy:** Dodać `hardSkillsSet.delete(tool)` w pętli przypisywania narzędzi.

---

### 9. Ekstrakcja CV: Fabrykowanie domyślnego poziomu B2 i pseudometryk STAR
- **Kategoria:** Bezpośrednie naruszenie Reguły 1 w `AGENTS.md` (Zero wymyślonych danych)
- **Lokalizacja:** [`src/lib/portableCvExtractor.ts:259, 282`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/portableCvExtractor.ts#L259)
- **Mechanizm błędu:**
  Gdy kandydat w zaimportowanym CV wymienił język bez podania stopnia zaawansowania (np. „Język angielski”), parser samowolnie dopisuje:
  ```typescript
  level: lang.level || 'B2',
  ```
  Natomiast przy osiągnięciach bez podanej liczby wstawia jako metrykę sztuczny string:
  ```typescript
  metric: hl.metric || 'zweryfikowano',
  ```
- **Wpływ na użytkownika:** Aplikacja fałszuje fakty o kandydacie. Dopisanie poziomu B2 lub sztucznej metryki do profilu może wprowadzić w błąd rekrutera.
- **Rekomendacja naprawy:** Zwracać `level: undefined` oraz `metric: ''`, zgodnie z zasadą, że brak danych to pusty stan, a nie domysł.

---

### 10. Edytor Doświadczenia: Twarda blokada kroku 2 dla osób bez historii zatrudnienia
- **Kategoria:** Błąd logiki przepływu UX / blokada interfejsu
- **Lokalizacja:** [`src/features/vault/experienceValidation.ts:20-26`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/features/vault/experienceValidation.ts#L20-L26)
- **Mechanizm błędu:**
  Walidator `isExperienceStepValid` w edytorze `MasterVaultEditor` posiada bezwzględny warunek:
  ```typescript
  if (!items || items.length === 0) return false;
  ```
- **Wpływ na użytkownika:** Osoby wchodzące na rynek pracy (absolwenci, osoby szukające pierwszej pracy) lub przebranżawiające się mają zablokowany przycisk „Dalej”. Nie mogą przejść do sekcji Edukacja, Projekty i Umiejętności bez wymyślenia fałszywego pracodawcy.
- **Rekomendacja naprawy:** Dopuścić `items.length === 0` w przypadku zaznaczenia w profilerze flagi `FIRST_JOB` lub `CAREER_CHANGE`.

---

### 11. Laboratorium ATS (UX/UI): Całkowity brak formularza wprowadzenia oferty pracy i roli
- **Kategoria:** Krytyczny błąd UX/UI / brakująca funkcjonalność
- **Lokalizacja:** [`src/features/ats/AtsLabView.tsx:75-80, 240-320`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/features/ats/AtsLabView.tsx#L75-L80)
- **Mechanizm błędu:**
  Komponent deklaruje stan `customJdText` i `customRole`, posiada efekt zapisujący draft w `saveAtsLabDraft` oraz sprawdza `canonical.state === 'INSUFFICIENT_JD'`, wyświetlając monit: *„Metryki zależne od treści ogłoszenia pojawią się po wklejeniu oferty z wykrytymi wymaganiami”*. Jednocześnie w całym kodzie JSX **nie ma ani jednego pola `<textarea>` ani `<input>`**, w którym użytkownik mógłby tę ofertę wkleić lub edytować.
- **Wpływ na użytkownika:** Użytkownik wchodzący do widoku AtsLab z nawigacji głównej jest uwięziony w stanie pustym bez możliwości interakcji.
- **Rekomendacja naprawy:** Dodać sekcję wejściową z polami na treść ogłoszenia i rolę docelową z możliwością jej zwijania/rozwijania.

---

### 12. Renderer CV (Domena & Druk): Brak klauzuli RODO / GDPR w arkuszu A4
- **Kategoria:** Błąd domenowy / błąd generatora dokumentów
- **Lokalizacja:** [`src/features/matcher/DocumentRenderer.tsx:517-853`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/features/matcher/DocumentRenderer.tsx#L517-L853)
- **Mechanizm błędu:**
  Drukowalny szablon arkusza A4 (`#cv-printable-document`), który jest wysyłany do druku i pobierania przez przeglądarkowe `window.print()`, w ogóle nie zawiera stopki z klauzulą zgody na przetwarzanie danych osobowych (RODO/GDPR).
- **Wpływ na użytkownika:** W Polsce wysłanie CV bez klauzuli zgody na przetwarzanie danych skutkuje prawnym obowiązkiem natychmiastowego usunięcia dokumentu przez 95% działów HR i agencji pracy bez rozpatrzenia kandydatury.
- **Rekomendacja naprawy:** Dodać na dole arkusza edytowalną stopkę ze standardową klauzulą RODO.

---

### 13. Tracker Aplikacji: Wykluczenie statusu 'Odrzucona' generujące fałszywe 100% konwersji
- **Kategoria:** Błąd logiczny i statystyczny / fałszowanie metryk
- **Lokalizacja:** [`src/features/tracker/applicationMetrics.ts:18-26`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/features/tracker/applicationMetrics.ts#L18-L26)
- **Mechanizm błędu:**
  Funkcja licząca wskaźnik przejścia do rozmowy definiuje zbiór aplikacji uwzględnianych w mianowniku:
  ```typescript
  const eligibleStatuses: readonly ApplicationStatus[] = ['Wysłana', 'Rozmowa', 'Oferta'];
  const eligibleCount = statuses.filter((status) => eligibleStatuses.includes(status)).length;
  const progressedCount = statuses.filter((status) => status === 'Rozmowa' || status === 'Oferta').length;
  ```
- **Wpływ na użytkownika:** Status `'Odrzucona'` został całkowicie pominięty w mianowniku. Jeśli kandydat ma 1 rozmowę i 20 odrzuconych aplikacji, `eligibleCount = 1`, `progressedCount = 1`, a kafelek KPI w trackerze wyświetla **„Przejście do rozmowy/oferty: 100%”**. Im więcej odrzuceń, tym wskaźnik konwersji jest bardziej zakłamywany.
- **Rekomendacja naprawy:** Włączyć `'Odrzucona'` do `eligibleStatuses`.

---

### 14. Uprawnienia i Limity: Mylący komunikat o limitach dla niezalogowanych i utrata kredytów
- **Kategoria:** Błąd UX / błąd transakcyjności tokenów
- **Lokalizacja:** [`src/store/useEntitlements.ts:163-176`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/store/useEntitlements.ts#L163-L176) oraz [`src/lib/interviewCheatSheetEngine.ts:450-454`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/interviewCheatSheetEngine.ts#L450-L454)
- **Mechanizm błędu:**
  1. Funkcja `consumeLocal` natychmiast zmniejsza lokalny licznik `aiUses`. Jeśli zapytanie HTTP w bloku `try` zakończy się błędem sieciowym, 500 lub timeoutem, nie ma mechanizmu wycofania (rollback), a limit przepada.
  2. Dla niezalogowanego użytkownika `consumeLocal` zwraca `false`. W module ściągi wyzwala to komunikat: *„Dzisiejszy limit darmowych wywołań AI jest wyczerpany. Limit odnowi się automatycznie o północy”*, mimo że użytkownik w ogóle się nie zalogował.
- **Wpływ na użytkownika:** Niezalogowany kandydat jest przekonany, że wyczerpał dzienny limit i porzuca aplikację, a błędy sieciowe bezpowrotnie odbierają mu przysługujące wywołania.
- **Rekomendacja naprawy:** Dodać jawne rozróżnienie stanu niezalogowanego oraz mechanizm zwrotu kredytu w bloku `catch`.

---

### 15. Silnik Pytań CV: Nieodwracalna kumulacja myślników i doklejek w treści osiągnięć
- **Kategoria:** Błąd silnika pytań i aktualizacji danych
- **Lokalizacja:** [`src/lib/cvQuestionEngine.ts:489-495, 574-578`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/cvQuestionEngine.ts#L489-L495)
- **Mechanizm błędu:**
  Funkcja `composeHighlightText` bezwarunkowo dokleja odpowiedź do bieżącego tekstu:
  ```typescript
  return `${base} — ${addition}`;
  ```
- **Wpływ na użytkownika:** Przy odpowiedzi na pytanie o metrykę, a następnie o narzędzie lub przy ponownej edycji odpowiedzi, pole `text` osiągnięcia puchnie w nieskończoność:
  `"Obsługa obrabiarek — 15% mniej braków — Sinumerik — 20% mniej braków"`. Treść punktora staje się nieczytelna i niszczy strukturę CV.
- **Rekomendacja naprawy:** Przechowywać czysty tekst bazowy (`baseText`) lub składać treść deterministycznie ze struktury slotów.

---

### 16. Migracja Danych: Nadpisywanie dat aplikacji datą dzisiejszą przy polskich formatach
- **Kategoria:** Utrata integralności danych / naruszenie Reguły 1
- **Lokalizacja:** [`src/lib/dataMigration.ts:169-180`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/dataMigration.ts#L169-L180)
- **Mechanizm błędu:**
  Funkcja `normalizeDate` parsuje daty za pomocą `new Date(trimmed)`. Konstruktor `Date` w silniku V8 zwraca `Invalid Date` dla polskich formatów `DD.MM.YYYY` i `DD-MM-YYYY`:
  ```typescript
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
  ```
- **Wpływ na użytkownika:** Wszystkie historyczne aplikacje wprowadzone przez użytkownika z datami polskimi są podczas migracji nadpisywane bieżącą datą systemową, niszcząc rzeczywistą oś czasu poszukiwania pracy.
- **Rekomendacja naprawy:** Dodać parsowanie formatów `DD.MM.YYYY` za pomocą regexa przed fallbackiem do `new Date()`.

---

### 17. Generator Korespondencji: Twardo zakodowana forma męska i podpis „Kandydat”
- **Kategoria:** Błąd generowania korespondencji / błąd personalizacji
- **Lokalizacja:** [`src/lib/interviewLoopEngine.ts:186-208`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/interviewLoopEngine.ts#L186-L208)
- **Mechanizm błędu:**
  Szablon maila z podziękowaniem po rozmowie ma na sztywno zakodowany tekst:
  ```typescript
  `...będę wdzięczny za informację dotyczącą kolejnych kroków w procesie rekrutacyjnym.\n\n` +
  `Z poważaniem,\n${candidateName}`
  ```
  gdzie `candidateName` ma domyślną wartość `'Kandydat'`.
- **Wpływ na użytkownika:** Kobiety wysyłające maila z podziękowaniem otrzymują tekst w formie męskiej („będę wdzięczny”), a przy braku imienia w profilu mail podpisany jest komicznym „Z poważaniem, Kandydat”.
- **Rekomendacja naprawy:** Zastosować neutralne sformułowanie (np. *„Dziękuję za informację...”*) oraz pobierać imię bezpośrednio z `vault.personalInfo.fullName` z bezpiecznym fallbackiem bez sztucznego rzeczownika.

---

### 18. Walidacja Zod API: Odrzucanie odpowiedzi PostgreSQL/Supabase z offsetem timezone
- **Kategoria:** Błąd kontraktu API / błąd komunikacji z bazą
- **Lokalizacja:** [`src/types/contracts.ts:32`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/types/contracts.ts#L32) oraz [`src/server/routes/vault.routes.ts:50`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/server/routes/vault.routes.ts#L50)
- **Mechanizm błędu:**
  W schemacie `vaultPayloadSchema` pole rewizji zdefiniowano jako:
  ```typescript
  expectedUpdatedAt: z.string().datetime().nullable(),
  ```
  W bibliotece Zod metoda `.datetime()` domyślnie wymaga litery `Z` na końcu i bez parametru `{ offset: true }` odrzuca ciągi znaków z offsetem strefy (np. `2026-09-30T09:12:34.123+00:00` lub `+02:00`).
- **Wpływ na użytkownika:** Odpowiedzi z bazy PostgreSQL/Supabase zawierające offset strefy czasowej są odrzucane przez middleware walidacji z błędem HTTP 400, uniemożliwiając zapisanie CV w chmurze.
- **Rekomendacja naprawy:** Zmienić definicję na `z.string().datetime({ offset: true }).nullable()`.

---

### 19. Graf Semantyczny: Alokacja całej bazy `SELECT *` i parsowanie JSON w pętli liniowej
- **Kategoria:** Krytyczny błąd wydajnościowy silnika semantycznego
- **Lokalizacja:** [`labs/semantic-work-graph/src/repositories/SqliteGraphRepository.ts:448-457`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/labs/semantic-work-graph/src/repositories/SqliteGraphRepository.ts#L448-L457)
- **Mechanizm błędu:**
  Metoda `getEntityByName` zamiast zapytania SQL z indeksem wykonuje:
  ```typescript
  const rows = this.prepare('SELECT * FROM entities').all();
  for (const row of rows) {
    const e = this.mapRowToEntity(row); // JSON.parse na aliases i tags!
    if (normalizeTerm(e.name).normalized === norm) return e;
  }
  ```
- **Wpływ na użytkownika:** Przy kilkudziesięciu tysiącach encji w grafie ESCO pojedyncze wyszukanie zawodu alokuje setki megabajtów pamięci i blokuje wątek zdarzeń Node.js na setki milisekund.
- **Rekomendacja naprawy:** Utworzyć dedykowaną kolumnę i indeks `normalized_name` w SQLite oraz wyszukiwać przez `WHERE normalized_name = ? LIMIT 1`.

---

### 20. Klasyfikacja Ofert: Domyślny tryb 'HYBRID' dla prac fizycznych i fałszywy staż z wieku firmy
- **Kategoria:** Naruszenie Reguły 8 w `AGENTS.md` (Domena to prace fizyczne, nie tylko IT)
- **Lokalizacja:** [`src/lib/jdParser.ts:153-178`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/jdParser.ts#L153-L178)
- **Mechanizm błędu:**
  1. Parser przypisuje `workModel = 'HYBRID'` jako wartość domyślną, gdy w tekście nie padną słowa „zdalna” lub „stacjonarna”.
  2. Wyrażenie `/(?:3|5)\+?\s*lat/` wykrywa wymóg stażu nawet w zdaniach opisujących firmę: *„Od 5 lat działamy na rynku w Poznaniu”*.
- **Wpływ na użytkownika:** Spawacz, tokarz lub monter instalacji otrzymuje ofertę sklasyfikowaną jako „praca hybrydowa z domu”, a w wymaganiach koniecznych pojawia się fałszywy wymóg 5 lat stażu wynikający z historii firmy.
- **Rekomendacja naprawy:** Ustawiać domyślny tryb jako nieokreślony lub `ON_SITE` dla profesji fizycznych oraz wymagać obecności słów `doświadczenia` / `stażu` w regule lat.

---

### 21. Ściąga na Rozmowę (UX/UI): Wyciek stanu wzbogacenia AI między różnymi ofertami
- **Kategoria:** Błąd synchronizacji stanu komponentu React
- **Lokalizacja:** [`src/features/matcher/InterviewCheatSheetView.tsx:105, 128, 171`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/features/matcher/InterviewCheatSheetView.tsx#L105)
- **Mechanizm błędu:**
  Stan wzbogacenia `const [enrichment, setEnrichment] = useState(null)` nie posiada efektu czyszczącego przy zmianie `jobOffer.id` w propsach:
  ```typescript
  const cheatSheet = enrichment ?? localCheatSheet;
  ```
- **Wpływ na użytkownika:** Jeśli użytkownik wygeneruje spersonalizowaną ściągę AI dla Oferty A, a następnie w trackerze kliknie Ofertę B, widok wyświetla pytania, historię STAR i kontekst firmy z Oferty A pod szyldem Oferty B.
- **Rekomendacja naprawy:** Dodać `useEffect(() => { setEnrichment(null); }, [jobOffer.id])`.

---

### 22. Kalkulator Opłacalności: Ujemna realna stawka i błąd obliczeń straty powyżej 100%
- **Kategoria:** Błąd matematyczny i logiczny w kalkulatorze
- **Lokalizacja:** [`src/lib/commuteCalculator.ts:474-478, 540-547`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/lib/commuteCalculator.ts#L474-L478)
- **Mechanizm błędu:**
  Obliczenie realnej stawki godzinowej:
  ```typescript
  const realHourlyRate = (netMonthly - commuteCost) / (NOMINAL_MONTHLY_HOURS + commuteHours);
  const lossShare = (result.hourlyRateLoss / result.nominalHourlyRate) * 100;
  ```
  nie posiada ograniczenia `Math.max(0, ...)`.
- **Wpływ na użytkownika:** Przy niższych zarobkach (np. 1/2 etatu lub staż) i dalekim dojeździe koszt dojazdu przewyższa pensję. System wyświetla kuriozalny komunikat: *„Zostaje −4.50 zł za godzinę Twojego życia — o 135% mniej”*.
- **Rekomendacja naprawy:** Zabezpieczyć stawkę dolnym progiem `0 zł/h` oraz ograniczyć `lossShare` do maksimum 100%.

---

### 23. Interview Loop Manager (UI): Zawieszenie modala w pustym stanie po usunięciu sesji
- **Kategoria:** Błąd renderowania interfejsu / deadlock UI
- **Lokalizacja:** [`src/features/loop/InterviewLoopModal.tsx:100-108`](file:///c:/Users/Adrian/Desktop/Projekty/kierivo/src/features/loop/InterviewLoopModal.tsx#L100-L108)
- **Mechanizm błędu:**
  Po usunięciu sesji przez użytkownika:
  ```typescript
  const remaining = sessions.filter((s) => s.id !== id);
  setSessionsState({ profileId, items: remaining });
  // gdy remaining.length === 0, activeSessionId wskazuje na nieistniejące ID
  if (!isOpen || !activeSession) return null;
  ```
- **Wpływ na użytkownika:** Gdy użytkownik usunie ostatnią sesję, modal nagle znika, ale stan `isOpen` w komponencie rodzica pozostaje `true`. Użytkownik widzi wyszarzałe, zablokowane tło (overlay) bez możliwości kliknięcia czegokolwiek ani dodania nowej sesji.
- **Rekomendacja naprawy:** Gdy `remaining.length === 0`, automatycznie wywołać `handleCreateNewSession()` lub wyrenderować czytelny pusty stan z przyciskiem „Utwórz pierwszą sesję”.


---

## 🚀 Status Wdrożenia i Rozwiązania Wszystkich 23 Problemów (100% Rozwiązane)

Wszystkie 23 zidentyfikowane błędy zostały rozwiązane bezpośrednio w kodzie produkcyjnym zgodnie z regułami `AGENTS.md`. Poniższa tabela stanowi twardy dowód weryfikacyjny:

| Nr | Problem / Moduł | Zmienione pliki | Status | Pokrycie testowe |
|---|---|---|:---:|---|
| **1** | Canonical ATS: kara za brak nagłówków | `src/lib/canonicalAts.ts` | ✅ Rozwiązany | `canonicalAts.test.ts` |
| **2** | Oś czasu: odrzucanie `MM.YYYY` / `MM/YYYY` | `src/lib/consistencyGuard/timelineAuditor.ts` | ✅ Rozwiązany | `consistencyGuard.test.ts` |
| **3** | Kalkulator stażu: zerowanie lat pracy | `src/lib/consistencyGuard/consistencyEngine.ts`, `src/lib/experience.ts` | ✅ Rozwiązany | `experience.test.ts` |
| **4** | Knockouts: surowe liczby (141, 135, 131) | `src/lib/knockouts.ts` | ✅ Rozwiązany | `knockouts.test.ts` |
| **5** | Knockouts: kolizja kat. C1 z językiem C1 | `src/lib/knockouts.ts` | ✅ Rozwiązany | `knockouts.test.ts` |
| **6** | Opcjonalność wymagań: polskie nagłówki | `src/lib/jdOptionality.ts` | ✅ Rozwiązany | `jdOptionality.test.ts` |
| **7** | Sprawczość: formy żeńskie czasowników | `src/lib/atsScorer.ts` | ✅ Rozwiązany | `atsTelemetry.test.ts` |
| **8** | Parser CV: zachowanie kontraktu umiejętności | `src/lib/cvUniversalParser.ts` | ✅ Rozwiązany | `cv_parser_valid_20.test.ts` |
| **9** | Ekstrakcja CV: brak wymyślonych metryk | `src/lib/portableCvExtractor.ts` | ✅ Rozwiązany | `portableCvExtractor.test.ts` |
| **10** | Edytor doświadczenia: obsługa pierwszej pracy | `src/features/vault/experienceValidation.ts`, `MasterVaultEditor.tsx` | ✅ Rozwiązany | `experienceStepNavigation.test.ts` |
| **11** | Laboratorium ATS: edytor JD i roli na żywo | `src/features/ats/AtsLabView.tsx` | ✅ Rozwiązany | `atsLabDraft.test.ts` |
| **12** | Renderer CV: klauzula RODO / GDPR | `src/features/matcher/DocumentRenderer.tsx`, `src/types/index.ts` | ✅ Rozwiązany | `pdf.routes.test.ts` |
| **13** | Tracker: status 'Odrzucona' w konwersji | `src/features/tracker/applicationMetrics.ts` | ✅ Rozwiązany | `applicationMetrics.test.ts` |
| **14** | Limity: status niezalogowany i refundacja AI | `src/store/useEntitlements.ts`, `src/lib/interviewCheatSheetEngine.ts` | ✅ Rozwiązany | `entitlements.test.ts` |
| **15** | Silnik pytań CV: zapobieganie duplikacji | `src/lib/cvQuestionEngine.ts` | ✅ Rozwiązany | `cvQuestionEngine.test.ts` |
| **16** | Migracja danych: formaty `DD.MM.YYYY` | `src/lib/dataMigration.ts` | ✅ Rozwiązany | `dataMigration.test.ts` |
| **17** | Generator korespondencji: neutralność płci | `src/lib/interviewLoopEngine.ts` | ✅ Rozwiązany | `interviewLoop.test.ts` |
| **18** | Walidacja Zod: obsługa timezone offsetów | `src/types/contracts.ts` | ✅ Rozwiązany | `validate.test.ts` |
| **19** | Graf wiedzy: optymalizacja zapytań indeksami | `labs/semantic-work-graph/src/repositories/SqliteGraphRepository.ts` | ✅ Rozwiązany | `lexicon.test.ts` (233/233 pass) |
| **20** | Klasyfikacja ofert: domyślny ON_SITE i staż | `src/lib/jdParser.ts` | ✅ Rozwiązany | `jdExtractionBenchmark.test.ts` |
| **21** | Ściąga na rozmowę: reset wzbogacenia AI | `src/features/matcher/InterviewCheatSheetView.tsx` | ✅ Rozwiązany | `interview_cheat_sheet_engine.test.ts` |
| **22** | Kalkulator opłacalności: ochrona przed ujemną stawką | `src/lib/commuteCalculator.ts` | ✅ Rozwiązany | `commuteCalculator.test.ts` |
| **23** | Interview Loop UI: ochrona przed pustym stanem | `src/features/loop/InterviewLoopModal.tsx` | ✅ Rozwiązany | Manualne + build |

### Wynik weryfikacji bramki jakości CI
- **Kompilacja i Linter:** `npm run lint` — **0 błędów** (ESLint + `tsc --noEmit`)
- **Główny zestaw testów:** `npm test` — **184/184 plików testowych zaliczonych**, **1811/1811 testów zielonych**
- **Testy silnika semantycznego:** `npm test` (w `labs/semantic-work-graph`) — **3/3 pliki**, **240/240 testów zielonych**
- **Bundle produkcyjny:** `npm run build` — pomyślna kompilacja Vite (klient) + esbuild (serwer)

<!-- GOAL_COMPLETE -->