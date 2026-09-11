# D03 — dowód odbioru zapisu CV i importu

Data odbioru: 2026-09-11  
Zakres: D03 · Fundament · zabezpieczenie zapisu CV i importu  
Powiązany PR: #110 — `D03: zabezpiecz zapis CV i import`  
Gałąź odbiorowa: `d03-vault-persistence`

## Kryterium „gotowe gdy”

D03 uznajemy za odebrane po spełnieniu wszystkich trzech warunków:

1. Ostatnia wersja CV nie ginie przy awarii, braku sieci, ponownym otwarciu ani wylogowaniu.
2. Retry jest rzeczywisty, zachowuje kolejność i nie miesza danych między profilami.
3. Import nie usuwa wcześniej zapisanych języków i nie tworzy duplikatów tego samego języka.

## Dowód 1 — awaria, retry i kolejność zapisów

Mechanizm trwałego outboxu znajduje się w:

- `src/lib/cloudVaultOutbox.ts`
- `src/lib/cloudVaultKeys.ts`
- `src/lib/cloudVault.ts`
- `src/context/AuthContext.tsx`
- `src/hooks/useDeferredPersist.ts`

Najpierw utrwalana jest owner-scoped wersja lokalna. Dopiero potwierdzona odpowiedź zapisu do chmury usuwa wpis z outboxu. Brak potwierdzenia pozostawia stan `pending`.

Wysyłki są serializowane per `ownerId`. Gdy zapis A jest w locie, a powstaje nowszy zapis B, potwierdzenie A nie może usunąć B. `saveCloudVault` dodatkowo sprawdza `expectedOwnerId`, więc zapis rozpoczęty dla profilu A nie może po zmianie sesji trafić do profilu B.

Automatyczny dowód regresyjny:

- `src/lib/__tests__/cloudVaultOutbox.test.ts`
  - błąd wysyłki → trwały `pending` → ponowienie → ACK → usunięcie outboxu,
  - szybkie A/B z opóźnionym potwierdzeniem A,
  - izolacja oczekujących danych między właścicielami,
  - odtworzenie oczekującej wersji po ponownym otwarciu.

## Dowód 2 — scenariusz ponownego otwarcia

Scenariusz zapisany i pokryty testem:

1. Użytkownik A ma aktywne konto chmurowe.
2. A edytuje CV.
3. Zapis do chmury nie otrzymuje potwierdzenia, np. z powodu utraty sieci.
4. Najnowsza wersja zostaje w trwałym outboxie przypisanym do `ownerId` użytkownika A.
5. A wylogowuje się albo aplikacja zostaje zamknięta.
6. Zwykła lokalna kopia profilu chmurowego nie jest używana do ujawniania danych po wylogowaniu; oczekujący zapis pozostaje wyłącznie pod kluczem właściciela.
7. Profil B nie widzi ani nie wysyła outboxu profilu A.
8. Po ponownym zalogowaniu A `fetchCloudVault()` uwzględnia jego własny pending jako najnowszą warstwę lokalną.
9. Po odzyskaniu połączenia retry wysyła tę wersję do chmury.
10. Outbox znika dopiero po potwierdzonym zapisie.

Test trwałości po „ponownym otwarciu” usuwa pamięciowy cache, zachowując `localStorage`, a następnie potwierdza odtworzenie pendingu właściciela.

## Dowód 3 — import języków

Naprawa znajduje się w `src/lib/vaultImportMerge.ts`.

Automatyczny dowód regresyjny:

- `src/lib/__tests__/vaultImportLanguages.test.ts`
  - import z `languages: []` zachowuje wcześniejsze języki,
  - ponowny język z inną wielkością liter lub spacjami nie tworzy duplikatu,
  - istniejący rekord pozostaje rekordem bazowym, a nowy, faktycznie inny język jest dokładany.

## Snapshoty zapisanych aplikacji

Istniejący `src/lib/__tests__/applicationSnapshot.test.ts` pozostaje dowodem, że późniejsza zmiana profilu/Master Vaultu nie mutuje snapshotu już zapisanej aplikacji. D03 nie zmienia tej własności.

## Wynik automatycznego odbioru

GitHub Actions, workflow `CVELOCITY CI`, run #228 dla commita `eb0ed548a6dbe40d43ba5341639515e72714e6f6` zakończył się powodzeniem.

Zielone bramki:

- Type Check,
- Unit Tests,
- Build Client and Server,
- Production Boot Smoke Test,
- Auth Boundary Smoke Test,
- bramka otwartych błędów klienta,
- kontrola sekretów w bundlu,
- Build Container Image.

Run: `https://github.com/krymszuch-stack/cvelocity/actions/runs/34571208305`

## Status odbioru

**D03: ODEBRANE na poziomie logiki, testów regresyjnych i CI.**

Potwierdzone:

- ostatnia wersja nie ginie przy awarii/wylogowaniu,
- retry jest trwały i zachowuje kolejność,
- dane oczekujące są związane z właścicielem i nie przechodzą między profilami,
- import zachowuje języki i deduplikuje powtórzenia,
- scenariusz ponownego otwarcia ma test regresyjny.

Pełny ręczny odbiór na rzeczywistym środowisku Supabase, obejmujący fizyczne offline → online i kontrolę wiersza `vaults`, pozostaje osobnym punktem D07. Nie jest wymagany do ponownego udowadniania logiki D03, ale stanowi odbiór integracyjny kanału zdalnego.
