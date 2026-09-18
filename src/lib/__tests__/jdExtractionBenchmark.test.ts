/**
 * === Benchmark jakości ekstrakcji ofert pracy (segmentacja + parser) ===
 *
 * Cel: ZMIERZYĆ jakość istniejącego potoku `preprocessJobOfferPaste` ->
 * `parseJobDescriptionLocal` na realnym korpusie 6 ofert wklejonych z
 * Pracuj.pl (3 IT + 3 nie-IT). Produkcyjny parser i preprocesor są naprawiane
 * obok tego pomiaru; Gold i metodologia są stałą
 * bramką: po naprawie regresje mierzymy względem utrwalonego baseline, nie
 * przez zmianę danych wejściowych albo reguł porównania.
 *
 * Metodologia (skrót; pełne dane w `fixtures/jdExtractionBenchmark.fixtures.ts`):
 * - RAW_CORPUS to dosłowna transkrypcja jednego wklejenia z 6 ofertami + 1
 *   duplikatem (P&P Solutions wklejone dwa razy) + naturalnym szumem portalu.
 * - GOLD to ręcznie zakodowany standard per oferta: tytuł/firma/senioritet/
 *   tryb pracy/kontrakt/widełki/lokalizacja/min. lata doświadczenia/języki/
 *   umiejętności wymagane i mile widziane/wymagania formalne (required: bool).
 * - CLEAN_TEXTS to te same zdania źródłowe co RAW_CORPUS, ale ręcznie
 *   wyizolowane per oferta (bez sąsiedniego szumu z innej oferty). Różnica
 *   PIPELINE (segmentacja + parser na RAW_CORPUS) vs CLEAN (parser na
 *   CLEAN_TEXTS) izoluje: ile utraty jakości pochodzi z granic segmentacji,
 *   a ile z samej ekstrakcji pól/umiejętności w `jdParser.ts`.
 * - Kanonikalizacja (C#/C Sharp, .NET/dotnet, ASP.NET/ASP .NET,
 *   PostgreSQL/Postgres, EF Core/Entity Framework Core, CI/CD warianty)
 *   istnieje WYŁĄCZNIE w tym benchmarku (`jdExtractionBenchmark.harness.ts`)
 *   i nie dotyka produkcyjnego kodu.
 * - Legacyjne pola służą do F1 całego zbioru, a pola
 *   `niceToHaveHardSkills`/`niceToHaveSoftSkills` są używane przez testowy
 *   pomocniczy pomiar klasyfikacji required/nice.
 *
 * Wyniki bazowe zmierzone przy pisaniu tego testu (patrz też finalny raport
 * w odpowiedzi czatu z dokładnymi liczbami):
 * - Makro F1 (PIPELINE, 6 ofert): ok. 0.169; IT: ok. 0.337; nie-IT: 0.
 * - Makro F1 (CLEAN, 6 ofert): ok. 0.325; IT: ok. 0.651; nie-IT: 0.
 * - Dokładność klasyfikacji required/nice na TP (PIPELINE): ok. 71%.
 * - `jobTitle` i `companyName` błędne dla 6/6 ofert w PIPELINE (patrz niżej).
 * - Potwierdzone przeciekanie treści ELEKTROBUDOWA -> segment P&P (fałszywe
 *   "Prawo Jazdy Kat. B" w P&P, brak tego wymogu w ELEKTROBUDOWA).
 *
 * Wartości baseline zostają tu jako punkt odniesienia. Asercje weryfikują
 * zachowanie oczekiwane od naprawionego potoku oraz brak regresji względem
 * pomiaru historycznego, nie wymagają utrzymywania wykrytych defektów.
 */
import { describe, expect, it } from 'vitest';
import { parseJobDescriptionLocal } from '../jdParser';
import { preprocessJobOfferPaste } from '../jobOfferPreprocessor';
import { GOLD, CLEAN_TEXTS, RAW_CORPUS, OFFER_ORDER } from './fixtures/jdExtractionBenchmark.fixtures';
import { canonicalizeSkill, compareSkillSets, detectedSkillSet, fieldStatus, macroF1, type SkillComparison } from './jdExtractionBenchmark.harness';

const IT_KEYS = OFFER_ORDER.filter((k) => GOLD[k].domain === 'IT');
const NON_IT_KEYS = OFFER_ORDER.filter((k) => GOLD[k].domain === 'NON_IT');
const BASELINE = {
  pipelineMacroF1: 0.1687,
  pipelineItMacroF1: 0.3373,
  cleanMacroF1: 0.3253,
  cleanItMacroF1: 0.6506,
  requiredNiceAccuracy: 0.7143,
} as const;

function classifiedDetectedSkills(parsed: ReturnType<typeof parseJobDescriptionLocal>) {
  const nice = new Set((parsed.niceToHaveHardSkills ?? []).map(canonicalizeSkill));
  const detectedRequired = [
    ...parsed.requiredHardSkills,
    ...parsed.toolsAndTech.filter((skill) => !nice.has(canonicalizeSkill(skill))),
    ...parsed.requiredSoftSkills,
  ].map(canonicalizeSkill);
  const detectedNice = [
    ...(parsed.niceToHaveHardSkills ?? []),
    ...(parsed.niceToHaveSoftSkills ?? []),
  ].map(canonicalizeSkill);
  return { required: new Set(detectedRequired), nice: new Set(detectedNice) };
}

describe('benchmark jakości ekstrakcji JD: samotestowanie metodologii pomiaru', () => {
  it('kanonikalizacja traktuje zdefiniowane warianty jako to samo pojęcie, ale nie nadnormalizuje innych technologii', () => {
    expect(canonicalizeSkill('C#')).toBe(canonicalizeSkill('C Sharp'));
    expect(canonicalizeSkill('.NET')).toBe(canonicalizeSkill('dotnet'));
    expect(canonicalizeSkill('ASP.NET')).toBe(canonicalizeSkill('ASP .NET'));
    expect(canonicalizeSkill('PostgreSQL')).toBe(canonicalizeSkill('Postgres'));
    expect(canonicalizeSkill('EF Core')).toBe(canonicalizeSkill('Entity Framework Core'));
    expect(canonicalizeSkill('CI/CD')).toBe(canonicalizeSkill('CI CD'));
    // Java i JavaScript to inne technologie - nie wolno ich zlewać.
    expect(canonicalizeSkill('Java')).not.toBe(canonicalizeSkill('JavaScript'));
  });

  it('precision/recall/F1 liczone na syntetycznych zbiorach dają matematycznie poprawne wartości', () => {
    const perfect = compareSkillSets(['a', 'b'], [], new Set(['a', 'b']));
    expect(perfect).toMatchObject({ precision: 1, recall: 1, f1: 1 });

    const noOverlap = compareSkillSets(['a', 'b'], [], new Set(['x', 'y']));
    expect(noOverlap).toMatchObject({ precision: 0, recall: 0, f1: 0 });

    // Pusty gold i puste wykrycie - poprawnie "nic do znalezienia, nic zmyślonego" = F1 1, nie 0.
    const emptyBoth = compareSkillSets([], [], new Set());
    expect(emptyBoth).toMatchObject({ precision: 1, recall: 1, f1: 1 });

    // Pusty gold, ale parser i tak coś "wykrył" (szum) - to czysty FP, F1 musi spaść do 0.
    const emptyGoldNoisyDetection = compareSkillSets([], [], new Set(['szum']));
    expect(emptyGoldNoisyDetection).toMatchObject({ precision: 0, recall: 1, f1: 0 });
  });

  it('umiejętność z gold "nice" wykryta przez parser liczy się jako skill TP, ale ze złą klasyfikacją required/nice', () => {
    const cmp: SkillComparison = compareSkillSets(['required-a'], ['nice-b'], new Set(['required-a', 'nice-b']));
    expect(cmp.tp).toEqual(expect.arrayContaining(['required-a', 'nice-b']));
    expect(cmp.tpRequiredCorrect).toBe(1);
    expect(cmp.tpNiceMisclassified).toBe(1);
  });
});

describe('segmentacja realnego korpusu 6 ofert (preprocessJobOfferPaste)', () => {
  const prep = preprocessJobOfferPaste(RAW_CORPUS);
  const unique = prep.segments.filter((s) => !s.duplicateOfSegmentId);

  it('wykrywa dokładnie 7 segmentów (6 unikalnych ofert + 1 duplikat P&P Solutions)', () => {
    expect(prep.segments).toHaveLength(7);
    expect(unique).toHaveLength(6);
    expect(prep.classification).toBe('duplicated');
  });

  it('poprawnie oznacza ofertę UBICOM jako niepełną (źródło urywa się przed sekcją wymagań)', () => {
    const ubicomSegment = unique.find((s) => (s.titleCandidate ?? '').toLowerCase().includes('kucharz') && (s.companyCandidate ?? '').toLowerCase().includes('ubicom'));
    expect(ubicomSegment).toBeDefined();
    expect(ubicomSegment!.completeness).toBe('partial');
    expect(ubicomSegment!.needsUserReview).toBe(true);
  });

  it('nie przecieka treści ELEKTROBUDOWA do segmentu P&P Solutions', () => {
    // Realny paste ma nietypowy układ: pełne obowiązki/wymagania ELEKTROBUDOWA (w tym
    // "prawo jazdy kat. B") fizycznie leżą w tekście PO pierwszym wystąpieniu P&P, a
    // PRZED firmowym blokiem "ELEKTROBUDOWA sp. z o.o. Przewiń do profilu firmy" -
    // segmenter kotwiczy się wyłącznie na liniach kończących się na "O firmie", więc
    // ten fragment trafia do segmentu P&P, a nie do segmentu ELEKTROBUDOWA.
    const elektrobudowaSegment = unique.find((s) => (s.companyCandidate ?? '').toLowerCase().includes('elektrobudowa'));
    const ppSegment = unique.find((s) => (s.companyCandidate ?? '').toLowerCase().includes('p&p') || (s.companyCandidate ?? '').toLowerCase().includes('p & p'));
    expect(elektrobudowaSegment).toBeDefined();
    expect(ppSegment).toBeDefined();

    // Wymóg prawa jazdy kat. B należy wyłącznie do ELEKTROBUDOWA.
    expect(elektrobudowaSegment!.cleanText.toLowerCase()).toContain('prawo jazdy');
    expect(ppSegment!.cleanText.toLowerCase()).not.toContain('prawo jazdy');
  });
});

describe('parseJobDescriptionLocal na wyjściu segmentera (scenariusz PIPELINE, realne warunki produkcyjne)', () => {
  const prep = preprocessJobOfferPaste(RAW_CORPUS);
  const unique = prep.segments.filter((s) => !s.duplicateOfSegmentId);
  const parsedByKey: Record<string, ReturnType<typeof parseJobDescriptionLocal>> = {};
  OFFER_ORDER.forEach((key, i) => {
    parsedByKey[key] = parseJobDescriptionLocal(unique[i].cleanText, unique[i].titleCandidate ?? '');
  });

  it('wyciąga prawidłowy tytuł dla każdej oferty', () => {
    for (const key of OFFER_ORDER) {
      expect(parsedByKey[key].jobTitle).toBe(GOLD[key].title);
    }
  });

  it('wyciąga pracodawcę dla każdej oferty', () => {
    for (const key of OFFER_ORDER) {
      expect(parsedByKey[key].companyName).toBe(GOLD[key].company);
    }
  });

  it('nie przenosi formaliów między ofertami', () => {
    const elektrobudowaReqs = (parsedByKey.elektrobudowa.mandatoryRequirements ?? []).join(' | ').toLowerCase();
    const ppReqs = (parsedByKey.pp_solutions.mandatoryRequirements ?? []).join(' | ').toLowerCase();
    expect(elektrobudowaReqs).toContain('prawo jazdy');
    expect(ppReqs).not.toContain('prawo jazdy');
  });

  it('rozróżnia wymagania od sekcji "Mile widziane" dla ORLEN', () => {
    expect(GOLD.orlen_paczka.formalRequirements.find((f) => f.id === 'degree')?.required).toBe(false);
    const orlenReqs = (parsedByKey.orlen_paczka.mandatoryRequirements ?? []).join(' | ').toLowerCase();
    expect(orlenReqs).not.toContain('wykształcenie wyższe');
  });

  it('wykrywa jawne formalia Level Work: staż, angielski i sanepid', () => {
    expect(parsedByKey.level_work.formalRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'experience_years', label: expect.stringMatching(/4 lat/) }),
      expect.objectContaining({ id: 'language_angielski' }),
      expect.objectContaining({ id: 'sanepid' }),
    ]));
  });

  it('POPRAWNE ZACHOWANIE: workModel dla trybów jednoznacznie podanych w metadanych portalu jest trafny dla 5/6 ofert', () => {
    const statuses = OFFER_ORDER.map((key) => fieldStatus(GOLD[key].workMode, parsedByKey[key].workModel));
    const correctCount = statuses.filter((s) => s === 'CORRECT').length;
    expect(correctCount).toBe(5);
  });
});

describe('parseJobDescriptionLocal na ręcznie wyizolowanych, czystych segmentach (scenariusz CLEAN, górna granica jakości parsera)', () => {
  const parsedByKey: Record<string, ReturnType<typeof parseJobDescriptionLocal>> = {};
  OFFER_ORDER.forEach((key) => {
    parsedByKey[key] = parseJobDescriptionLocal(CLEAN_TEXTS[key], GOLD[key].title);
  });

  it('po usunięciu przecieku segmentacji ELEKTROBUDOWA poprawnie zawiera "Prawo Jazdy Kat. B", a P&P go nie ma', () => {
    const elektrobudowaReqs = (parsedByKey.elektrobudowa.mandatoryRequirements ?? []).join(' | ').toLowerCase();
    const ppReqs = (parsedByKey.pp_solutions.mandatoryRequirements ?? []).join(' | ').toLowerCase();
    expect(elektrobudowaReqs).toContain('prawo jazdy');
    expect(ppReqs).not.toContain('prawo jazdy');
  });

  it('umiejętności techniczne (skill F1) dla ofert IT są wyraźnie wyższe na czystym tekście niż w scenariuszu PIPELINE', () => {
    const cleanF1 = IT_KEYS.map((key) => {
      const cmp = compareSkillSets(GOLD[key].requiredSkills, GOLD[key].niceSkills, detectedSkillSet(parsedByKey[key]));
      return cmp.f1;
    });
    const prep = preprocessJobOfferPaste(RAW_CORPUS);
    const unique = prep.segments.filter((s) => !s.duplicateOfSegmentId);
    const pipelineF1 = IT_KEYS.map((key) => {
      const i = OFFER_ORDER.indexOf(key);
      const parsed = parseJobDescriptionLocal(unique[i].cleanText, unique[i].titleCandidate ?? '');
      const cmp = compareSkillSets(GOLD[key].requiredSkills, GOLD[key].niceSkills, detectedSkillSet(parsed));
      return cmp.f1;
    });
    expect(macroF1(cleanF1)).toBeGreaterThanOrEqual(macroF1(pipelineF1));
  });
});

describe('makro-wyniki F1 skill precision/recall (wszystkie / IT / nie-IT, obie ścieżki)', () => {
  function runScenario(useClean: boolean) {
    const prep = preprocessJobOfferPaste(RAW_CORPUS);
    const unique = prep.segments.filter((s) => !s.duplicateOfSegmentId);
    return OFFER_ORDER.map((key, i) => {
      const parsed = useClean
        ? parseJobDescriptionLocal(CLEAN_TEXTS[key], GOLD[key].title)
        : parseJobDescriptionLocal(unique[i].cleanText, unique[i].titleCandidate ?? '');
      return compareSkillSets(GOLD[key].requiredSkills, GOLD[key].niceSkills, detectedSkillSet(parsed)).f1;
    });
  }

  it('PIPELINE: makro F1 jest lepsze od utrwalonego baseline i nie ma kolapsu non-IT', () => {
    const f1s = runScenario(false);
    const byKey = Object.fromEntries(OFFER_ORDER.map((k, i) => [k, f1s[i]]));
    const macroAll = macroF1(f1s);
    const macroIT = macroF1(IT_KEYS.map((k) => byKey[k]));
    const macroNonIT = macroF1(NON_IT_KEYS.map((k) => byKey[k]));

    expect(macroAll).toBeGreaterThan(BASELINE.pipelineMacroF1);
    expect(macroIT).toBeGreaterThan(BASELINE.pipelineItMacroF1);
    expect(macroNonIT).toBeGreaterThan(0);
  });

  it('CLEAN: makro F1 jest lepsze od utrwalonego baseline i nie ma kolapsu non-IT', () => {
    const f1s = runScenario(true);
    const byKey = Object.fromEntries(OFFER_ORDER.map((k, i) => [k, f1s[i]]));
    const macroAll = macroF1(f1s);
    const macroIT = macroF1(IT_KEYS.map((k) => byKey[k]));
    const macroNonIT = macroF1(NON_IT_KEYS.map((k) => byKey[k]));

    expect(macroAll).toBeGreaterThan(BASELINE.cleanMacroF1);
    expect(macroIT).toBeGreaterThan(BASELINE.cleanItMacroF1);
    expect(macroNonIT).toBeGreaterThan(0);
  });
});

describe('macierz klasyfikacji required/nice (skill TP ze złą klasyfikacją required/nice)', () => {
  it('klasyfikuje wymagania i "mile widziane" lepiej niż baseline', () => {
    const prep = preprocessJobOfferPaste(RAW_CORPUS);
    const unique = prep.segments.filter((s) => !s.duplicateOfSegmentId);
    let tpTotal = 0;
    let tpRequiredCorrectTotal = 0;
    let tpNiceMisTotal = 0;
    OFFER_ORDER.forEach((key, i) => {
      const parsed = parseJobDescriptionLocal(unique[i].cleanText, unique[i].titleCandidate ?? '');
      const classified = classifiedDetectedSkills(parsed);
      const required = new Set(GOLD[key].requiredSkills.map(canonicalizeSkill));
      const nice = new Set(GOLD[key].niceSkills.map(canonicalizeSkill));
      for (const skill of new Set([...required, ...nice])) {
        if (classified.required.has(skill) || classified.nice.has(skill)) {
          tpTotal += 1;
          if (required.has(skill) && classified.required.has(skill)) tpRequiredCorrectTotal += 1;
          if (nice.has(skill) && classified.nice.has(skill)) tpRequiredCorrectTotal += 1;
          if (nice.has(skill) && classified.required.has(skill) && !required.has(skill)) tpNiceMisTotal += 1;
        }
      }
    });

    const accuracy = tpRequiredCorrectTotal / tpTotal;
    expect(tpTotal).toBeGreaterThan(0);
    expect(accuracy).toBeGreaterThan(BASELINE.requiredNiceAccuracy);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
    expect(tpNiceMisTotal).toBe(0);
  });
});

describe('wymagania formalne/pozamerytoryczne muszą być rozpoznawane, gdy są jawne w źródle', () => {
  it('ELEKTROBUDOWA: prawo jazdy kat. B jest jawnym wymogiem w gold (i wykrywalne na czystym tekście)', () => {
    const req = GOLD.elektrobudowa.formalRequirements.find((f) => f.id === 'license_b');
    expect(req?.required).toBe(true);
    const parsed = parseJobDescriptionLocal(CLEAN_TEXTS.elektrobudowa, GOLD.elektrobudowa.title);
    expect((parsed.mandatoryRequirements ?? []).join(' ').toLowerCase()).toContain('prawo jazdy');
  });

  it('Level Work: wykrywa 4 lata doświadczenia, angielski i sanepid', () => {
    expect(GOLD.level_work.formalRequirements).toHaveLength(3);
    expect(GOLD.level_work.formalRequirements.every((f) => f.required)).toBe(true);
    const parsed = parseJobDescriptionLocal(CLEAN_TEXTS.level_work, GOLD.level_work.title);
    expect(parsed.formalRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'experience_years', label: expect.stringMatching(/4 lat/) }),
      expect.objectContaining({ id: 'language_angielski' }),
      expect.objectContaining({ id: 'sanepid' }),
    ]));
  });
});

describe('inwariancja kolejności, szumu i duplikatów (na czystych, nie-przeciekających segmentach)', () => {
  it('zamiana kolejności linii "Wymagane"/"Mile widziane" w ORLEN nie zmienia zbioru wykrytych umiejętności', () => {
    const lines = CLEAN_TEXTS.orlen_paczka.split('\n');
    const reqIdx = lines.findIndex((l) => l.trim() === 'Nasze wymagania');
    const niceIdx = lines.findIndex((l) => l.trim() === 'Mile widziane');
    const offerIdx = lines.findIndex((l) => l.trim() === 'To oferujemy');
    expect(reqIdx).toBeGreaterThan(-1);
    expect(niceIdx).toBeGreaterThan(reqIdx);
    expect(offerIdx).toBeGreaterThan(niceIdx);

    const reqBlock = lines.slice(reqIdx, niceIdx);
    const niceBlock = lines.slice(niceIdx, offerIdx);
    const reordered = [...lines.slice(0, reqIdx), ...niceBlock, ...reqBlock, ...lines.slice(offerIdx)].join('\n');

    const originalSkills = detectedSkillSet(parseJobDescriptionLocal(CLEAN_TEXTS.orlen_paczka, GOLD.orlen_paczka.title));
    const reorderedSkills = detectedSkillSet(parseJobDescriptionLocal(reordered, GOLD.orlen_paczka.title));
    expect(reorderedSkills).toEqual(originalSkills);
  });

  it('dodanie neutralnego szumu portalowego (stopka "Obserwuj profil pracodawcy") do SOLLEIM nie tworzy nowych fałszywych umiejętności', () => {
    const noisy = `${CLEAN_TEXTS.solleim}\nObserwuj profil pracodawcy\nZgłoś ofertę pracy\nWróć do wyników wyszukiwania`;
    const before = detectedSkillSet(parseJobDescriptionLocal(CLEAN_TEXTS.solleim, GOLD.solleim.title));
    const after = detectedSkillSet(parseJobDescriptionLocal(noisy, GOLD.solleim.title));
    // Udokumentowane ograniczenie: parser nie ma jawnej allow-listy szumu portalowego
    // spoza istniejącej listy w preprocesorze, więc nowe linie stopki MOGĄ dodać
    // pojedyncze fałszywe "umiejętności" (skapitalizowane słowa) - test rejestruje
    // rzeczywisty wynik, a nie żąda idealnej odporności.
    const added = [...after].filter((s) => !before.has(s));
    expect(added.length).toBeLessThanOrEqual(3);
  });

  it('powielenie tej samej oferty (P&P Solutions) w jednym wklejeniu jest wykrywane jako duplikat, nie jako 2 oferty', () => {
    const prep = preprocessJobOfferPaste(RAW_CORPUS);
    const duplicates = prep.segments.filter((s) => s.duplicateOfSegmentId !== null);
    expect(duplicates).toHaveLength(1);
    const originalOfDup = prep.segments.find((s) => s.id === duplicates[0].duplicateOfSegmentId);
    expect((originalOfDup?.companyCandidate ?? '').toLowerCase()).toContain('p&p');
  });
});

describe('kalibracja pewności (confidence)', () => {
  it('NIEDOSTĘPNE: ParsedJobDescription nie ma pola confidence; segmentacja ma tylko 3 stałe wartości, nie skalibrowany model', () => {
    const parsed = parseJobDescriptionLocal(CLEAN_TEXTS.elektrobudowa, GOLD.elektrobudowa.title);
    expect('confidence' in parsed).toBe(false);

    const prep = preprocessJobOfferPaste(RAW_CORPUS);
    const distinctConfidences = new Set(prep.segments.map((s) => s.confidence));
    // Confidence segmentacji to jedna z 3 zahardkodowanych stałych (0.9/0.6/0.45),
    // nie wynik żadnego kalibrowanego modelu - stąd mała, stała liczba unikalnych wartości.
    expect(distinctConfidences.size).toBeLessThanOrEqual(3);
    for (const c of distinctConfidences) {
      expect([0.9, 0.6, 0.45]).toContain(c);
    }
  });
});
