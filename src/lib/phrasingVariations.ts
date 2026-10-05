/**
 * Bank dynamicznych wariantów językowych (hooki, przywitania, wstępy, call-to-action).
 * Zapobiega powtarzalności i „szablonowości” w generatorach autoprezentacji,
 * listów motywacyjnych, podziękowań po rozmowie i telepromptera Live HUD.
 * Gwarantuje 0-tokenowe generowanie naturalnego, nieszablonowego języka polskiego.
 */

export interface HookContext {
  candidateName: string;
  roleTitle: string;
  companyName?: string;
  topSkills?: string;
  topMetric?: string;
  secondMetric?: string;
  companyContext?: string;
}

export type PhrasingTone = 'METRIC_FOCUSED' | 'TECHNICAL_EXPERT' | 'PRACTICAL_IMPACT' | 'BUSINESS_ROI' | 'DIRECT_CONFIDENT';

/**
 * Zwraca stabilny indeks wariantu na podstawie wejściowego ciągu znaków (hash) lub podanego indeksu.
 */
export function selectVariantIndex(seed: string | number | undefined, totalVariants: number): number {
  if (totalVariants <= 0) return 0;
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.abs(Math.floor(seed)) % totalVariants;
  }
  if (typeof seed === 'string' && seed.length > 0) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % totalVariants;
  }
  return 0;
}

/**
 * 1. Bank Hooków do Autoprezentacji / Elevator Pitch (Live HUD, ConsistencyGuard, PitchModal)
 */
export function getPitchHookVariations(ctx: HookContext): string[] {
  const { candidateName, roleTitle } = ctx;
  const nameIntroduction = candidateName ? `Nazywam się ${candidateName}. ` : '';
  const roleContext = roleTitle ? ` w kontekście stanowiska ${roleTitle}` : '';

  return [
    `${nameIntroduction}Przedstawiam wybrane informacje z mojego profilu${roleContext}.`,
    `${nameIntroduction}Chcę omówić kilka wpisów z profilu${roleContext}.`,
    `${nameIntroduction}W tym wprowadzeniu odwołam się do informacji zapisanych w moim profilu${roleContext}.`,
    `${nameIntroduction}Dzień dobry. Poniżej przedstawiam wpisy z mojego profilu, które chcę omówić${roleContext}.`,
    `${nameIntroduction}Przygotowuję krótkie wprowadzenie na podstawie informacji z profilu${roleContext}.`,
    `${nameIntroduction}Chcę przedstawić informacje zapisane w moim profilu i omówić je${roleContext}.`,
  ];
}

/**
 * 2. Bank Zakończeń / Call to Action do Autoprezentacji (Pitch)
 */
export function getPitchCtaVariations(ctx: HookContext): string[] {
  const { roleTitle } = ctx;
  const roleContext = roleTitle ? ` dotyczące stanowiska ${roleTitle}` : '';

  return [
    `Mogę doprecyzować zakres informacji zapisanych w poszczególnych wpisach.`,
    `Chętnie odpowiem na pytania dotyczące przedstawionych danych${roleContext}.`,
    `Dziękuję za rozmowę. Chętnie poznam dalsze kroki procesu rekrutacyjnego.`,
    `Jeśli potrzebny jest dodatkowy kontekst, mogę go uzupełnić podczas rozmowy.`,
    `Chętnie omówię przedstawione informacje i wymagania stanowiska${roleTitle ? ` ${roleTitle}` : ''}.`,
  ];
}

/**
 * 3. Bank Nagłówków Grzecznościowych do Listu Motywacyjnego
 */
export function getCoverLetterSalutations(companyName?: string): string[] {
  const companySuffix = companyName && companyName !== 'Państwa Firmie' ? ` firmy ${companyName}` : '';
  return [
    'Szanowni Państwo,',
    `Szanowny Zespole Rekrutacji${companySuffix},`,
    `Szanowny Zespole${companySuffix},`,
    'Dzień dobry,',
  ];
}

/**
 * 4. Bank Wstępów (Hooków) do Listu Motywacyjnego (Anti-Template Cover Letter)
 * Poprawne gramatycznie formy w języku polskim, zróżnicowane stylistycznie.
 */
export function getCoverLetterHookVariations(ctx: HookContext): string[] {
  const { roleTitle, companyName = 'Państwa Firmie', topSkills, topMetric } = ctx;
  const profileSkills = topSkills ? ` W profilu wymieniono: ${topSkills}.` : '';
  const profileMetric = topMetric ? ` W profilu zapisano też wartość: ${topMetric}.` : '';

  return [
    `Zgłaszam kandydaturę na stanowisko ${roleTitle} w firmie ${companyName}.${profileSkills}${profileMetric}`,
    `Aplikuję na stanowisko ${roleTitle} w firmie ${companyName}.${profileSkills}`,
    `Przedstawiam swoją kandydaturę w rekrutacji na stanowisko ${roleTitle} w firmie ${companyName}.${profileMetric}`,
    `W odpowiedzi na rekrutację ${companyName} na stanowisko ${roleTitle} przekazuję swoją aplikację.${profileSkills}`,
    `Proszę o rozważenie mojej kandydatury na stanowisko ${roleTitle} w firmie ${companyName}.${profileSkills}`,
    `Przesyłam aplikację na stanowisko ${roleTitle} w firmie ${companyName}.${profileMetric}`,
    `Chcę wziąć udział w rekrutacji na stanowisko ${roleTitle} w firmie ${companyName}.${profileSkills}`,
    `Zainteresowała mnie rekrutacja ${companyName} na stanowisko ${roleTitle}; przedstawiam swoją kandydaturę.${profileSkills}`,
  ];
}

/**
 * 5. Bank Fraz Wprowadzających do Dowodów i Osiągnięć (Proof Points Bridges)
 */
export function getCoverLetterProofIntroductions(): string[] {
  return [
    'Poniżej znajdują się wybrane wpisy z mojego profilu:',
    'Wybrane informacje z profilu dotyczące doświadczenia i projektów:',
    'W profilu zapisano następujące przykłady:',
    'Poniższe wpisy pochodzą z mojego profilu:',
    'Wybrane punkty z historii i projektów zapisanych w profilu:',
    'Informacje z profilu powiązane z ogłoszeniem:',
  ];
}

/**
 * 6. Bank Zakończeń (CTA) do Listu Motywacyjnego
 */
export function getCoverLetterCtaVariations(companyName = 'Państwa Firmie'): string[] {
  return [
    `Chętnie omówię informacje z mojego profilu w kontekście rekrutacji w firmie ${companyName}.`,
    `Mogę doprecyzować, czego dotyczą wpisy przedstawione w liście.`,
    `Dziękuję za zapoznanie się z moją aplikacją.`,
    `Chętnie odpowiem na pytania dotyczące informacji zawartych w moim profilu.`,
    `Pozostaję do dyspozycji w sprawie rekrutacji w firmie ${companyName}.`,
    `Proszę o informację o kolejnych krokach rekrutacji.`,
  ];
}

/**
 * 7. Bank Pożegnań do Listu Motywacyjnego
 */
export function getCoverLetterSignOffs(): string[] {
  return [
    'Z poważaniem,',
    'Z wyrazami szacunku,',
    'Łączę wyrazy szacunku,',
  ];
}
