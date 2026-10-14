# Korpus regresji czyszczenia ofert

Zamrożone istniejące wklejki z portali używane przez testy parsera.
Profile kandydatów są syntetyczne; korpus zawiera publiczne treści ofert, szum portali i znaczniki z narzędzi przeglądarkowych. Kompresja gzip nie zmienia bajtów danych. Testy nie wymagają katalogów prywatnego komputera ani dostępu do sieci.

| Plik źródłowy | Bajty źródłowe | Bajty gzip | SHA-256 danych po rozpakowaniu |
| --- | ---: | ---: | --- |
| kierivo_dirty_job_offers_300.md | 2823057 | 354930 | `5703e748c73f02f1c376b1a6c1c9e58915673f0cf1d459ecf386b9944a926b5f` |
| kierivo_chrome_raw_job_pages.md | 142320 | 42008 | `1c55c0ebd5fe288f9f31fd8b213d032f6300bd0030c02461d6d190626ebd7415` |
| kierivo_pracuj_round_2.md | 49886 | 15296 | `e772396b91a783f83b93a2e0c5f32925ee837bd3e142b4299d3d86429623a4b0` |
| kierivo_pracuj_round_3.md | 40476 | 12411 | `63c1dfbd11e901b0f7475d32bc7564faba6e2257acc3c14d8039864b65637e6e` |
| kierivo_dirty_clipboard_batch_20260930.md | 25093287 | 6625127 | `d0c70d1927884c699319ee5479fea2ca32bab71a48a64d34e2b73bf515bfa01d` |
| test_praktyczny1.md | 210289 | 48976 | `3c0492c8789223ea349b43fa549b0b7e63acc240886b34293334ac7a6e3521f5` |

## Zweryfikowane pokrycie — 14.10.2026

Wszystkie sześć sum SHA-256 powyżej ponownie potwierdzono bez zmiany wklejek.
Liczby fragmentów nie oznaczają liczby unikalnych, kompletnych ofert:

- Aplikuj: 300 fragmentów `Oferta`; wstęp pliku nie jest 301. ofertą.
- Duży schowek: 2985 fragmentów `Clipboard`, 126 różnych treści po pominięciu
  wyłącznie nagłówka numerującego kopię. Test bada wszystkie 126 treści,
  zamiast ucinać listę do pierwszych 300 fragmentów.
- Surowe zrzuty Chrome: 14 fragmentów; Pracuj rundy 2/3: 7/6 fragmentów.
- `test_praktyczny1`: dokładnie 33 sekcje. Istniejące sprawdzenia tytułu,
  firmy, lokalizacji, obcych ofert i dopasowania pozostają. Dodatkowo pełny
  potok przygotowania ofert 2 i 16 musi zachować prawo jazdy C oraz UDT suwnice;
  kandydat z uprawnieniem spełnia regułę, a profil z jawną negacją jej nie spełnia.

Czyszczenie HTML/szumu, zachowanie tekstu, interpretacja wymagań oraz poprawność
dopasowania to osobne kontrole. Brak szumu nie dowodzi kompletnego odczytu
każdej oferty. Powtórzenia nie zwiększają deklarowanego pokrycia.
