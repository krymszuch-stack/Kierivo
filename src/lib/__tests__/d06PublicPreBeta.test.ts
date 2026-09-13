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

  it('nie zasypuje użytkownika komunikatami wersji testowej na każdym ekranie', () => {
    const shell = source('src/components/layout/Shell.tsx');
    const landing = source('src/views/LandingView.tsx');
    const sidebar = source('src/components/layout/Sidebar.tsx');

    expect(shell).not.toContain('PUBLIC_PREBETA_LABEL');
    expect(landing).not.toContain('PUBLIC_PREBETA_LABEL');
    expect(landing).toContain('Trzy kroki pracy z CV');
    expect(sidebar).toContain('Doradca regułowy');
    expect(sidebar).not.toContain('badge="LOCAL"');
    expect(sidebar).not.toContain('badge="GOTOWE"');
  });

  it('README identyfikuje dokładnie publiczną wersję, którą ogląda tester', () => {
    const readme = source('README.md');
    expect(readme).toContain('Public Pre-Beta');
    expect(readme).toContain('PB-2026.09');
    expect(readme).toContain('0 zł');
  });
});
