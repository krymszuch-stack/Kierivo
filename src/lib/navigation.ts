/**
 * Jedyne miejsce, które wie, z jakich sekcji składa się ta aplikacja.
 *
 * Wcześniej lista była w dwóch kopiach: `NavTabId` w `GlobalShell.tsx`
 * wyliczał osiem identyfikatorów, a `Sidebar.tsx` budował obok własną tablicę
 * `navItems` z etykietami. Dołożenie sekcji wymagało trafienia w oba miejsca,
 * a rozjazd między nimi kończył się pozycją w menu prowadzącą do pustego
 * ekranu — zakładka istniała w typie, ale nie w tablicy albo odwrotnie.
 *
 * Ośmiu pozycji już nie ma. Zostały cztery czasowniki opisujące kolejne kroki
 * jednej podróży: uzupełnij PROFIL → APLIKUJ na ofertę → TRENUJ przed rozmową
 * → śledź APLIKACJE. Moduły, które były osobnymi pozycjami menu (Wczytaj CV,
 * Filtry i Priorytety), stały się krokami wewnątrz sekcji, bo żaden z nich nie
 * jest celem sam w sobie — są sposobem na uzupełnienie profilu.
 */

/** Główne sekcje aplikacji (model Kierivo 11/10). */
export type NavSectionId = 'profil' | 'aplikuj' | 'trenuj' | 'cv' | 'pipeline';

/**
 * Ekrany aplikacji. Obok głównych obiektów kariery (`profil`, `aplikuj`, `cv`, `pipeline`)
 * obejmuje `home` (Start), `trenuj` (Rozmowy / Trening powiązany z aplikacją),
 * `ats-lab`, `pricing`, `porady` i `biblioteka`.
 */
export type NavTabId =
  | NavSectionId
  | 'home'
  | 'pricing'
  | 'ats-lab'
  | 'porady'
  | 'biblioteka';

export const NAV_SECTION_IDS: readonly NavSectionId[] = [
  'profil',
  'aplikuj',
  'cv',
  'pipeline',
  'trenuj',
] as const;

export function isNavSectionId(value: string): value is NavSectionId {
  return (NAV_SECTION_IDS as readonly string[]).includes(value);
}

export interface NavSection {
  id: NavSectionId;
  label: string;
  /**
   * Co ta sekcja robi, zdaniem w drugiej osobie. Pokazywane w podpowiedzi
   * pozycji menu — użytkownik ma wiedzieć, co go czeka, zanim kliknie.
   */
  hint: string;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'profil',
    label: 'Profil',
    hint: 'Twoje dane, doświadczenie i umiejętności — jedno źródło prawdy dla wszystkich dokumentów.',
  },
  {
    id: 'aplikuj',
    label: 'Oferty',
    hint: 'Wklej link lub treść ogłoszenia, sprawdź dopasowanie i odkryj ukryte kompetencje.',
  },
  {
    id: 'cv',
    label: 'CV',
    hint: 'Workspace życiorysu, live preview, dopasowanie pod ofertę i eksport do PDF.',
  },
  {
    id: 'pipeline',
    label: 'Aplikacje',
    hint: 'Oś czasu procesu rekrutacyjnego, statusy i przygotowanie do rozmów.',
  },
] as const;

/**
 * Gdzie wylądował moduł, który kiedyś był osobną zakładką.
 *
 * Potrzebne, bo identyfikatory starych zakładek siedzą jeszcze w kodzie —
 * `WelcomeWizard` kieruje na `vault` i `parser`, `HomeView` na `matcher`.
 * Zamiast poprawiać każde wywołanie z osobna i przeoczyć jedno (reguła 4
 * w `AGENTS.md` — poprawiaj klasę, nie wystąpienie), tłumaczenie jest w jednym
 * miejscu, przez które przechodzi każda nawigacja.
 */
const LEGACY_TAB_MAP: Record<string, NavTabId> = {
  vault: 'profil',
  parser: 'profil',
  profiler: 'profil',
  consistency: 'profil',
  matcher: 'aplikuj',
  oferty: 'aplikuj',
  generator: 'cv',
  cv: 'cv',
  cockpit: 'trenuj',
  trenuj: 'trenuj',
  applications: 'pipeline',
};

/**
 * Sprowadza dowolny identyfikator zakładki — nowy albo sprzed konsolidacji —
 * do jednej z obecnych sekcji. Nieznana wartość ląduje na ekranie startowym,
 * bo pusty ekran jest gorszy od ekranu nie tego, co się kliknęło.
 */
export function resolveTabId(value: string): NavTabId {
  if (
    isNavSectionId(value) ||
    value === 'home' ||
    value === 'trenuj' ||
    value === 'pricing' ||
    value === 'ats-lab' ||
    value === 'porady' ||
    value === 'biblioteka'
  )
    return value;
  return LEGACY_TAB_MAP[value] ?? 'home';
}
