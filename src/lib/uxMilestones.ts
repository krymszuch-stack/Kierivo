import { JobApplication, MasterVault } from '../types';
import { NavSectionId } from './navigation';
import { StorageKeys, readJson, writeJson } from './storage';
import { measureVaultCompleteness } from './vaultCompleteness';

/**
 * Progresywne odsłanianie interfejsu.
 *
 * Aplikacja umie kilkanaście rzeczy, ale nowy użytkownik potrzebuje dwóch:
 * uzupełnić profil i sprawdzić pierwszą ofertę. Reszta w pierwszej minucie
 * jest wyłącznie hałasem, w którym łatwiej zrezygnować niż wybrać.
 *
 * Sekcje jeszcze niedostępne są **wyszarzone, nie ukryte**, i mówią wprost, co
 * je odblokuje. Ukrywanie miało jedną zaletę — czystszy ekran — i dwie wady:
 * użytkownik nie dowiadywał się, że produkt umie więcej, a element pojawiający
 * się nagle w menu wygląda na usterkę. Zablokowana pozycja z powodem jest
 * zapowiedzią, a nie ścianą, i nie wymaga od nikogo decyzji teraz.
 *
 * Odblokowania są **nieodwracalne**. Kto raz dotarł do rozmowy, ten ma
 * Zasobnik Rozmowy na stałe — także wtedy, gdy usunie tę aplikację z Pipeline.
 * Cofnięcie odblokowania czytałoby się jak odebranie czegoś za karę.
 *
 * Stan jest zapisywany w przeglądarce, bo ta instalacja nie prowadzi kont
 * (`AuthContext` zakłada profil lokalny i nie uwierzytelnia nikogo). Docelowo
 * należy do konta — dopóki nie ma logowania po stronie serwera, przeniesienie
 * go tam dałoby pole, którego nikt nie zapisuje.
 */

export type UxLevel = 1 | 2 | 3;

export interface UxMilestones {
  /** Kiedy profil przestał być pusty. */
  vaultStartedAt?: string;
  /** Kiedy pierwsza aplikacja trafiła do Pipeline. */
  firstApplicationAt?: string;
  /** Kiedy pierwszy raz umówiono rozmowę. */
  firstInterviewAt?: string;
  /** Kiedy pokazano jednorazową podpowiedź o skrótach klawiszowych. */
  shortcutsHintSeenAt?: string;
}

/** Stan, z którego wyprowadzamy poziom. Tyle i tylko tyle. */
export interface UxLiveState {
  vault: MasterVault;
  applications: JobApplication[];
}

export interface UnlockState {
  level: UxLevel;
  /** Które sekcje menu są klikalne. */
  sections: Record<NavSectionId, boolean>;
  /**
   * Czemu sekcja jest zablokowana — tekst trafia wprost do podpowiedzi
   * przy wyszarzonej pozycji menu.
   */
  reasons: Partial<Record<NavSectionId, string>>;
  /** Zasobnik Rozmowy: HUD, pętla wywiadu, debrief. */
  interviewToolbox: boolean;
  /** Czy pokazać jednorazową podpowiedź o skrótach klawiszowych. */
  showShortcutsHint: boolean;
}

const LOCK_REASONS: Record<'trenuj' | 'pipeline', string> = {
  trenuj: 'Odblokuje się, gdy zapiszesz pierwszą ofertę na liście aplikacji.',
  pipeline: 'Odblokuje się, gdy zapiszesz pierwszą ofertę z sekcji Aplikuj.',
};

/**
 * Dopisuje kamienie milowe, które wynikają z bieżącego stanu.
 *
 * Zwraca **ten sam obiekt**, gdy nic się nie zmieniło. To nie jest
 * mikrooptymalizacja: wynik ląduje w stanie Reacta, a nowa referencja przy
 * każdym wywołaniu zapętliłaby efekt, który go zapisuje — dokładnie tak, jak
 * opisano w `AuthContext.tsx` przy `saveUserVault`.
 */
export function reconcileMilestones(
  milestones: UxMilestones,
  state: UxLiveState,
  now: Date
): UxMilestones {
  const stamp = now.toISOString();
  let next: UxMilestones | null = null;

  const set = (patch: Partial<UxMilestones>) => {
    next = { ...(next ?? milestones), ...patch };
  };

  if (!milestones.vaultStartedAt && measureVaultCompleteness(state.vault).filled.length > 0) {
    set({ vaultStartedAt: stamp });
  }

  if (!milestones.firstApplicationAt && state.applications.length > 0) {
    set({ firstApplicationAt: stamp });
  }

  if (
    !milestones.firstInterviewAt &&
    state.applications.some((app) => app.status === 'Rozmowa' || app.status === 'Oferta')
  ) {
    set({ firstInterviewAt: stamp });
  }

  return next ?? milestones;
}

/**
 * Poziom wyprowadzony z kamieni milowych.
 *
 * Świadomie patrzy wyłącznie na `milestones`, nie na bieżący stan —
 * `reconcileMilestones` jest jedynym miejscem, które tłumaczy stan na kamień
 * milowy. Gdyby liczyć poziom z obu naraz, usunięcie aplikacji potrafiłoby
 * cofnąć odblokowanie, mimo że kamień milowy dalej stoi.
 */
export function levelOf(milestones: UxMilestones): UxLevel {
  if (milestones.firstInterviewAt) return 3;
  if (milestones.firstApplicationAt) return 2;
  return 1;
}

export function deriveUnlocks(milestones: UxMilestones): UnlockState {
  const level = levelOf(milestones);

  const sections: Record<NavSectionId, boolean> = {
    // Profil i Aplikuj to cała ścieżka pierwszego kroku — nigdy nie blokowane.
    profil: true,
    aplikuj: true,
    trenuj: level >= 2,
    pipeline: level >= 2,
  };

  const reasons: Partial<Record<NavSectionId, string>> = {};
  if (!sections.trenuj) reasons.trenuj = LOCK_REASONS.trenuj;
  if (!sections.pipeline) reasons.pipeline = LOCK_REASONS.pipeline;

  return {
    level,
    sections,
    reasons,
    interviewToolbox: level >= 3,
    // Skróty pokazujemy dopiero temu, kto ma z nich pożytek, i tylko raz.
    // Wcześniej pięć skrótów globalnych działało od pierwszej sekundy i nie
    // było o nich mowy nigdzie w interfejsie.
    showShortcutsHint: level >= 3 && !milestones.shortcutsHintSeenAt,
  };
}

/* --- cienka warstwa utrwalania; cała logika wyżej jest czysta --- */

export function loadMilestones(): UxMilestones {
  return readJson<UxMilestones>(StorageKeys.uxMilestones, {});
}

export function saveMilestones(milestones: UxMilestones): void {
  writeJson(StorageKeys.uxMilestones, milestones);
}
