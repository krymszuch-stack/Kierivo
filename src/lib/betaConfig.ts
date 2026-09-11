/**
 * Jedno źródło prawdy o konfiguracji i statusie wersji Beta w aplikacji.
 *
 * Wszystkie teksty, flagi dostępności zakupów i oznaczenia wersji odwołują się
 * do tego modułu, aby zapobiec rozjazdowi informacji w różnych widokach (reguła 3).
 */

export const IS_BETA = true;
export const BETA_VERSION = '0.1.0-beta';
export const BETA_LABEL = 'Bezpłatna Beta';
export const BETA_BADGE = 'BETA';

export const BETA_NOTICE =
  'Trwa faza bezpłatnych testów beta. Zakupy są wyłączone, a podstawowe funkcje aplikacji są dostępne bezpłatnie w ramach dobowych limitów serwera.';

export const PURCHASES_DISABLED_REASON =
  'Zakupy i płatne subskrypcje są wyłączone w trakcie trwania bezpłatnej bety. Wszyscy testerzy korzystają z bezpłatnego dostępu testerskiego.';

export const OUT_OF_SCOPE_NOTICE =
  'Ta funkcja jest poza zakresem bezpłatnej wersji beta i pozostaje wyłączona.';
