import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Konfiguracja celowo wąska.
 *
 * `npm run lint` sprawdzał do tej pory wyłącznie typy (`tsc --noEmit`), więc
 * klasa błędów, których typy nie łapią — zależności efektów Reacta, niedomknięte
 * `await`, `any` przemycone przez granicę modułu — przechodziła bez śladu.
 *
 * Nie włączamy zestawu `stylistic`: formatowanie to nie jest problem, który ten
 * projekt ma, a setki ostrzeżeń o cudzysłowach zakopałyby te kilka reguł, które
 * faktycznie wyłapują błędy.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      // Osobny projekt npm z własnym tsconfigiem i własnymi zależnościami.
      'semantic-work-graph/**',
      // To samo dotyczy próbek integracji: własny `package.json`, własne
      // `node_modules` i własna wersja SDK. Sprawdzane komendą `lint` z katalogu
      // danej próbki, nie stąd.
      'samples/**',
      // Funkcje brzegowe biegną na Deno: globalne `Deno`, importy `jsr:`
      // i własne typy. Dla konfiguracji Node są nieparsowalne.
      'supabase/functions/**',
      'scripts/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Nieużywana zmienna to zwykle ślad po niedokończonej zmianie. Prefiks `_`
      // zostaje furtką na świadomie pominięte argumenty — konwencja jest już
      // używana w kodzie serwera (`_req`, `_next`).
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // `any` bywa uzasadnione na granicy z bibliotekami bez typów, ale ma być
      // decyzją, a nie przypadkiem.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Cztery zgłoszenia w istniejącym kodzie (App, CommandPalette,
      // ApplicationModal, GeminiAdvisorModal). To są realne uwagi projektowe —
      // synchroniczne setState w efekcie powoduje kaskadę renderów, a ten
      // projekt już raz się o to potknął ("Maximum update depth exceeded",
      // patrz komentarz w src/context/AuthContext.tsx). Zostają jako
      // ostrzeżenia, a nie błędy, bo poprawianie ich w tej samej zmianie co
      // warstwa backendu oznaczałoby modyfikowanie zachowania czterech ekranów
      // przy okazji. Do zrobienia osobno, z możliwością przetestowania skutków.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  }
);
