import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyAnswer,
  buildCvQuestionSet,
  composeHighlightText,
  CV_QUESTION_RULES,
  knownQuestionIds,
  loadSkippedQuestionIds,
  MAX_QUESTIONS,
  MAX_QUESTIONS_PER_EXPERIENCE,
  previewAnswer,
  pruneSkippedIds,
  saveSkippedQuestionIds,
} from '../cvQuestionEngine';
import { createEmptyVault } from '../sampleVault';
import { profileDataKeyFor, resetLastGoodCache, StorageKeys } from '../storage';
import { MasterVault, HighlightMetric, WorkExperience } from '../../types';
import { MemoryStorage } from './helpers/memoryStorage';

function highlight(overrides: Partial<HighlightMetric> = {}): HighlightMetric {
  return { id: 'hl-1', text: '', action: '', target: '', tool: '', metric: '', keywords: [], ...overrides };
}

function job(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'exp-1',
    company: 'GROMGAZ',
    role: 'Koordynator serwisu',
    location: 'Kraków',
    startDate: '2020-01',
    endDate: '2023-01',
    isCurrent: false,
    description: 'Nadzór nad zespołem serwisantów.',
    highlights: [],
    ...overrides,
  };
}

/** Vault wypełniony wszędzie poza tym, co dany test chce sprawdzić. */
function vaultWith(overrides: Partial<MasterVault> = {}): MasterVault {
  const base = createEmptyVault('Jan Kowalski', 'jan@example.com');
  return {
    ...base,
    personalInfo: { ...base.personalInfo, title: 'Koordynator serwisu', summary: 'Serwis urządzeń gazowych.' },
    skillsMatrix: { ...base.skillsMatrix, hardSkills: ['Przeglądy kotłów'], toolsAndTech: ['Analizator spalin'] },
    ...overrides,
  };
}

describe('katalog pytań uzupełniających', () => {
  it('nie ma dwóch reguł o tym samym identyfikatorze', () => {
    const ids = CV_QUESTION_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('nie zadaje pytań w formie rodzajowej — vault nie zna płci użytkownika', () => {
    // Vault nie ma pola płci, a „Co osiągnąłeś" wybiera formę męską za osobę,
    // która nigdy tego nie zadeklarowała. Ten test pilnuje, żeby przyszła edycja
    // katalogu nie wprowadziła takiej formy tylnymi drzwiami.
    const vault = vaultWith({
      personalInfo: { ...createEmptyVault().personalInfo, title: '', summary: '' },
      skillsMatrix: { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
      history: [
        job({ description: '', location: '', highlights: [highlight({ text: 'Planowanie pracy serwisantów' })] }),
        job({ id: 'exp-2', company: 'Elektro-Mont', role: 'Elektryk', highlights: [] }),
      ],
    });

    const wszystkie = CV_QUESTION_RULES.flatMap((rule) => rule.collect(vault));
    expect(wszystkie.length).toBeGreaterThan(5);

    for (const pytanie of wszystkie) {
      expect(`${pytanie.question} ${pytanie.hint}`).not.toMatch(/(łem|łam|łeś|łaś)\b/);
    }
  });

  it('nie odmienia nazwy firmy, tylko poprzedza ją słowem „firmie”', () => {
    // „w Zakłady Mięsne" jest niepoprawne, a deterministycznie odmienić dowolnej
    // nazwy własnej się nie da. Nazwa musi zostać w mianowniku.
    const vault = vaultWith({
      history: [job({ company: 'Zakłady Mięsne', highlights: [highlight({ text: 'Obsługa linii pakującej' })] })],
    });

    const pytanie = buildCvQuestionSet(vault).questions.find((q) => q.id.startsWith('metric:'));
    expect(pytanie?.question).toContain('w firmie Zakłady Mięsne');
  });

  it('brak nazwy firmy nie zostawia dziury w zdaniu', () => {
    const vault = vaultWith({
      history: [job({ company: '', highlights: [highlight({ text: 'Obsługa magazynu' })] })],
    });

    const pytanie = buildCvQuestionSet(vault).questions.find((q) => q.id.startsWith('metric:'));
    expect(pytanie?.question).toContain('na tym stanowisku');
    expect(pytanie?.question).not.toContain('undefined');
  });
});

describe('wykrywanie luk', () => {
  it('pusty profil nie pyta o osiągnięcia, bo nie ma jeszcze o co', () => {
    const { questions } = buildCvQuestionSet(createEmptyVault());
    expect(questions.some((q) => q.id.startsWith('metric:'))).toBe(false);
    expect(questions.some((q) => q.id === 'personal:title')).toBe(true);
  });

  it('pyta o mierzalny efekt i cytuje treść osiągnięcia razem z nazwą firmy', () => {
    const vault = vaultWith({
      history: [job({ highlights: [highlight({ text: 'Planowanie i harmonogramowanie pracy serwisantów' })] })],
    });

    const pytanie = buildCvQuestionSet(vault).questions.find((q) => q.id === 'metric:exp-1:hl-1');
    expect(pytanie?.question).toContain('Planowanie i harmonogramowanie pracy serwisantów');
    expect(pytanie?.question).toContain('GROMGAZ');
    expect(pytanie?.kind).toBe('UNQUANTIFIED');
  });

  it('osiągnięcie z wypełnioną metryką nie generuje pytania o metrykę', () => {
    const vault = vaultWith({
      history: [job({ highlights: [highlight({ text: 'Planowanie pracy', metric: 'skrócenie dojazdu o 20 minut' })] })],
    });

    expect(buildCvQuestionSet(vault).questions.some((q) => q.id.startsWith('metric:'))).toBe(false);
  });

  it('stanowisko bez ani jednego osiągnięcia prosi o jedno zadanie, nie o pięć', () => {
    const vault = vaultWith({ history: [job({ highlights: [] })] });
    const pytanie = buildCvQuestionSet(vault).questions.find((q) => q.id === 'highlight:exp-1');
    expect(pytanie?.question).toContain('Wystarczy jedno zadanie');
  });

  it('slogan w osiągnięciu zamienia się w pytanie o konkret', () => {
    const vault = vaultWith({
      history: [job({ highlights: [highlight({ text: 'Zmotywowany do pracy pod presją czasu', metric: 'x' })] })],
    });

    const pytanie = buildCvQuestionSet(vault).questions.find((q) => q.id.startsWith('slogan:'));
    expect(pytanie).toBeDefined();
    expect(pytanie?.kind).toBe('SLOGAN');
  });

  it('rozpoznaje slogany przez eliminateSlogans, a nie przez własny spis', () => {
    // Gdyby katalog miał drugą listę buzzwordów, rozjechałaby się z tą
    // w slotFillingEngine przy pierwszej zmianie (reguła 3). Sprawdzamy hasło,
    // które jest wyłącznie tam.
    const vault = vaultWith({
      history: [job({ highlights: [highlight({ text: 'Myślenie out-of-the-box w projektach', metric: 'x' })] })],
    });

    expect(buildCvQuestionSet(vault).questions.some((q) => q.id.startsWith('slogan:'))).toBe(true);
  });
});

describe('zawody fizyczne (reguła 8)', () => {
  function podpowiedzNarzedzia(role: string, company: string): string {
    const vault = vaultWith({
      history: [job({ company, role, highlights: [highlight({ text: 'Praca na stanowisku' })] })],
    });
    return buildCvQuestionSet(vault).questions.find((q) => q.id.startsWith('tool:'))!.hint;
  }

  it('rozpoznany zawód fizyczny dostaje przykłady sprzętu, nie frameworków', () => {
    const hint = podpowiedzNarzedzia('Monter instalacji gazowych', 'GROMGAZ');
    expect(hint).toContain('analizator spalin');
    expect(hint).not.toContain('TypeScript');
  });

  it('rozpoznana praca biurowa dostaje przykłady biurowe', () => {
    const hint = podpowiedzNarzedzia('Frontend Developer React TypeScript', 'TechCorp');
    expect(hint).toContain('TypeScript');
    expect(hint).not.toContain('spawarka');
  });

  it('nierozpoznany zawód dostaje przykłady z obu światów zamiast zgadywania', () => {
    // Gdy branża nie wynika z tytułu ani firmy, pokazujemy przykłady techniczne
    // i biurowe naraz (UNKNOWN); wybranie jednego na chybił trafił byłoby zgadywaniem (reguła 1 i 8).
    const hint = podpowiedzNarzedzia('Pracownik ds. projektów specjalnych', 'Firma ABC');
    expect(hint).toContain('analizator spalin');
    expect(hint).toContain('Excel');
  });
});

describe('kolejność i limity', () => {
  it('o kolejności decyduje waga, nie kolejność w vaulcie', () => {
    const vault = vaultWith({
      personalInfo: { ...createEmptyVault().personalInfo, title: '', summary: '' },
      history: [job({ location: '', highlights: [highlight({ text: 'Planowanie pracy' })] })],
    });

    const { questions } = buildCvQuestionSet(vault);
    const wagi = questions.map((q) => q.weight);
    expect([...wagi].sort((a, b) => b - a)).toEqual(wagi);
    expect(questions[0].id).toBe('metric:exp-1:hl-1');
  });

  it('nie pokazuje więcej pytań niż wynosi limit', () => {
    const history = Array.from({ length: 8 }, (_, index) =>
      job({
        id: `exp-${index}`,
        company: `Firma ${index}`,
        description: '',
        location: '',
        highlights: [highlight({ id: `hl-${index}`, text: `Zadanie ${index}` })],
      })
    );

    const { questions, totalGaps } = buildCvQuestionSet(vaultWith({ history }));
    expect(questions).toHaveLength(MAX_QUESTIONS);
    expect(totalGaps).toBeGreaterThan(MAX_QUESTIONS);
  });

  it('nie zasypuje użytkownika pytaniami o jedno stanowisko', () => {
    const highlights = Array.from({ length: 6 }, (_, index) =>
      highlight({ id: `hl-${index}`, text: `Zadanie ${index}` })
    );
    const vault = vaultWith({ history: [job({ description: '', location: '', highlights })] });

    const oJedno = buildCvQuestionSet(vault).questions.filter((q) => q.id.includes('exp-1'));
    expect(oJedno.length).toBeLessThanOrEqual(MAX_QUESTIONS_PER_EXPERIENCE);
  });

  it('ten sam vault daje ten sam zestaw pytań', () => {
    const vault = vaultWith({
      history: [job({ highlights: [highlight({ text: 'Planowanie pracy' })] })],
    });

    const pierwszy = buildCvQuestionSet(vault).questions.map((q) => q.id);
    const drugi = buildCvQuestionSet(vault).questions.map((q) => q.id);
    expect(pierwszy).toEqual(drugi);
  });
});

describe('zapis odpowiedzi', () => {
  const vault = vaultWith({
    history: [job({ highlights: [highlight({ text: 'Planowanie pracy serwisantów' })] })],
  });
  const pytanie = buildCvQuestionSet(vault).questions.find((q) => q.id === 'metric:exp-1:hl-1')!;

  it('odpowiedź trafia do CV dosłownie, bez ani jednego dopisanego słowa', () => {
    const odpowiedz = 'skrócenie czasu dojazdu o 20 minut';
    const wynik = applyAnswer(vault, pytanie, odpowiedz);
    const zapisany = wynik.history[0].highlights[0];

    expect(zapisany.metric).toBe(odpowiedz);
    expect(zapisany.text).toBe(`Planowanie pracy serwisantów — ${odpowiedz}`);

    // Każde słowo w punkcie pochodzi albo z oryginału, albo z odpowiedzi.
    const dozwolone = new Set([...'Planowanie pracy serwisantów'.split(' '), ...odpowiedz.split(' '), '—']);
    for (const slowo of zapisany.text.split(' ')) expect(dozwolone.has(slowo)).toBe(true);
  });

  it('podgląd pokazuje dokładnie ten tekst, który zostanie zapisany', () => {
    const odpowiedz = 'mniej reklamacji';
    expect(previewAnswer(vault, pytanie, odpowiedz)).toBe(
      applyAnswer(vault, pytanie, odpowiedz).history[0].highlights[0].text
    );
  });

  it('pusta odpowiedź nie kasuje tego, co już było', () => {
    expect(applyAnswer(vault, pytanie, '   ')).toBe(vault);
  });

  it('nie mutuje przekazanego vaultu', () => {
    const przed = JSON.stringify(vault);
    applyAnswer(vault, pytanie, 'coś');
    expect(JSON.stringify(vault)).toBe(przed);
  });

  it('nowe osiągnięcie dostaje identyfikator z vaultu, nie z zegara', () => {
    const pusty = vaultWith({ history: [job({ highlights: [] })] });
    const pytanieOZadanie = buildCvQuestionSet(pusty).questions.find((q) => q.id === 'highlight:exp-1')!;
    const wynik = applyAnswer(pusty, pytanieOZadanie, 'Nadzór nad przeglądami');

    expect(wynik.history[0].highlights[0].id).toBe('hl-exp-1-0');
    expect(wynik.history[0].highlights[0].text).toBe('Nadzór nad przeglądami');
  });

  it('odpowiedź o umiejętności rozbija się po przecinkach i nie dubluje wpisów', () => {
    const bezUmiejetnosci = vaultWith({
      skillsMatrix: { hardSkills: ['Spawanie MIG'], softSkills: [], toolsAndTech: ['x'], certifications: [] },
    });
    const pytanieOUmiejetnosci = {
      ...buildCvQuestionSet(createEmptyVault()).questions.find((q) => q.id === 'skills:hardSkills')!,
    };

    const wynik = applyAnswer(bezUmiejetnosci, pytanieOUmiejetnosci, 'spawanie mig, UDT, HACCP, UDT');
    expect(wynik.skillsMatrix.hardSkills).toEqual(['Spawanie MIG', 'UDT', 'HACCP']);
  });

  it('doklejanie radzi sobie z kropką na końcu oryginału', () => {
    expect(composeHighlightText('Planowanie pracy.', 'mniej opóźnień')).toBe('Planowanie pracy — mniej opóźnień');
  });
});

describe('pominięte pytania', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
    resetLastGoodCache();
  });

  const vault = vaultWith({
    history: [job({ highlights: [highlight({ text: 'Planowanie pracy serwisantów' })] })],
  });

  it('pominięte pytanie nie wraca', () => {
    const { questions } = buildCvQuestionSet(vault);
    const pominiete = questions[0].id;
    expect(buildCvQuestionSet(vault, [pominiete]).questions.some((q) => q.id === pominiete)).toBe(false);
  });

  it('identyfikator pytania przeżywa poprawienie literówki w treści osiągnięcia', () => {
    const poprawiony = vaultWith({
      history: [job({ highlights: [highlight({ text: 'Planowanie pracy serwisantow' })] })],
    });

    expect(knownQuestionIds(poprawiony)).toContain('metric:exp-1:hl-1');
    expect(buildCvQuestionSet(poprawiony, ['metric:exp-1:hl-1']).questions.some((q) => q.id === 'metric:exp-1:hl-1')).toBe(false);
  });

  it('pominięcia znikają razem ze stanowiskiem, którego dotyczyły', () => {
    const bezStanowiska = vaultWith({ history: [] });
    expect(pruneSkippedIds(vault, ['metric:exp-1:hl-1'])).toEqual(['metric:exp-1:hl-1']);
    expect(pruneSkippedIds(bezStanowiska, ['metric:exp-1:hl-1'])).toEqual([]);
  });

  it('klucz pominięć jest w rejestrze, więc znika przy „usuń moje dane”', () => {
    const key = profileDataKeyFor(StorageKeys.cvQuestionsSkipped, 'profile-a');
    saveSkippedQuestionIds('profile-a', ['metric:exp-1:hl-1']);
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(StorageKeys.cvQuestionsSkipped.startsWith('cvelocity:')).toBe(true);
    expect(loadSkippedQuestionIds('profile-a')).toEqual(['metric:exp-1:hl-1']);
  });

  it('uszkodzona zawartość schowka nie wywraca karty pytań', () => {
    localStorage.setItem(profileDataKeyFor(StorageKeys.cvQuestionsSkipped, 'profile-a'), '{"nie":"tablica"}');
    expect(loadSkippedQuestionIds('profile-a')).toEqual([]);
  });

  it('pominięcia jednego profilu nie ukrywają pytań w drugim', () => {
    saveSkippedQuestionIds('profile-a', ['metric:exp-1:hl-1']);
    expect(loadSkippedQuestionIds('profile-a')).toEqual(['metric:exp-1:hl-1']);
    expect(loadSkippedQuestionIds('profile-b')).toEqual([]);
  });

  it('zastąpienie odpowiedzi w slocie nie kumuluje myślników i podmienia poprzednią wartość', () => {
    const text1 = composeHighlightText('Obsługa obrabiarek', 'Sinumerik');
    expect(text1).toBe('Obsługa obrabiarek — Sinumerik');

    // Podmiana narzędzia z Sinumerik na Heidenhain
    const text2 = composeHighlightText(text1, 'Heidenhain', 'Sinumerik');
    expect(text2).toBe('Obsługa obrabiarek — Heidenhain');

    // Ponowne podanie tej samej odpowiedzi nie dubluje jej
    const text3 = composeHighlightText(text2, 'Heidenhain');
    expect(text3).toBe('Obsługa obrabiarek — Heidenhain');
  });
});
