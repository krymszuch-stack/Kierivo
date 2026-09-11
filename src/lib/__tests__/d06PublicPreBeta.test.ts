import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FREE_BETA_PRICE_PLN,
  PUBLIC_PREBETA_CODE,
  PUBLIC_PREBETA_LABEL,
  PUBLIC_PREBETA_MESSAGE,
} from '../beta';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('D06 — publiczne oznaczenie wersji przedpremierowej', () => {
  it('ma stabilny kod wydania i cenę 0 zł', () => {
    expect(PUBLIC_PREBETA_LABEL).toBe('Public Pre-Beta');
    expect(PUBLIC_PREBETA_CODE).toBe('PB-2026.09');
    expect(PUBLIC_PREBETA_MESSAGE).toContain('Otwarte testy');
    expect(FREE_BETA_PRICE_PLN).toBe(0);
  });

  it('pokazuje oznaczenie globalnie, a nie wyłącznie na landingu', () => {
    const shell = source('src/components/layout/Shell.tsx');
    expect(shell).toContain('PUBLIC_PREBETA_LABEL');
    expect(shell).toContain('PUBLIC_PREBETA_CODE');
    expect(shell).toContain('PUBLIC_PREBETA_MESSAGE');
    expect(shell).toContain('FREE_BETA_PRICE_PLN');
  });

  it('landing wyjaśnia etap testowy, a Doradca jest łatwo dostępny w narzędziach', () => {
    const landing = source('src/views/LandingView.tsx');
    const sidebar = source('src/components/layout/Sidebar.tsx');

    expect(landing).toContain('PUBLIC_PREBETA_LABEL');
    expect(landing).toContain('PUBLIC_PREBETA_CODE');
    expect(sidebar).toContain('Doradca regułowy');
    expect(sidebar).toContain('badge="LOCAL"');
  });

  it('README identyfikuje dokładnie publiczną wersję, którą ogląda tester', () => {
    const readme = source('README.md');
    expect(readme).toContain('Public Pre-Beta');
    expect(readme).toContain('PB-2026.09');
    expect(readme).toContain('0 zł');
  });
});
