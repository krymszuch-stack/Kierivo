import { api } from './apiClient';
import type { ParsedJobDescription } from './jdParser';

/**
 * Cicha kontrybucja do wspólnej bazy wiedzy o pracodawcach.
 *
 * Zasada: wychodzą wyłącznie metadane ogłoszenia — nazwa firmy, stanowisko,
 * wymagane umiejętności, widełki, adres źródła. Nic z vaultu, nic z CV, nic
 * z notatek. Ogłoszenie było publiczne, zanim ktokolwiek je wkleił; profil
 * użytkownika nie był i nie będzie.
 *
 * Wszystko jest „best effort": błąd sieci, tryb lokalny (501) czy limit (429)
 * nie mogą przerwać tego, co użytkownik faktycznie robił. Dlatego funkcje niżej
 * nie rzucają wyjątkami i nie zwracają wyniku do pokazania — wołający ma je
 * odpalić i zapomnieć.
 */

/** „12 000 – 15 000 zł" → `[12000, 15000]`. `null`, gdy nie da się odczytać. */
export function parseSalaryRange(raw: string | undefined): [number | null, number | null] {
  if (!raw) return [null, null];

  // Spacje zwykłe i niełamliwe rozdzielają tysiące; przecinek bywa separatorem
  // dziesiętnym. Bez tego „12 000" czytało się jako 12.
  const numbers = raw
    .replace(/[\u00a0\u202f]/g, ' ')
    .match(/\d[\d ]*(?:[.,]\d+)?/g)
    ?.map((token) => Number(token.replace(/ /g, '').replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numbers || numbers.length === 0) return [null, null];
  if (numbers.length === 1) return [numbers[0], null];

  const sorted = [...numbers].sort((a, b) => a - b);
  return [sorted[0], sorted[sorted.length - 1]];
}

export interface JobIntelContribution {
  companyName: string;
  jobTitle: string;
  requiredSkills: string[];
  interviewQuestions: string[];
  salaryRangeMin: number | null;
  salaryRangeMax: number | null;
  sourceUrl: string | null;
}

/**
 * Buduje ładunek z rozpoznanego ogłoszenia. Osobno od wysyłki, żeby dało się
 * sprawdzić w Node, co dokładnie wychodzi z przeglądarki — to jedyny moment,
 * w którym można wyłapać, że coś prywatnego przecieka do wspólnej bazy.
 */
export function buildJobIntel(parsed: ParsedJobDescription): JobIntelContribution | null {
  const companyName = parsed.companyName?.trim() ?? '';
  const jobTitle = parsed.jobTitle?.trim() ?? '';

  // Bez firmy albo bez stanowiska wpis jest bezużyteczny dla kogokolwiek
  // innego. Lepiej nie dokładać wiersza niż dokładać śmieć.
  if (companyName.length < 2 || jobTitle.length < 2) return null;

  const [min, max] = parseSalaryRange(parsed.salaryRange);

  return {
    companyName,
    jobTitle,
    requiredSkills: [...new Set([...(parsed.requiredHardSkills ?? []), ...(parsed.toolsAndTech ?? [])])]
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0 && skill.length <= 80)
      .slice(0, 60),
    interviewQuestions: [],
    salaryRangeMin: min,
    salaryRangeMax: max,
    sourceUrl: parsed.sourceUrl ?? null,
  };
}

/** Odpal i zapomnij: dokłada ogłoszenie do wspólnego korpusu. */
export function contributeJobIntel(parsed: ParsedJobDescription): void {
  const payload = buildJobIntel(parsed);
  if (!payload) return;
  void api.post('/api/intel/job', payload).catch(() => undefined);
}

/** Pytanie faktycznie zadane na rozmowie — najcenniejsze, bo niepubliczne. */
export function contributeInterviewQuestion(
  companyName: string,
  jobTitle: string,
  question: string
): Promise<boolean> {
  const trimmed = question.trim();
  if (companyName.trim().length < 2 || jobTitle.trim().length < 2 || trimmed.length < 3) {
    return Promise.resolve(false);
  }

  return api
    .post('/api/intel/job', {
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      requiredSkills: [],
      interviewQuestions: [trimmed.slice(0, 400)],
    })
    .then(() => true)
    .catch(() => false);
}
