# Kierivo Public Pre-Beta — odbiór ADR-152 / ADR-125

Stan 15.10.2026: **BLOCKED — odbiór trwa; brak zgody na publikację**.

ADR-153: potwierdzono S0 w lokalnym przełączaniu profili. Na bazowym
`1e5d2eb7241fa999d0e576201725462424b544f2` edytor pozostawiony na karcie CV
po zmianie A → B pokazywał i kopiował tekst A. Magazyny źródłowe pozostawały
rozdzielone; lokalny `docVault` był inicjalizowany tylko przy montowaniu.
Poprawka odmontowuje edytor przy zmianie właściciela, osłania przekazanie Vaultu
także przy wylogowaniu i uzupełnia nietknięty szkic po odczycie nowego profilu.
Istniejący test izolacji sprawdza teraz CV i rzeczywisty schowek przed zmianą
zakładki: A → zamknięcie profilu → B → reload → A. Reprodukcja FAIL przed
poprawką, PASS po poprawce na świeżo uruchomionym serwerze. Lint/TS PASS
(202 wcześniejsze ostrzeżenia), Vitest 2739 PASS / 1 SKIPPED, build PASS.
Dowód syntetyczny: `docs/evidence/cv-profile-owner-b.png`. Pozostaje odbiór
CI wynikowego SHA oraz dalsze kryteria ADR-153 dotyczące bajtów eksportów;
nie oznaczono całego issue Done.

Odbiór lokalny poprawki `4eb4ca0d98a7ac45460cda1c41fcabda6553bdb6`:
Release Gate PASS, zakończony 15.10.2026 03:04:42 UTC; 29 scenariuszy
przeglądarkowych, testy Python/PDF, build i built smoke PASS. Raport:
`artifacts/release-4eb4ca0d98a7ac45460cda1c41fcabda6553bdb6/report.json`.
Produkcja/OAuth/AI mają osobne statusy UNKNOWN, telemetria lokalna SKIPPED;
nie zaliczono ich na podstawie tego raportu. Draft PR #144 jest oparty na #142,
więc filtry `pull_request: branches: [main]` nie uruchamiają automatycznie CI.

Dodatkowe kryterium ADR-153: istniejące testy eksportu badają teraz rzeczywiste
PDF standard/dual-layer (tekst wszystkich stron, metadane, brak załączników),
całe archiwum DOCX i dwa mechanizmy TXT. Markery telefonu i punktora usuniętych
z projekcji oraz wewnętrznych claims/subRoleId nie występują w wynikach;
publiczne markery są obecne, źródłowy Vault zachowuje całą treść. Wynik negatywny
dla tej projekcji, bez nowej poprawki runtime. Kontrakt nie ma flag private/visible;
test nie potwierdza nieistniejącej funkcji prywatnych pól. Globalny eksport Word
z palety poleceń używa całego MasterVault, a edytor CV swojej projekcji.
34 testy DOCX/PDF PASS z rzeczywistym rendererem; pełny Vitest 2740 PASS /
3 SKIPPED (trzy kontrole PDF wykonano osobno z RUN_PDF_INTEGRATION=1), lint/TS
PASS, bez nowych ostrzeżeń. Bieżący kod runtime nie zmienił się od `4eb4ca0`.

Uzgodniono nowe przekazanie Gemini Argon i instrukcje z draft PR #143:
ADR-153/154 przed porządkowaniem agentów i optymalizacją CI. PR #143 pozostaje
osobny i niescalony. Same nazwy historycznych zrzutów nie są dowodem regresji.
`main` po ponownym pobraniu: `00a4ccb4590d754a90e8a5e65e5e31f39a3ad63f`;
baza poprawki ma 17 commitów przewagi i 0 zaległych względem `main`.

Potwierdzony S1 na stronie publicznej po rzeczywistym logowaniu: eksport
`POST /api/cv/export-pdf` zwraca HTTP 500. Renderer zgłasza brak Georgia,
Georgia-Bold i SegoeUI/Bold/Semibold. Obraz runtime nie instaluje fontów DejaVu,
których wymaga istniejący fallback na Linuksie. Obraz instaluje teraz
`fonts-dejavu-core`. Wymagany CI po zbudowaniu obrazu wykonuje rzeczywisty
eksport i ścisłą weryfikację PDF jako użytkownik node. Lokalny eksport/
weryfikacja CLI PASS (2 strony, 37 elementów semantycznych). Docker nie jest
dostępny lokalnie; poprawkę kontenera odebrano w GitHub CI wskazanym poniżej.
Eksport obecnej produkcji pozostaje FAIL do zatwierdzonego wdrożenia i smoke.

Ostatni kompletny odbiór CI i lokalny: `1e5d2eb7241fa999d0e576201725462424b544f2`
([Release Gate 38640047253](https://github.com/krymszuch-stack/Kierivo/actions/runs/38640047253), wszystkie 6 workflowów PASS).
Lokalny raport: `artifacts/release-1e5d2eb7241fa999d0e576201725462424b544f2/report.json`;
29 kontroli przeglądarkowych, Vitest 2739 PASS / 1 SKIPPED, Python 46/46,
PDF API 19/19 i built smoke PASS. Ten odbiór nie obejmuje późniejszej poprawki S0.
Ostatni kompletny lokalny odbiór kodu: `d1cc1e7cba6c263ba58c4e5629bbee47dda21aba`.
Lokalny Release Gate PASS, Vitest 2736 PASS / 1 SKIPPED, Python 46/46,
PDF API 19/19, 28 scenariuszy przeglądarkowych i built smoke PASS.
Raport: `artifacts/release-d1cc1e7cba6c263ba58c4e5629bbee47dda21aba/report.json`.
Wszystkie sześć workflowów GitHub PASS; [Release Gate 38636624103](https://github.com/krymszuch-stack/Kierivo/actions/runs/38636624103).
Funkcjonalny eksport i ścisła weryfikacja PDF wewnątrz obrazu runtime PASS
w [CI 38636624084](https://github.com/krymszuch-stack/Kierivo/actions/runs/38636624084), job 116101321304, krok 12.
Nie oznacza to odbioru późniejszych zmian ani produkcji.

Kolejna poprawka D17: dodanie brakującego Terraform do oferty z Python
obniżało świeżość ze 100 do 85 mimo niezmienionych dat. Pokrycie wymagań było
ponownie ważone w modułach aktualności (30%) i tytułu (25%). Te moduły mierzą
teraz wyłącznie własny sygnał; pokrycie ma osobny moduł. RED → GREEN;
2733 testy PASS / 1 SKIPPED, lint/TypeScript i build PASS. Rzeczywisty AtsLabView
oraz onboarding PASS, zrzuty `docs/evidence/ats-independent-aggregation.png`
i `ats-mandatory-skill-onboarding.png`. CI/Gate powyżej obejmuje tę poprawkę.
Nie zmieniono progów ani oczekiwań wcześniejszych testów.

Smoke działającej strony ujawnił dwa błędy importu tekstu: z „ADR-152”
powstawała umiejętność ADR, a daty po nazwie uczelni i stopniu tworzyły drugą,
pustą edukację. Reprodukcje RED → GREEN. Wspólny matcher pomija identyfikator
ze skrótem i numerem; osobny prawdziwy dowód nadal liczy się. Parser zachowuje
jedną szkołę z datami także przy kolejności zakres → uczelnia → stopień.
Lokalnie 2736 PASS / 1 SKIPPED, lint/TS i build PASS. Rzeczywisty modal importu
przez ekran różnic do MasterVault PASS; dowód `docs/evidence/cv-import-source-facts.png`.
Dodano go jako 28. scenariusz Release Gate; odbiór `d1cc1e7` powyżej go obejmuje.

Wcześniejsze wklejki: ponownie potwierdzono sumy wszystkich sześciu plików.
Duży schowek zawiera 2985 fragmentów, lecz 126 różnych treści po pominięciu
samego nagłówka kopii. Stały test bada wszystkie 126, bez dawnego limitu 300
fragmentów; tekst nie może zniknąć do pustego wyniku. Zbiór praktyczny ma
dokładnie 33 sekcje. Dodatkowe kontrole ofert 2/16 w pełnym potoku przygotowania
potwierdzają wymagane C/UDT i blokadę profilu z negacją uprawnień. Wklejek nie
zmieniono. Regresje korpusu 26/26 PASS; cały Vitest 2739 PASS / 1 SKIPPED.
To pokrycie wybranych kontraktów, nie dowód idealnego odczytu wszystkich ofert.

Nowa poprawka podglądu PDF: po przygotowaniu pliku modal renderuje jego strony
przez PDF.js, a pobranie zapisuje ten sam Blob. Nie generuje drugiego pliku.
Bez gotowego podglądu pobranie jest zablokowane; ostrzeżenia o skróceniu nadal
wymagają decyzji. Zmiana źródła lub konta usuwa gotowy artefakt i unieważnia
opóźnioną odpowiedź. RED: ostrzeżenia bez podglądu, 0 zamiast 1 panelu. GREEN:
rzeczywiste 2 strony, SHA-256 podglądu == pobranie, jedno wywołanie renderera,
brak automatycznego download, usunięcie pliku po zmianie profilu i właściciela.
Użyto bez zmian istniejącej długiej próbki (wspólny fixture). Dotychczasowy test
nadal wykazuje 11/31 markerów oraz jawne 20 pominięć; nie deklarujemy eksportu
bez skróceń. Obejrzano obie strony: `docs/evidence/pdf-artifact-preview*.png`.
Vitest 2739 PASS / 1 SKIPPED, lint/TS (202 istniejące ostrzeżenia) i build PASS;
preflight PDF/druk PASS. Nowy test jest 29. scenariuszem Gate. D04 wymaga teraz
obejrzenia PDF przed pobraniem. CI/Gate tej nowej poprawki pozostaje wymagany.

Następny krok: odebrać końcowy Gate/D04 podglądu i ustalić pozostałe kryteria
D20: przyszłe UI vs potwierdzone usterki bieżącego produktu. Przykład do
weryfikacji: etykieta „Kary” w AtsLab zlicza również uwagi struktury/danych,
które w canonical-v3 nie odejmują punktów dopasowania.

Supabase **ACTIVE_HEALTHY**. Odczyt telemetrii: 1 OPEN / 8 wystąpień błędu
importu modułu, ostatnie 06.10; przyczyna nieustalona, nie zamknięto zgłoszenia.
ADR-127: ochrona ujawnionych haseł nadal wyłączona. Polityki właścicielskie
profiles/vaults/applications odczytano; to nie jest test izolacji dwóch kont.
Właściciel zalogował konto i zezwolił na zastąpienie CV danymi syntetycznymi.
Konflikt lokalnej/chmurowej wersji rozwiązano wyborem chmury; UI potwierdził
zapis. AI `/api/ai/verify-cv` odpowiedział 200; bez JD UI wstrzymał dopasowanie
i jawnie wykluczył ocenę pliku PDF. Eksport publiczny FAIL opisano wyżej.
Testowana strona publiczna nie zawiera
jeszcze PR #142. Nie zmieniono produkcyjnych sekretów ani uprawnień.

Pozostałe kryteria odbioru: D17/D20 i ADR-143, pełna zgodność podglądu/PDF,
końcowy Gate oraz rzeczywiste zależności. Długi PDF wymaga jawnej zgody na
skrócenia i nie dowodzi bezstratnej zgodności z podglądem. Nie wykonano merge
ani deploy. ADR-152/125 pozostają otwarte; bieżące dowody uzupełniono w Linear.
Historia poniżej odnosi się wyłącznie do podanych SHA.

## Zakres i punkt odniesienia

Main pobrany 13.10: `00a4ccb4590d754a90e8a5e65e5e31f39a3ad63f`.
PR #138 (011f694), #139 (f5ba973), #140 (763338b), #141 (00a4ccb) są scalone;
potwierdzono przez GitHub API. Przy rozpoczęciu brak otwartych PR.
Gałąź prac: `codex/adr-152-release-hardening`. Nie wykonano merge ani deploy.

Zakres: parser CV/JD → MasterVault → deterministyczna diagnoza i dowody →
generator/podgląd → eksport PDF, izolacja kont/logout/delete, regresje i proces wydania.
Audit Core D07–D20 oceniany w zakresie zachowania publicznego produktu.
Poza zakresem: Gigs, Hunter Autofill, Jobs, publiczny Trust, Kotlin, CzyToTy,
nowa komercjalizacja i przebudowa UI. Nie deklarujemy pełnej kalibracji matematycznej.
S0/S1 blokują; S2/S3 wymagają udokumentowanej akceptacji ryzyka.

## Mapa zależności

- Oferta: scraper/net safeFetch → parser/normalizacja/sekcje MUST/NICE → canonicalAts/knockouts.
- CV: cvUniversalParser → MasterVault → canonicalAts (konsument głównej ścieżki),
  atsSimulator (diagnostyka), Audit Core D07/D08/D09… (kontrakty i ledger).
- Fakty: localProfile/storage/IndexedDB lub AuthContext/cloudVault/outbox/RLS →
  projekcje CV/HUD/Pitch → consistencyEngine/consistencyGuard.
- Eksport: DocumentRenderer/docVault → CVExportModal → API → pdf.routes →
  Python mvcv; wymagany token w ścieżce UI. Podgląd i pobrany plik to oddzielne kontrole.
- Wydanie: CI Fast Gate + pełny Release Gate + izolowany AUTH/RLS/PDF →
  ręczny workflow deploy z produkcyjną bramką telemetryczną → uwierzytelniony smoke.

## Historia

Poprzednie checkpointy i wyniki: [AUDIT_CLOSURE_HISTORY.md](docs/evidence/AUDIT_CLOSURE_HISTORY.md).
