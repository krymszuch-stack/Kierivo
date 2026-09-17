# ═══════════════════════════════════════════════════════════════════
# KIERIVO: ARCHITEKTURA WERSJONOWANIA & EXPORT ENGINE (6 FILARÓW)
# ═══════════════════════════════════════════════════════════════════

## 1. EDYCJA POPRZEZ "WARSTWY" (LAYERED EDITING)
* **Baza faktów (MasterVault):** Fakt źródłowy jest NIEZMIENNY (Prawda Źródłowa).
* **Sformułowanie per-oferta:** Reframing pod dany wakat jest edytowalny per-oferta.
* **Awansowanie poprawki:** Gdy użytkownik ręcznie zmienia sformułowanie, system zapytuje:
  > *"Czy to poprawka tylko dla tej oferty (EC Engineering), czy chcesz zaktualizować bazowy fakt w MasterVault na stałe?"*

## 2. DIFF & HISTORIA ZMIAN PER CV
* Wyraźne oznaczenie kolorystyczne w interfejsie:
  - **Fakt źródłowy:** szare tło / badge "Źródło Vault"
  - **Automatyczny reframing AI:** fioletowe tło / badge "Reframing AI"
  - **Ręczna edycja użytkownika:** niebieskie tło / badge "Poprawka Użytkownika"

## 3. EKSPORT — KOLEJNOŚĆ WAŻNOŚCI
1. **PDF (Priorytet #1):** Jednolity wektorowy wygląd wszędzie.
2. **DOCX (Priorytet #2):** Format pod parsery ATS nieradzące sobie z PDF.
3. **Zwykły TXT (Plain Text):** Czysta treść bez formatowania dla formularzy korporacyjnych z polem *"Wklej treść CV"*.
4. **LinkedIn-Ready Format:** Skrócony eksport dopasowany pod limity znaków i sekcje profilu LinkedIn.

## 4. WERSJONOWANIE PER-OFERTA (APPLICATION HISTORY)
* Trzymanie historii wysłanych aplikacji zamiast osobnych plików nadrzędnych:
  - *"CV wysłane do EC Engineering — 19 lipca"*
  - *"CV wysłane do KRUK S.A. — 30 lipca"*
* Możliwość natychmiastowego sprawdzenia w historii: *"Co dokładnie wysłałem tej firmie?"* podczas rozmowy kwalifikacyjnej.

## 5. TRYB "PORÓWNAJ Z ORYGINAŁEM" (SIDE-BY-SIDE COMPARE)
* Widok porównawczy w czasie rzeczywistym:
  - **Lewa kolumna:** Bazowy fakt z MasterVault
  - **Prawa kolumna:** Zreframowana wersja dla oferty + wykryty tryb (A / B / C)
* Kontrola jakości przed nadmiernym "podkoloryzowaniem".

## 6. WALIDACJA PRZED EKSPORTEM (PRE-FLIGHT CHECKLIST UI)
* Widoczny raport dla użytkownika przed pobraniem pliku:
  - `✓ Wszystkie umiejętności potwierdzone w MasterVault (0-Halucynacji)`
  - `✓ Twarde wymagania i test dealbreakera zaliczony`
  - `✓ Liczby i wskaźniki podane cyfrowo (np. 4,40/5, 100%)`
  - `✓ Mieści się na 1 stronie (Układ jednokolumnowy ATS)`
  - `✓ Zgodność języka dokumentu z ofertą`

## 7. ZASADA 2-MONTH AUTO-DESTRUCT RULE (TTL DATA PURGE POLICY) [PLAN DO WDROŻENIA]
* **Cel:** Automatyczne usuwanie tymczasowych migawek i historii zgłoszeń z serwera po 60 dniach.
* **Architektura:**
  - Prawda Źródłowa MasterVault pozostaje u użytkownika (Local-First w przeglądarce/na urządzeniu).
  - Migawki i kopie na serwerze otrzymują kolumnę `expires_at = now() + interval '60 days'`.
  - Kasowanie realizuje zadanie `pg_cron` w Postgresie Supabase, uruchamiane raz na dobę:
    `delete from snapshots where expires_at < now()`.
  - Aktywność użytkownika (nowa aplikacja / zalogowanie) przesuwa `expires_at` o kolejne 60 dni.
* **Uwaga o wcześniejszej wersji tego zapisu:** planowano tu natywną politykę TTL
  Cloud Firestore. Projekt korzysta z Supabase (Postgres), nie z Firestore —
  patrz [`docs/SETUP.md`](./docs/SETUP.md) §2 i [`docs/BACKEND-ROADMAP.md`](./docs/BACKEND-ROADMAP.md).
  Utrzymywanie w dokumentacji architektury opartej na usłudze, której nie używamy,
  kończy się planowaniem pracy, której nie da się wykonać.
* **Zaleta RODO/Bezpieczeństwa:** Zgodność z RODO Art. 5 (ograniczenie przechowywania)
  i zerowy dług wycieku danych po 60 dniach.
