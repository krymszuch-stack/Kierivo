import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { cleanPastedJobOffer } from '../jobOfferCleaner';
import { parseJobDescriptionLocal } from '../jdParser';

const CODEX_OUTPUTS_DIR = fileURLToPath(new URL('./fixtures/portal-corpus/', import.meta.url));

function readCorpusFile(filename: string): string {
  return gunzipSync(fs.readFileSync(path.join(CODEX_OUTPUTS_DIR, `${filename}.gz`))).toString('utf-8');
}

const HTML_TAG_REGEX = /<[^>]+>/;
const HTML_ENTITY_REGEX = /&(?:nbsp|amp|quot|apos|lt|gt|#\d+|#x[0-9a-fA-F]+);/i;

const FORBIDDEN_PORTAL_NOISE = [
  'olx.ua',
  'olx.bg',
  'olx.ro',
  'olx.pt',
  'otodom.pl',
  'otomoto.pl',
  'obido.pl',
  'akt o usługach cyfrowych',
  'polityka plików cookies',
  'polityka prywatności',
  'the network',
  'kreator cv',
  'aplikuj check',
  'aplikuj connect',
];

const FORBIDDEN_EXACT_LINES = [
  /^aplikuj$/i,
  /^aplikuj teraz$/i,
  /^aplikuj szybko$/i,
  /^dodaj ogłoszenie$/i,
  /^twoje konto$/i,
  /^dla biznesu opens in a new tab$/i,
  /^dla biznesu$/i,
  /^asystent pracuj\.pl$/i,
  /^powiadomienia$/i,
  /^drukuj$/i,
  /^udostępnij$/i,
  /^zapisz$/i,
];

describe('Parser i Cleaner wklejek - test na zbiorze produkcyjnym Codex outputs', () => {
  const isAvailable = fs.existsSync(CODEX_OUTPUTS_DIR);

  it('katalog ze zrzutami Codex outputs istnieje', () => {
    expect(isAvailable, `Katalog ${CODEX_OUTPUTS_DIR} powinien istnieć`).toBe(true);
  });

  if (!isAvailable) return;

  describe('1. kierivo_dirty_job_offers_300.md (301 stron ofert z Aplikuj.pl)', () => {
    const content = readCorpusFile('kierivo_dirty_job_offers_300.md');
    const offers = content.split(/\n(?=## Oferta \d+)/).filter((s) => s.trim());

    it('wczytuje 301 ofert ze zrzutu Aplikuj.pl', () => {
      expect(offers.length).toBeGreaterThanOrEqual(300);
    });

    it('0% tagów HTML, 0% encji i 0% szumu portalowego na wszystkich ofertach', () => {
      offers.forEach((offerRaw, idx) => {
        const cleaned = cleanPastedJobOffer(offerRaw);
        const ct = cleaned.cleanText;

        // 1. Zero tagów HTML
        expect(HTML_TAG_REGEX.test(ct), `Oferta ${idx + 1} zawiera tag HTML w: ${ct.slice(0, 100)}`).toBe(false);

        // 2. Zero niesparsowanych encji HTML
        expect(HTML_ENTITY_REGEX.test(ct), `Oferta ${idx + 1} zawiera encję HTML`).toBe(false);

        // 3. Zero domen i szumu portalowego
        const ctLower = ct.toLowerCase();
        FORBIDDEN_PORTAL_NOISE.forEach((forbidden) => {
          expect(ctLower, `Oferta ${idx + 1} zawiera zakazany szum: ${forbidden}`).not.toContain(forbidden);
        });

        // 4. Zero przycisków i nawigacji jako osobnych linii
        const lines = ct.split('\n').map((l) => l.trim());
        lines.forEach((line) => {
          FORBIDDEN_EXACT_LINES.forEach((pattern) => {
            expect(pattern.test(line), `Oferta ${idx + 1} zawiera zakazaną linię nawigacyjną: "${line}"`).toBe(false);
          });
        });

        // 5. Parser nie wyrzuca błędu
        const parsed = parseJobDescriptionLocal(offerRaw);
        expect(parsed.jobTitle.length).toBeGreaterThan(0);
      });
    }, 60000);
  });

  describe('2. kierivo_chrome_raw_job_pages.md (surowe zrzuty Chrome z tagami)', () => {
    const content = readCorpusFile('kierivo_chrome_raw_job_pages.md');
    const tabs = content.split(/\n(?=## (?:Tab|Clipboard) )/).filter((s) => s.trim());

    it('oczyszcza 100% zrzutów Chrome z tagów <browser__document> i HTML', () => {
      tabs.forEach((tabRaw, idx) => {
        const cleaned = cleanPastedJobOffer(tabRaw);
        const ct = cleaned.cleanText;

        expect(HTML_TAG_REGEX.test(ct), `Tab ${idx + 1} zawiera tag HTML`).toBe(false);
        expect(ct, `Tab ${idx + 1} zawiera znacznik browser__document`).not.toMatch(/<\/?browser__document/);
        expect(ct, `Tab ${idx + 1} zawiera znacznik user__selection`).not.toMatch(/<\/?user__selection/);
      });
    });
  });

  describe('3. kierivo_pracuj_round_2.md i round_3.md (Pracuj.pl zrzuty tabów)', () => {
    const files = ['kierivo_pracuj_round_2.md', 'kierivo_pracuj_round_3.md'];
    files.forEach((fname) => {
      it(`oczyszcza ${fname} z 0% błędów`, () => {
        const content = readCorpusFile(fname);
        const tabs = content.split(/\n(?=## Chrome tab )/).filter((s) => s.trim());

        tabs.forEach((tabRaw, idx) => {
          const cleaned = cleanPastedJobOffer(tabRaw);
          const ct = cleaned.cleanText;

          expect(HTML_TAG_REGEX.test(ct), `${fname} Tab ${idx + 1} zawiera tag HTML`).toBe(false);
          const ctLower = ct.toLowerCase();
          FORBIDDEN_PORTAL_NOISE.forEach((forbidden) => {
            expect(ctLower, `${fname} Tab ${idx + 1} zawiera: ${forbidden}`).not.toContain(forbidden);
          });
        });
      });
    });
  });

  describe('4. kierivo_dirty_clipboard_batch_20260930.md (300 ofert ze schowka)', () => {
    const content = readCorpusFile('kierivo_dirty_clipboard_batch_20260930.md');
    const batch = content.split(/\n(?=## Clipboard \d+)/).filter((s) => s.trim()).slice(0, 300);

    it('0% HTML i 0% szumu na 300 ofertach ze schowka', () => {
      batch.forEach((clipRaw, idx) => {
        const cleaned = cleanPastedJobOffer(clipRaw);
        const ct = cleaned.cleanText;

        // Zero tagów HTML
        expect(HTML_TAG_REGEX.test(ct), `Clip ${idx + 1} zawiera tag HTML`).toBe(false);

        // Zero niesparsowanych encji HTML
        expect(HTML_ENTITY_REGEX.test(ct), `Clip ${idx + 1} zawiera encję HTML`).toBe(false);

        // Zero przycisków jako linii
        const lines = ct.split('\n').map((l) => l.trim());
        lines.forEach((line) => {
          FORBIDDEN_EXACT_LINES.forEach((pattern) => {
            expect(pattern.test(line), `Clip ${idx + 1} zawiera zakazaną linię nawigacyjną: "${line}"`).toBe(false);
          });
        });
      });
    });
  });
});
