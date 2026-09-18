import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Dwie własności warstwy wizualnej, których zwykły build nie sprawdza:
 * kartka dokumentu zostaje biała niezależnie od motywu, a tekst na ciemnym
 * tle mieści się w progach WCAG. Obie da się złamać zmianą jednej wartości
 * w pliku z tokenami — kompilator przepuści ją bez słowa, `npm test` nie.
 */

const root = resolve(__dirname, '../../..');
const tokens = readFileSync(resolve(root, 'src/styles/tokens.css'), 'utf8').replace(/\r\n/g, '\n');

/** Wycina ciało bloku CSS zaczynającego się od podanego selektora. */
function block(selectorStart: string): string {
  const at = tokens.indexOf(selectorStart);
  expect(at, `nie znaleziono bloku ${selectorStart}`).toBeGreaterThan(-1);
  const open = tokens.indexOf('{', at);
  const close = tokens.indexOf('\n}', open);
  return tokens.slice(open + 1, close);
}

function readVar(css: string, name: string): string {
  const match = new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm').exec(css);
  expect(match, `brak zmiennej --${name}`).not.toBeNull();
  return match![1].trim();
}

const lightBlock = block(':root {');
const darkBlock = block('[data-theme="dark"],\n.dark {');
const paperBlock = block('.doc-paper {');

// --- Kartka dokumentu -------------------------------------------------------

describe('kartka dokumentu zostaje biała', () => {
  it('token --paper jest czystą bielą w obu motywach', () => {
    expect(readVar(lightBlock, 'paper')).toBe('#ffffff');
    expect(readVar(darkBlock, 'paper')).toBe('#ffffff');
  });

  it('.doc-paper przestawia surowe zmienne motywu na wartości papierowe', () => {
    expect(readVar(paperBlock, 'surface')).toBe('var(--paper)');
    expect(readVar(paperBlock, 'elevated')).toBe('var(--paper)');
    expect(readVar(paperBlock, 'ink')).toBe('var(--paper-ink)');
    expect(readVar(paperBlock, 'line')).toBe('var(--paper-line)');
  });

  // To jest właściwy warunek poprawności, a nie test wyżej. Klasy narzędziowe
  // Tailwinda czytają `--color-*` z bloku `@theme`, a te rozwiązują się na
  // `:root` i dziedziczą w dół już rozwiązane. Kartka z nadpisanym wyłącznie
  // `--surface` wygląda na białą, ale każde `bg-sunken` i `text-ink` w środku
  // wraca do barw aplikacji — co widać dopiero na renderze.
  it.each(['surface', 'elevated', 'sunken', 'ink', 'muted', 'subtle', 'line', 'line-strong'])(
    '.doc-paper przestawia także --color-%s, bo to jego czytają klasy Tailwinda',
    (name) => {
      expect(readVar(paperBlock, `color-${name}`)).toMatch(/^var\(--paper/);
    }
  );

  it('arkusz A4 nosi klasę .doc-paper', () => {
    const renderer = readFileSync(
      resolve(root, 'src/features/matcher/DocumentRenderer.tsx'),
      'utf8'
    );
    const sheet = /id="cv-printable-document"[\s\S]{0,400}?className="([^"]+)"/.exec(renderer);
    expect(sheet, 'nie znaleziono arkusza dokumentu').not.toBeNull();
    expect(sheet![1]).toContain('doc-paper');
  });
});

// --- Kontrast ---------------------------------------------------------------

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('kontrast tekstu w ciemnym motywie', () => {
  const surface = readVar(darkBlock, 'surface');
  const elevated = readVar(darkBlock, 'elevated');

  // `--subtle` na `--elevated` to najciaśniejsza para w całym zestawie:
  // najjaśniejsze tło spotyka się z najciemniejszym stopniem tekstu.
  it.each([
    ['ink', 'surface', 7, surface],
    ['ink', 'elevated', 7, elevated],
    ['muted', 'surface', 4.5, surface],
    ['muted', 'elevated', 4.5, elevated],
    ['subtle', 'surface', 4.5, surface],
    ['subtle', 'elevated', 4.5, elevated],
  ])('%s na %s osiąga co najmniej %s:1', (inkName, _bgName, threshold, bg) => {
    const value = contrast(readVar(darkBlock, inkName as string), bg as string);
    expect(value).toBeGreaterThanOrEqual(threshold as number);
  });
});

describe('kontrast krańców gradientu nagłówka', () => {
  // Nagłówek jest duży i pogrubiony, więc obowiązuje go próg 3:1 (WCAG,
  // tekst powiększony), a nie 4.5:1.
  it.each([
    ['ciemny', darkBlock],
    ['jasny', lightBlock],
  ])('w motywie %s oba krańce mieszczą się w progu tekstu powiększonego', (_name, themeBlock) => {
    const grad = readVar(themeBlock as string, 'display-grad');
    const stops = grad.match(/#[0-9a-f]{6}/gi) ?? [];
    expect(stops.length, 'gradient nagłówka nie ma zapisanych krańców').toBe(2);

    const bg = readVar(themeBlock as string, 'surface');
    for (const stop of stops) {
      expect(contrast(stop, bg), `kraniec ${stop}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('kontrast akcentu brandowego i tekstu na nim', () => {
  it.each([
    ['jasny', lightBlock],
    ['ciemny', darkBlock],
  ])('w motywie %s tekst --on-brand na --brand osiaga co najmniej 4.5:1 (WCAG AA)', (_name, themeBlock) => {
    const bg = readVar(themeBlock as string, 'brand');
    const fg = readVar(themeBlock as string, 'on-brand');
    const val = contrast(fg, bg);
    expect(val).toBeGreaterThanOrEqual(4.5);
  });
});

