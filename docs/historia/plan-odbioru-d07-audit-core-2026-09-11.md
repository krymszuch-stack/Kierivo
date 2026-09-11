# Plan odbioru D07 — Audit Core 1.0

Data: 2026-09-11

D07 jest fundamentem matematycznym i architektonicznym dla D08–D17. Sam dokument specyfikacji nie kończy D07. Etap zostaje odebrany dopiero po implementacji kontraktów, matematycznych gates, zielonym CI i potwierdzeniu kompatybilności pierwszego modułu D08.

## Bramy odbioru

- [x] canonical contracts w TypeScript;
- [x] pure core bez bezpośredniego importu raw Vault/CV/JD;
- [x] Evidence Graph + MissingEvidence;
- [x] provenance bez fałszywego `GROUND_TRUTH` dla danych deklaratywnych użytkownika;
- [x] MonthIndex + jawny referenceMonth;
- [x] applicability: rozdzielone N/A i insufficient data;
- [x] confidence v2: coverage/provenance/extraction/effective independent sample;
- [x] correlationKey chroniący `n_eff` przed liczeniem duplikatów jak nowych dowodów;
- [x] penalty anti-double-dipping przez defect fingerprint i centralny budget;
- [x] hard caps MODULE/DOMAIN/GLOBAL;
- [x] SignalOwnershipMap z jednym primary ownerem per family;
- [x] domenowy consensus i benchmark `p ∈ {-1,-0.5,0,0.5,1}`;
- [x] global consensus z polityką wymaganych domen;
- [x] kanoniczny Score Ledger + runtime verifier;
- [x] deterministyczny Audit Integrity Signature;
- [x] Zod config z `configVersion` i `calibrationRequired: true`;
- [x] wersjonowany JSON golden corpus z 34+ archetypami;
- [x] calibration drift engine + stop-the-line gate;
- [x] baseline drift report bez udawania empirycznej kalibracji;
- [x] mapa `signal → legacy engine → UI → canonical source of truth`;
- [x] focused testy D07: bounds/logika applicability/confidence/penalties/ledger/ownership/aggregation/signature/corpus/drift;
- [x] dedykowany workflow `D07 AUDIT CORE`;
- [ ] finalny head D07: focused CI zielone po ostatniej zmianie dokumentacji;
- [ ] finalny head D07: pełny `CVELOCITY CI` zielony po ostatniej zmianie dokumentacji;
- [ ] D08 przepięte na canonical contracts D07 bez alternatywnego confidence/ledger/penalty engine.

## Zaimplementowane źródła prawdy

Canonical API znajduje się w `src/lib/audit-core/`:

```text
contracts.ts
applicability.ts
confidence.ts
evidence.ts
hash.ts
temporal.ts
penalties.ts
hardCaps.ts
ledger.ts
ownership.ts
aggregation.ts
signature.ts
config.ts
corpus.ts + corpus/golden-v2.json
drift.ts
index.ts
```

Dokument mapujący stare źródła wyniku:

`docs/audit-core/D07_SIGNAL_SOURCE_MAP.md`

Legacy `simulateMultiEngineATS` i `buildAtsTelemetryReport` nie są canonical source of truth. Po odbiorze kolejnych DXX ich score ma być zastępowane modułami Audit Core, a użyteczne dane mogą pozostać wyłącznie jako jawne extractors/diagnostics.

## Kolejność odbioru

1. Final Spec v2 review — wykonane.
2. Implementacja D07 core bez strojenia produkcyjnych D08–D17 — wykonane.
3. Golden corpus + matematyczne gates — wykonane jako kontrakt/baseline.
4. Finalne CI D07 na ostatnim headzie.
5. Merge D07 do `main`.
6. Retarget D08 do `main` i migracja na canonical D07.
7. Po zielonym D08 compatibility gate można formalnie zamknąć ADR-110.

## Zasada odbioru

D07 nie jest „skalibrowane empirycznie”. D07 jest odebrane wtedy, gdy fundament jest deterministyczny, audytowalny i wymusza późniejszą kalibrację zamiast ją udawać.

Parametry takie jak provenance priors, confidence weights, domain weights, wybór agregatora, hard-cap limits i progi interpretacyjne pozostają `CALIBRATION_REQUIRED` do czasu właściwej walidacji na corpus i zanonimizowanych realnych dokumentach.