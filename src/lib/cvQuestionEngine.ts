import { GapKind, HighlightMetric, MasterVault, WorkExperience } from '../types';
import { eliminateSlogans } from './slotFillingEngine';
import { matchSubRoles, suggestedProfileForSector } from './specializationIndex';
import { profileDataKeyFor, readJson, StorageKeys, writeJson } from './storage';

/**
 * Pytania uzupełniające do CV — deterministycznie, za zero tokenów.
 *
 * Powód istnienia widać w modelu danych: `HighlightMetric` ma sloty `action`,
 * `target`, `tool` i `metric`, a edytor osiągnięć wystawia wyłącznie `text`
 * i tworzy resztę pustą (`AchievementEditor.tsx`). Najcenniejsza część CV —
 * mierzalny efekt — nie miała jak powstać, bo nikt o nią nie pytał.
 *
 * Dlaczego bez modelu językowego: te pytania da się wyprowadzić z samego
 * kształtu vaultu. Konkurencja liczy je jako wiadomości w czacie i limituje do
 * kilku dziennie; katalog reguł nie kosztuje nic i może stać za funkcją darmową
 * bez limitu — tak samo jak `quickAtsCheck` i `interviewCheatSheetEngine`.
 *
 * **Ten moduł nigdy nie zna odpowiedzi.** Zna wyłącznie pytanie i miejsce,
 * w które odpowiedź trafi. `hint` podaje przykłady *formy* odpowiedzi, nie jej
 * treść — podstawienie komuś cudzej liczby byłoby złamaniem reguły 1
 * z `AGENTS.md` i kłamstwem w dokumencie, którym ta osoba szuka pracy.
 *
 * Funkcje są czyste: bez `Math.random()` i bez `Date.now()`. Ten sam vault musi
 * dawać ten sam zestaw pytań w tej samej kolejności, inaczej „Ignoruj" nie ma
 * czego zapamiętać.
 */

/**
 * Gdzie ląduje odpowiedź. Bez tego pytanie jest tylko tekstem na ekranie —
 * to jest ta część, przez którą odpowiedź trafia do dokumentu.
 */
export type CvAnswerTarget =
  | { kind: 'highlightSlot'; experienceId: string; highlightId: string; slot: 'metric' | 'tool' }
  | { kind: 'experienceField'; experienceId: string; field: 'description' | 'location' }
  | { kind: 'experienceHighlight'; experienceId: string }
  | { kind: 'personalField'; field: 'title' | 'summary' }
  | { kind: 'skillList'; list: 'hardSkills' | 'toolsAndTech' };

export interface CvQuestion {
  /**
   * Stabilny identyfikator — z niego bierze się pamięć „Ignoruj". Składany
   * wyłącznie z `target`, nigdy z treści pytania ani z pozycji na liście:
   * gdyby zależał od treści, poprawienie literówki w osiągnięciu przywracałoby
   * pytanie, które użytkownik świadomie pominął.
   */
  id: string;
  kind: GapKind;
  /** Etykieta nad pytaniem — nazwa firmy albo sekcji, której pytanie dotyczy. */
  topic: string;
  /** Pytanie po polsku, złożone wyłącznie z danych, które są już w vaulcie. */
  question: string;
  /** „np. …" — przykłady formy odpowiedzi. Nigdy sama odpowiedź. */
  hint: string;
  /** Im wyżej, tym mocniej brak tej informacji psuje dokument. */
  weight: number;
  target: CvAnswerTarget;
}

/**
 * Ile pytań pokazujemy naraz — mianownik paska postępu („4/10").
 *
 * Limit nie jest kosmetyczny: seria bez widocznego końca zostaje porzucona
 * w połowie, a wtedy vault jest uzupełniony w kilku przypadkowych miejscach
 * zamiast w najważniejszych. Dziesięć pytań po około pół minuty to te same
 * pięć minut, które `nextAction.ts` obiecuje przy uzupełnianiu profilu —
 * dwie różne obietnice czasu w jednej aplikacji byłyby rozjazdem.
 */
export const MAX_QUESTIONS = 10;

/**
 * Ile pytań naraz o jedno stanowisko. Bez tego jedna praca z pięcioma pustymi
 * punktami zjada cały zestaw i czyta się jak zaczepka, a reszta historii
 * zatrudnienia nie dostaje ani jednego pytania.
 */
export const MAX_QUESTIONS_PER_EXPERIENCE = 3;

/** Górny limit pola odpowiedzi — wspólny dla silnika i licznika w karcie. */
export const MAX_ANSWER_LENGTH = 2000;

const hasText = (value: string | undefined | null): boolean => Boolean(value && value.trim());

/**
 * Nazwa firmy w mianowniku, poprzedzona słowem „firmie".
 *
 * `w ${company}` jest niepoprawne dla większości polskich nazw — „w Zakłady
 * Mięsne", „w Przedsiębiorstwo Robót Drogowych". Odmienić dowolnej nazwy
 * własnej deterministycznie się nie da, a zły przypadek w pytaniu wygląda jak
 * usterka aplikacji. „w firmie X" jest poprawne dla każdej nazwy, bo to
 * „firmie" niesie przypadek, a nazwa zostaje nietknięta.
 */
function inCompany(job: WorkExperience): string {
  return hasText(job.company) ? `w firmie ${job.company.trim()}` : 'na tym stanowisku';
}

/** Etykieta tematu nad pytaniem — tu nazwa firmy stoi samodzielnie i nie wymaga odmiany. */
function companyTopic(job: WorkExperience): string {
  if (hasText(job.company)) return job.company.trim();
  return hasText(job.role) ? job.role.trim() : 'Doświadczenie';
}

/**
 * Krótki opis tego, czego dotyczy osiągnięcie — wchodzi w treść pytania jako
 * cytat. Bierzemy `target` ze slotów, a gdy go nie ma, sam tekst przycięty do
 * pierwszego przecinka. Nigdy nie dopisujemy tu nic od siebie.
 */
function highlightSubject(highlight: HighlightMetric): string {
  const source = hasText(highlight.target) ? highlight.target : highlight.text;
  const firstClause = source.split(/[,;.]/)[0]?.trim() ?? '';
  const subject = firstClause || source.trim();
  return subject.length > 90 ? `${subject.slice(0, 87).trimEnd()}…` : subject;
}

/**
 * Branża stanowiska — decyduje **wyłącznie** o doborze przykładów w `hint`.
 * Sam zestaw pytań jest identyczny dla wszystkich; różni się tylko to, czym
 * je zilustrować (reguła 8 w `AGENTS.md`).
 */
type HintDomain = 'PHYSICAL' | 'OFFICE' | 'UNKNOWN';

/**
 * Rozpoznanie branży po tytule stanowiska — z **progiem zero**, nie domyślnym
 * czwórką, i z uczciwym „nie wiem".
 *
 * `matchSubRoles` jest zestrojone pod całą treść ogłoszenia, nie pod trzy słowa
 * tytułu, i na krótkim tekście trafia asymetrycznie: „Frontend Developer React
 * TypeScript" zbiera 20 punktów, bo React i TypeScript są w katalogu jako
 * osobne umiejętności, a „Serwisant kotłów gazowych Junkers" zbiera zero — marka
 * figuruje jako `'Junkers / Bosch'`, a `phraseSpecificity` wymaga **wszystkich**
 * członów frazy. Próg 4 przepuszczałby więc informatyka i odrzucał montera,
 * czyli dokładnie odwrotnie do reguły 8.
 *
 * Stąd `UNKNOWN` jako pełnoprawny wynik: gdy nie wiadomo, pokazujemy przykłady
 * z obu światów zamiast zgadywać. Zły przykład jest gorszy niż dłuższy.
 */
function hintDomain(job: WorkExperience): HintDomain {
  const [match] = matchSubRoles(`${job.role} ${job.company}`, 1);
  if (!match) return 'UNKNOWN';
  return suggestedProfileForSector(match.sector.id) === 'PHYSICAL' ? 'PHYSICAL' : 'OFFICE';
}

const METRIC_HINTS: Record<HintDomain, string> = {
  PHYSICAL: 'np. skrócenie czasu dojazdu, mniej reklamacji, więcej zleceń dziennie, krótszy przestój maszyny',
  OFFICE: 'np. skrócenie czasu obsługi, niższy koszt, wyższa sprzedaż, mniej błędów na produkcji',
  UNKNOWN: 'np. skrócenie czasu, niższy koszt, mniej reklamacji, więcej zleceń — liczba albo procent',
};

const TOOL_HINTS: Record<HintDomain, string> = {
  PHYSICAL: 'np. spawarka MIG/MAG, analizator spalin, wózek widłowy, system WMS',
  OFFICE: 'np. Excel, SAP, Power BI, TypeScript, Jira',
  UNKNOWN: 'np. analizator spalin, wózek widłowy, SAP, Excel — sprzęt albo program',
};

/**
 * Reguła „luka → pytanie". Kształt świadomie taki sam jak `VaultSectionSpec`
 * w `vaultCompleteness.ts`: pole `blocks` zmusza do nazwania, **co konkretnie
 * się psuje** bez tej informacji, więc wagę da się podważyć argumentem,
 * a nie tylko przeczuciem.
 *
 * Wszystkie pytania są formułowane **bezosobowo**. Vault nie ma pola płci,
 * a wymyślenie go byłoby złamaniem reguły 1; „Co osiągnąłeś" wybiera formę
 * męską za osobę, która nigdy tego nie deklarowała. Pilnuje tego test
 * odrzucający końcówki „-łem/-łam/-łeś/-łaś".
 */
export interface CvQuestionRule {
  id: string;
  kind: GapKind;
  weight: number;
  /** Co się psuje w dokumencie, gdy tej informacji brakuje. */
  blocks: string;
  collect: (vault: MasterVault) => CvQuestion[];
}

export const CV_QUESTION_RULES: readonly CvQuestionRule[] = [
  {
    id: 'highlight-metric',
    kind: 'UNQUANTIFIED',
    weight: 10,
    blocks: 'Osiągnięcie bez liczby czyta się jak zakres obowiązków, nie jak wynik.',
    collect: (vault) =>
      vault.history.flatMap((job) =>
        job.highlights
          .filter((highlight) => hasText(highlight.text) && !hasText(highlight.metric))
          .map((highlight) => ({
            id: `metric:${job.id}:${highlight.id}`,
            kind: 'UNQUANTIFIED' as const,
            topic: companyTopic(job),
            question: `Jaki mierzalny efekt dało „${highlightSubject(highlight)}" ${inCompany(job)}?`,
            hint: METRIC_HINTS[hintDomain(job)],
            weight: 10,
            target: {
              kind: 'highlightSlot' as const,
              experienceId: job.id,
              highlightId: highlight.id,
              slot: 'metric' as const,
            },
          }))
      ),
  },
  {
    id: 'experience-without-highlights',
    kind: 'GAP',
    weight: 9,
    blocks: 'Generator składa treść CV z osiągnięć — stanowisko bez ani jednego nie trafi do dokumentu.',
    collect: (vault) =>
      vault.history
        .filter((job) => job.highlights.filter((h) => hasText(h.text)).length === 0)
        .map((job) => ({
          id: `highlight:${job.id}`,
          kind: 'GAP' as const,
          topic: companyTopic(job),
          question: `Co należało do zadań na stanowisku ${hasText(job.role) ? `„${job.role.trim()}"` : 'w tej pracy'} ${inCompany(job)}? Wystarczy jedno zadanie.`,
          hint: 'jedno zdanie o realnym zadaniu — o resztę dopytamy osobno',
          weight: 9,
          target: { kind: 'experienceHighlight' as const, experienceId: job.id },
        })),
  },
  {
    id: 'personal-title',
    kind: 'MISSING_FIELD',
    weight: 8,
    blocks: 'Dopasowanie tytułu do ogłoszenia jest osobnym składnikiem oceny Kierivo.',
    collect: (vault) =>
      hasText(vault.personalInfo.title)
        ? []
        : [
            {
              id: 'personal:title',
              kind: 'MISSING_FIELD' as const,
              topic: 'Tytuł zawodowy',
              question: 'Jak nazywa się Twoje stanowisko w języku ogłoszeń o pracę?',
              hint: 'np. Monter instalacji gazowych, Specjalista ds. logistyki, Frontend Developer',
              weight: 8,
              target: { kind: 'personalField' as const, field: 'title' as const },
            },
          ],
  },
  {
    id: 'skills-hard',
    kind: 'GAP',
    weight: 7,
    blocks: 'Pokrycie słów kluczowych ma największą wagę w ocenie Kierivo.',
    collect: (vault) =>
      vault.skillsMatrix.hardSkills.length > 0
        ? []
        : [
            {
              id: 'skills:hardSkills',
              kind: 'GAP' as const,
              topic: 'Umiejętności twarde',
              question: 'Jakie konkretne umiejętności zawodowe masz opanowane na tyle, żeby wykonać je bez niczyjej pomocy?',
              hint: 'oddziel przecinkami — np. spawanie MIG/MAG, przeglądy kotłów, kosztorysowanie',
              weight: 7,
              target: { kind: 'skillList' as const, list: 'hardSkills' as const },
            },
          ],
  },
  {
    id: 'highlight-tool',
    kind: 'MISSING_FIELD',
    weight: 6,
    blocks: 'Nazwa narzędzia jest słowem kluczowym, po którym ATS dopasowuje kandydata.',
    collect: (vault) =>
      vault.history.flatMap((job) =>
        job.highlights
          .filter((highlight) => hasText(highlight.text) && !hasText(highlight.tool))
          .map((highlight) => ({
            id: `tool:${job.id}:${highlight.id}`,
            kind: 'MISSING_FIELD' as const,
            topic: companyTopic(job),
            question: `Jaki sprzęt, program albo narzędzie było przy tym używane ${inCompany(job)}?`,
            hint: TOOL_HINTS[hintDomain(job)],
            weight: 6,
            target: {
              kind: 'highlightSlot' as const,
              experienceId: job.id,
              highlightId: highlight.id,
              slot: 'tool' as const,
            },
          }))
      ),
  },
  {
    id: 'skills-tools',
    kind: 'GAP',
    weight: 5,
    blocks: 'Druga połowa dopasowania słów kluczowych — dla montera to sprzęt, nie frameworki.',
    collect: (vault) =>
      vault.skillsMatrix.toolsAndTech.length > 0
        ? []
        : [
            {
              id: 'skills:toolsAndTech',
              kind: 'GAP' as const,
              topic: 'Narzędzia i technologie',
              question: 'Na jakim sprzęcie, oprogramowaniu albo systemach opiera się Twoja codzienna praca?',
              hint: 'oddziel przecinkami — np. analizator spalin Testo, wózek widłowy, SAP, Excel',
              weight: 5,
              target: { kind: 'skillList' as const, list: 'toolsAndTech' as const },
            },
          ],
  },
  {
    id: 'highlight-slogan',
    kind: 'SLOGAN',
    weight: 5,
    blocks: 'Slogan zajmuje miejsce w dokumencie i nie niesie ani jednego faktu.',
    // Spis buzzwordów czytamy przez `eliminateSlogans` ze `slotFillingEngine`.
    // Własny drugi spis rozjechałby się z tamtym po pierwszej zmianie (reguła 3).
    collect: (vault) =>
      vault.history.flatMap((job) =>
        job.highlights
          .filter((highlight) => hasText(highlight.text))
          .flatMap((highlight) => {
            const [slogan] = eliminateSlogans(highlight.text).slogansRemoved;
            if (!slogan) return [];
            return [
              {
                id: `slogan:${job.id}:${highlight.id}`,
                kind: 'SLOGAN' as const,
                topic: companyTopic(job),
                question: `„${slogan}" w opisie ${inCompany(job)} brzmi jak slogan. Jaka konkretna sytuacja za tym stoi i czym się skończyła?`,
                hint: 'opisz jedno zdarzenie zamiast cechy charakteru',
                weight: 5,
                target: {
                  kind: 'highlightSlot' as const,
                  experienceId: job.id,
                  highlightId: highlight.id,
                  slot: 'metric' as const,
                },
              },
            ];
          })
      ),
  },
  {
    id: 'experience-description',
    kind: 'MISSING_FIELD',
    weight: 4,
    blocks: 'Bez opisu roli rekruter nie wie, za co odpowiadał kandydat, zanim dojdzie do osiągnięć.',
    collect: (vault) =>
      vault.history
        .filter((job) => !hasText(job.description))
        .map((job) => ({
          id: `description:${job.id}`,
          kind: 'MISSING_FIELD' as const,
          topic: companyTopic(job),
          question: `Za co odpowiadało to stanowisko ${inCompany(job)} na co dzień?`,
          hint: 'jedno–dwa zdania o zakresie obowiązków',
          weight: 4,
          target: { kind: 'experienceField' as const, experienceId: job.id, field: 'description' as const },
        })),
  },
  {
    id: 'personal-summary',
    kind: 'MISSING_FIELD',
    weight: 3,
    blocks: 'Podsumowanie jest pierwszym akapitem CV i miejscem na słowa kluczowe z ogłoszenia.',
    collect: (vault) =>
      hasText(vault.personalInfo.summary)
        ? []
        : [
            {
              id: 'personal:summary',
              kind: 'MISSING_FIELD' as const,
              topic: 'Podsumowanie profilu',
              question: 'W dwóch–trzech zdaniach: czym się zajmujesz, od jak dawna i co wychodzi Ci najlepiej?',
              hint: 'same fakty o pracy, bez przymiotników o sobie',
              weight: 3,
              target: { kind: 'personalField' as const, field: 'summary' as const },
            },
          ],
  },
  {
    id: 'experience-location',
    kind: 'MISSING_FIELD',
    weight: 2,
    blocks: 'Miejscowość poprzedniej pracy bywa kryterium zerojedynkowym przy rekrutacji lokalnej.',
    collect: (vault) =>
      vault.history
        .filter((job) => !hasText(job.location))
        .map((job) => ({
          id: `location:${job.id}`,
          kind: 'MISSING_FIELD' as const,
          topic: companyTopic(job),
          question: `W jakiej miejscowości była praca ${inCompany(job)}?`,
          hint: 'np. Kraków, teren woj. śląskiego, zdalnie',
          weight: 2,
          target: { kind: 'experienceField' as const, experienceId: job.id, field: 'location' as const },
        })),
  },
] as const;

/** Identyfikator stanowiska, którego dotyczy pytanie — albo `null` dla pytań o profil. */
function experienceIdOf(question: CvQuestion): string | null {
  const { target } = question;
  return target.kind === 'highlightSlot' ||
    target.kind === 'experienceField' ||
    target.kind === 'experienceHighlight'
    ? target.experienceId
    : null;
}

export interface CvQuestionSet {
  /** Pytania do zadania — po odjęciu pominięć, posortowane i przycięte. */
  questions: CvQuestion[];
  /**
   * Ile luk wykryto łącznie, zanim zadziałały limity.
   *
   * Pokazywane osobno, a **nie** jako mianownik paska postępu: przy czterdziestu
   * lukach pasek liczony od tej liczby prawie nie drgnąłby po odpowiedzi
   * i zniechęcał zamiast prowadzić. Mianownikiem jest długość `questions`,
   * a `totalGaps` mówi prawdę o tym, ile zostało (reguła 1 obejmuje też liczby
   * pokazywane w interfejsie).
   */
  totalGaps: number;
}

/**
 * Pytania do zadania. `skippedIds` przychodzi z zewnątrz zamiast być czytane ze
 * schowka w środku, żeby funkcja została czysta i dała się przetestować w Node
 * bez atrapy `localStorage` — tak samo jak reszta `src/lib/`.
 */
export function buildCvQuestionSet(
  vault: MasterVault,
  skippedIds: readonly string[] = []
): CvQuestionSet {
  const skipped = new Set(skippedIds);
  const candidates: CvQuestion[] = [];

  for (const rule of CV_QUESTION_RULES) {
    for (const question of rule.collect(vault)) {
      if (!skipped.has(question.id)) candidates.push(question);
    }
  }

  // Sortowanie stabilne po samej wadze: przy remisie zostaje kolejność, w jakiej
  // reguły wypełniły tablicę, czyli kolejność wpisów w vaulcie. Bez tego o tym,
  // o co użytkownik zostanie zapytany najpierw, decydowałby przypadek.
  const ordered = [...candidates].sort((a, b) => b.weight - a.weight);

  const perExperience = new Map<string, number>();
  const questions: CvQuestion[] = [];

  for (const question of ordered) {
    if (questions.length >= MAX_QUESTIONS) break;

    const experienceId = experienceIdOf(question);
    if (experienceId !== null) {
      const used = perExperience.get(experienceId) ?? 0;
      if (used >= MAX_QUESTIONS_PER_EXPERIENCE) continue;
      perExperience.set(experienceId, used + 1);
    }

    questions.push(question);
  }

  return { questions, totalGaps: candidates.length };
}

/**
 * Identyfikatory pytań, które w tym vaulcie da się jeszcze wygenerować.
 * Liczone **bez** filtra pominięć — chodzi o to, co w ogóle istnieje.
 */
export function knownQuestionIds(vault: MasterVault): string[] {
  return CV_QUESTION_RULES.flatMap((rule) => rule.collect(vault)).map((question) => question.id);
}

/**
 * Przycina listę pominięć do pytań, które nadal mają sens.
 *
 * Bez tego wpis o osiągnięciu usuniętym pół roku temu leżałby w schowku bez
 * końca, a lista rosłaby monotonicznie przez całe życie konta.
 */
export function pruneSkippedIds(vault: MasterVault, skippedIds: readonly string[]): string[] {
  const known = new Set(knownQuestionIds(vault));
  return skippedIds.filter((id) => known.has(id));
}

/**
 * Dokleja odpowiedź do istniejącego tekstu osiągnięcia.
 *
 * Myślnik, a nie wplecenie w zdanie: odpowiedź zostaje **słowo w słowo**,
 * a człon po myślniku jest poprawny gramatycznie po dowolnej polskiej frazie.
 * Kuszące byłoby użycie `fillSlotSentence` ze `slotFillingEngine`, ale ta
 * funkcja losuje synonimy — przepisałaby użytkownikowi jego własne słowa
 * i przy dwóch uruchomieniach dała dwa różne CV.
 */
export function composeHighlightText(text: string, answer: string): string {
  const base = text.trim().replace(/[.\s]+$/, '');
  const addition = answer.trim();
  if (!base) return addition;
  if (!addition) return text;
  return `${base} — ${addition}`;
}

function updateHighlight(
  job: WorkExperience,
  highlightId: string,
  update: (highlight: HighlightMetric) => HighlightMetric
): WorkExperience {
  return {
    ...job,
    highlights: job.highlights.map((highlight) =>
      highlight.id === highlightId ? update(highlight) : highlight
    ),
  };
}

/**
 * Rozbija odpowiedź na pozycje listy. Używane wyłącznie tam, gdzie polem
 * docelowym jest tablica — użytkownik pisze wtedy po przecinku, bo tak brzmi
 * pytanie.
 */
function splitList(answer: string): string[] {
  return answer
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Podgląd tego, co odpowiedź zrobi z dokumentem — bez zapisywania czegokolwiek.
 *
 * Karta pytań pokazuje ten tekst nad przyciskiem „Zapisz". To jest ta różnica
 * między „aplikacja przepisała mi CV" a „widziałem, co się stanie, i się
 * zgodziłem": zasada z `SpecializationPicker.tsx:21-25` mówi, że nic nie wchodzi
 * do dokumentu bez świadomej decyzji, a decyzja bez podglądu nie jest świadoma.
 * Zwraca `null`, gdy pytanie nie zmienia treści punktora.
 */
export function previewAnswer(
  vault: MasterVault,
  question: CvQuestion,
  answer: string
): string | null {
  const trimmed = answer.trim();
  if (!trimmed) return null;

  const { target } = question;
  if (target.kind === 'experienceHighlight') return trimmed;
  if (target.kind !== 'highlightSlot') return null;

  const job = vault.history.find((entry) => entry.id === target.experienceId);
  const highlight = job?.highlights.find((entry) => entry.id === target.highlightId);
  if (!highlight) return null;

  return composeHighlightText(highlight.text, trimmed);
}

/**
 * Wpisuje odpowiedź do vaultu i zwraca **nowy** vault. Czysta funkcja.
 *
 * Odpowiedź na pytanie o metrykę trafia w dwa miejsca: do slotu `metric`
 * i do `text`. Sam slot nie wystarcza, bo generator dokumentu składa treść
 * punktora z `text` — zapis wyłącznie do slotu wyglądałby na udany i nie
 * zmieniłby ani jednej linijki w CV, czyli funkcja nie robiłaby tego, po co
 * powstała. Użytkownik widzi wynik wcześniej, w `previewAnswer`.
 *
 * Pusta odpowiedź zwraca vault bez zmian: „Zapisz" z pustym polem nie może
 * skasować tego, co było wcześniej.
 */
export function applyAnswer(vault: MasterVault, question: CvQuestion, answer: string): MasterVault {
  const trimmed = answer.trim().slice(0, MAX_ANSWER_LENGTH);
  if (!trimmed) return vault;

  const { target } = question;

  switch (target.kind) {
    case 'highlightSlot':
      return {
        ...vault,
        history: vault.history.map((job) =>
          job.id === target.experienceId
            ? updateHighlight(job, target.highlightId, (highlight) => ({
                ...highlight,
                [target.slot]: trimmed,
                text: composeHighlightText(highlight.text, trimmed),
              }))
            : job
        ),
      };

    case 'experienceHighlight':
      return {
        ...vault,
        history: vault.history.map((job) =>
          job.id === target.experienceId
            ? {
                ...job,
                highlights: [
                  ...job.highlights,
                  // Identyfikator wyprowadzony z pytania i liczby istniejących
                  // punktów, a nie z `Date.now()` — inaczej ta funkcja
                  // przestałaby być czysta i nie dałoby się jej przetestować
                  // na powtarzalnym wyniku.
                  {
                    id: `hl-${job.id}-${job.highlights.length}`,
                    text: trimmed,
                    action: '',
                    target: '',
                    tool: '',
                    metric: '',
                    keywords: [],
                  },
                ],
              }
            : job
        ),
      };

    case 'experienceField':
      return {
        ...vault,
        history: vault.history.map((job) =>
          job.id === target.experienceId ? { ...job, [target.field]: trimmed } : job
        ),
      };

    case 'personalField':
      return { ...vault, personalInfo: { ...vault.personalInfo, [target.field]: trimmed } };

    case 'skillList': {
      const existing = vault.skillsMatrix[target.list];
      const known = new Set(existing.map((item) => item.toLowerCase()));
      const added: string[] = [];
      for (const item of splitList(trimmed)) {
        const key = item.toLowerCase();
        if (known.has(key)) continue;
        known.add(key);
        added.push(item);
      }
      return {
        ...vault,
        skillsMatrix: { ...vault.skillsMatrix, [target.list]: [...existing, ...added] },
      };
    }
  }
}

/* --- cienka warstwa utrwalania; cała logika wyżej jest czysta --- */

/**
 * Pominięte pytania z tej przeglądarki.
 *
 * Klucz jest zadeklarowany w `StorageKeys` (`src/lib/storage.ts`), bo usuwanie
 * danych iteruje po rejestrze — klucz spoza niego przeżyłby „usuń moje dane",
 * co w tym repozytorium zdarzyło się już raz.
 */
export function loadSkippedQuestionIds(profileId: string): string[] {
  const stored = readJson<unknown>(profileDataKeyFor(StorageKeys.cvQuestionsSkipped, profileId), []);
  // Uszkodzona albo podmieniona wartość nie może wywrócić karty pytań:
  // czytamy defensywnie, bo to zwykły tekst w schowku przeglądarki.
  return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
}

export function saveSkippedQuestionIds(profileId: string, ids: readonly string[]): void {
  writeJson(profileDataKeyFor(StorageKeys.cvQuestionsSkipped, profileId), ids);
}
