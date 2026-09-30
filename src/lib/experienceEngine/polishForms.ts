import { GrammarNarrativeStyle } from './types';
import { getPolishStem, stripDiacriticsLower } from '../skillEvidence';

export interface ActionFormMapping {
  noun: string; // Bezokolicznik / Rzeczownik odsłowny (np. Projektowanie)
  male: string; // 1 os. lp męski (np. Projektowałem)
  female: string; // 1 os. lp żeński (np. Projektowałam)
}

export const POLISH_VERB_FORMS: Record<string, ActionFormMapping> = {
  // IT & Software
  projektowałem: { noun: 'Projektowanie', male: 'Projektowałem', female: 'Projektowałam' },
  'projektowałem architekturę': { noun: 'Projektowanie architektury oprogramowania', male: 'Projektowałem architekturę oprogramowania', female: 'Projektowałam architekturę oprogramowania' },
  implementowałem: { noun: 'Implementacja', male: 'Implementowałem', female: 'Implementowałam' },
  'implementowałem endpointy': { noun: 'Implementacja endpointów API', male: 'Implementowałem endpointy API', female: 'Implementowałam endpointy API' },
  rozwijałem: { noun: 'Rozwój', male: 'Rozwijałem', female: 'Rozwijałam' },
  'rozwijałem mikroserwisy': { noun: 'Rozwój mikroserwisów', male: 'Rozwijałem mikroserwisy', female: 'Rozwijałam mikroserwisy' },
  wdrażałem: { noun: 'Wdrażanie', male: 'Wdrażałem', female: 'Wdrażałam' },
  optymalizowałem: { noun: 'Optymalizacja', male: 'Optymalizowałem', female: 'Optymalizowałam' },
  'optymalizowałem zapytania': { noun: 'Optymalizacja zapytań SQL', male: 'Optymalizowałem zapytania SQL', female: 'Optymalizowałam zapytania SQL' },
  konfigurowałem: { noun: 'Konfiguracja', male: 'Konfigurowałem', female: 'Konfigurowałam' },
  integrowałem: { noun: 'Integracja', male: 'Integrowałem', female: 'Integrowałam' },
  'integrowałem api': { noun: 'Integracja usług API', male: 'Integrowałem usługi API', female: 'Integrowałam usługi API' },
  utrzymywałem: { noun: 'Utrzymanie', male: 'Utrzymywałem', female: 'Utrzymywałam' },
  testowałem: { noun: 'Testowanie', male: 'Testowałem', female: 'Testowałam' },
  automatyzowałem: { noun: 'Automatyzacja', male: 'Automatyzowałem', female: 'Automatyzowałam' },
  monitorowałem: { noun: 'Monitoring', male: 'Monitorowałem', female: 'Monitorowałam' },
  skalowałem: { noun: 'Skalowanie', male: 'Skalowałem', female: 'Skalowałam' },
  zabezpieczałem: { noun: 'Zabezpieczanie', male: 'Zabezpieczałem', female: 'Zabezpieczałam' },
  tworzyłem: { noun: 'Tworzenie', male: 'Tworzyłem', female: 'Tworzyłam' },
  'tworzyłem komponenty ui': { noun: 'Tworzenie komponentów UI', male: 'Tworzyłem komponenty UI', female: 'Tworzyłam komponenty UI' },
  'implementowałem widoki': { noun: 'Implementacja widoków aplikacji', male: 'Implementowałem widoki aplikacji', female: 'Implementowałam widoki aplikacji' },
  'zarządzałem stanem aplikacji': { noun: 'Zarządzanie stanem aplikacji', male: 'Zarządzałem stanem aplikacji', female: 'Zarządzałam stanem aplikacji' },
  'optymalizowałem wydajność renderingu': { noun: 'Optymalizacja wydajności renderingu', male: 'Optymalizowałem wydajność renderingu', female: 'Optymalizowałam wydajność renderingu' },
  'budowałem aplikacje webowe': { noun: 'Budowa aplikacji webowych', male: 'Budowałem aplikacje webowe', female: 'Budowałam aplikacje webowe' },
  'projektowałem architekturę end-to-end': { noun: 'Projektowanie architektury end-to-end', male: 'Projektowałem architekturę end-to-end', female: 'Projektowałam architekturę end-to-end' },
  'wdrażałem funkcjonalności': { noun: 'Wdrażanie funkcjonalności', male: 'Wdrażałem funkcjonalności', female: 'Wdrażałam funkcjonalności' },
  'łączyłem frontend z backendem': { noun: 'Integracja frontendu z backendem', male: 'Łączyłem frontend z backendem', female: 'Łączyłam frontend z backendem' },
  'projektowałem schematy relacyjne': { noun: 'Projektowanie schematów relacyjnych', male: 'Projektowałem schematy relacyjne', female: 'Projektowałam schematy relacyjne' },
  'optymalizowałem indeksy sql': { noun: 'Optymalizacja indeksów SQL', male: 'Optymalizowałem indeksy SQL', female: 'Optymalizowałam indeksy SQL' },
  'zarządzałem migracjami bazy': { noun: 'Zarządzanie migracjami bazy danych', male: 'Zarządzałem migracjami bazy danych', female: 'Zarządzałam migracjami bazy danych' },
  'tworzyłem procedury': { noun: 'Tworzenie procedur składowanych SQL', male: 'Tworzyłem procedury składowane SQL', female: 'Tworzyłam procedury składowane SQL' },
  kodowałem: { noun: 'Kodowanie', male: 'Kodowałem', female: 'Kodowałam' },

  // Techniczne, Monter, Instalator, Elektryk
  montowałem: { noun: 'Montaż', male: 'Montowałem', female: 'Montowałam' },
  instalowałem: { noun: 'Instalacja', male: 'Instalowałem', female: 'Instalowałam' },
  podłączałem: { noun: 'Podłączanie', male: 'Podłączałem', female: 'Podłączałam' },
  uruchamiałem: { noun: 'Uruchamianie', male: 'Uruchamiałem', female: 'Uruchamiałam' },
  'prowadziłem montaż': { noun: 'Prowadzenie montażu', male: 'Prowadziłem montaż', female: 'Prowadziłam montaż' },
  diagnozowałem: { noun: 'Diagnostyka', male: 'Diagnozowałem', female: 'Diagnozowałam' },
  naprawiałem: { noun: 'Naprawa', male: 'Naprawiałem', female: 'Naprawiałam' },
  wymieniałem: { noun: 'Wymiana', male: 'Wymieniałem', female: 'Wymieniałam' },
  czyściłem: { noun: 'Czyszczenie', male: 'Czyściłem', female: 'Czyściłam' },
  kalibrowałem: { noun: 'Kalibracja', male: 'Kalibrowałem', female: 'Kalibrowałam' },
  układałem: { noun: 'Układanie', male: 'Układałem', female: 'Układałam' },
  zgrzewałem: { noun: 'Zgrzewanie', male: 'Zgrzewałem', female: 'Zgrzewałam' },
  lutowałem: { noun: 'Lutowanie', male: 'Lutowałem', female: 'Lutowałam' },
  prefabrykowałem: { noun: 'Prefabrykacja', male: 'Prefabrykowałem', female: 'Prefabrykowałam' },
  sznurowałem: { noun: 'Sznurowanie', male: 'Sznurowałem', female: 'Sznurowałam' },
  'wykonywałem pomiary': { noun: 'Wykonywanie pomiarów', male: 'Wykonywałem pomiary', female: 'Wykonywałam pomiary' },
  'sporządzałem protokoły': { noun: 'Sporządzanie protokołów', male: 'Sporządzałem protokoły', female: 'Sporządzałam protokoły' },
  parametryzowałem: { noun: 'Parametryzacja', male: 'Parametryzowałem', female: 'Parametryzowałam' },
  'usuwałem awarie': { noun: 'Usuwanie awarii', male: 'Usuwałem awarie', female: 'Usuwałam awarie' },
  'prowadziłem przeglądy': { noun: 'Prowadzenie przeglądów', male: 'Prowadziłem przeglądy', female: 'Prowadziłam przeglądy' },
  modernizowałem: { noun: 'Modernizacja', male: 'Modernizowałem', female: 'Modernizowałam' },

  // Spawalnictwo & Ślusarstwo
  'spawałem metodą tig 141': { noun: 'Spawanie metodą TIG 141', male: 'Spawałem metodą TIG 141', female: 'Spawałam metodą TIG 141' },
  'wykonywałem przetopy': { noun: 'Wykonywanie przetopów', male: 'Wykonywałem przetopy', female: 'Wykonywałam przetopy' },
  'prowadziłem lico': { noun: 'Prowadzenie lica spoiny', male: 'Prowadziłem lico spoiny', female: 'Prowadziłam lico spoiny' },
  'spawałem pod rentgen': { noun: 'Spawanie pod badania RTG', male: 'Spawałem pod badania RTG', female: 'Spawałam pod badania RTG' },
  'spawałem metodą mag 135/136': { noun: 'Spawanie metodą MAG 135/136', male: 'Spawałem metodą MAG 135/136', female: 'Spawałam metodą MAG 135/136' },
  'łączyłem konstrukcje': { noun: 'Łączenie konstrukcji', male: 'Łączyłem konstrukcje', female: 'Łączyłam konstrukcje' },
  'spawałem w pozycjach wymuszonych': { noun: 'Spawanie w pozycjach wymuszonych', male: 'Spawałem w pozycjach wymuszonych', female: 'Spawałam w pozycjach wymuszonych' },
  trasowałem: { noun: 'Trasowanie', male: 'Trasowałem', female: 'Trasowałam' },
  'ukosowałem krawędzie': { noun: 'Ukosowanie krawędzi', male: 'Ukosowałem krawędzie', female: 'Ukosowałam krawędzie' },
  szlifowałem: { noun: 'Szlifowanie', male: 'Szlifowałem', female: 'Szlifowałam' },
  'sczepiałem elementy': { noun: 'Sczepianie elementów', male: 'Sczepiałem elementy', female: 'Sczepiałam elementy' },
  'weryfikowałem jakość spoin': { noun: 'Weryfikacja jakości spoin', male: 'Weryfikowałem jakość spoin', female: 'Weryfikowałam jakość spoin' },
  'przeprowadzałem badania vt2': { noun: 'Przeprowadzanie badań VT2', male: 'Przeprowadzałem badania VT2', female: 'Przeprowadzałam badania VT2' },
  'eliminowałem niezgodności spawalnicze': { noun: 'Eliminacja niezgodności spawalniczych', male: 'Eliminowałem niezgodności spawalnicze', female: 'Eliminowałam niezgodności spawalnicze' },

  // Magazyn & Logistyka
  kompletowałem: { noun: 'Kompletacja', male: 'Kompletowałem', female: 'Kompletowałam' },
  'pobierałem towar': { noun: 'Pobieranie towaru', male: 'Pobierałem towar', female: 'Pobierałam towar' },
  pakowałem: { noun: 'Pakowanie', male: 'Pakowałem', female: 'Pakowałam' },
  'weryfikowałem zamówienia': { noun: 'Weryfikacja zamówień', male: 'Weryfikowałem zamówienia', female: 'Weryfikowałam zamówienia' },
  etykietowałem: { noun: 'Etykietowanie', male: 'Etykietowałem', female: 'Etykietowałam' },
  'obsługiwałem wózki udt': { noun: 'Obsługa wózków widłowych UDT', male: 'Obsługiwałem wózki widłowe UDT', female: 'Obsługiwałam wózki widłowe UDT' },
  'rozładowywałem naczepy tir': { noun: 'Rozładunek naczep ciężarowych', male: 'Rozładowywałem naczepy ciężarowe', female: 'Rozładowywałam naczepy ciężarowe' },
  'składowałem w regałach': { noun: 'Składowanie w regałach wysokiego składu', male: 'Składowałem w regałach wysokiego składu', female: 'Składowałam w regałach wysokiego składu' },
  'przemieszczałem palety': { noun: 'Przemieszczanie palet', male: 'Przemieszczałem palety', female: 'Przemieszczałam palety' },
  'przyjmowałem dostawy': { noun: 'Przyjmowanie dostaw', male: 'Przyjmowałem dostawy', female: 'Przyjmowałam dostawy' },
  'weryfikowałem stan towaru': { noun: 'Weryfikacja stanu towaru', male: 'Weryfikowałem stan towaru', female: 'Weryfikowałam stan towaru' },
  'sprawdzałem dokumenty wz': { noun: 'Weryfikacja dokumentów WZ/PZ', male: 'Sprawdzałem dokumenty WZ/PZ', female: 'Sprawdzałam dokumenty WZ/PZ' },
  'przygotowywałem wysyłki': { noun: 'Przygotowywanie wysyłek', male: 'Przygotowywałem wysyłki', female: 'Przygotowywałam wysyłki' },
  'ewidencjonowałem w wms': { noun: 'Ewidencja w systemie WMS', male: 'Ewidencjonowałem w systemie WMS', female: 'Ewidencjonowałam w systemie WMS' },
  'prowadziłem inwentaryzacje': { noun: 'Prowadzenie inwentaryzacji', male: 'Prowadziłem inwentaryzacje', female: 'Prowadziłam inwentaryzacje' },
  'optymalizowałem strefy składowania': { noun: 'Optymalizacja stref składowania', male: 'Optymalizowałem strefy składowania', female: 'Optymalizowałam strefy składowania' },
  'generowałem raporty': { noun: 'Generowanie raportów', male: 'Generowałem raporty', female: 'Generowałam raporty' },

  // Transport & Kierowca
  'prowadziłem zestawy ciężarowe': { noun: 'Prowadzenie zestawów ciężarowych C+E', male: 'Prowadziłem zestawy ciężarowe C+E', female: 'Prowadziłam zestawy ciężarowe C+E' },
  'realizowałem przewozy': { noun: 'Realizacja przewozów towarowych', male: 'Realizowałem przewozy towarowe', female: 'Realizowałam przewozy towarowe' },
  'optymalizowałem trasę przejazdu': { noun: 'Optymalizacja tras przejazdu', male: 'Optymalizowałem trasę przejazdu', female: 'Optymalizowałam trasę przejazdu' },
  'dostarczałem ładunki': { noun: 'Dostarczanie ładunków', male: 'Dostarczałem ładunki', female: 'Dostarczałam ładunki' },
  'zabezpieczałem ładunek': { noun: 'Zabezpieczanie ładunków', male: 'Zabezpieczałem ładunek', female: 'Zabezpieczałam ładunek' },
  'mocowałem towar pasami': { noun: 'Mocowanie ładunków pasami transportowymi', male: 'Mocowałem towar pasami transportowymi', female: 'Mocowałam towar pasami transportowymi' },
  'kontrolowałem naciski na osie': { noun: 'Kontrola nacisków na osie', male: 'Kontrolowałem naciski na osie', female: 'Kontrolowałam naciski na osie' },
  'nadzorowałem załadunek': { noun: 'Nadzór nad procesem załadunku', male: 'Nadzorowałem załadunek', female: 'Nadzorowałam załadunek' },
  'rejestrowałem czas pracy': { noun: 'Rejestracja czasu pracy', male: 'Rejestrowałem czas pracy', female: 'Rejestrowałam czas pracy' },
  'rozliczałem czas jazdy': { noun: 'Rozliczanie czasu jazdy wg norm AETR', male: 'Rozliczałem czas jazdy wg norm AETR', female: 'Rozliczałam czas jazdy wg norm AETR' },
  'obsługiwałem tachograf cyfrowy': { noun: 'Obsługa tachografu cyfrowego', male: 'Obsługiwałem tachograf cyfrowy', female: 'Obsługiwałam tachograf cyfrowy' },
  'weryfikowałem dokumenty cmr': { noun: 'Weryfikacja dokumentów CMR i celnych', male: 'Weryfikowałem dokumenty CMR i celne', female: 'Weryfikowałam dokumenty CMR i celne' },
  'obsługiwałem procedury celne': { noun: 'Obsługa procedur celnych', male: 'Obsługiwałem procedury celne', female: 'Obsługiwałam procedury celne' },
  'prowadziłem dokumentację przewozową': { noun: 'Prowadzenie dokumentacji przewozowej', male: 'Prowadziłem dokumentację przewozową', female: 'Prowadziłam dokumentację przewozową' },

  // Mechanika Samochodowa
  'diagnozowałem testerem': { noun: 'Diagnostyka testerem komputerowym', male: 'Diagnozowałem testerem komputerowym', female: 'Diagnozowałam testerem komputerowym' },
  'odczytywałem parametry': { noun: 'Odczyt parametrów bieżących', male: 'Odczytywałem parametry bieżące', female: 'Odczytywałam parametry bieżące' },
  'analizowałem sygnały oscyloskopem': { noun: 'Analiza sygnałów oscyloskopem', male: 'Analizowałem sygnały oscyloskopem', female: 'Analizowałam sygnały oscyloskopem' },
  'wymieniałem elementy zawieszenia': { noun: 'Wymiana elementów zawieszenia', male: 'Wymieniałem elementy zawieszenia', female: 'Wymieniałam elementy zawieszenia' },
  'ustawiałem geometrię 3d': { noun: 'Ustawianie geometrii kół 3D', male: 'Ustawiałem geometrię kół 3D', female: 'Ustawiałam geometrię kół 3D' },
  'serwisowałem układy hamulcowe': { noun: 'Serwis układów hamulcowych', male: 'Serwisowałem układy hamulcowe', female: 'Serwisowałam układy hamulcowe' },
  odpowietrzałem: { noun: 'Odpowietrzanie', male: 'Odpowietrzałem', female: 'Odpowietrzałam' },
  'lokalizowałem zwarcia': { noun: 'Lokalizacja zwarć i przerw w instalacji', male: 'Lokalizowałem zwarcia i przerwy', female: 'Lokalizowałam zwarcia i przerwy' },
  'naprawiałem wiązki elektryczne': { noun: 'Naprawa wiązek elektrycznych', male: 'Naprawiałem wiązki elektryczne', female: 'Naprawiałam wiązki elektryczne' },
  'regenerowałem podzespoły': { noun: 'Regeneracja podzespołów elektromechanicznych', male: 'Regenerowałem podzespoły', female: 'Regenerowałam podzespoły' },
  'badałem pobór prądu': { noun: 'Badanie poboru prądu w spoczynku', male: 'Badałem pobór prądu', female: 'Badałam pobór prądu' },

  // Budownictwo & Wykończenia
  'układałem gres': { noun: 'Układanie płytek gresowych', male: 'Układałem płytki gresowe', female: 'Układałam płytki gresowe' },
  'docinałem płytki': { noun: 'Docinanie płytek wielkoformatowych', male: 'Docinałem płytki wielkoformatowe', female: 'Docinałam płytki wielkoformatowe' },
  'szlifowałem krawędzie pod kątem 45°': { noun: 'Szlifowanie krawędzi pod kątem 45° (Jolly)', male: 'Szlifowałem krawędzie pod kątem 45°', female: 'Szlifowałam krawędzie pod kątem 45°' },
  'fugowałem epoksydem': { noun: 'Fugowanie fugą epoksydową', male: 'Fugowałem fugą epoksydową', female: 'Fugowałam fugą epoksydową' },
  'montowałem profile cw/uw': { noun: 'Montaż profili stalowych CW/UW', male: 'Montowałem profile stalowe CW/UW', female: 'Montowałam profile stalowe CW/UW' },
  'płytowałem płytami g-k': { noun: 'Płytowanie płytami gipsowo-kartonowymi', male: 'Płytowałem płytami G-K', female: 'Płytowałam płytami G-K' },
  'wykonywałem zabudowy poddaszy': { noun: 'Wykonywanie zabudowy poddaszy i skosów', male: 'Wykonywałem zabudowy poddaszy', female: 'Wykonywałam zabudowy poddaszy' },
  'nakładałem hydroizolację': { noun: 'Nakładanie hydroizolacji powłokowej', male: 'Nakładałem hydroizolację powłokową', female: 'Nakładałam hydroizolację powłokową' },
  'wykonywałem gładzie gipsowe': { noun: 'Wykonywanie gładzi gipsowych bezpyłowych', male: 'Wykonywałem gładzie gipsowe', female: 'Wykonywałam gładzie gipsowe' },
  'malowałem agregatem': { noun: 'Malowanie natryskowe agregatem', male: 'Malowałem natryskowo agregatem', female: 'Malowałam natryskowo agregatem' },
  gruntowałem: { noun: 'Gruntowanie powierzchni', male: 'Gruntowałem powierzchnie', female: 'Gruntowałam powierzchnie' },
  'obsługiwałem maszyny budowlane': { noun: 'Obsługa maszyn budowlanych', male: 'Obsługiwałem maszyny budowlane', female: 'Obsługiwałam maszyny budowlane' },
  'wykonywałem wykopy': { noun: 'Wykonywanie wykopów ziemnych', male: 'Wykonywałem wykopy ziemne', female: 'Wykonywałam wykopy ziemne' },
  'niwelowałem teren laserem': { noun: 'Niwelacja terenu z laserem 3D', male: 'Niwelowałem teren z laserem 3D', female: 'Niwelowałam teren z laserem 3D' },
  skarpowałem: { noun: 'Skarpowanie wykopów', male: 'Skarpowałem wykopy', female: 'Skarpowałam wykopy' },

  // CNC & Produkcja
  'pisałem programy g-code': { noun: 'Programowanie obrabiarek w kodzie G-Code', male: 'Pisałem programy w kodzie G-Code', female: 'Pisałam programy w kodzie G-Code' },
  'edytowałem trajektorie narzędzia': { noun: 'Edycja trajektorii narzędzi skrawających', male: 'Edytowałem trajektorie narzędzi', female: 'Edytowałam trajektorie narzędzi' },
  'dobierałem parametry skrawania': { noun: 'Dobór parametrów skrawania (Vc, F)', male: 'Dobierałem parametry skrawania', female: 'Dobierałam parametry skrawania' },
  'symulowałem obróbkę': { noun: 'Symulacja procesu obróbki', male: 'Symulowałem proces obróbki', female: 'Symulowałam proces obróbki' },
  'uzbrajałem maszynę cnc': { noun: 'Uzbrajanie maszyny CNC', male: 'Uzbrajałem maszynę CNC', female: 'Uzbrajałam maszynę CNC' },
  'montowałem oprawki i płytki': { noun: 'Montaż oprawek i płytek węglikowych', male: 'Montowałem oprawki i płytki', female: 'Montowałam oprawki i płytki' },
  'badałem bazowanie detalu': { noun: 'Weryfikacja bazowania detalu', male: 'Badałem bazowanie detalu', female: 'Badałam bazowanie detalu' },
  'ustawiałem zera maszynowe': { noun: 'Ustawianie punktów zerowych maszyny', male: 'Ustawiałem punkty zerowe maszyny', female: 'Ustawiałam punkty zerowe maszyny' },
  'mierzyłem detale': { noun: 'Pomiary warsztatowe detali', male: 'Mierzyłem detale warsztatowe', female: 'Mierzyłam detale warsztatowe' },
  'kontrolowałem wymiary i chropowatość ra': { noun: 'Kontrola wymiarowa i pomiar chropowatości Ra', male: 'Kontrolowałem wymiary i chropowatość Ra', female: 'Kontrolowałam wymiary i chropowatość Ra' },
  'weryfikowałem tolerancje geometryczne': { noun: 'Weryfikacja tolerancji geometrycznych', male: 'Weryfikowałem tolerancje geometryczne', female: 'Weryfikowałam tolerancje geometryczne' },
  'nadzorowałem proces obróbki': { noun: 'Nadzór nad procesem obróbki skrawaniem', male: 'Nadzorowałem proces obróbki', female: 'Nadzorowałam proces obróbki' },
  'korygowałem zużycie narzędzi': { noun: 'Korekcja zużycia narzędzi (G41/G42)', male: 'Korygowałem zużycie narzędzi', female: 'Korygowałam zużycie narzędzi' },
  'optymalizowałem czas cyklu': { noun: 'Optymalizacja czasu cyklu obróbczego', male: 'Optymalizowałem czas cyklu', female: 'Optymalizowałam czas cyklu' },
  'usuwałem zacięcia': { noun: 'Usuwanie zakłóceń i zacięć maszynowych', male: 'Usuwałem zakłócenia maszynowe', female: 'Usuwałam zakłócenia maszynowe' },

  // Księgowość & Finanse
  księgowałem: { noun: 'Księgowanie', male: 'Księgowałem', female: 'Księgowałam' },
  'dekretowałem dokumenty': { noun: 'Dekretacja dokumentów księgowych', male: 'Dekretowałem dokumenty księgowe', female: 'Dekretowałam dokumenty księgowe' },
  'sporządzałem deklaracje vat/cit': { noun: 'Sporządzanie deklaracji podatkowych VAT/CIT', male: 'Sporządzałem deklaracje VAT/CIT', female: 'Sporządzałam deklaracje VAT/CIT' },
  'weryfikowałem pliki jpk_v7': { noun: 'Weryfikacja i wysyłka plików JPK_V7', male: 'Weryfikowałem pliki JPK_V7', female: 'Weryfikowałam pliki JPK_V7' },
  'prowadziłem ewidencję': { noun: 'Prowadzenie ewidencji księgowych', male: 'Prowadziłem ewidencję', female: 'Prowadziłam ewidencję' },
  'naliczałem wynagrodzenia': { noun: 'Naliczanie wynagrodzeń pracowniczych', male: 'Naliczałem wynagrodzenia', female: 'Naliczałam wynagrodzenia' },
  'sporządzałem listy płac': { noun: 'Sporządzanie list płac', male: 'Sporządzałem listy płac', female: 'Sporządzałam listy płac' },
  'wysyłałem deklaracje zus płatnik': { noun: 'Wysyłka deklaracji w programie ZUS Płatnik', male: 'Wysyłałem deklaracje ZUS Płatnik', female: 'Wysyłałam deklaracje ZUS Płatnik' },
  'rozliczałem umowy': { noun: 'Rozliczanie umów o pracę i cywilnoprawnych', male: 'Rozliczałem umowy pracownicze', female: 'Rozliczałam umowy pracownicze' },
  'tworzyłem sprawozdania finansowe': { noun: 'Tworzenie sprawozdań finansowych i bilansu', male: 'Tworzyłem sprawozdania finansowe', female: 'Tworzyłam sprawozdania finansowe' },
  'zamykałem miesiące i rok obrotowy': { noun: 'Zamykanie okresów rozliczeniowych i roku obrotowego', male: 'Zamykałem miesiące i rok obrotowy', female: 'Zamykałam miesiące i rok obrotowy' },
  'uzgadniałem konta': { noun: 'Uzgodnienia kont księgowych i sald', male: 'Uzgadniałem konta księgowe', female: 'Uzgadniałam konta księgowe' },
  'analizowałem koszty': { noun: 'Analiza kosztów i przychodów', male: 'Analizowałem koszty', female: 'Analizowałam koszty' },
  'wystawiałem faktury': { noun: 'Wystawianie faktur sprzedażowych', male: 'Wystawiałem faktury', female: 'Wystawiałam faktury' },
  'obsługiwałem system ksef': { noun: 'Obsługa Krajowego Systemu e-Faktur (KSeF)', male: 'Obsługiwałem system KSeF', female: 'Obsługiwałam system KSeF' },
  'weryfikowałem salda kontrahentów': { noun: 'Weryfikacja i uzgadnianie sald kontrahentów', male: 'Weryfikowałem salda kontrahentów', female: 'Weryfikowałam salda kontrahentów' },
  'kontrolowałem spływ należności': { noun: 'Kontrola spływu należności i windykacja', male: 'Kontrolowałem spływ należności', female: 'Kontrolowałam spływ należności' },

  // Sprzedaż B2B
  'pozyskiwałem klientów': { noun: 'Pozyskiwanie klientów biznesowych (B2B)', male: 'Pozyskiwałem klientów biznesowych', female: 'Pozyskiwałam klientów biznesowych' },
  'prowadziłem prospecting': { noun: 'Prowadzenie prospectingu i cold outreachu', male: 'Prowadziłem prospecting', female: 'Prowadziłam prospecting' },
  'badałem potrzeby biznesowe': { noun: 'Badanie i analiza potrzeb klienta (BANT)', male: 'Badałem potrzeby biznesowe', female: 'Badałam potrzeby biznesowe' },
  'nawiązywałem relacje': { noun: 'Nawiązywanie relacji biznesowych', male: 'Nawiązywałem relacje biznesowe', female: 'Nawiązywałam relacje biznesowe' },
  'negocjowałem warunki umów': { noun: 'Negocjacje warunków handlowych i cenowych', male: 'Negocjowałem warunki umów', female: 'Negocjowałam warunki umów' },
  'prezentowałem oferty handlowe': { noun: 'Prezentacje ofert handlowych i wartości', male: 'Prezentowałem oferty handlowe', female: 'Prezentowałam oferty handlowe' },
  'kalkulowałem marże': { noun: 'Kalkulacja marży i rentowności kontraktów', male: 'Kalkulowałem marże', female: 'Kalkulowałam marże' },
  'domykałem kontrakty': { noun: 'Domykanie transakcji handlowych', male: 'Domykałem kontrakty handlowe', female: 'Domykałam kontrakty handlowe' },
  'rozwijałem współpracę': { noun: 'Rozwój współpracy z kluczowymi klientami', male: 'Rozwijałem współpracę z klientami', female: 'Rozwijałam współpracę z klientami' },
  'dbałem o retencję': { noun: 'Dbałość o retencję i satysfakcję partnerów', male: 'Dbałem o retencję partnerów', female: 'Dbałam o retencję partnerów' },
  'realizowałem dosprzedaż (up-selling)': { noun: 'Realizacja dosprzedaży (Up-selling / Cross-selling)', male: 'Realizowałem dosprzedaż', female: 'Realizowałam dosprzedaż' },
  'doradzałem partnerom': { noun: 'Doradztwo biznesowe dla kontrahentów', male: 'Doradzałem partnerom biznesowym', female: 'Doradzałam partnerom biznesowym' },
  'zarządzałem lejkiem sprzedaży': { noun: 'Zarządzanie lejkiem sprzedaży w CRM', male: 'Zarządzałem lejkiem sprzedaży', female: 'Zarządzałam lejkiem sprzedaży' },
  'prognozowałem realizację planu': { noun: 'Prognozowanie realizacji planów sprzedażowych', male: 'Prognozowałem realizację planu', female: 'Prognozowałam realizację planu' },
  'rejestrowałem aktywności w crm': { noun: 'Ewidencja aktywności sprzedażowych w CRM', male: 'Rejestrowałem aktywności w CRM', female: 'Rejestrowałam aktywności w CRM' },

  // Obsługa Klienta
  'doradzałem klientom': { noun: 'Doradztwo produktowe i obsługa klienta', male: 'Doradzałem klientom', female: 'Doradzałam klientom' },
  'odbierałem zgłoszenia': { noun: 'Obsługa zgłoszeń przychodzących', male: 'Odbierałem zgłoszenia przychodzące', female: 'Odbierałam zgłoszenia przychodzące' },
  'udzielałem informacji': { noun: 'Udzielanie rzetelnych informacji produktowych', male: 'Udzielałem informacji klientom', female: 'Udzielałam informacji klientom' },
  'diagnozowałem potrzeby': { noun: 'Diagnostyka i analiza potrzeb klienta', male: 'Diagnozowałem potrzeby klienta', female: 'Diagnozowałam potrzeby klienta' },
  'rozpatrywałem reklamacje': { noun: 'Rozpatrywanie reklamacji i wniosków', male: 'Rozpatrywałem reklamacje', female: 'Rozpatrywałam reklamacje' },
  'deeskalowałem trudne sytuacje': { noun: 'Deeskalacja sytuacji konfliktowych i spornych', male: 'Deeskalowałem trudne sytuacje', female: 'Deeskalowałam trudne sytuacje' },
  'znajdowałem rozwiązania': { noun: 'Rozwiązywanie problemów użytkowników', male: 'Znajdowałem rozwiązania', female: 'Znajdowałam rozwiązania' },
  'procesowałem zwroty': { noun: 'Procesowanie zwrotów i kompensacji', male: 'Procesowałem zwroty', female: 'Procesowałam zwroty' },
  'zarządzałem ticketami w helpdesk': { noun: 'Zarządzanie ticketami w systemach Helpdesk', male: 'Zarządzałem ticketami w Helpdesk', female: 'Zarządzałam ticketami w Helpdesk' },
  'dbałem o wskaźniki sla': { noun: 'Nadzór nad wskaźnikami SLA i czasem reakcji', male: 'Dbałem o wskaźniki SLA', female: 'Dbałam o wskaźniki SLA' },
  'przekazywałem zgłoszenia do ii linii': { noun: 'Eskalacja zgłoszeń do drugiej linii wsparcia', male: 'Przekazywałem zgłoszenia do II linii', female: 'Przekazywałam zgłoszenia do II linii' },
  'weryfikowałem tożsamość klienta (kyc)': { noun: 'Weryfikacja tożsamości klienta w reżimie KYC', male: 'Weryfikowałem tożsamość klienta (KYC)', female: 'Weryfikowałam tożsamość klienta (KYC)' },
  'przestrzegałem procedur bezpieczeństwa': { noun: 'Przestrzeganie procedur bezpieczeństwa i RODO', male: 'Przestrzegałem procedur bezpieczeństwa', female: 'Przestrzegałam procedur bezpieczeństwa' },
  'zastrzegałem dokumenty': { noun: 'Zastrzeganie dokumentów tożsamości i kart', male: 'Zastrzegałem dokumenty tożsamości', female: 'Zastrzegałam dokumenty tożsamości' },

  // Medycyna & Zdrowie
  'podawałem leki': { noun: 'Podawanie leków i farmakoterapia', male: 'Podawałem leki zgodnie ze zleceniem', female: 'Podawałam leki zgodnie ze zleceniem' },
  'zakładałem wkłucia obwodowe (wenflony)': { noun: 'Zakładanie kaniul i wkłuć obwodowych (wenflonów)', male: 'Zakładałem wkłucia obwodowe (wenflony)', female: 'Zakładałam wkłucia obwodowe (wenflony)' },
  'obsługiwałem pompy infuzyjne': { noun: 'Obsługa pomp infuzyjnych strzykawkowych i objętościowych', male: 'Obsługiwałem pompy infuzyjne', female: 'Obsługiwałam pompy infuzyjne' },
  'zmieniałem opatrunki': { noun: 'Zmiana opatrunków i toaleta ran', male: 'Zmieniałem opatrunki specjalistyczne', female: 'Zmieniałam opatrunki specjalistyczne' },
  'wykonywałem badania ekg': { noun: 'Wykonywanie 12-odprowadzeniowych badań EKG', male: 'Wykonywałem badania EKG', female: 'Wykonywałam badania EKG' },
  'monitorowałem parametry życiowe': { noun: 'Monitorowanie parametrów życiowych pacjentów', male: 'Monitorowałem parametry życiowe', female: 'Monitorowałam parametry życiowe' },
  'pobierałem krew do badań': { noun: 'Pobieranie materiału biologicznego i krwi', male: 'Pobierałem krew do badań', female: 'Pobierałam krew do badań' },
  'interpretowałem wyniki': { noun: 'Wstępna interpretacja wyników badań i EKG', male: 'Interpretowałem wyniki badań', female: 'Interpretowałam wyniki badań' },
  'prowadziłem resuscytację krążeniowo-oddechową (rko)': { noun: 'Prowadzenie resuscytacji krążeniowo-oddechowej (RKO/ALS)', male: 'Prowadziłem resuscytację (RKO)', female: 'Prowadziłam resuscytację (RKO)' },
  'zaopatrywałem pacjentów w stanach nagłych': { noun: 'Zaopatrywanie pacjentów w stanach nagłego zagrożenia', male: 'Zaopatrywałem pacjentów w stanach nagłych', female: 'Zaopatrywałam pacjentów w stanach nagłych' },
  'kwalifikowałem w triage': { noun: 'Kwalifikacja pacjentów w systemie segregacji Triage', male: 'Kwalifikowałem pacjentów w Triage', female: 'Kwalifikowałam pacjentów w Triage' },
  'prowadziłem elektroniczną dokumentację (edm)': { noun: 'Prowadzenie Elektronicznej Dokumentacji Medycznej (EDM)', male: 'Prowadziłem dokumentację EDM', female: 'Prowadziłam dokumentację EDM' },
  'sporządzałem zlecenia pielęgniarskie': { noun: 'Sporządzanie planów opieki i zleceń pielęgniarskich', male: 'Sporządzałem zlecenia pielęgniarskie', female: 'Sporządzałam zlecenia pielęgniarskie' },
  'przestrzegałem procedur sanitarnych': { noun: 'Przestrzeganie procedur sanitarno-epidemiologicznych', male: 'Przestrzegałem procedur sanitarnych', female: 'Przestrzegałam procedur sanitarnych' },



  // DevOps & Cloud
  'konfigurowałem pipeline’y ci/cd': { noun: 'Konfiguracja automatycznych potoków CI/CD', male: 'Konfigurowałem pipeline’y CI/CD', female: 'Konfigurowałam pipeline’y CI/CD' },
  'konteneryzowałem aplikacje': { noun: 'Konteneryzacja aplikacji w Dockerze', male: 'Konteneryzowałem aplikacje w Dockerze', female: 'Konteneryzowałam aplikacje w Dockerze' },
  'zarządzałem klastrami k8s': { noun: 'Zarządzanie klastrami Kubernetes (K8s)', male: 'Zarządzałem klastrami Kubernetes', female: 'Zarządzałam klastrami Kubernetes' },
  'automatyzowałem wdrożenia': { noun: 'Automatyzacja procesów wdrożeniowych', male: 'Automatyzowałem wdrożenia produkcyjne', female: 'Automatyzowałam wdrożenia produkcyjne' },
  'projektowałem infrastrukturę iac': { noun: 'Projektowanie infrastruktury jako kodu (IaC / Terraform)', male: 'Projektowałem infrastrukturę IaC', female: 'Projektowałam infrastrukturę IaC' },
  'zarządzałem zasobami chmurowymi': { noun: 'Zarządzanie zasobami chmury AWS / GCP', male: 'Zarządzałem zasobami chmurowymi', female: 'Zarządzałam zasobami chmurowymi' },
  'optymalizowałem koszty cloud': { noun: 'Optymalizacja kosztów chmury (FinOps)', male: 'Optymalizowałem koszty chmurowe', female: 'Optymalizowałam koszty chmurowe' },
  'skalowałem środowiska': { noun: 'Skalowanie środowisk o wysokiej dostępności', male: 'Skalowałem środowiska produkcyjne', female: 'Skalowałam środowiska produkcyjne' },
  'wdrażałem monitoring prometheus/grafana': { noun: 'Wdrażanie monitoringu Prometheus i Grafana', male: 'Wdrażałem monitoring Prometheus/Grafana', female: 'Wdrażałam monitoring Prometheus/Grafana' },
  'konfigurowałem alerty': { noun: 'Konfiguracja reguł alertowania SLA', male: 'Konfigurowałem alerty monitoringu', female: 'Konfigurowałam alerty monitoringu' },
  'audytowałem bezpieczeństwo': { noun: 'Audyt bezpieczeństwa i podatności systemowych', male: 'Audytowałem bezpieczeństwo systemów', female: 'Audytowałam bezpieczeństwo systemów' },
  'tworzyłem polityki backupu': { noun: 'Tworzenie procedur Disaster Recovery i backupu', male: 'Tworzyłem procedury backupu', female: 'Tworzyłam procedury backupu' },
  'administrowałem siecią lan/wan': { noun: 'Administracja i konfiguracja sieci LAN/WAN', male: 'Administrowałem siecią LAN/WAN', female: 'Administrowałam siecią LAN/WAN' },
  'zarządzałem active directory': { noun: 'Zarządzanie domeną Active Directory i GPO', male: 'Zarządzałem domeną Active Directory', female: 'Zarządzałam domeną Active Directory' },
  'konfigurowałem routery i firewalle': { noun: 'Konfiguracja routerów, przełączników i firewalli', male: 'Konfigurowałem routery i firewalle', female: 'Konfigurowałam routery i firewalle' },
  'zabezpieczałem połączenia vpn': { noun: 'Zabezpieczanie połączeń zdalnych VPN', male: 'Zabezpieczałem połączenia VPN', female: 'Zabezpieczałam połączenia VPN' },

  // Projekty & Zarządzanie
  'zarządzałem projektami': { noun: 'Zarządzanie projektami', male: 'Zarządzałem projektami', female: 'Zarządzałam projektami' },
  'koordynowałem harmonogram': { noun: 'Koordynacja harmonogramu i kamieni milowych', male: 'Koordynowałem harmonogram prac', female: 'Koordynowałam harmonogram prac' },
  'kontrolowałem budżet': { noun: 'Kontrola i rozliczanie budżetu projektowego', male: 'Kontrolowałem budżet projektowy', female: 'Kontrolowałam budżet projektowy' },
  'nadzorowałem etapy realizacji': { noun: 'Nadzór nad etapami realizacji projektów', male: 'Nadzorowałem etapy realizacji', female: 'Nadzorowałam etapy realizacji' },
  'facylitowałem ceremonie scrum': { noun: 'Facylitacja ceremonii Scrum (Daily, Planning, Retro)', male: 'Facylitowałem ceremonie Scrum', female: 'Facylitowałam ceremonie Scrum' },
  'usuwałem przeszkody zespołowe': { noun: 'Usuwanie przeszkód (Impediments) i wsparcie zespołu', male: 'Usuwałem przeszkody zespołowe', female: 'Usuwałam przeszkody zespołowe' },
  'współtworzyłem backlog': { noun: 'Współtworzenie i priorytetyzacja Product Backlogu', male: 'Współtworzyłem backlog produktu', female: 'Współtworzyłam backlog produktu' },
  'optymalizowałem velocity': { noun: 'Optymalizacja metryk przepustowości zespołu (Velocity)', male: 'Optymalizowałem Velocity zespołu', female: 'Optymalizowałam Velocity zespołu' },
  'raportowałem postępy sponsorom': { noun: 'Raportowanie postępów dla sponsorów i zarządu', male: 'Raportowałem postępy sponsorom', female: 'Raportowałam postępy sponsorom' },
  'zarządzałem oczekiwaniami interesariuszy': { noun: 'Zarządzanie relacjami i oczekiwaniami interesariuszy', male: 'Zarządzałem oczekiwaniami interesariuszy', female: 'Zarządzałam oczekiwaniami interesariuszy' },
  'prowadziłem warsztaty projektowe': { noun: 'Prowadzenie warsztatów projektowych i discovery', male: 'Prowadziłem warsztaty projektowe', female: 'Prowadziłam warsztaty projektowe' },
  'identyfikowałem ryzyka projektowe': { noun: 'Identyfikacja ryzyk i planowanie działań mitygacyjnych', male: 'Identyfikowałem ryzyka projektowe', female: 'Identyfikowałam ryzyka projektowe' },
  'wdrażałem plany mitygacji': { noun: 'Wdrażanie planów mitygacji ryzyk', male: 'Wdrażałem plany mitygacji ryzyk', female: 'Wdrażałam plany mitygacji ryzyk' },
  'prowadziłem odbiory końcowe': { noun: 'Prowadzenie odbiorów końcowych i formalnych wdrożeń', male: 'Prowadziłem odbiory końcowe', female: 'Prowadziłam odbiory końcowe' },
  'dbałem o jakość deliverables': { noun: 'Dbałość o jakość produktów cząstkowych i standardy DoD', male: 'Dbałem o jakość deliverables', female: 'Dbałam o jakość deliverables' },

  // Ogólne
  koordynowałem: { noun: 'Koordynacja', male: 'Koordynowałem', female: 'Koordynowałam' },
  organizowałem: { noun: 'Organizacja', male: 'Organizowałem', female: 'Organizowałam' },
  usprawniałem: { noun: 'Usprawnianie', male: 'Usprawniałem', female: 'Usprawniałam' },
  analizowałem: { noun: 'Analiza', male: 'Analizowałem', female: 'Analizowałam' },
  'tworzyłem raporty': { noun: 'Tworzenie raportów', male: 'Tworzyłem raporty', female: 'Tworzyłam raporty' },
  'weryfikowałem dane': { noun: 'Weryfikacja danych', male: 'Weryfikowałem dane', female: 'Weryfikowałam dane' },
  'przygotowywałem zestawienia': { noun: 'Przygotowywanie zestawień analitycznych', male: 'Przygotowywałem zestawienia analityczne', female: 'Przygotowywałam zestawienia analityczne' },
  'prowadziłem korespondencję': { noun: 'Prowadzenie korespondencji biznesowej', male: 'Prowadziłem korespondencję biznesową', female: 'Prowadziłam korespondencję biznesową' },
  'budowałem relacje': { noun: 'Budowanie relacji biznesowych', male: 'Budowałem relacje biznesowe', female: 'Budowałam relacje biznesowe' },
  'obsługiwałem zapytania': { noun: 'Obsługa zapytań ofertowych', male: 'Obsługiwałem zapytania ofertowe', female: 'Obsługiwałam zapytania ofertowe' },
  'uzgadniałem terminy': { noun: 'Uzgodnienia terminów spotkań', male: 'Uzgadniałem terminy spotkań', female: 'Uzgadniałam terminy spotkań' },
  'wspierałem realizację projektów': { noun: 'Wsparcie realizacji projektów wewnętrznych', male: 'Wspierałem realizację projektów', female: 'Wspierałam realizację projektów' },
  'rozliczałem koszty': { noun: 'Rozliczanie wydatków i kosztów służbowych', male: 'Rozliczałem koszty służbowe', female: 'Rozliczałam koszty służbowe' },
  'organizowałem wydarzenia': { noun: 'Organizacja wydarzeń i spotkań firmowych', male: 'Organizowałem wydarzenia firmowe', female: 'Organizowałam wydarzenia firmowe' },
  'przygotowywałem materiały': { noun: 'Przygotowywanie materiałów informacyjnych', male: 'Przygotowywałem materiały', female: 'Przygotowywałam materiały' },
};

/**
 * Zwraca właściwą formę czynności wg wybranego stylu narracji.
 */
export function formatActionWord(action: string, style: GrammarNarrativeStyle): string {
  if (!action) return '';
  const norm = action.trim().toLowerCase();
  const mapping = POLISH_VERB_FORMS[norm];
  const mapped = mapping
    ? style === 'impersonal'
      ? mapping.noun
      : style === 'first_person_f'
        ? mapping.female
        : mapping.male
    : '';

  if (mapped) {
    const grounded = keepActionWordsFromSource(mapped, action);
    if (grounded) return grounded;
  }
  if (mapping && style === 'first_person_f') {
    const femaleVerb = mapping.female.trim().split(/\s+/)[0];
    const sourceRemainder = action.trim().split(/\s+/).slice(1).join(' ');
    return [femaleVerb, sourceRemainder].filter(Boolean).join(' ');
  }
  // Gdy gotowa forma dodaje rzeczownik lub narzędzie, zachowujemy czynność
  // użytkownika. Odmiana nie może dopowiadać, czym się zajmował.
  if (style === 'first_person_f' && norm.endsWith('łem')) {
    return norm.slice(0, -3) + 'łam';
  }
  return action.charAt(0).toUpperCase() + action.slice(1);
}

const ACTION_GLUE = new Set(
  ['i', 'oraz', 'w', 'we', 'z', 'ze', 'na', 'do', 'od', 'po', 'za', 'o', 'przy', 'dla', 'nad']
    .map((token) => getPolishStem(stripDiacriticsLower(token))),
);

function actionTokens(text: string): string[] {
  return stripDiacriticsLower(text)
    .split(/[^\p{L}\p{N}+#.]+/u)
    .filter(Boolean)
    .map(getPolishStem);
}

/** Formy słownikowe mogą zmieniać fleksję, ale nie dopisywać nowych faktów. */
function keepActionWordsFromSource(candidate: string, action: string): string {
  const sourceTokens = new Set(actionTokens(action));
  const rawTokens = candidate.match(/[\p{L}\p{N}+#.]+/gu) ?? [];
  const candidateTokens = rawTokens.map((token) => getPolishStem(stripDiacriticsLower(token)));
  // Pierwszy token to sama odmieniona czynność; wszystkie dalsze muszą
  // pochodzić z podanej frazy albo być neutralnym łącznikiem gramatycznym.
  const hasUnsupportedClaim = candidateTokens.slice(1).some((token) =>
    !ACTION_GLUE.has(token) && !sourceTokens.has(token)
  );
  return hasUnsupportedClaim ? '' : rawTokens.join(' ');
}

/**
 * Łączy listę obiektów lub technologii w naturalny polski ciąg (np. "A, B oraz C").
 */
export function joinWithPolishConjunction(items: string[], conjunction: 'oraz' | 'i' = 'oraz'): string {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}
