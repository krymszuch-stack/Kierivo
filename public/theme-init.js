// Ten skrypt działa przed renderowaniem aplikacji. Zewnętrzny plik same-origin
// zachowuje ścisłe script-src bez wyjątków dla skryptów inline.
(function () {
  try {
    var stored = globalThis.localStorage.getItem('cvelocity-theme');
    var resolved =
      stored === 'light' || stored === 'dark'
        ? stored
        : stored === 'system' || !stored
          ? (globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : 'dark';
    // Bez zapisanej preferencji wygrywa ciemny motyw startowy.
    if (!stored) resolved = 'dark';
    globalThis.document.documentElement.setAttribute('data-theme', resolved);
    globalThis.document.documentElement.classList.toggle('dark', resolved === 'dark');
  } catch {
    /* Niedostępny localStorage — pozostaw ciemny motyw startowy. */
  }
})();
