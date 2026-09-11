# Odbiór D06 — Public Pre-Beta PB-2026.09

Data: 2026-09-11

## Zakres

D06 nadaje publicznej wersji CVelocity jednoznaczny status przedpremierowy oraz poprawia widoczność Doradcy regułowego.

- globalne oznaczenie `Public Pre-Beta · PB-2026.09 · Otwarte testy · premiera wkrótce · 0 zł`;
- landing wyjaśnia, że produkt można publicznie testować przed właściwą premierą;
- Doradca regułowy jest w głównej grupie narzędzi, a nie ukryty przy stopce sidebara;
- gotowe CV nie dostaje obowiązkowego watermarku wersji testowej;
- README i NOTATKI używają tego samego nazewnictwa;
- browser acceptance sprawdza sens przepływu zamiast kruchych literalnych nazw CTA.

## Odbiór techniczny

Head PR #113: `1576575027d459b0d5ecc767d5f6197ad591b5cf`.

Na tym samym headzie zakończyły się sukcesem:

- CVELOCITY CI, run `34580650902`;
- D05 BETA SCOPE / browser acceptance, run `34580651067`;
- D04 AUTH + RLS, run `34580650922`.

Testy jednostkowe D06 obejmują kontrakt `Public Pre-Beta`, kod `PB-2026.09`, globalną widoczność wersji i obecność Doradcy regułowego w głównych narzędziach.

## Decyzja

D06 spełnia kryteria odbioru i może zostać scalone do `main`. Po merge należy potwierdzić produkcyjny deploy Firebase Hosting.
