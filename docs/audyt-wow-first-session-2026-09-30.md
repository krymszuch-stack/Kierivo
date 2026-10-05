# Audyt pierwszej sesji Kierivo â€” 2026-09-30

## A. CURRENT STATE

Audyt wykonano lokalnie na syntetycznym profilu IT Support. Nie uĹĽyto prywatnego CV, nie wysĹ‚ano danych do chmury i niczego nie wdroĹĽono. HEAD `5923a5b` odpowiada `origin/main`; zmiany sÄ… lokalne, niezatwierdzone.

Sprawdzono Ĺ›cieĹĽkÄ™ od startu, przez lokalny profil i import syntetycznego CV, do analizy oferty. W tej Ĺ›cieĹĽce sÄ…: piÄ™Ä‡ gĹ‚Ăłwnych obiektĂłw kariery w nawigacji, osobny Doradca, Porady i Baza wiedzy, Biblioteka CV, ustawienia i prywatnoĹ›Ä‡. Po imporcie uĹĽytkownik trafia na seriÄ™ pytaĹ„ o CV; przejĹ›cie do ofert wymagaĹ‚o ich pomijania. Matcher otwiera rozbudowany wynik z siedmioma obszarami.

## B. WOW BLOCKERS

- Pierwsze dopasowanie wymagaĹ‚o ponownego wklejenia CV mimo ĹĽe profil juĹĽ je zawieraĹ‚.
- Po imporcie do profilu seria kart coachingowych odciÄ…gaĹ‚a od pierwszego zadania.
- Wynik ATS mĂłgĹ‚ rozdzieliÄ‡ alternatywÄ™ â€žServiceNow lub Jiraâ€ť i nie rozpoznaÄ‡ triage opisanego zwykĹ‚ym jÄ™zykiem.
- Mapper potrafiĹ‚ znaleĹşÄ‡ dowĂłd w doĹ›wiadczeniu, ale wczeĹ›niej nie proponowaĹ‚ edytowalnego punktu CV z zachowaniem ĹşrĂłdĹ‚a.
- Suma kontrolna wykrywaĹ‚a korupcjÄ™ bieĹĽÄ…cego zapisu, lecz bez trwaĹ‚ej kopii po restarcie nie byĹ‚o wczeĹ›niejszej wersji do odzyskania.
- Start i elementy mobilnoĹ›ci pokazywaĹ‚y wartoĹ›ci sugerujÄ…ce postÄ™p, lokalizacjÄ™ lub dojazd bez peĹ‚nych danych ĹşrĂłdĹ‚owych.

## C. P0

- Ujednolicono liczenie wymagaĹ„ i szybki ATS z kanonicznÄ… analizÄ…: alternatywy narzÄ™dzi nie sÄ… podwĂłjnie liczone, a obowiÄ…zki triage mapujÄ… siÄ™ na dowĂłd.
- Wskazania dopasowania pokazujÄ… ĹşrĂłdĹ‚o; brak wzmianki nie jest przedstawiany jako potwierdzona kompetencja.
- Ukryte sĹ‚owo kluczowe znalezione w doĹ›wiadczeniu proponuje edytowalny punkt roboczego CV, zachowujÄ…c identyfikator stanowiska, firmÄ™ i oryginalny fragment. Zastosowanie i cofniÄ™cie nie zmienia profilu ĹşrĂłdĹ‚owego.
- Szybki ATS korzysta z juĹĽ zapisanego profilu i wymaga tylko treĹ›ci oferty. Pusty profil zachowuje dotychczasowy onboarding z CV.
- Dla przechowywania JSON dodano kopiÄ™ ostatniego poprawnego envelope w IndexedDB oraz odtworzenie i naprawÄ™ localStorage przy wykryciu korupcji.
- Czas i koszt dojazdu zaczynajÄ… siÄ™ od zera; lokalne wyliczenie wymaga rzeczywistego miejsca zamieszkania i biura oraz jest oznaczone jako szacunek.

## D. P1

- Start ma jedno gĹ‚Ăłwne zadanie wynikajÄ…ce z rzeczywistego stanu profilu; usuniÄ™to fikcyjne liczniki analiz i CV. Ostatnia analiza jest odczytywana per profil.
- SkrĂłt Ctrl/Cmd+K otwiera paletÄ™ poleceĹ„.
- Pytania o dowody CV sÄ… umieszczone przy edycji profilu, gdzie moĹĽna poprawiÄ‡ ĹşrĂłdĹ‚owe doĹ›wiadczenie.
- Kolejny krok: ograniczyÄ‡ bocznÄ… nawigacjÄ™ do podstawowych obiektĂłw pracy, a DoradcÄ™ i bazÄ™ wiedzy udostÄ™pniaÄ‡ kontekstowo.
- Kolejny krok: sprawdziÄ‡ peĹ‚ny wynik na telefonie, nawigacjÄ™ samÄ… klawiaturÄ…, czytnik ekranu oraz motyw jasny i ciemny.

## E. P2

- OceniÄ‡ PWA `share_target` osobno; repozytorium nie deklaruje dziaĹ‚ajÄ…cego share target ani rejestracji service workera.
- Liczniki aktywnoĹ›ci pokazywaÄ‡ wyĹ‚Ä…cznie po podĹ‚Ä…czeniu do rzeczywistej historii zdarzeĹ„.
- PeĹ‚ny audyt dĹ‚ugich CV/ofert, literĂłwek, synonimĂłw, konfliktĂłw danych i odzyskiwania po bĹ‚Ä™dach wejĹ›cia pozostaje do wykonania.

## F. DELETE/SIMPLIFY

- UsuniÄ™to fikcyjne wartoĹ›ci licznikĂłw i domyĹ›lne wartoĹ›ci dojazdu.
- Szybki przepĹ‚yw zapisany profil â†’ oferta nie prosi ponownie o CV.
- W profilu ograniczono rozpraszajÄ…ce pytania coachingowe wyĹ›wietlane bezpoĹ›rednio po imporcie.
- Do dalszego uproszczenia pozostajÄ… rozbudowana nawigacja boczna i siedem sekcji wyniku ATS; nie zostaĹ‚y przebudowane w tym zestawie.

## G. WOW MOMENT

Na profilu zawierajÄ…cym juĹĽ CV uĹĽytkownik wkleja tylko ofertÄ™ i otrzymuje kanoniczny wynik wraz z dowodami w profilu. JeĹ›li istotny termin istnieje w opisie doĹ›wiadczenia, ale nie w roboczym CV, Kierivo wskazuje firmÄ™, stanowisko i fragment ĹşrĂłdĹ‚a, pozwala poprawiÄ‡ proponowany punkt, zastosowaÄ‡ go do roboczej wersji i cofnÄ…Ä‡ zmianÄ™. ĹąrĂłdĹ‚owy profil pozostaje bez zmian.

## H. IMPLEMENTATION PLAN

WdroĹĽone w tym zestawie: spĂłjne rozpoznanie wymagaĹ„, dowody dopasowania, edytowalna sugestia oparta na doĹ›wiadczeniu, szybki przepĹ‚yw z zapisanym CV, korekta faĹ‚szywych wartoĹ›ci lokalizacji/dojazdu, kopia odzyskiwania JSON w IndexedDB, testy regresyjne i ten raport.

NastÄ™pnie: (1) rÄ™cznie zastosowaÄ‡/cofnÄ…Ä‡ sugestiÄ™ w UI, odĹ›wieĹĽyÄ‡ i sprawdziÄ‡ izolacjÄ™ drugiego profilu; (2) przejĹ›Ä‡ wynik na telefonie oraz klawiaturÄ… i czytnikiem; (3) sprawdziÄ‡ jasny/ciemny motyw, dĹ‚ugie i niejednoznaczne dane oraz komunikaty bĹ‚Ä™dĂłw; (4) uproĹ›ciÄ‡ nawigacjÄ™ i wynik ATS na podstawie tych obserwacji; (5) po akceptacji przygotowaÄ‡ integracjÄ™.

## I. ACCEPTANCE TEST

Na syntetycznym profilu lokalnym z ServiceNow i opisem triage wkleiÄ‡ ofertÄ™ wymagajÄ…cÄ… â€žServiceNow lub Jiraâ€ť, obsĹ‚ugi klienta, Exchange Online i PowerShell. Oczekiwane: alternatywa jest jednym wymaganiem; triage, ServiceNow, obsĹ‚uga klienta i Exchange majÄ… konkretne dowody z CV; PowerShell pozostaje lukÄ…; brak kompetencji nie jest dopisywany do profilu. ZastosowaÄ‡ ukrytÄ… sugestiÄ™, edytowaÄ‡ jej tekst, cofnÄ…Ä‡ i odĹ›wieĹĽyÄ‡; ĹşrĂłdĹ‚owe CV pozostaje niezmienione. PowtĂłrzyÄ‡ analizÄ™ na drugim profilu i sprawdziÄ‡, ĹĽe ostatnie wyniki oraz kopie danych sÄ… odizolowane. Przy uszkodzonym bieĹĽÄ…cym envelope aplikacja ma odtworzyÄ‡ poprzedni poprawny stan z IndexedDB. DomknÄ…Ä‡ sprawdzenie widoku wyniku na telefonie, keyboard-only, czytnikiem ekranu, w jasnym i ciemnym motywie.

**Weryfikacja wykonana:** testy ukierunkowane przechodzÄ…; peĹ‚ne testy, lint i build sÄ… sprawdzane dla bieĹĽÄ…cego zestawu. W przeglÄ…darce potwierdzono szybkie wejĹ›cie z istniejÄ…cego profilu oraz analizÄ™ syntetycznej oferty (72%, 4 z 5 wymaganych punktĂłw potwierdzonych przez treĹ›Ä‡ syntetycznego CV). Nie potwierdzono jeszcze peĹ‚nego manualnego cyklu zastosuj/cofnij/odĹ›wieĹĽ ani wszystkich dostÄ™pnoĹ›ciowych i responsywnych stanĂłw. Cloud/auth, eksport/PDF, prawdziwe Azure Maps i wdroĹĽenie nie byĹ‚y testowane.
