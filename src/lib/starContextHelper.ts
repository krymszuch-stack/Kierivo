/**
 * starContextHelper.ts — Logika dynamicznego dobierania kontekstu STAR
 * na podstawie nazwy stanowiska (Lekarz, Monter, Magazynier, Handlowiec, IT itp.)
 */

export type IndustryDomain = 'medical' | 'tech' | 'logistics' | 'sales' | 'mgmt' | 'it' | 'general';

export interface StarContextConfig {
  domain: IndustryDomain;
  domainLabel: string;
  placeholder: string;
  defaultVerbs: string[];
}

export function detectIndustryFromRole(roleTitle?: string): IndustryDomain {
  if (!roleTitle || typeof roleTitle !== 'string') return 'general';
  const norm = roleTitle.toLowerCase();

  // Medycyna / Zdrowie
  if (
    /(lekarz|doktor|pielęgniar|ratownik|medyc|farmaceut|fizjoterapeut|rehabilitant|szpital|przychodni|dentyst|stomatolog|położn|diagnost)/i.test(
      norm
    )
  ) {
    return 'medical';
  }

  // Techniczne / Monter / Spawacz / Utrzymanie Ruchu / Budownictwo
  if (
    /(monter|spawacz|instalator|elektryk|mechanik|serwisant|technik|budowl|operator maszyn|utrzyman|tokarz|ślusarz|cieśla|hydraulik|automatyk)/i.test(
      norm
    )
  ) {
    return 'tech';
  }

  // Magazyn / Logistyka / Kierowca
  if (
    /(magazyn|wózk|logist|kierowca|spedytor|kurier|dyspozytor|zaopatrzeni|wms|dostawc)/i.test(
      norm
    )
  ) {
    return 'logistics';
  }

  // Sprzedaż / Obsługa klienta / Gastronomia
  if (
    /(sprzeda|handlow|account|doradca|kasjer|kelner|barista|recepcjon|b2b|call center|obsług|przedstawiciel|reprezentant)/i.test(
      norm
    )
  ) {
    return 'sales';
  }

  // Zarządzanie / HR / Finanse / Administracja
  if (
    /(menedżer|manager|kierownik|dyrektor|lider|koordynator|rekruter|księgow|analityk|administracj|hr|kadrow)/i.test(
      norm
    )
  ) {
    return 'mgmt';
  }

  // IT & Software
  if (
    /(developer|programist|inżynier oprogramowania|frontend|backend|fullstack|devops|tester|qa|data|software|administrator it|sieciow)/i.test(
      norm
    )
  ) {
    return 'it';
  }

  return 'general';
}

export function getStarContextConfig(roleTitle?: string): StarContextConfig {
  const domain = detectIndustryFromRole(roleTitle);

  switch (domain) {
    case 'medical':
      return {
        domain: 'medical',
        domainLabel: 'Medycyna & Zdrowie',
        placeholder: 'Opisz własne działania dotyczące pacjentów i potwierdzony rezultat. Nie wpisuj szacowanych liczb.',
        defaultVerbs: [
          'Przeprowadziłem procedury',
          'Wdrożyłem procedurę triage',
          'Zdiagnozowałem i zabezpieczyłem',
          'Skróciłem czas oczekiwania pacjentów o',
          'Skoordynowałem dyżur medyczny',
          'Nadzorowałem opiekę nad',
        ],
      };

    case 'tech':
      return {
        domain: 'tech',
        domainLabel: 'Techniczne & Produkcja',
        placeholder: 'Opisz własną diagnozę awarii lub montaż i potwierdzony rezultat. Uprawnienia podaj tylko, jeśli je posiadasz.',
        defaultVerbs: [
          'Zmontowałem i podłączyłem',
          'Zdiagnozowałem i naprawiłem',
          'Wykonałem spawy (TIG/MAG)',
          'Skróciłem czas przestoju linii o',
          'Przeprowadziłem próby ciśnieniowe',
          'Wdrożyłem plan prewencji TPM',
        ],
      };

    case 'logistics':
      return {
        domain: 'logistics',
        domainLabel: 'Magazyn & Logistyka',
        placeholder: 'Opisz własną pracę magazynową i użycie WMS tylko, jeśli rzeczywiście z niego korzystałeś.',
        defaultVerbs: [
          'Zoptymalizowałem strefę w WMS',
          'Obsługiwałem wózek (UDT)',
          'Zredukowałem uszkodzenia palet o',
          'Zwiększyłem wydajność pobrań do',
          'Skoordynowałem odprawę aut ciężarowych',
          'Przeprowadziłem inwentaryzację',
        ],
      };

    case 'sales':
      return {
        domain: 'sales',
        domainLabel: 'Sprzedaż & Klient',
        placeholder: 'Opisz własną pracę z kontrahentami i potwierdzony rezultat. Nie wpisuj szacowanych liczb.',
        defaultVerbs: [
          'Wynegocjowałem warunki',
          'Zwiększyłem sprzedaż o',
          'Pozyskałem nowych klientów kluczowych',
          'Podniosłem wskaźnik satysfakcji CSAT do',
          'Skróciłem czas finalizacji transakcji o',
          'Wdrożyłem standardy obsługi',
        ],
      };

    case 'mgmt':
      return {
        domain: 'mgmt',
        domainLabel: 'Zarządzanie & Operacje',
        placeholder: 'Opisz własną pracę w zespole i potwierdzony rezultat. Nie wpisuj szacowanych liczb.',
        defaultVerbs: [
          'Zreorganizowałem proces',
          'Wynegocjowałem oszczędności na poziomie',
          'Wdrożyłem system obiegu zadań',
          'Skoordynowałem zespół realizujący',
          'Przeprowadziłem audyt zgodności',
          'Zoptymalizowałem budżet operacyjny o',
        ],
      };

    case 'it':
      return {
        domain: 'it',
        domainLabel: 'IT & Software',
        placeholder: 'Opisz własną pracę przy oprogramowaniu. Nie dopisuj mikroserwisów, jeśli ich nie używałeś.',
        defaultVerbs: [
          'Zaprojektowałem i wdrożyłem',
          'Zoptymalizowałem zapytania SQL/indeksy',
          'Zautomatyzowałem potok CI/CD',
          'Zrefaktoryzowałem kluczowy moduł',
          'Zredukowałem czas ładowania (LCP) o',
          'Zmigrowałem infrastrukturę do',
        ],
      };

    default:
      return {
        domain: 'general',
        domainLabel: 'Wzorce Uniwersalne',
        placeholder: 'Opisz [zadanie/projekt], rzeczywiście użyte narzędzie i potwierdzony rezultat.',
        defaultVerbs: [
          'Zoptymalizowałem',
          'Wdrożyłem',
          'Zdiagnozowałem i naprawiłem',
          'Zrealizowałem projekt',
          'Zredukowałem czas/koszty o',
          'Skoordynowałem działania',
        ],
      };
  }
}
