/**
 * Warstwa widoku — proste HTML renderowane po stronie serwera.
 *
 * Próbka celowo nie używa Reacta, choć aplikacja jest w Reakcie. Powód:
 * integracja ma być czytelna linia po linii, a każdy krok — od formularza do
 * przekierowania na Stripe'a — ma być widoczny w jednym pliku obok wywołania
 * API. Budowanie osobnego frontu zakopałoby to, co jest tu do pokazania.
 *
 * Kolory i typografia są wzięte z aplikacji (`src/views/LandingView.tsx`):
 * granat #1E3A5F, pomarańcz #F26440, błękit #38BDF8.
 */

/**
 * Ucieczka znaków w treści wstawianej do HTML.
 *
 * To nie jest ozdoba: nazwa sprzedawcy i nazwa produktu pochodzą z formularza,
 * a więc od użytkownika. Bez tego pole „nazwa" z treścią `<script>` wykonałoby
 * się każdemu, kto otworzy sklep. Każda interpolacja w tym pliku i w trasach
 * przechodzi przez `esc()` — wyjątkiem są wartości, które sami wygenerowaliśmy
 * (identyfikatory Stripe'a, kwoty po sformatowaniu).
 */
export function esc(wartosc: unknown): string {
  return String(wartosc ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Kwota w groszach/centach → czytelny napis, np. `49,00 USD`. */
export function formatujKwote(wMinorUnits: number, waluta: string): string {
  return `${(wMinorUnits / 100).toFixed(2).replace('.', ',')} ${waluta.toUpperCase()}`;
}

const STYLE = `
  :root {
    --granat: #1E3A5F;
    --granat-ciemny: #10203A;
    --pomarancz: #F26440;
    --blekit: #38BDF8;
    --tlo: #F4F6F8;
    --panel: #FFFFFF;
    --linia: #D8E0E8;
    --tekst: #10203A;
    --tekst-drugi: #55677A;
    --zielony: #1B7A50;
    --zielony-tlo: #E6F3EC;
    --bursztyn: #9A6608;
    --bursztyn-tlo: #FAF0DC;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--tlo);
    color: var(--tekst);
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  header {
    background: var(--granat-ciemny);
    color: #fff;
    padding: 18px 24px;
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
  }
  header .marka { font-weight: 700; font-size: 17px; letter-spacing: -0.02em; }
  header .marka span { color: var(--pomarancz); }
  header nav { display: flex; gap: 18px; flex-wrap: wrap; }
  header nav a { color: #C7D4E2; text-decoration: none; font-size: 14px; }
  header nav a:hover, header nav a:focus-visible { color: #fff; text-decoration: underline; }
  header .tryb {
    margin-left: auto;
    font-size: 12px;
    background: rgba(56,189,248,.15);
    color: var(--blekit);
    padding: 4px 10px;
    border-radius: 3px;
  }
  main { max-width: 940px; margin: 0 auto; padding: 28px 24px 72px; }
  h1 { font-size: 26px; letter-spacing: -0.02em; margin: 0 0 8px; }
  h2 { font-size: 18px; letter-spacing: -0.01em; margin: 32px 0 12px; }
  p.wstep { color: var(--tekst-drugi); margin: 0 0 24px; max-width: 68ch; }
  section.panel {
    background: var(--panel);
    border: 1px solid var(--linia);
    border-radius: 4px;
    padding: 20px 22px;
    margin-bottom: 18px;
  }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 5px; }
  input, textarea, select {
    width: 100%;
    padding: 9px 11px;
    border: 1px solid var(--linia);
    border-radius: 3px;
    font: inherit;
    background: #fff;
    color: inherit;
  }
  input:focus-visible, textarea:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible {
    outline: 2px solid var(--blekit);
    outline-offset: 2px;
  }
  .pola { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
  .pola > .szerokie { grid-column: 1 / -1; }
  button, a.przycisk {
    display: inline-block;
    margin-top: 16px;
    padding: 10px 18px;
    background: var(--pomarancz);
    color: #fff;
    border: none;
    border-radius: 3px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
  }
  button:hover, a.przycisk:hover { background: #D9481F; }
  a.przycisk.wtorny { background: var(--granat); }
  a.przycisk.wtorny:hover { background: var(--granat-ciemny); }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 11px 12px; border-bottom: 1px solid var(--linia); vertical-align: top; font-size: 14px; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--tekst-drugi); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: var(--tlo); padding: 1px 5px; border-radius: 2px; }
  .znacznik { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 9px; border-radius: 3px; white-space: nowrap; }
  .znacznik.gotowe { background: var(--zielony-tlo); color: var(--zielony); }
  .znacznik.czeka { background: var(--bursztyn-tlo); color: var(--bursztyn); }
  .pusty { color: var(--tekst-drugi); font-style: italic; padding: 14px 0; }
  .komunikat { padding: 13px 16px; border-radius: 3px; margin-bottom: 18px; border-left: 3px solid; }
  .komunikat.blad { background: #FBEAE3; border-color: var(--pomarancz); color: #8A2A0F; }
  .komunikat.sukces { background: var(--zielony-tlo); border-color: var(--zielony); color: var(--zielony); }
  .karty { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .karta { background: var(--panel); border: 1px solid var(--linia); border-radius: 4px; padding: 18px 20px; display: flex; flex-direction: column; }
  .karta h3 { margin: 0 0 6px; font-size: 16px; }
  .karta .cena { font-size: 21px; font-weight: 700; margin: 10px 0 4px; }
  .karta .sprzedawca { font-size: 13px; color: var(--tekst-drugi); }
  .karta form { margin-top: auto; }
  .karta button { width: 100%; }
  .podpis { font-size: 12.5px; color: var(--tekst-drugi); margin-top: 6px; }
`;

export interface OpcjeStrony {
  tytul: string;
  /** Który element nawigacji podświetlić. */
  aktywny?: 'sprzedawcy' | 'produkty' | 'sklep';
  tresc: string;
  /** Komunikat z `?blad=` lub `?sukces=` w adresie. */
  komunikat?: { rodzaj: 'blad' | 'sukces'; tekst: string } | null;
}

/** Wspólny szkielet strony — jedno miejsce na nawigację, style i stopkę. */
export function strona({ tytul, aktywny, tresc, komunikat }: OpcjeStrony): string {
  const link = (href: string, etykieta: string, id: OpcjeStrony['aktywny']) =>
    `<a href="${href}"${aktywny === id ? ' style="color:#fff;font-weight:600"' : ''}>${etykieta}</a>`;

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tytul)} — próbka Stripe Connect</title>
<style>${STYLE}</style>
</head>
<body>
<header>
  <div class="marka">CVelocity <span>Connect</span></div>
  <nav>
    ${link('/', 'Sprzedawcy', 'sprzedawcy')}
    ${link('/products', 'Produkty', 'produkty')}
    ${link('/storefront', 'Sklep', 'sklep')}
  </nav>
  <div class="tryb">próbka — tryb testowy Stripe</div>
</header>
<main>
  ${komunikat ? `<div class="komunikat ${komunikat.rodzaj}">${esc(komunikat.tekst)}</div>` : ''}
  ${tresc}
</main>
</body>
</html>`;
}

/**
 * Buduje komunikat z parametrów adresu.
 *
 * Po każdej operacji zmieniającej stan przekierowujemy (POST → 303 → GET),
 * więc informacja o wyniku musi przejechać przez adres. Alternatywą byłaby
 * sesja, a to zależność, której ta próbka nie potrzebuje.
 */
export function komunikatZAdresu(query: Record<string, unknown>): OpcjeStrony['komunikat'] {
  if (typeof query.blad === 'string' && query.blad) return { rodzaj: 'blad', tekst: query.blad };
  if (typeof query.sukces === 'string' && query.sukces) return { rodzaj: 'sukces', tekst: query.sukces };
  return null;
}
