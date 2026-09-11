import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BETA_PURCHASES_ENABLED, FREE_BETA_ACTIVE, FREE_BETA_PRICE_PLN } from '../beta';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('D05 — prawdziwość bezpłatnej bety', () => {
  it('ma jednoznacznie wyłączone zakupy', () => {
    expect(FREE_BETA_ACTIVE).toBe(true);
    expect(FREE_BETA_PRICE_PLN).toBe(0);
    expect(BETA_PURCHASES_ENABLED).toBe(false);

    const config = source('src/server/config.ts');
    expect(config).toContain('BETA_PURCHASES_ENABLED');
    expect(config).toContain('paymentsEnabled:');
  });

  it('nie podpisuje wyniku nazwami zewnętrznych ATS w głównym symulatorze', () => {
    const ats = source('src/features/matcher/AtsSimulatorView.tsx');
    for (const vendor of ['Workday', 'Greenhouse', 'Lever', 'Taleo', 'Oracle']) {
      expect(ats).not.toContain(`name: '${vendor}'`);
    }
    expect(ats).toContain('Składowe wyniku CVelocity');
    expect(ats).toContain('nie jest wynikiem');
    expect(ats).toContain('ani gwarancja');
  });

  it('nie wraca do fallbacku 100% zgodności walidatora', () => {
    const badge = source('src/components/consistency/ConsistencyLockBadge.tsx');
    expect(badge).not.toContain('100% zgodności');
    expect(badge).toContain('sprawdzanym zakresie');
  });

  it('nie ma aktywnych CTA zakupowych w cenniku, parserze, bramce ani menu konta', () => {
    const pricing = source('src/views/PricingView.tsx');
    const parser = source('src/features/parser/CVParserModal.tsx');
    const gate = source('src/components/payments/ApplicationPassGate.tsx');
    const topbar = source('src/components/layout/Topbar.tsx');

    for (const text of [pricing, parser, gate, topbar]) {
      expect(text).not.toContain('StripeCheckoutModal');
    }

    expect(pricing).not.toContain('Rozpocznij 30 dni');
    expect(pricing).not.toContain('Kup szablon');
    expect(parser).not.toContain('price_cvelocity_pro_monthly');
    expect(gate).not.toContain('Zobacz Karnet');
    expect(gate).not.toContain('onBuyPass');
    expect(topbar).not.toContain('/api/billing/portal-session');
    expect(topbar).not.toContain('Stripe Portal');
    expect(topbar).toContain('Zakres bezpłatnej bety');
  });

  it('ekran startowy pokazuje 0 zł i granice bety zamiast starego Pro', () => {
    const landing = source('src/views/LandingView.tsx');
    expect(landing).toContain('FREE_BETA_PRICE_PLN');
    expect(landing).toContain('Bez karty i bez aktywnych zakupów');
    expect(landing).not.toContain('49 zł');
    expect(landing).not.toContain('39 zł');
    expect(landing).not.toContain('19 zł');
    expect(landing).not.toContain('Zobacz pełny cennik');
  });

  it('Doradca ujawnia faktyczny zakres danych i nie używa nazw vendorów w poradzie', () => {
    const advisor = source('src/features/advisor/GeminiAdvisorModal.tsx');
    expect(advisor).toContain('Nie czytam automatycznie Master Vaultu ani aplikacji');
    expect(advisor).toContain('nie wysyłam tej rozmowy do modelu AI');
    expect(advisor).not.toContain('Workday');
    expect(advisor).not.toContain('Taleo');
  });

  it('README nie ma stałej liczby testów ani absolutnego 100% client-side', () => {
    const readme = source('README.md');
    expect(readme).not.toContain('813');
    expect(readme).not.toContain('100% Client-Side');
    expect(readme).toContain('bezpłatną betą, cena: 0 zł');
    expect(readme).toContain('nie gwarantuje przejścia filtra');
  });
});
