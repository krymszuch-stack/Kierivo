import { RoleKnowledgeNode } from './types';

export const ROLE_GRAPH: Record<string, RoleKnowledgeNode> = {
  trades_technician: {
    roleId: 'trades_technician',
    label: 'Monter / Serwisant HVAC & Urządzeń Grzewczych',
    category: 'Instalacje & HVAC',
    description: 'Montaż, próby szczelności, przeglądy okresowe i serwis kotłów, pomp ciepła, klimatyzacji i instalacji sanitarnych.',
    aliases: ['monter', 'instalator', 'serwisant', 'hvac', 'piecyk', 'kocioł', 'klimatyzacja', 'pompa ciepła', 'sanitarny', 'hydraulik'],
    areas: [
      { id: 'hvac_installation', label: 'Montaż Kotłów, Pomp Ciepła & HVAC', description: 'Instalacje grzewcze, klimatyzacyjne i sanitarne' },
      { id: 'gas_leak_testing', label: 'Próby Szczelności & Pomiary Spalin', description: 'Diagnostyka ciśnieniowa i analizy spalin Testo' },
      { id: 'service_maintenance', label: 'Serwis Okresowy, Diagnostyka & DTR', description: 'Czyszczenie palników, wymiana wymienników i usuwanie usterek' },
      { id: 'sanitary_piping', label: 'Rurociągi, Armatura & Zgrzewanie', description: 'Trasy rurowe miedziane, PEX, zgrzewanie elektrooporowe' },
    ],
    actions: {
      hvac_installation: ['montowałem', 'instalowałem', 'podłączałem', 'uruchamiałem', 'prowadziłem montaż'],
      gas_leak_testing: ['wykonywałem', 'diagnozowałem', 'przeprowadzałem', 'weryfikowałem', 'mierzyłem'],
      service_maintenance: ['serwisowałem', 'naprawiałem', 'wymieniałem', 'czyściłem', 'kalibrowałem'],
      sanitary_piping: ['układałem', 'zgrzewałem', 'lutowałem', 'montowałem', 'prowadziłem'],
    },
    objects: {
      hvac_installation: ['kotły gazowe kondensacyjne', 'pompy ciepła powietrze-woda', 'jednostki klimatyzacji Split/Multi-Split', 'instalacje ogrzewania podłogowego', 'węzły cieplne'],
      gas_leak_testing: ['próby szczelności instalacji gazowej', 'analizy emisji spalin analizatorem Testo', 'pomiary ciśnienia statycznego i dynamicznego', 'protokoły odbioru technicznego'],
      service_maintenance: ['wymienniki ciepła i komory spalania', 'armaturę gazową i palniki', 'filtry, zawory trójdrogowe i naczynia wzbiorcze', 'usterki w oparciu o kody błędów DTR'],
      sanitary_piping: ['rurociągi miedziane i wielowarstwowe PEX', 'trasy freonowe w izolacji termicznej', 'armaturę odcinającą i regulacyjną', 'połączenia zgrzewane i lutowane na twardo'],
    },
    outcomes: {
      hvac_installation: [
        'sprawdzając szczelność instalacji i stosując właściwe procedury bezpieczeństwa',
        'terminowo oddając instalacje do odbioru technicznego',
        'kontrolując parametry pracy układu według dokumentacji producenta',
      ],
      gas_leak_testing: [
        'wykluczając nieszczelności i podnosząc bezpieczeństwo eksploatacji',
        'uzyskując optymalne parametry spalania według wytycznych producenta',
      ],
      service_maintenance: [
        'skracając czas przestoju urządzeń do minimum',
        'diagnozując podzespoły i weryfikując ich działanie po serwisie',
      ],
      default: [
        'z zachowaniem najwyższych standardów BHP oraz procedur producenta',
        'zgodnie z dokumentacją techniczno-ruchową (DTR)',
      ],
    },
    defaultTech: {
      hvac_installation: ['Uprawnienia SEP G3 (Gaz)', 'Certyfikat F-Gaz', 'Lutowanie twarde', 'Pompy próżniowe'],
      gas_leak_testing: ['Analizator spalin Testo', 'Detektor nieszczelności', 'Manometr cyfrowy', 'Protokół odbiorczy'],
      service_maintenance: ['Junkers / Bosch', 'Vaillant', 'Viessmann', 'Daikin', 'Dokumentacja DTR'],
      default: ['SEP G3', 'SEP G1 do 1kV', 'F-Gaz', 'Narzędzia serwisowe'],
    },
  },

  electrician_automation: {
    roleId: 'electrician_automation',
    label: 'Elektryk / Elektromonter / Automatyk (SEP G1)',
    category: 'Elektryka & Automatyka',
    description: 'Montaż rozdzielnic, trasy kablowe, pomiary ochronne Sonel, programowanie sterowników PLC i usuwanie awarii.',
    aliases: ['elektryk', 'elektromonter', 'automatyk', 'sep', 'sonel', 'rozdzielnica', 'pomiary', 'falownik', 'plc', 's7'],
    areas: [
      { id: 'power_distribution', label: 'Montaż Rozdzielnic & Trasy Kablowe', description: 'Prefabrykacja szaf nn, koryta kablowe i osprzęt' },
      { id: 'electrical_testing', label: 'Pomiary Ochrony Przeciwporażeniowej', description: 'Badania pętli zwarcia, rezystancji izolacji i RCD miernikiem Sonel' },
      { id: 'plc_automation', label: 'Sterowniki PLC, Falowniki & Czujniki', description: 'Programowanie Siemens/WAGO, parametryzacja napędów i I/O' },
      { id: 'industrial_maintenance', label: 'Utrzymanie Ruchu & Usuwanie Awarii', description: 'Ciągłość pracy linii produkcyjnych i modernizacja układów sterowania' },
    ],
    actions: {
      power_distribution: ['montowałem', 'prefabrykowałem', 'układałem', 'podłączałem', 'sznurowałem'],
      electrical_testing: ['wykonywałem pomiary', 'badałem', 'weryfikowałem', 'sporządzałem protokoły', 'diagnozowałem'],
      plc_automation: ['programowałem', 'konfigurowałem', 'uruchamiałem', 'parametryzowałem', 'testowałem'],
      industrial_maintenance: ['usuwałem awarie', 'nadzorowałem', 'prowadziłem przeglądy', 'modernizowałem', 'naprawiałem'],
    },
    objects: {
      power_distribution: ['rozdzielnice niskiego napięcia (nn)', 'trasy i koryta kablowe', 'szafy zasilająco-sterownicze', 'aparaturę modułową i zabezpieczenia'],
      electrical_testing: ['impedancję pętli zwarcia', 'rezystancję izolacji obwodów', 'czasy i prądy zadziałania wyłączników RCD', 'ciągłość przewodów ochronnych i uziemień'],
      plc_automation: ['sterowniki PLC Siemens S7 / WAGO', 'przemienniki częstotliwości (falowniki)', 'aparaturę kontrolno-pomiarową i czujniki', 'układy bezpieczeństwa maszynowego (Safety)'],
      industrial_maintenance: ['ciągi technologiczne i linie produkcyjne', 'silniki elektryczne i układy napędowe', 'instalacje automatyki przemysłowej', 'park maszynowy zakładu'],
    },
    outcomes: {
      power_distribution: [
        'pracując na podstawie schematów i właściwych wymagań technicznych',
        'dbając o estetykę sznurowania szaf i przejrzystość oznaczeń',
      ],
      electrical_testing: [
        'sprawdzając ochronę przeciwporażeniową według obowiązujących procedur',
        'oceniając stan izolacji i odnotowując wykryte nieprawidłowości',
      ],
      plc_automation: [
        'zwiększając wydajność i automatyzację cyklu produkcyjnego',
        'skracając czas przezbrojeń linii technologicznej',
      ],
      industrial_maintenance: [
        'redukując czas nieplanowanych przestojów technologicznych',
        'lokalizując źródła usterek i dokumentując wykonane naprawy',
      ],
      default: [
        'z uwzględnieniem norm PN-HD 60364 i wymogów BHP',
      ],
    },
    defaultTech: {
      power_distribution: ['Schneider Electric', 'Eaton', 'Hager', 'Wago', 'Schematy Eplan'],
      electrical_testing: ['Miernik Sonel MPI-530', 'Protokół pomiarowy', 'SEP G1 D+E z pomiarami'],
      plc_automation: ['Siemens TIA Portal (S7-1200/1500)', 'Falowniki Danfoss/ABB', 'Sensoryka IO-Link'],
      default: ['SEP G1 do 1kV', 'Multimetr Fluke', 'Czytanie schematów elektrycznych'],
    },
  },

  welder_fitter: {
    roleId: 'welder_fitter',
    label: 'Spawacz TIG / MAG & Ślusarz Konstrukcji',
    category: 'Spawalnictwo & Ślusarstwo',
    description: 'Spawanie metodami TIG 141, MAG 135/136 rurociągów i konstrukcji, trasowanie, montaż oraz kontrola wizualna VT2.',
    aliases: ['spawacz', 'ślusarz', 'tig', 'mag', 'mig', '141', '135', 'spawanie', 'konstrukcje stalowe', 'rurociągi'],
    areas: [
      { id: 'tig_welding', label: 'Spawanie TIG 141 Rurociągów & Nierdzewki', description: 'Przetopy, lica spoin i rury ze stali kwasoodpornej' },
      { id: 'mag_welding', label: 'Spawanie MAG 135/136 Konstrukcji Stalowych', description: 'Profile wielkogabarytowe, spoiny pachwinowe i doczołowe' },
      { id: 'fitter_assembly', label: 'Ślusarstwo, Trasowanie & Przygotowanie Krawędzi', description: 'Cięcie, ukosowanie, sczepianie i pasowanie elementów' },
      { id: 'vt_quality_inspection', label: 'Kontrola Spoin VT/PT & Defektoskopia', description: 'Weryfikacja jakości złączy spawalniczych bez wad' },
    ],
    actions: {
      tig_welding: ['spawałem metodą TIG 141', 'wykonywałem przetopy', 'prowadziłem lico', 'spawałem pod rentgen'],
      mag_welding: ['spawałem metodą MAG 135/136', 'łączyłem konstrukcje', 'spawałem w pozycjach wymuszonych'],
      fitter_assembly: ['trasowałem', 'ukosowałem krawędzie', 'szlifowałem', 'sczepiałem elementy', 'montowałem'],
      vt_quality_inspection: ['weryfikowałem jakość spoin', 'przeprowadzałem badania VT2', 'eliminowałem niezgodności spawalnicze'],
    },
    objects: {
      tig_welding: ['rurociągi ze stali nierdzewnej i duplex', 'instalacje ciśnieniowe i spożywcze', 'złącza doczołowe pod badania RTG', 'cienkościenne rury i kształtki'],
      mag_welding: ['wielkogabarytowe konstrukcje stalowe', 'spoiny doczołowe (BW) i pachwinowe (FW)', 'profile hutnicze, dźwigary i ramy maszyn'],
      fitter_assembly: ['krawędzie spoin pod ukos V i Y', 'konstrukcje według rysunku technicznego', 'zestawy montażowe przed spawaniem docelowym'],
      vt_quality_inspection: ['spoiny pod kątem podtopień, porowatości i przyklejeń', 'certyfikowane złącza zgodnie z normą ISO 5817 poziom B/C'],
    },
    outcomes: {
      tig_welding: [
        'wykonując badania nieniszczące RTG i UT zgodnie z procedurą',
        'kontrolując geometrię spoin i jakość przetopu według wymagań',
      ],
      mag_welding: [
        'zapewniając wysoką wytrzymałość statyczną i dynamiczną konstrukcji',
        'utrzymując wysokie tempo spawania przy zachowaniu czystości spoiny',
      ],
      default: [
        'zgodnie z instrukcją WPS i międzynarodowymi normami ISO 9606-1',
        'z zachowaniem rygorystycznych wymogów BHP prac spawalniczych',
      ],
    },
    defaultTech: {
      tig_welding: ['Spawarki Fronius / Kemppi', 'Gaz osłonowy Argon', 'ISO 9606-1 FM5 (Stal nierdzewna)'],
      mag_welding: ['Półautomat spawalniczy Lincoln / Esab', 'Drut lity / proszkowy', 'Mieszanka Ar/CO2'],
      fitter_assembly: ['Rysunek techniczny spawalniczy', 'Ukosowarki do rur', 'Szpachlówki i spoinomierze'],
      default: ['Certyfikat UDT / TÜV ISO 9606', 'Badania VT2', 'Rysunek techniczny'],
    },
  },

  warehouse_logistics: {
    roleId: 'warehouse_logistics',
    label: 'Magazynier / Operator Wózka Widłowego UDT / WMS',
    category: 'Logistyka & Magazyn',
    description: 'Kompletacja zleceń, obsługa wózków widłowych UDT, przyjęcia dostaw, praca ze skanerami kodów i systemami WMS.',
    aliases: ['magazynier', 'wózek widłowy', 'udt', 'wms', 'kompletacja', 'skład wysokiego składowania', 'logistyk', 'order picker', 'picker'],
    areas: [
      { id: 'order_picking', label: 'Kompletacja Zamówień (Pick & Pack)', description: 'Pobieranie towaru ze skanerem radiowym Zebra i pakowanie' },
      { id: 'forklift_high_rack', label: 'Wysoki Skład & Rozładunek Naczep UDT', description: 'Obsługa wózków bocznych Reach Truck i czołowych' },
      { id: 'inbound_outbound', label: 'Przyjęcia Towaru, Kontrola Dostaw & GS1', description: 'Weryfikacja ilościowo-jakościowa dostaw, awizacje i etykiety' },
      { id: 'wms_inventory', label: 'Obsługa Systemu WMS & Inwentaryzacja', description: 'Ewidencja stanów magazynowych w SAP WMS / Baselinker' },
    ],
    actions: {
      order_picking: ['kompletowałem', 'pobierałem towar', 'pakowałem', 'weryfikowałem zamówienia', 'etykietowałem'],
      forklift_high_rack: ['obsługiwałem wózki UDT', 'rozładowywałem naczepy TIR', 'składowałem w regałach', 'przemieszczałem palety'],
      inbound_outbound: ['przyjmowałem dostawy', 'weryfikowałem stan towaru', 'sprawdzałem dokumenty WZ', 'przygotowywałem wysyłki'],
      wms_inventory: ['ewidencjonowałem w WMS', 'prowadziłem inwentaryzacje', 'optymalizowałem strefy składowania', 'generowałem raporty'],
    },
    objects: {
      order_picking: ['zamówienia e-commerce i B2B', 'artykuły w technologii kodów kreskowych i QR', 'paczki i przesyłki paletowe', 'zlecenia kompletacji według ścieżki pickingu'],
      forklift_high_rack: ['palety w regałach wysokiego składowania (do 10m)', 'ładunki naczep samochodów ciężarowych TIR', 'wózki widłowe czołowe i Reach Truck (Linde / Jungheinrich)'],
      inbound_outbound: ['dostawy surowców i towarów handlowych', 'etykiety logistyczne w standardzie GS1', 'dokumentację magazynową (WZ, PZ, MM)'],
      wms_inventory: ['stany magazynowe w systemie SAP WMS / Baselinker', 'lokalizacje magazynowe i strefy buforowe', 'różnice inwentaryzacyjne'],
    },
    outcomes: {
      order_picking: [
        'kontrolując poprawność kompletacji względem dokumentacji zamówienia',
        'zwiększając dzienną liczbę skompletowanych linii zamówień',
      ],
      forklift_high_rack: [
        'zabezpieczając ładunki zgodnie z procedurami obsługi i transportu',
        'skracając średni czas rozładunku naczepy TIR',
      ],
      wms_inventory: [
        'porównując stan fizyczny towaru z zapisami w systemie WMS',
        'optymalizując wykorzystanie dostępnej powierzchni magazynowej',
      ],
      default: [
        'z zachowaniem rygorystycznych procedur BHP i standardów 5S',
      ],
    },
    defaultTech: {
      order_picking: ['Terminal skaner Zebra / Honeywell', 'Pick by Voice / Light', 'Pakowarki i owijarki'],
      forklift_high_rack: ['Wózki UDT (I WJO / II WJO)', 'Wózki wysokiego składu Reach Truck Linde', 'Jungheinrich'],
      wms_inventory: ['System SAP WMS', 'Baselinker', 'Comarch ERP XL', 'Etykiety GS1-128'],
      default: ['Uprawnienia UDT', 'Skaner kodów kreskowych', 'BHP Magazynowe', 'System WMS'],
    },
  },

  driver_transport: {
    roleId: 'driver_transport',
    label: 'Kierowca Zawodowy C+E / Spedytor / Kurier',
    category: 'Transport & Spedycja',
    description: 'Przewóz ładunków FTL/LTL na trasach krajowych i międzynarodowych, obsługa tachografu, procedury celne i mocowanie ładunków.',
    aliases: ['kierowca', 'c+e', 'kierowca c+e', 'kierowca zawodowy', 'transport', 'spedytor', 'tir', 'adr', 'tachograf', 'kurier'],
    areas: [
      { id: 'freight_routing', label: 'Trasy Międzynarodowe & Krajowe FTL/LTL', description: 'Bezpieczny transport naczepami firanka, chłodnia lub kontener' },
      { id: 'cargo_securing', label: 'Mocowanie Ładunku, ADR & Zabezpieczenia', description: 'Pasy transportowe, maty antypoślizgowe i procedury ADR' },
      { id: 'tachograph_compliance', label: 'Czas Pracy Kierowcy & Cyfrowy Tachograf', description: 'Ścisłe przestrzeganie norm czasu jazdy i odpoczynku (AETR)' },
      { id: 'customs_docs', label: 'Dokumentacja CMR, WZ & Odprawy Celne', description: 'Obsługa listów przewozowych, procedur tranzytowych T1/T2' },
    ],
    actions: {
      freight_routing: ['prowadziłem zestawy ciężarowe', 'realizowałem przewozy', 'optymalizowałem trasę przejazdu', 'dostarczałem ładunki'],
      cargo_securing: ['zabezpieczałem ładunek', 'mocowałem towar pasami', 'kontrolowałem naciski na osie', 'nadzorowałem załadunek'],
      tachograph_compliance: ['rejestrowałem czas pracy', 'rozliczałem czas jazdy', 'obsługiwałem tachograf cyfrowy'],
      customs_docs: ['weryfikowałem dokumenty CMR', 'obsługiwałem procedury celne', 'prowadziłem dokumentację przewozową'],
    },
    objects: {
      freight_routing: ['zestawy ciągnik z naczepą (firanka / chłodnia / mega)', 'ładunki całopojazdowe (FTL) i drobnicowe (LTL)', 'trasy międzynarodowe (UE / Wielka Brytania)'],
      cargo_securing: ['pasy mocujące z napinaczami i belki rozporowe', 'towary niebezpieczne objęte konwencją ADR', 'ładunki paletowe i maszyny przemysłowe'],
      tachograph_compliance: ['cyfrowe karty kierowcy i tachografy VDO/Stoneridge', 'normy Rozporządzenia 561/2006 (AETR)'],
      customs_docs: ['międzynarodowe listy przewozowe CMR', 'karnety TIR, dokumenty T1/T2 i zgłoszenia celne', 'kwity wagowe i protokoły zdawczo-odbiorcze'],
    },
    outcomes: {
      freight_routing: [
        'koordynując dostawy z harmonogramem okien czasowych (Just-In-Time)',
        'prowadząc pojazd w sposób ekonomiczny i bezpieczny (Eco-Driving)',
      ],
      cargo_securing: [
        'kontrolując zabezpieczenie towaru przed transportem i przy odbiorze',
        'wykluczając ryzyko przesunięcia ładunku w trakcie hamowania awaryjnego',
      ],
      default: [
        'z uwzględnieniem przepisów transportowych i norm bezpieczeństwa',
      ],
    },
    defaultTech: {
      freight_routing: ['Prawo jazdy kat. C+E', 'Karta kierowcy do tachografu', 'Nawigacja dla ciężarówek TomTom Truck / GPS'],
      cargo_securing: ['Uprawnienia ADR (podstawowe + cysterny)', 'Pasy ERGO 500daN', 'Maty antypoślizgowe'],
      default: ['Prawo jazdy C+E', 'Kod 95 (Kwalifikacja wstępna)', 'Tachograf cyfrowy', 'Konwencja CMR'],
    },
  },

  automotive_mechanic: {
    roleId: 'automotive_mechanic',
    label: 'Mechanik Samochodowy / Diagnosta KTS / Elektromechanik',
    category: 'Motoryzacja & Diagnostyka',
    description: 'Diagnostyka komputerowa, wymiana rozrządów, naprawa układów wtryskowych, zawieszeń, hamulców i elektromechanika pojazdowa.',
    aliases: ['mechanik', 'mechanik samochodowy', 'diagnosta', 'elektromechanik', 'warsztat', 'kts', 'can', 'silnik', 'rozrząd', 'geometria'],
    areas: [
      { id: 'engine_powertrain', label: 'Silniki, Rozrządy & Układy Wtryskowe', description: 'Wymiana rozrządów, regeneracja wtryskiwaczy Common Rail, turbosprężarki' },
      { id: 'computer_diagnostics', label: 'Diagnostyka Komputerowa KTS & Magistrala CAN', description: 'Odczyt parametrów bieżących, kasowanie błędów, oscyloskop' },
      { id: 'suspension_brakes', label: 'Układy Hamulcowe, Zawieszenie & Geometria 3D', description: 'Wymiana klocków, tarcz, wahaczy, ustawianie zbieżności 3D' },
      { id: 'auto_electrical', label: 'Elektromechanika & Sterowniki ECU', description: 'Lokalizacja zwarć, naprawa alternatorów, rozruszników i wiązek' },
    ],
    actions: {
      engine_powertrain: ['wymieniałem', 'naprawiałem', 'regenerowałem', 'diagnozowałem', 'regulowałem'],
      computer_diagnostics: ['diagnozowałem testerem', 'odczytywałem parametry', 'analizowałem sygnały oscyloskopem', 'kodowałem'],
      suspension_brakes: ['wymieniałem elementy zawieszenia', 'ustawiałem geometrię 3D', 'serwisowałem układy hamulcowe', 'odpowietrzałem'],
      auto_electrical: ['lokalizowałem zwarcia', 'naprawiałem wiązki elektryczne', 'regenerowałem podzespoły', 'badałem pobór prądu'],
    },
    objects: {
      engine_powertrain: ['układy rozrządu (paski mokre/suche, łańcuchy)', 'układy wtryskowe Common Rail i pompowtryskiwacze', 'turbosprężarki i układy recyrkulacji spalin EGR/DPF', 'głowice i uszczelnienia silników'],
      computer_diagnostics: ['sterowniki silnika ECU i moduły komfortu BSI/BCM', 'parametry rzeczywiste magistrali CAN i LIN', 'sygnały czujników wału, wałka i sond lambda'],
      suspension_brakes: ['tarcze, klocki hamulcowe i zaciski z elektrycznym hamulcem EPB', 'wahacze, sworznie, amortyzatory i tuleje metalowo-gumowe', 'geometrię kół na urządzeniach 3D Hunter'],
      auto_electrical: ['alternatory, rozruszniki i układy ładowania akumulatora', 'wiązki elektryczne i złącza narażone na wilgoć', 'moduły oświetlenia LED / Xenon i sterowniki'],
    },
    outcomes: {
      engine_powertrain: [
        'sprawdzając parametry pracy jednostki napędowej po wykonanym serwisie',
        'skutecznie eliminując wycieki i niepokojące stuki silnika',
      ],
      computer_diagnostics: [
        'błyskawicznie lokalizując źródło usterki bez zbędnej wymiany sprawnych części',
        'przywracając fabryczne adaptacje i parametry pracy podzespołów',
      ],
      suspension_brakes: [
        'kontrolując układ jezdny i hamulcowy zgodnie z zakresem naprawy',
      ],
      default: [
        'zgodnie ze sztuką warsztatową i zalecanymi momentami dokręcania śrub (Nm)',
      ],
    },
    defaultTech: {
      computer_diagnostics: ['Tester Bosch KTS 590 / ESI[tronic]', 'Oscyloskop PicoScope', 'Autel MaxiSys', 'VCDS / ODIS'],
      suspension_brakes: ['Urządzenie do geometrii 3D Hunter', 'Ściągacze hydrauliczne', 'Klucze dynamometryczne Hazet'],
      default: ['Tester diagnostyczny KTS', 'Klucz dynamometryczny', 'Dokumentacja Autodata / HaynesPro'],
    },
  },

  construction_finishing: {
    roleId: 'construction_finishing',
    label: 'Glazurnik / Wykończeniowiec / Monter Budowlany',
    category: 'Budownictwo & Wykończenia',
    description: 'Układanie płytek wielkoformatowych, sucha zabudowa G-K, hydroizolacje, szpachlowanie i prace wykończeniowe.',
    aliases: ['glazurnik', 'budowlaniec', 'wykończeniowiec', 'płytkarz', 'gipsiarz', 'sucha zabudowa', 'malarz', 'szpachlarz', 'remonty'],
    areas: [
      { id: 'tiling_large_format', label: 'Glazurnictwo & Płyty Wielkoformatowe', description: 'Układanie gresu, cięcie wodne i szlifowanie krawędzi 45°' },
      { id: 'drywall_insulation', label: 'Sucha Zabudowa G-K & Sufity Podwieszane', description: 'Konstrukcje profili CW/UW, zabudowy poddaszy i ścianki działowe' },
      { id: 'waterproofing_finishing', label: 'Hydroizolacja, Gładzie & Malowanie', description: 'Folie w płynie, gładzie bezpyłowe i natrysk hydrodynamiczny' },
      { id: 'heavy_machinery', label: 'Obsługa Maszyn Budowlanych & Niwelacja', description: 'Prace ziemne, koparko-ładowarki i lasery niwelacyjne' },
    ],
    actions: {
      tiling_large_format: ['układałem gres', 'docinałem płytki', 'szlifowałem krawędzie pod kątem 45°', 'fugowałem epoksydem'],
      drywall_insulation: ['montowałem profile CW/UW', 'płytowałem płytami G-K', 'wykonywałem zabudowy poddaszy', 'akrylowałem'],
      waterproofing_finishing: ['nakładałem hydroizolację', 'wykonywałem gładzie gipsowe', 'malowałem agregatem', 'gruntowałem'],
      heavy_machinery: ['obsługiwałem maszyny budowlane', 'wykonywałem wykopy', 'niwelowałem teren laserem', 'skarpowałem'],
    },
    objects: {
      tiling_large_format: ['płyty gresowe wielkoformatowe (120x240cm)', 'krawędzie pod kątem 45 stopni (Jolly)', 'systemy poziomowania płytek (Raimondi / kliny)', 'fugi cementowe i epoksydowe'],
      drywall_insulation: ['ścianki działowe i sufity podwieszane na profilach stalowych', 'płyty gipsowo-kartonowe standardowe i impregnowane (zielone/ognioodporne)', 'wełnę mineralną i folie paroizolacyjne'],
      waterproofing_finishing: ['powłoki hydroizolacyjne z taśmami uszczelniającymi w strefach mokrych', 'gładzie polimerowe i gipsowe szlifowane bezpyłowo', 'powłoki malarskie nakładane agregatem hydrodynamicznym Graco'],
      heavy_machinery: ['wykopy pod fundamenty i sieci uzbrojenia terenu', 'koparko-ładowarki JCB/CAT z osprzętem', 'poziomy z wykorzystaniem niwelatora laserowego 3D'],
    },
    outcomes: {
      tiling_large_format: [
        'kontrolując równość powierzchni i jakość wykonania po pracach',
        'dobierając sposób wykończenia do projektu i zastosowanych materiałów',
      ],
      waterproofing_finishing: [
        'sprawdzając szczelność hydroizolacji przed kolejnym etapem prac',
        'przygotowując powierzchnię ścian do odbioru według wymaganej klasy',
      ],
      default: [
        'z zachowaniem najwyższej kultury technicznej, czystości i tolerancji wymiarowych',
      ],
    },
    defaultTech: {
      tiling_large_format: ['Przecinarka do wielkiego formatu Rubi/Raimondi', 'Mapei Keraflex', 'Laser krzyżowy Bosch', 'Fugi epoksydowe'],
      waterproofing_finishing: ['Agregat malarski Graco', 'Szlifierka do gładzi Festool Planex', 'Mapei Mapegum'],
      default: ['Laser krzyżowy', 'Narzędzia Festool / Rubi', 'Chemia budowlana Mapei / Knauf'],
    },
  },

  cnc_production: {
    roleId: 'cnc_production',
    label: 'Operator & Programista Obrabiarek CNC',
    category: 'Produkcja & Obróbka CNC',
    description: 'Programowanie obrabiarek CNC, pisanie G-Code (Sinumerik/Fanuc/Heidenhain), uzbrajanie maszyn i pomiary mikrometryczne.',
    aliases: ['cnc', 'operator cnc', 'programista cnc', 'tokarz', 'frezarz', 'obróbka skrawaniem', 'g-code', 'sinumerik', 'fanuc', 'heidenhain'],
    areas: [
      { id: 'cnc_programming', label: 'Programowanie G-Code (Sinumerik / Fanuc)', description: 'Pisanie programów obróbczych z pulpitu i w CAM' },
      { id: 'tool_setup', label: 'Uzbrajanie Tokarek / Frezarek & Narzędzia', description: 'Mocowanie detali, dobór płytek skrawających, pomiar długości narzędzi' },
      { id: 'precision_measurement', label: 'Pomiary Warsztatowe & Kontrola Jakości', description: 'Pomiar tolerancji IT6-IT8 mikrometrem, średnicówką i suwmiarką' },
      { id: 'production_flow', label: 'Ciągłość Produkcji & Optymalizacja Cyklu', description: 'Korekcja promienia G41/G42 i redukcja czasu skrawania' },
    ],
    actions: {
      cnc_programming: ['pisałem programy G-Code', 'edytowałem trajektorie narzędzia', 'dobierałem parametry skrawania', 'symulowałem obróbkę'],
      tool_setup: ['uzbrajałem maszynę CNC', 'montowałem oprawki i płytki', 'badałem bazowanie detalu', 'ustawiałem zera maszynowe'],
      precision_measurement: ['mierzyłem detale', 'kontrolowałem wymiary i chropowatość Ra', 'weryfikowałem tolerancje geometryczne'],
      production_flow: ['nadzorowałem proces obróbki', 'korygowałem zużycie narzędzi', 'optymalizowałem czas cyklu', 'usuwałem zacięcia'],
    },
    objects: {
      cnc_programming: ['programy obróbcze na sterowniki Siemens Sinumerik 840D / Fanuc / Heidenhain', 'cykle toczenia, frezowania, gwintowania i wiercenia', 'parametry prędkości skrawania Vc i posuwu F'],
      tool_setup: ['oprawki narzędziowe HSK/SK, głowice frezarskie i noże tokarskie', 'płytki skrawające węglikowe (Sandvik / Iscar / Seco)', 'przyrządy mocujące i uchwyty hydrauliczne'],
      precision_measurement: ['detale w klasach tolerancji do 0.01 mm', 'wymiary za pomocą mikrometrów, średnicówek dwupunktowych i suwmiarek Mitutoyo', 'chropowatość powierzchni profilometrem'],
      production_flow: ['korektory promienia i długości narzędzi (G41/G42)', 'seryjną produkcję elementów z zachowaniem powtarzalności'],
    },
    outcomes: {
      cnc_programming: [
        'skracając czas jednostkowego cyklu obróbki przy zachowaniu trwałości płytek',
        'eliminując ryzyko kolizji wrzeciona dzięki dokładnej weryfikacji kodu',
      ],
      precision_measurement: [
        'monitorując braki produkcyjne na podstawie danych z kontroli jakości',
        'weryfikując wykonanie detalu względem rysunku technicznego',
      ],
      default: [
        'zgodnie z normami technicznymi i wymogami ISO 9001',
      ],
    },
    defaultTech: {
      cnc_programming: ['Siemens Sinumerik 840D', 'Fanuc Series', 'Heidenhain TNC', 'G-Code / M-Code'],
      precision_measurement: ['Narzędzia pomiarowe Mitutoyo', 'Mikrometr', 'Średnicówka', 'Projektor pomiarowy'],
      default: ['Programowanie CNC', 'G-Code', 'Rysunek techniczny', 'Narzędzia Sandvik/Iscar'],
    },
  },

  finance_accounting: {
    roleId: 'finance_accounting',
    label: 'Księgowa / Specjalista ds. Finansów & Kadr',
    category: 'Finanse & Księgowość',
    description: 'Pełna księgowość, deklaracje VAT/CIT, JPK_V7, Płatnik ZUS, sprawozdania finansowe i rozliczenia kadr.',
    aliases: ['księgowa', 'księgowy', 'finanse', 'kadry', 'płace', 'płatnik', 'vat', 'cit', 'jpk', 'rachunkowość', 'symfonia', 'optima'],
    areas: [
      { id: 'full_accounting', label: 'Pełna Księgowość, VAT, CIT & JPK', description: 'Dekretacja dokumentów, ewidencja środków trwałych, deklaracje podatkowe' },
      { id: 'payroll_hr', label: 'Kadry i Płace, ZUS Płatnik & Umowy', description: 'Naliczanie wynagrodzeń, deklaracje DRA, ZUA, świadectwa pracy' },
      { id: 'financial_reporting', label: 'Sprawozdawczość Finansowa & Bilans', description: 'Rachunek zysków i strat (RZiS), bilans roczny i audyty' },
      { id: 'invoicing_ar', label: 'Fakturowanie, Kontrola Należności & KSeF', description: 'Obsługa płatności, KSeF, uzgadnianie sald i windykacja' },
    ],
    actions: {
      full_accounting: ['księgowałem', 'dekretowałem dokumenty', 'sporządzałem deklaracje VAT/CIT', 'weryfikowałem pliki JPK_V7', 'prowadziłem ewidencję'],
      payroll_hr: ['naliczałem wynagrodzenia', 'sporządzałem listy płac', 'wysyłałem deklaracje ZUS Płatnik', 'rozliczałem umowy'],
      financial_reporting: ['tworzyłem sprawozdania finansowe', 'zamykałem miesiące i rok obrotowy', 'uzgadniałem konta', 'analizowałem koszty'],
      invoicing_ar: ['wystawiałem faktury', 'obsługiwałem system KSeF', 'weryfikowałem salda kontrahentów', 'kontrolowałem spływ należności'],
    },
    objects: {
      full_accounting: ['faktury kosztowe i zakupowe według planu kont', 'deklaracje podatkowe VAT-7, CIT-8 oraz pliki JPK_V7M/K', 'rejestry VAT i ewidencję środków trwałych'],
      payroll_hr: ['listy płac dla umów o pracę, B2B i umów cywilnoprawnych', 'deklaracje rozliczeniowe ZUS (DRA, RCA, RSA) w programie Płatnik', 'kartoteki pracownicze i ewidencję czasu pracy'],
      financial_reporting: ['bilans, rachunek zysków i strat (RZiS) oraz cash flow', 'zestawienia obrotów i sald (obrotówki)', 'raporty zarządcze na potrzeby audytu i zarządu'],
      invoicing_ar: ['faktury sprzedażowe zgodne z wymogami KSeF', 'uzgodnienia sald z kontrahentami i wyciągi bankowe', 'noty odsetkowe i wezwania do zapłaty'],
    },
    outcomes: {
      full_accounting: [
        'przygotowując deklaracje do Urzędu Skarbowego i ZUS na podstawie dokumentów',
        'weryfikując zapisy księgowe względem obowiązujących wymagań',
      ],
      financial_reporting: [
        'dostarczając zarządowi rzetelnych danych do podejmowania decyzji biznesowych',
        'sprawnie przeprowadzając firmę przez audyty biegłego rewidenta',
      ],
      invoicing_ar: [
        'skracając średni wskaźnik DSO (spływ należności) i poprawiając płynność finansową',
      ],
      default: [
        'zgodnie z przepisami prawa podatkowego i zasadami rachunkowości',
      ],
    },
    defaultTech: {
      full_accounting: ['Comarch ERP Optima', 'Symfonia Finanse i Księgowość', 'Enova365', 'System KSeF'],
      payroll_hr: ['Program Płatnik ZUS', 'Gratyfikant GT', 'MS Excel Zaawansowany'],
      default: ['Comarch Optima / Symfonia', 'Płatnik ZUS', 'MS Excel (VLOOKUP, Tabele przestawne)', 'JPK_V7'],
    },
  },

  sales_b2b: {
    roleId: 'sales_b2b',
    label: 'Przedstawiciel Handlowy B2B / Key Account Manager',
    category: 'Sprzedaż & Rozwój Biznesu',
    description: 'Pozyskiwanie klientów biznesowych, negocjacje handlowe, doradztwo techniczne i zarządzanie relacjami CRM.',
    aliases: ['handlowiec', 'sprzedawca', 'b2b', 'przedstawiciel handlowy', 'kam', 'account manager', 'sales', 'doradca handlowy', 'negocjacje'],
    areas: [
      { id: 'prospecting_acquisition', label: 'Pozyskiwanie Klientów B2B & Prospecting', description: 'Cold outreach, badanie potrzeb (BANT) i networking' },
      { id: 'negotiations_closing', label: 'Negocjacje Handlowe & Domykanie Umów', description: 'Prezentacje ofert, kalkulacje marży i kontrakty długoterminowe' },
      { id: 'account_management', label: 'Obsługa Klientów Kluczowych & Retencja', description: 'Budowanie trwałych relacji, up-selling i cross-selling' },
      { id: 'crm_pipeline', label: 'Zarządzanie Lejkiem Sprzedaży & CRM', description: 'Prognozowanie przychodów w Salesforce / Pipedrive / Livespace' },
    ],
    actions: {
      prospecting_acquisition: ['pozyskiwałem klientów', 'prowadziłem prospecting', 'badałem potrzeby biznesowe', 'nawiązywałem relacje'],
      negotiations_closing: ['negocjowałem warunki umów', 'prezentowałem oferty handlowe', 'kalkulowałem marże', 'domykałem kontrakty'],
      account_management: ['rozwijałem współpracę', 'dbałem o retencję', 'realizowałem dosprzedaż (up-selling)', 'doradzałem partnerom'],
      crm_pipeline: ['zarządzałem lejkiem sprzedaży', 'prognozowałem realizację planu', 'rejestrowałem aktywności w CRM'],
    },
    objects: {
      prospecting_acquisition: ['nowych klientów biznesowych z sektora MŚP i korporacji', 'kwalifikację leadów sprzedażowych według metodologii BANT', 'spotkania handlowe i prezentacje wartości (Value Proposition)'],
      negotiations_closing: ['kontrakty handlowe o wysokiej wartości rocznej', 'oferty cenowe, rabaty i warunki płatności', 'umowy ramowe i przetargi B2B'],
      account_management: ['kluczowych partnerów biznesowych (Key Accounts)', 'plany rozwoju sprzedaży w istniejącym portfelu', 'renegocjacje warunków handlowych'],
      crm_pipeline: ['szanse sprzedaży w systemie CRM (Salesforce / HubSpot / Pipedrive)', 'wskaźniki konwersji na poszczególnych etapach lejka'],
    },
    outcomes: {
      negotiations_closing: [
        'monitorując realizację planu sprzedażowego na podstawie wyników',
        'zwiększając średnią marżę na zawieranych kontraktach',
      ],
      account_management: [
        'zwiększając wskaźnik retencji klientów (LTV) i budując pozycję zaufanego partnera',
        'pozyskując rekomendacje i referencje od zadowolonych kontrahentów',
      ],
      default: [
        'zgodnie z metodologią sprzedaży doradczej (Consultative Selling)',
      ],
    },
    defaultTech: {
      prospecting_acquisition: ['LinkedIn Sales Navigator', 'Hunter.io', 'Google Workspace'],
      crm_pipeline: ['Salesforce Sales Cloud', 'HubSpot CRM', 'Pipedrive', 'Livespace CRM'],
      default: ['System CRM (Salesforce/HubSpot)', 'LinkedIn Sales Navigator', 'Techniki negocjacji Sandlera'],
    },
  },

  customer_service: {
    roleId: 'customer_service',
    label: 'Specjalista ds. Obsługi Klienta / Contact Center',
    category: 'Obsługa Klienta & Support',
    description: 'Wsparcie klienta przez telefon, mail i czat, rozwiązywanie problemów, reklamacje i procedury SLA.',
    aliases: ['obsługa klienta', 'call center', 'contact center', 'customer service', 'support', 'reklamacje', 'konsultant', 'doradca klienta', 'helpdesk'],
    areas: [
      { id: 'inbound_consulting', label: 'Doradztwo & Wielokanałowa Obsługa', description: 'Obsługa połączeń przychodzących, maili i czatów na żywo' },
      { id: 'issue_resolution', label: 'Obsługa Reklamacji & Deeskalacja', description: 'Rozwiązywanie sporów, zwroty i profesjonalna mediacja' },
      { id: 'sla_case_management', label: 'Zarządzanie Zgłoszeniami & Systemy Helpdesk', description: 'Praca na ticketach w Zendesk / Freshdesk / Jira Service Desk' },
      { id: 'banking_compliance', label: 'Weryfikacja Tożsamości KYC & Procedury Bezpieczeństwa', description: 'Reżim procedur bankowych, zastrzeganie i weryfikacja danych' },
    ],
    actions: {
      inbound_consulting: ['doradzałem klientom', 'odbierałem zgłoszenia', 'udzielałem informacji', 'diagnozowałem potrzeby'],
      issue_resolution: ['rozpatrywałem reklamacje', 'deeskalowałem trudne sytuacje', 'znajdowałem rozwiązania', 'procesowałem zwroty'],
      sla_case_management: ['zarządzałem ticketami w Helpdesk', 'dbałem o wskaźniki SLA', 'przekazywałem zgłoszenia do II linii'],
      banking_compliance: ['weryfikowałem tożsamość klienta (KYC)', 'przestrzegałem procedur bezpieczeństwa', 'zastrzegałem dokumenty'],
    },
    objects: {
      inbound_consulting: ['klientów indywidualnych i biznesowych w modelu omnichannel', 'zapytania produktowe, techniczne i rozliczeniowe', 'zamówienia i umowy w systemach bazodanowych'],
      issue_resolution: ['reklamacje towarów i usług', 'trudne i roszczeniowe sprawy sporne klientów', 'decyzje kompensacyjne i ugody polubowne'],
      sla_case_management: ['zgłoszenia w systemie ticketowym Zendesk / Freshdesk / Jira', 'metryki First Contact Resolution (FCR) i Time to Resolution'],
      banking_compliance: ['procedury bezpieczeństwa bankowego KYC i AML', 'wrażliwe dane osobowe zgodnie z RODO'],
    },
    outcomes: {
      inbound_consulting: [
        'analizując opinie klientów i zgłoszenia dotyczące obsługi',
        'podnosząc wskaźnik rozwiązywania spraw przy pierwszym kontakcie (FCR)',
      ],
      issue_resolution: [
        'skutecznie deeskalując konflikty i chroniąc wizerunek firmy',
        'skracając średni czas procedowania reklamacji',
      ],
      default: [
        'z zachowaniem najwyższych standardów kultury osobistej i empatii',
      ],
    },
    defaultTech: {
      sla_case_management: ['Zendesk Support', 'Freshdesk', 'Jira Service Management', 'LiveChat'],
      inbound_consulting: ['Centrale Avaya / Genesys / Daktela', 'Systemy CRM', 'MS Office'],
      default: ['Zendesk / Jira Service', 'Systemy CRM', 'Wskaźniki CSAT / FCR / NPS'],
    },
  },

  medical_healthcare: {
    roleId: 'medical_healthcare',
    label: 'Pielęgniarka / Ratownik Medyczny / Fizjoterapeuta',
    category: 'Medycyna & Zdrowie',
    description: 'Pielęgnacja pacjentów, iniekcje, kaniulacja żył, stany nagłe, rehabilitacja i prowadzenie dokumentacji EDM.',
    aliases: ['pielęgniarka', 'pielęgniarz', 'ratownik medyczny', 'fizjoterapeuta', 'medycyna', 'szpital', 'lekarz', 'ekg', 'pwz', 'rehabilitacja'],
    areas: [
      { id: 'patient_care_injections', label: 'Iniekcje, Kaniulacja Żył & Farmakoterapia', description: 'Podawanie leków, wkłucia obwodowe, pompy infuzyjne i opatrunki' },
      { id: 'diagnostics_ekg', label: 'Diagnostyka, Zapis EKG & Pomiary', description: 'Badania parametrów życiowych, pobieranie materiału do badań' },
      { id: 'emergency_triage', label: 'Stany Nagłe, RKO / ALS & Procedury Ratunkowe', description: 'Resuscytacja, zaopatrywanie urazów, segregacja medyczna Triage' },
      { id: 'medical_documentation', label: 'Dokumentacja Medyczna EDM & Standardy', description: 'Prowadzenie historii choroby w systemach Kamsoft / Asseco' },
    ],
    actions: {
      patient_care_injections: ['podawałem leki', 'zakładałem wkłucia obwodowe (wenflony)', 'obsługiwałem pompy infuzyjne', 'zmieniałem opatrunki'],
      diagnostics_ekg: ['wykonywałem badania EKG', 'monitorowałem parametry życiowe', 'pobierałem krew do badań', 'interpretowałem wyniki'],
      emergency_triage: ['prowadziłem resuscytację krążeniowo-oddechową (RKO)', 'zaopatrywałem pacjentów w stanach nagłych', 'kwalifikowałem w triage'],
      medical_documentation: ['prowadziłem elektroniczną dokumentację (EDM)', 'sporządzałem zlecenia pielęgniarskie', 'przestrzegałem procedur sanitarnych'],
    },
    objects: {
      patient_care_injections: ['leki dożylne, domięśniowe i podskórne', 'kaniule dożylne (wenflony) i wlewy kroplowe', 'pompy infuzyjne strzykawkowe i objętościowe (Fresenius / Braun)', 'rany pooperacyjne i odleżyny'],
      diagnostics_ekg: ['12-odprowadzeniowe zapisy EKG', 'parametry życiowe (ciśnienie, saturacja SpO2, tętno, glikemia)', 'kardiomonitory przyłóżkowe Mindray'],
      emergency_triage: ['pacjentów w stanach nagłego zagrożenia życia', 'procedury zaawansowanych zabiegów resuscytacyjnych (ALS/BLS)', 'sprzęt reanimacyjny i defibrylatory AED/manualne'],
      medical_documentation: ['elektroniczną dokumentację medyczną w systemach Asseco AMMS / Kamsoft KS-SOMED', 'karty obserwacji pacjenta'],
    },
    outcomes: {
      patient_care_injections: [
        'sprawdzając zgodność przygotowania leków ze zleceniem i procedurą',
        'minimalizując dyskomfort pacjenta i dbając o aseptykę zabiegową',
      ],
      emergency_triage: [
        'szybko i skutecznie stabilizując parametry życiowe pacjentów',
        'skracając czas wdrożenia procedur ratujących życie',
      ],
      default: [
        'z uwzględnieniem zasad EBM i etyki zawodowej',
      ],
    },
    defaultTech: {
      patient_care_injections: ['Pompy infuzyjne Fresenius/Braun', 'Kaniule BD Venflon', 'Opatrunki specjalistyczne'],
      diagnostics_ekg: ['Aparaty EKG Bionet/Aspel', 'Kardiomonitory Mindray', 'Glukometry'],
      medical_documentation: ['Systemy Asseco AMMS', 'Kamsoft KS-SOMED / KS-PPS', 'EDM'],
      default: ['Prawo Wykonywania Zawodu (PWZ)', 'Certyfikat RKO / ALS', 'System EDM'],
    },
  },

  software_engineer: {
    roleId: 'software_engineer',
    label: 'Programista / Software Engineer (Frontend, Backend, Fullstack)',
    category: 'IT & Software Engineering',
    description: 'Projektowanie i programowanie aplikacji webowych, API REST/GraphQL, mikroserwisów, architektury i baz danych.',
    aliases: ['programista', 'developer', 'software engineer', 'frontend', 'backend', 'fullstack', 'react', 'typescript', 'node', 'java', 'python'],
    areas: [
      { id: 'backend', label: 'Backend / Mikroserwisy & API', description: 'Architektura usług, bazy danych SQL/NoSQL, REST/GraphQL' },
      { id: 'frontend', label: 'Frontend / React & UI/UX', description: 'Interfejsy użytkownika, TypeScript, responsywność i dostępność WCAG' },
      { id: 'fullstack', label: 'Full-stack & Aplikacje Webowe', description: 'Kompletne systemy klient-serwer i integracje chmurowe' },
      { id: 'database_data', label: 'Bazy Danych & Optymalizacja Zapytań', description: 'Projektowanie schematów, indeksacja PostgreSQL/MySQL i ORM' },
    ],
    actions: {
      backend: ['projektowałem architekturę', 'implementowałem endpointy', 'rozwijałem mikroserwisy', 'optymalizowałem zapytania', 'integrowałem API'],
      frontend: ['tworzyłem komponenty UI', 'implementowałem widoki', 'zarządzałem stanem aplikacji', 'optymalizowałem wydajność renderingu'],
      fullstack: ['budowałem aplikacje webowe', 'projektowałem architekturę end-to-end', 'wdrażałem funkcjonalności', 'łączyłem frontend z backendem'],
      database_data: ['projektowałem schematy relacyjne', 'optymalizowałem indeksy SQL', 'zarządzałem migracjami bazy', 'tworzyłem procedury'],
    },
    objects: {
      backend: ['usługi backendowe i mikroserwisy', 'endpointy API REST i GraphQL', 'mechanizmy uwierzytelniania JWT i OAuth2', 'kolejki zadań i cache Redis'],
      frontend: ['responsywne interfejsy użytkownika (UI/UX)', 'moduły aplikacji w React / TypeScript', 'formularze z walidacją i stan globalny (Zustand/Redux)', 'komponenty zgodne ze standardem WCAG 2.1 AA'],
      fullstack: ['kompleksowe platformy internetowe i panele SaaS', 'przepływy danych klient-serwer', 'zintegrowane systemy płatności i powiadomień'],
      database_data: ['relacyjne bazy danych PostgreSQL / MySQL', 'zapytania SQL z planem wykonania EXPLAIN', 'struktury NoSQL i modele danych'],
    },
    outcomes: {
      backend: [
        'mierząc czas odpowiedzi API i przepustowość na podstawie danych z monitoringu',
        'monitorując komunikację między mikroserwisami i obsługując błędy integracji',
      ],
      frontend: [
        'poprawiając wynik Core Web Vitals i skracając czas ładowania widoków',
        'zwiększając intuicyjność interfejsu i zadowolenie użytkowników końcowych',
      ],
      default: [
        'z zachowaniem zasad Clean Code, testów jednostkowych i architektury Type-Safe',
      ],
    },
    defaultTech: {
      backend: ['TypeScript / Node.js', 'Java / Spring Boot', 'PostgreSQL', 'Redis', 'Docker'],
      frontend: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Vite'],
      database_data: ['PostgreSQL', 'MySQL', 'Prisma ORM', 'Redis', 'SQL'],
      default: ['TypeScript', 'Git / GitHub', 'REST API', 'Docker', 'Clean Architecture'],
    },
  },

  devops_sysadmin: {
    roleId: 'devops_sysadmin',
    label: 'DevOps Engineer / Administrator Systemów & Sieci',
    category: 'DevOps & Infrastruktura',
    description: 'Pipeline’y CI/CD, konteneryzacja Docker/K8s, infrastruktura chmurowa AWS/GCP, monitoring i administracja Linux/Windows.',
    aliases: ['devops', 'sysadmin', 'administrator', 'cloud', 'aws', 'kubernetes', 'docker', 'ci/cd', 'linux', 'terraform', 'sieci'],
    areas: [
      { id: 'ci_cd_pipelines', label: 'Pipeline’y CI/CD & Konteneryzacja', description: 'Automatyzacja wdrożeń GitHub Actions, Docker i Kubernetes' },
      { id: 'cloud_infrastructure', label: 'Infrastruktura Chmurowa & Terraform (IaC)', description: 'Architektura AWS / GCP, provisioning i zarządzanie kosztami' },
      { id: 'monitoring_security', label: 'Monitoring, Logi & Bezpieczeństwo', description: 'Prometheus, Grafana, alerty i audyt podatności' },
      { id: 'it_helpdesk_lan', label: 'Administracja Siecią LAN/WAN & Active Directory', description: 'VLAN, VPN, zarządzanie domeną Windows Server i backupy' },
    ],
    actions: {
      ci_cd_pipelines: ['konfigurowałem pipeline’y CI/CD', 'konteneryzowałem aplikacje', 'zarządzałem klastrami K8s', 'automatyzowałem wdrożenia'],
      cloud_infrastructure: ['projektowałem infrastrukturę IaC', 'zarządzałem zasobami chmurowymi', 'optymalizowałem koszty Cloud', 'skalowałem środowiska'],
      monitoring_security: ['wdrażałem monitoring Prometheus/Grafana', 'konfigurowałem alerty', 'audytowałem bezpieczeństwo', 'tworzyłem polityki backupu'],
      it_helpdesk_lan: ['administrowałem siecią LAN/WAN', 'zarządzałem Active Directory', 'konfigurowałem routery i firewalle', 'zabezpieczałem połączenia VPN'],
    },
    objects: {
      ci_cd_pipelines: ['automatyczne potoki wdrożeniowe CI/CD (GitHub Actions / GitLab)', 'obrazy kontenerów Docker i manifesty Kubernetes / Helm', 'środowiska deweloperskie, stagingowe i produkcyjne'],
      cloud_infrastructure: ['infrastrukturę jako kod (Terraform / OpenTofu)', 'usługi chmurowe AWS (EC2, S3, RDS, EKS) oraz GCP', 'mechanizmy automatycznego skalowania (Auto-scaling)'],
      monitoring_security: ['pulpity monitoringu w Grafanie i metryki Prometheus', 'centralny rejestr logów (ELK Stack / Loki)', 'certyfikaty SSL/TLS, firewalle sieciowe i polityki IAM'],
      it_helpdesk_lan: ['serwery Linux Debian/Ubuntu oraz Windows Server', 'strukturę Active Directory i zasady grup GPO', 'urządzenia sieciowe Cisco / MikroTik i tunele VPN WireGuard/IPsec'],
    },
    outcomes: {
      ci_cd_pipelines: [
        'skracając czas wdrożenia wersji na produkcję (Deployment Lead Time)',
        'uwzględniając dostępność usług podczas aktualizacji',
      ],
      cloud_infrastructure: [
        'obniżając miesięczne koszty infrastruktury chmurowej (FinOps)',
        'monitorując dostępność usług na podstawie rzeczywistych pomiarów',
      ],
      default: [
        'stosując ustalone procedury bezpieczeństwa i odtwarzania usług',
      ],
    },
    defaultTech: {
      ci_cd_pipelines: ['Docker', 'Kubernetes (K8s)', 'GitHub Actions', 'Helm', 'ArgoCD'],
      cloud_infrastructure: ['AWS', 'Google Cloud Platform (GCP)', 'Terraform', 'Linux'],
      monitoring_security: ['Prometheus', 'Grafana', 'ELK Stack / Loki', 'Vault'],
      default: ['Docker', 'Kubernetes', 'Linux', 'Terraform', 'CI/CD'],
    },
  },

  project_management: {
    roleId: 'project_management',
    label: 'Kierownik Projektu / Scrum Master / Koordynator',
    category: 'Zarządzanie & Projekty',
    description: 'Zarządzanie projektami, budżetem, harmonogramem, prowadzenie zespołów w Agile/Scrum i relacje ze sponsorami.',
    aliases: ['project manager', 'kierownik projektu', 'scrum master', 'product owner', 'agile', 'jira', 'zarządzanie', 'koordynator projektu', 'pm'],
    areas: [
      { id: 'project_delivery', label: 'Harmonogramowanie & Realizacja Projektów', description: 'Kamienie milowe, budżet, alokacja zasobów i zarządzanie zakresem' },
      { id: 'agile_scrum', label: 'Prowadzenie Zespołu w Metodykach Agile / Scrum', description: 'Sprint planning, daily, retrospektywy i usuwanie przeszkód' },
      { id: 'stakeholder_mgmt', label: 'Komunikacja ze Sponsorami & Raportowanie', description: 'Zarządzanie oczekiwaniami, statusy projektowe i wskaźniki KPI' },
      { id: 'risk_quality', label: 'Zarządzanie Ryzykiem & Odbiory Projektowe', description: 'Identyfikacja ryzyk, plany mitygacji i weryfikacja jakościowa' },
    ],
    actions: {
      project_delivery: ['zarządzałem projektami', 'koordynowałem harmonogram', 'kontrolowałem budżet', 'nadzorowałem etapy realizacji'],
      agile_scrum: ['facylitowałem ceremonie Scrum', 'usuwałem przeszkody zespołowe', 'współtworzyłem backlog', 'optymalizowałem Velocity'],
      stakeholder_mgmt: ['raportowałem postępy sponsorom', 'zarządzałem oczekiwaniami interesariuszy', 'prowadziłem warsztaty projektowe'],
      risk_quality: ['identyfikowałem ryzyka projektowe', 'wdrażałem plany mitygacji', 'prowadziłem odbiory końcowe', 'dbałem o jakość deliverables'],
    },
    objects: {
      project_delivery: ['złożone projekty biznesowe i technologiczne', 'harmonogramy prac (Gantt) i budżety projektowe', 'zespoły wielodyscyplinarne i podwykonawców'],
      agile_scrum: ['ceremonie zwinne (Sprint Planning, Daily, Review, Retro)', 'tablice Jira / ClickUp i estymacje zadań (Story Points)', 'efektywność i przepustowość zespołu (Velocity & Burndown Chart)'],
      stakeholder_mgmt: ['raporty statusowe dla zarządu i komitetów sterujących', 'wymagania biznesowe i kryteria akceptacji (Definition of Done)'],
      risk_quality: ['rejestry ryzyk projektowych i plany awaryjne', 'odbiory etapowe i dokumentację powdrożeniową'],
    },
    outcomes: {
      project_delivery: [
        'dostarczając projekt w terminie, w ramach założonego budżetu i zakresu (On Time, On Budget)',
        'optymalizując wykorzystanie zasobów zespołu',
      ],
      agile_scrum: [
        'zwiększając przewidywalność dostarczania wartości przez zespół w kolejnych sprintach',
        'skracając Time-to-Market dla kluczowych funkcjonalności',
      ],
      default: [
        'zgodnie ze standardami PMI / PRINCE2 / Scrum Guide',
      ],
    },
    defaultTech: {
      project_delivery: ['Jira Software', 'ClickUp / Asana', 'MS Project', 'Miro / Confluence'],
      default: ['Jira / Confluence', 'Metodyki Agile / Scrum', 'Budżetowanie i harmonogramowanie', 'Miro'],
    },
  },

  general_role: {
    roleId: 'general_role',
    label: 'Specjalista / Koordynator Biurowy / Administracja',
    category: 'Administracja & Biuro',
    description: 'Koordynacja procesów, obieg dokumentów, analiza danych, wsparcie operacyjne i komunikacja biznesowa.',
    aliases: ['specjalista', 'koordynator', 'asystent', 'administracja', 'biuro', 'office manager', 'referent', 'sekretariat'],
    areas: [
      { id: 'operations', label: 'Operacje & Koordynacja Biura', description: 'Płynny obieg dokumentów, procedury firmowe i organizacja pracy' },
      { id: 'analysis', label: 'Analiza Danych & Raportowanie KPI', description: 'Zestawienia tabelaryczne, arkusze kalkulacyjne i prezentacje' },
      { id: 'clients', label: 'Obsługa Klienta B2B & Korespondencja', description: 'Prowadzenie bieżącej korespondencji, umawianie spotkań i obsługa zapytań' },
      { id: 'projects', label: 'Wdrożenia & Wsparcie Projektowe', description: 'Organizacja wydarzeń, rozliczanie wydatków i asysta przy projektach' },
    ],
    actions: {
      operations: ['koordynowałem', 'optymalizowałem', 'nadzorowałem', 'organizowałem', 'usprawniałem'],
      analysis: ['analizowałem', 'tworzyłem raporty', 'weryfikowałem dane', 'przygotowywałem zestawienia'],
      clients: ['prowadziłem korespondencję', 'budowałem relacje', 'obsługiwałem zapytania', 'uzgadniałem terminy'],
      projects: ['wspierałem realizację projektów', 'rozliczałem koszty', 'organizowałem wydarzenia', 'przygotowywałem materiały'],
    },
    objects: {
      operations: ['obieg dokumentów i korespondencji firmowej', 'harmonogramy prac i spotkań zarządu', 'procedury biurowe i zaopatrzenie stanowisk'],
      analysis: ['raporty wskaźnikowe KPI i zestawienia w Excelu', 'bazy danych kontrahentów i ewidencje', 'prezentacje biznesowe i analizy kosztowe'],
      clients: ['zapytania ofertowe i korespondencję handlową B2B', 'kontakty z partnerami biznesowymi i urzędami'],
      projects: ['projekty wewnętrzne i eventy firmowe', 'rozliczenia wydatków i delegacji służbowych', 'materiały szkoleniowe i informacyjne'],
    },
    outcomes: {
      operations: [
        'usprawniając obieg dokumentów i skracając czas realizacji spraw formalnych',
        'prowadząc dokumentację i koordynując bieżące procesy biurowe',
      ],
      analysis: [
        'dostarczając kadrze zarządzającej przejrzystych analiz do podejmowania decyzji',
      ],
      default: [
        'z dbałością o dokładność, terminowość i wysokie standardy poufności RODO',
      ],
    },
    defaultTech: {
      analysis: ['MS Excel (Tabele przestawne, XLOOKUP)', 'Google Sheets', 'PowerPoint / Canva'],
      operations: ['Systemy CRM / ERP', 'Google Workspace / MS 365', 'Elektroniczny obieg dokumentów'],
      default: ['MS Office (Excel, Word, PowerPoint)', 'Google Workspace', 'Systemy CRM/ERP'],
    },
  },
};

import { getGlobalOccupationalGraphDB } from '../occupationalGraph';

/**
 * Zwraca listę wszystkich zarejestrowanych profesji w grafie wiedzy (statyczne + OccupationalGraphDB).
 */
export function getAllRoleKnowledgeNodes(): RoleKnowledgeNode[] {
  const staticNodes = Object.values(ROLE_GRAPH);
  const db = getGlobalOccupationalGraphDB();
  const dbNodes = db.getAllProfessions().map((p) => db.toRoleKnowledgeNode(p));

  // Scalanie wg roleId
  const nodeMap = new Map<string, RoleKnowledgeNode>();
  for (const node of staticNodes) {
    nodeMap.set(node.roleId, node);
  }
  for (const node of dbNodes) {
    if (!nodeMap.has(node.roleId)) {
      nodeMap.set(node.roleId, node);
    }
  }

  return Array.from(nodeMap.values());
}

/**
 * Zwraca profesje pogrupowane wg branż/kategorii.
 */
export function getRoleKnowledgeNodesByCategory(): Record<string, RoleKnowledgeNode[]> {
  const grouped: Record<string, RoleKnowledgeNode[]> = {};
  for (const node of getAllRoleKnowledgeNodes()) {
    const cat = node.category || 'Inne';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(node);
  }
  return grouped;
}

/**
 * Wybiera najlepszy węzeł grafu stanowiska na podstawie tytułu roli.
 */
export function resolveRoleKnowledgeNode(roleTitle: string): RoleKnowledgeNode {
  if (!roleTitle || typeof roleTitle !== 'string') {
    return ROLE_GRAPH.general_role;
  }
  const norm = roleTitle.toLowerCase().trim();

  // 1. Magazynier / Operator Wózka / WMS (przed spawaczem, aby uniknąć kolizji z 'mag')
  if (/(magazyn|wózek|wozek|widłow|widlow|\budt\b|\bwms\b|order picker|kompletator|pakowacz|\bpicker\b|magazynier-kierowca)/i.test(norm)) {
    return ROLE_GRAPH.warehouse_logistics;
  }

  // 2. Spawacz / Ślusarz
  if (/(spawacz|ślusarz|slusarz|\btig\b|\bmag\b|\bmig\b|\b141\b|\b135\b|zgrzewacz|spawani)/i.test(norm)) {
    return ROLE_GRAPH.welder_fitter;
  }

  // 3. Monter / Instalator HVAC / Sanitarny / OZE
  if (/(monter|instalator|hvac|klimatyz|\bpiec(?:yk|a|e|ów)?\b|kocioł|kociol|pompa ciepła|pompy ciepła|hydraulik|gazow|ciepłown)/i.test(norm)) {
    return ROLE_GRAPH.trades_technician;
  }

  // 4. Elektryk / Automatyk / SEP
  if (/(elektryk|elektromonter|automatyk|\bsep\b|pomiary elektrycz|rozdzielnic|falownik|\bplc\b|\bs7\b|szafy sterownicze)/i.test(norm)) {
    return ROLE_GRAPH.electrician_automation;
  }

  // 5. Kierowca / Transport / Spedycja
  if (/(kierowca|c\+e|c\s*\+\s*e|kierowca zawodowy|\btir\b|spedytor|spedycj|transport|kurier|dostawca)/i.test(norm)) {
    return ROLE_GRAPH.driver_transport;
  }

  // 6. Mechanik / Diagnosta / Samochodowy
  if (/(mechanik|diagnosta|samochodow|motoryzac|elektromechanik|warsztat|wulkanizator|blacharz|lakiernik)/i.test(norm)) {
    return ROLE_GRAPH.automotive_mechanic;
  }

  // 7. Budownictwo / Glazurnik / Wykończeniowiec
  if (/(budowl|glazurnik|płytkarz|plytkarz|wykończeni|wykonczeni|gipsiarz|malarz|szpachlarz|cieśla|ciesla|murarz|zbrojarz|brukarz|kopark|maszyn budowl)/i.test(norm)) {
    return ROLE_GRAPH.construction_finishing;
  }

  // 8. CNC / Obróbka skrawaniem / Produkcja
  if (/(\bcnc\b|tokarz|frezarz|operator maszyn|skrawani|g-code|sinumerik|fanuc|heidenhain|ustawiacz)/i.test(norm)) {
    return ROLE_GRAPH.cnc_production;
  }

  // 9. Księgowość / Finanse / Kadry
  if (/(księgow|ksiegow|finans|kadry|płace|place|rachunkow|audytor|fakturzyst|płatnik|platnik|controlling)/i.test(norm)) {
    return ROLE_GRAPH.finance_accounting;
  }

  // 10. Sprzedaż B2B / Handlowiec
  if (/(handlowiec|sprzedaw|\bb2b\b|\bkam\b|key account|sales|przedstawiciel|doradca klienta biznes|merchandiser)/i.test(norm)) {
    return ROLE_GRAPH.sales_b2b;
  }

  // 11. Obsługa klienta / Call Center
  if (/(obsług|obslug|klient|call center|contact center|reklamac|konsultant|helpdesk|support)/i.test(norm)) {
    return ROLE_GRAPH.customer_service;
  }

  // 12. Medycyna / Zdrowie / Pielęgniarka
  if (/(pielęg|pieleg|ratownik|medyc|lekarz|doktor|farmaceut|fizjoterap|stomatolog|opiekun medycz|rehabilitant)/i.test(norm)) {
    return ROLE_GRAPH.medical_healthcare;
  }

  // 13. DevOps / Administrator sieci / Cloud
  if (/(devops|sysadmin|administrator|cloud|aws|azure|gcp|kubernetes|k8s|docker|terraform|sieciow|infrastruktur)/i.test(norm)) {
    return ROLE_GRAPH.devops_sysadmin;
  }

  // 14. Programista / Software Engineer
  if (/(programi|develop|software|frontend|backend|fullstack|java|python|react|node|typescript|c#|\.net|php|\bqa\b|tester|architekt)/i.test(norm)) {
    return ROLE_GRAPH.software_engineer;
  }

  // 15. Zarządzanie / Project Management
  if (/(project manager|kierownik|manager|scrum|product owner|agile|koordynator projekt|lider|dyrektor|\bpm\b)/i.test(norm)) {
    return ROLE_GRAPH.project_management;
  }

  // 16. Wyszukiwanie w OccupationalGraphDB (np. Kominiarz, Piekarz, Stolarz, itd.)
  const db = getGlobalOccupationalGraphDB();
  const dbMatches = db.search(norm, 1);
  if (dbMatches.length > 0 && dbMatches[0].score >= 8) {
    return db.toRoleKnowledgeNode(dbMatches[0].profession);
  }

  // 17. Ogólne / Domyślne
  return ROLE_GRAPH.general_role;
}
