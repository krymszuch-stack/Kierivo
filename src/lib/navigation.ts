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

/** Cztery kroki podróży. To jest to, co widać w pasku bocznym. */
export type NavSectionId = 'profil' | 'aplikuj' | 'trenuj' | 'pipeline';

/**
 * Ekrany poza czterema sekcjami. `home` to ekran startowy z rekomendacją
 * „następny krok", `pricing` siedzi w menu konta, a `ats-lab` to dedykowane
 * laboratorium audytu wielosilnikowego.
 */
export type NavTabId = NavSectionId | 'home' | 'pricing' | 'ats-lab' | 'porady' | 'biblioteka';

export const NAV_SECTION_IDS: readonly NavSectionId[] = [
  'profil',
  'aplikuj',
  'trenuj',
  'pipeline',
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
    hint: 'Twoje dane, doświadczenie i preferencje — jedno źródło dla wszystkich dokumentów.',
  },
  {
    id: 'aplikuj',
    label: 'Sprawdź dopasowanie',
    hint: 'Wklej ofertę, zobacz dopasowanie i przygotuj dokument do wysłania.',
  },
  {
    id: 'trenuj',
    label: 'Trenuj',
    hint: 'Przygotowanie do rozmowy: pitch, mosty kompetencyjne, pułapki, próbne pytania.',
  },
  {
    id: 'pipeline',
    label: 'Moje aplikacje',
    hint: 'Wysłane aplikacje, ich etapy i notatki z rozmów. Tu nic nie wpada do czarnej dziury.',
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
  cockpit: 'trenuj',
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
    value === 'pricing' ||
    value === 'ats-lab' ||
    value === 'porady' ||
    value === 'biblioteka'
  )
    return value;
  return LEGACY_TAB_MAP[value] ?? 'home';
}
