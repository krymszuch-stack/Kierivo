import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseRobotsTxt,
  isPathAllowed,
  getCachedRules,
  cacheRules,
  clearRobotsCache,
  permissiveRules,
} from '../robots';

const UA = 'KIERIVO/1.0 (+https://cvelocity.pl/bot)';

beforeEach(() => {
  clearRobotsCache();
});

describe('Parser robots.txt', () => {
  it('czyta Disallow z grupy dla wszystkich agentów', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /api/
Disallow: /admin/
`);

    expect(isPathAllowed(rules, '/api/jobs', UA)).toBe(false);
    expect(isPathAllowed(rules, '/job-offer/senior-dev', UA)).toBe(true);
  });

  it('wygrywa najdłuższa pasująca reguła, nie pierwsza napotkana', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /oferty/
Allow: /oferty/publiczne/
`);

    expect(isPathAllowed(rules, '/oferty/prywatne', UA)).toBe(false);
    expect(isPathAllowed(rules, '/oferty/publiczne/abc', UA)).toBe(true);
  });

  it('przy równej długości reguł wygrywa Allow (RFC 9309)', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /x/
Allow: /x/
`);

    expect(isPathAllowed(rules, '/x/cokolwiek', UA)).toBe(true);
  });

  it('obsługuje wildcard * i kotwicę $', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /*.pdf$
Disallow: /szukaj/*/wyniki
`);

    expect(isPathAllowed(rules, '/dokumenty/cv.pdf', UA)).toBe(false);
    expect(isPathAllowed(rules, '/dokumenty/cv.pdf.html', UA)).toBe(true);
    expect(isPathAllowed(rules, '/szukaj/it/wyniki', UA)).toBe(false);
  });

  it('puste Disallow znaczy „nic nie jest zabronione"', () => {
    // Pusty wzorzec pasowałby do każdej ścieżki, więc musi być pominięty.
    const rules = parseRobotsTxt(`
User-agent: *
Disallow:
`);

    expect(isPathAllowed(rules, '/cokolwiek', UA)).toBe(true);
  });

  it('grupa dla konkretnego agenta ma pierwszeństwo przed gwiazdką', () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /

User-agent: cvelocity
Allow: /job-offer/
Disallow: /api/
`);

    expect(isPathAllowed(rules, '/job-offer/abc', UA)).toBe(true);
    expect(isPathAllowed(rules, '/api/x', UA)).toBe(false);
  });

  it('łączy kilka linii User-agent w jedną grupę', () => {
    const rules = parseRobotsTxt(`
User-agent: googlebot
User-agent: cvelocity
Disallow: /zamkniete/
`);

    expect(isPathAllowed(rules, '/zamkniete/x', UA)).toBe(false);
  });

  it('pomija komentarze i linie bez dwukropka', () => {
    const rules = parseRobotsTxt(`
# to jest komentarz
User-agent: *
Disallow: /api/   # też komentarz
jakas smieciowa linia
`);

    expect(isPathAllowed(rules, '/api/x', UA)).toBe(false);
    expect(isPathAllowed(rules, '/inne', UA)).toBe(true);
  });

  it('czyta Crawl-delay', () => {
    expect(parseRobotsTxt('User-agent: *\nCrawl-delay: 2.5').crawlDelaySeconds).toBe(2.5);
    expect(parseRobotsTxt('User-agent: *\nDisallow: /x').crawlDelaySeconds).toBeNull();
  });

  it('brak reguł oznacza zgodę — pusty plik nie blokuje niczego', () => {
    expect(isPathAllowed(permissiveRules(), '/cokolwiek', UA)).toBe(true);
    expect(isPathAllowed(parseRobotsTxt(''), '/cokolwiek', UA)).toBe(true);
  });

  it('odzwierciedla realny robots.txt justjoin.it — oferty przechodzą, /api/ nie', () => {
    // Skopiowane z żywego pliku: ścieżki ofert nie są objęte zakazem.
    const rules = parseRobotsTxt(`
User-agent: *
Sitemap: https://justjoin.it/sitemaps/active-jobs.xml
Disallow: /oferty-pracy/*,*
Disallow: /api/
Disallow: /shared-gfx/
`);

    expect(isPathAllowed(rules, '/job-offer/sellintegro-fullstack-net-developer', UA)).toBe(true);
    expect(isPathAllowed(rules, '/api/offers', UA)).toBe(false);
  });
});

describe('Cache reguł', () => {
  it('zwraca zapisane reguły dla tego samego origin', () => {
    const rules = parseRobotsTxt('User-agent: *\nDisallow: /api/');
    cacheRules('https://example.pl', rules);

    expect(getCachedRules('https://example.pl')).toBe(rules);
    expect(getCachedRules('https://inny.pl')).toBeNull();
  });

  it('nie miesza reguł między hostami', () => {
    cacheRules('https://a.pl', parseRobotsTxt('User-agent: *\nDisallow: /'));
    cacheRules('https://b.pl', permissiveRules());

    expect(isPathAllowed(getCachedRules('https://a.pl')!, '/x', UA)).toBe(false);
    expect(isPathAllowed(getCachedRules('https://b.pl')!, '/x', UA)).toBe(true);
  });
});
