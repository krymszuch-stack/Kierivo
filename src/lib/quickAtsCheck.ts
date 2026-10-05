import { MasterVault, TailoredResume, AtsCheckResult } from '../types';
import { parseTextToMasterVault, type ParsedCVResult } from './cvUniversalParser';
import { MAX_DOCUMENT_TEXT_CHARS } from './textNormalization';
import { vaultFromParsedCv } from './cvIngestionEngine';
import { extractDynamicJdPhrases, simulateAtsCheck } from './atsSimulator';
import { scoreCanonicalAts, getCanonicalScoreBand, CANONICAL_SCORE_BAND_LABELS, type CanonicalAtsScore } from './canonicalAts';
import { auditKnockouts, type KnockoutReport } from './knockouts';
import {
  bestSubRoleMatch,
  suggestedProfileForSector,
  type SubRoleMatch,
} from './specializationIndex';

/**
 * Szybkie sprawdzenie CV pod kątem oferty — bez konta, bez serwera.
 *
 * To jest logika klina wejściowego: użytkownik wkleja CV i ogłoszenie, dostaje
 * wynik w kilka sekund i nie zakłada po drodze żadnego konta. Cała ścieżka jest
 * **czysto lokalna** — żadne z tych wywołań nie sięga do sieci, więc dokument
 * nie opuszcza urządzenia. To jedyna rzecz, której portal pracy nie może
 * skopiować, bo jego model wymaga dokładnie odwrotnego.
 *
 * Funkcja jest wydzielona z komponentu celowo: dzięki temu da się ją przetestować
 * bez renderowania interfejsu i bez atrapy przeglądarki.
 */

export interface QuickCheckResult {
  ats: AtsCheckResult;
  /** Jedyny główny wynik dopasowania, wspólny z widokiem zaawansowanym. */
  canonicalResult: CanonicalAtsScore;
  vault: MasterVault;
  parsed: ParsedCVResult;
  /** Braki wypisane wprost — to jest ta wartość, którą użytkownik pokazuje dalej. */
  missingSkills: string[];
  /**
   * Wymagania formalne ogłoszenia zestawione z profilem.
   *
   * Dla zawodów technicznych i fizycznych to jest **ważniejsze niż wynik
   * procentowy**: aplikacja montera nie odpada na gęstości słów kluczowych,
   * tylko na braku SEP-u, UDT albo orzeczenia sanepidu. Sam wynik ATS tego nie
   * pokazywał, bo mierzy co innego.
   */
  knockouts: KnockoutReport;
  /**
   * Rozpoznana specjalizacja albo `null`, gdy nic nie trafiło wystarczająco
   * pewnie. Służy do podpowiedzi słownictwa branżowego — nigdy nie zmienia
   * niczego w profilu sama z siebie.
   */
  detectedSubRole: SubRoleMatch | null;
}

/**
 * Odsiewa z listy braków fragmenty zdań, które nie są umiejętnościami.
 *
 * `extractDynamicJdPhrases` wyciąga z ogłoszenia frazy, więc obok „Kubernetes"
 * trafiają się resztki w rodzaju „senior backend developera." — z kropką na
 * końcu. Na stronie wejściowej to jest szczególnie kosztowne: lista braków jest
 * całą wartością tego ekranu, a jedna bzdura w niej podważa cały wynik.
 *
 * Filtrujemy przy prezentacji, a nie w `atsSimulator` — sam scoring działa
 * dobrze i nie ma powodu ruszać go dla kosmetyki wyświetlania.
 */
function looksLikeSkill(phrase: string): boolean {
  const value = phrase.trim();
  if (value.length < 2 || value.length > 32) return false;

  // Zdania kończą się kropką; nazwy technologii (Node.js, ASP.NET) nie.
  if (/[.!?;:]$/.test(value)) return false;

  // Umiejętność to zwykle jedno–trzy słowa. Dłuższe ciągi to fragmenty zdań.
  if (value.split(/\s+/).length > 3) return false;

  // Musi zawierać litery — same liczby albo znaki interpunkcyjne to szum.
  return /\p{L}/u.test(value);
}

export function meaningfulMissingSkills(
  missingHard: string[] = [],
  missingSoft: string[] = []
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const phrase of [...missingHard, ...missingSoft]) {
    const value = (phrase ?? '').trim();
    if (!looksLikeSkill(value)) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

export class QuickCheckError extends Error {
  constructor(
    message: string,
    readonly field: 'cv' | 'jd'
  ) {
    super(message);
    this.name = 'QuickCheckError';
  }
}

/** Poniżej tylu znaków nie ma z czego liczyć sensownego wyniku. */
export const MIN_CV_CHARS = 120;
export const MIN_JD_CHARS = 80;

/**
 * Składa „życiorys pod ofertę" wyłącznie z tego, co jest w profilu.
 *
 * `atsScore` startuje z zera, a nie z optymistycznej wartości — właściwy wynik
 * nadpisuje je zaraz po symulacji. Wstawienie tu liczby w rodzaju 92 sprawiłoby,
 * że przy błędzie symulacji użytkownik zobaczyłby wysoką ocenę wziętą z powietrza.
 */
function tailoredFromVault(vault: MasterVault, jobTitle: string): TailoredResume {
  return {
    targetJobTitle: jobTitle,
    companyName: '',
    summary: vault.personalInfo.summary || '',
    selectedHighlights: vault.history.flatMap((experience) =>
      experience.highlights.map((highlight) => ({
        experienceId: experience.id,
        role: experience.role,
        company: experience.company,
        originalText: highlight.text,
        optimizedText: highlight.text,
        source: 'SLOT_FILLING' as const,
        keywordsMatched: highlight.keywords || [],
      }))
    ),
    skillsMatched: {
      hardSkills: vault.skillsMatrix?.hardSkills || [],
      toolsAndTech: vault.skillsMatrix?.toolsAndTech || [],
      softSkills: vault.skillsMatrix?.softSkills || [],
    },
    atsScore: null,
  };
}

/**
 * Pełna ścieżka: surowy tekst CV + treść ogłoszenia → wynik ATS.
 *
 * Świadomie **nie** zwracamy `gapAnalysis` (analizy przerw w zatrudnieniu).
 * Wnioskowanie z luk w historii zawodowej może pośrednio dotykać zdrowia albo
 * macierzyństwa, więc nie jest to rzecz, którą eksponuje się na stronie
 * wejściowej. Zostaje w pełnym raporcie, po stronie klienta, i nigdzie się
 * nie zapisuje — zgodnie z decyzją zapisaną w rejestrze czynności.
 */
export function runQuickAtsCheck(
  cvText: string,
  jdText: string,
  options: { format?: string; jobTitle?: string } = {}
): QuickCheckResult {
  const cv = (cvText ?? '').trim();
  const jd = (jdText ?? '').trim();

  if (cv.length < MIN_CV_CHARS) {
    throw new QuickCheckError(
      'Wklej pełną treść CV — na tak krótkim fragmencie nie da się policzyć rzetelnego wyniku.',
      'cv'
    );
  }

  if (cv.length > MAX_DOCUMENT_TEXT_CHARS) {
    throw new QuickCheckError(
      `Treść CV przekracza limit ${MAX_DOCUMENT_TEXT_CHARS.toLocaleString('pl-PL')} znaków. Skróć tekst lub podziel dokument przed analizą.`,
      'cv'
    );
  }

  if (jd.length < MIN_JD_CHARS) {
    throw new QuickCheckError('Wklej treść ogłoszenia, do którego chcesz się dopasować.', 'jd');
  }

  const parsed = parseTextToMasterVault(cv, options.format || 'TXT');
  const vault = vaultFromParsedCv(parsed);

  // Branża rozpoznana z ogłoszenia ustala, w jakiej kolejności pokazać
  // zalecenia. Monter nie potrzebuje jako pierwszej porady o gęstości tytułu
  // stanowiska — potrzebuje wiedzieć, że jego CV nie przejdzie przez parser
  // i że brakuje w nim uprawnień.
  const detectedSubRole = bestSubRoleMatch(`${options.jobTitle || ''} ${jd}`);
  const profile = detectedSubRole
    ? suggestedProfileForSector(detectedSubRole.sector.id)
    : undefined;

  const ats = simulateAtsCheck(
    tailoredFromVault(vault, options.jobTitle || ''),
    vault,
    jd,
    profile
  );
  // Ten sam CV i oferta trafiają później do JobMatcher. Szybki ekran musi
  // pokazać tę samą miarę kanoniczną, a nie równoległy wynik symulatora.
  const canonicalResult = scoreCanonicalAts(vault, jd, options.jobTitle || '');
  const canonicalMissingSkills = extractDynamicJdPhrases(jd).hardSkills
    .map(({ phrase }) => phrase)
    .filter((phrase) => canonicalResult.missingRequirements.includes(phrase));

  return {
    ats,
    canonicalResult,
    vault,
    parsed,
    missingSkills: meaningfulMissingSkills(canonicalMissingSkills),
    // Audyt liczy się lokalnie, na dopasowaniu tekstowym, i nie kosztuje ani
    // jednego tokenu. Dlatego może stać w części darmowej bez limitu — a przy
    // zawodach fizycznych to właśnie on niesie wartość.
    knockouts: auditKnockouts(jd, vault),
    detectedSubRole,
  };
}

export interface TopProblem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'formal' | 'hard_skill' | 'structure';
}

/**
 * Wybiera do 3 najważniejszych ustaleń z wyniku szybkiego sprawdzenia
 * (dla uproszczonego onboardingu). Nie dopisuje ogólnych porad, gdy analiza
 * nie znalazła tylu ustaleń.
 *
 * Kolejność priorytetów:
 * 1. Niespełnione formalne kryteria dyskwalifikujące (brak SEP, UDT, prawa jazdy itp.) — krytyczne.
 * 2. Brakujące kluczowe umiejętności techniczne z ogłoszenia — ostrzeżenia.
 * 3. Ryzyka formatowania i błędy strukturalne ATS — ostrzeżenia / zalecenia.
 * 4. Konkretne zalecenia zwrócone przez analizę, jeśli są dostępne.
 */
export function extractTopThreeProblems(result: QuickCheckResult): TopProblem[] {
  const problems: TopProblem[] = [];

  // 1. Niespełnione wymagania formalne (najwyższy priorytet - natychmiastowe odrzucenie)
  if (result.knockouts && Array.isArray(result.knockouts.findings)) {
    // `findings` zawiera też pozycje mile widziane i same wzmianki informacyjne;
    // ich brak nie może zamienić się w krytyczny brak formalny.
    const unsatisfiedKnockouts = result.knockouts.findings.filter(
      (finding) => finding.severity === 'knockout' && finding.status !== 'unknown' && !finding.satisfied,
    );
    for (const ko of unsatisfiedKnockouts) {
      if (problems.length >= 3) break;
      problems.push({
        id: `ko-${ko.ruleId}`,
        title: ko.label,
        description: ko.hint || 'Brak wymaganego uprawnienia lub kryterium formalnego w treści CV.',
        severity: 'critical',
        category: 'formal',
      });
    }
    for (const finding of result.knockouts.findings.filter(
      (item) => item.severity === 'knockout' && item.status === 'unknown',
    )) {
      if (problems.length >= 3) break;
      problems.push({
        id: `ko-unknown-${finding.ruleId}`,
        title: finding.label,
        description: finding.hint || 'Brakuje danych, aby ustalić, czy dokument jest aktualny.',
        severity: 'warning',
        category: 'formal',
      });
    }
  }

  // 2. Brakujące kluczowe umiejętności twarde
  const missingHard = Array.isArray(result.missingSkills) ? result.missingSkills : [];
  for (const skill of missingHard) {
    if (problems.length >= 3) break;
    problems.push({
      id: `skill-${skill.toLowerCase().replace(/\s+/g, '-')}`,
      title: `Nie znaleziono w CV: ${skill}`,
      description: `Sprawdź, czy „${skill}” występuje w oryginalnym CV. Jeśli masz tę umiejętność, opisz ją własnymi słowami.`,
      severity: 'warning',
      category: 'hard_skill',
    });
  }

  // Wynik „formatowania” obejmuje też kompletność kontaktu i daty. Nie
  // przypisujemy automatycznie brakującego telefonu do układu graficznego.
  if (problems.length < 3 && result.ats?.ocrWarnings?.length) {
    problems.push({
      id: 'contact-review',
      title: 'Sprawdź dane kontaktowe',
      description: result.ats.ocrWarnings.join(' '),
      severity: 'warning',
      category: 'structure',
    });
  } else if (problems.length < 3 && result.ats?.badDateFormats?.length) {
    problems.push({
      id: 'date-review',
      title: 'Sprawdź zapis dat',
      description: result.ats.badDateFormats[0],
      severity: 'warning',
      category: 'structure',
    });
  } else if (problems.length < 3 && result.ats?.layer1Structure?.unparsableElementsWarnings?.length) {
    problems.push({
      id: 'formatting-risk',
      title: 'Sprawdź układ dokumentu',
      description: result.ats.layer1Structure.unparsableElementsWarnings[0],
      severity: 'warning',
      category: 'structure',
    });
  }

  // Rekomendacje redakcyjne mogą dopełnić trzy pozycje, ale braki kompetencji
  // pochodzą wyłącznie z kanonicznej listy użytej także na ekranie wyniku.
  if (problems.length < 3 && Array.isArray(result.ats?.recommendations)) {
    for (const rec of result.ats.recommendations) {
      if (problems.length >= 3) break;
      problems.push({
        id: `rec-${problems.length}`,
        title: 'Zalecenie optymalizacyjne',
        description: rec,
        severity: 'info',
        category: 'structure',
      });
    }
  }

  return problems.slice(0, 3);
}

export interface QuickCheckScoreVisualTone {
  tone: 'high' | 'mid' | 'low';
  text: string;
  ring: string;
  label: string;
}

/**
 * Zwraca klasy stylów oraz etykietę słowną dopasowania ATS dla prostej prezentacji (QuickCheck).
 * Progi są zgodne ze specyfikacją demoTimeline: >=75 (wysokie), >=50 (umiarkowane), <50 (niskie).
 */
export function getQuickCheckScoreTone(score: number): QuickCheckScoreVisualTone {
  const band = getCanonicalScoreBand(score);
  if (band === 'high') {
    return {
      tone: 'high',
      text: 'text-success-fg',
      ring: 'stroke-success-fg',
      label: CANONICAL_SCORE_BAND_LABELS[band],
    };
  }
  if (band === 'moderate') {
    return {
      tone: 'mid',
      text: 'text-warning-fg',
      ring: 'stroke-warning-fg',
      label: CANONICAL_SCORE_BAND_LABELS[band],
    };
  }
  return {
    tone: 'low',
    text: 'text-danger-fg',
    ring: 'stroke-danger-fg',
    label: CANONICAL_SCORE_BAND_LABELS[band],
  };
}
