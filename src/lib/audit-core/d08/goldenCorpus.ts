import { cloneD08Signals, createCleanD08Signals } from './fixtures';
import type { D08Signals } from './types';

export interface D08GoldenCase {
  id: string;
  description: string;
  signals: D08Signals;
  expectedHardCaps?: string[];
}

const mutate = (fn: (signals: D08Signals) => void): D08Signals => {
  const signals = cloneD08Signals(createCleanD08Signals());
  fn(signals);
  return signals;
};

const clean = (): D08Signals => cloneD08Signals(createCleanD08Signals());

export const D08_GOLDEN_CORPUS: D08GoldenCase[] = [
  {
    id: 'D08_01_CLEAN_SINGLE_COLUMN',
    description: 'Wzorcowy dokument o poprawnej strukturze i ekstrakcji.',
    signals: clean(),
  },
  {
    id: 'D08_02_CLEAN_TWO_COLUMN_ORDER_SAFE',
    description: 'Dwukolumnowy dokument z identycznie bezpieczną ekstrakcją. Sama liczba kolumn nie jest sygnałem.',
    signals: clean(),
  },
  {
    id: 'D08_03_TWO_COLUMN_INTERLEAVED',
    description: 'Silne zaburzenie kolejności odczytu przy wysokiej pewności pomiaru.',
    signals: mutate((signals) => {
      signals.readingOrder.discordantPairWeight = 32;
      signals.readingOrder.measurementConfidence = 1;
    }),
    expectedHardCaps: ['HC_D08_READING_ORDER_CRITICAL'],
  },
  {
    id: 'D08_04_THREE_COLUMN_ORDER_SAFE',
    description: 'Układ wielokolumnowy bez realnej utraty informacji.',
    signals: clean(),
  },
  {
    id: 'D08_05_SCAN_NO_NATIVE_TEXT',
    description: 'Kontrolowany przypadek źródłowy z niemal całkowitą utratą tekstu podczas ekstrakcji.',
    signals: mutate((signals) => {
      signals.textLayer.sourceTokenCount = 500;
      signals.textLayer.extractedTokenCount = 35;
      signals.textLayer.matchedTokenCount = 30;
    }),
    expectedHardCaps: ['HC_D08_TEXT_LAYER_CRITICAL'],
  },
  {
    id: 'D08_06_OCR_LAYER_CORRECT',
    description: 'Warstwa OCR zachowuje pełną treść i kolejność.',
    signals: clean(),
  },
  {
    id: 'D08_07_MOJIBAKE_POLISH',
    description: 'Polskie słowa częściowo uszkodzone przez mojibake.',
    signals: mutate((signals) => {
      signals.encoding.weightedDamageRatio = 0.012;
    }),
  },
  {
    id: 'D08_08_NFKC_LIGATURE_CLEAN',
    description: 'Ligatury rozwiązywane przez NFKC nie są wadą.',
    signals: clean(),
  },
  {
    id: 'D08_09_NESTED_TABLE_LAYOUT',
    description: 'Zagnieżdżona topologia zwiększa ryzyko layoutu.',
    signals: mutate((signals) => {
      signals.layout.nestedComplexityRatio = 0.25;
    }),
  },
  {
    id: 'D08_10_FLOATING_BOX_OVERLAP',
    description: 'Istotne nakładanie niezależnych bloków tekstowych.',
    signals: mutate((signals) => {
      signals.layout.overlapRatio = 0.15;
    }),
  },
  {
    id: 'D08_11_CLIPPED_TEXT',
    description: 'Część tekstu wychodzi poza bezpieczny obszar dokumentu.',
    signals: mutate((signals) => {
      signals.layout.clippingRatio = 0.10;
    }),
  },
  {
    id: 'D08_12_MIXED_DATES_PARSEABLE',
    description: 'Różne formaty dat, ale wszystkie jednoznacznie parsowalne.',
    signals: mutate((signals) => {
      signals.structuredFields = [
        { kind: 'DATE', parseability: 1, evidenceId: 'EV_DATE_A' },
        { kind: 'DATE', parseability: 0.95, evidenceId: 'EV_DATE_B' },
        { kind: 'EMAIL', parseability: 1, evidenceId: 'EV_EMAIL' },
      ];
    }),
  },
  {
    id: 'D08_13_AMBIGUOUS_DATES',
    description: 'Daty istnieją, ale część ma semantycznie dwuznaczny format.',
    signals: mutate((signals) => {
      signals.structuredFields = [
        { kind: 'DATE', parseability: 0.35, evidenceId: 'EV_DATE_AMBIG_A' },
        { kind: 'DATE', parseability: 0.35, evidenceId: 'EV_DATE_AMBIG_B' },
        { kind: 'EMAIL', parseability: 1, evidenceId: 'EV_EMAIL' },
      ];
    }),
  },
  {
    id: 'D08_14_MINIMALIST_HEADINGS_PARSEABLE',
    description: 'Nagłówki są minimalistyczne, ale pozostają jednoznacznie odróżnialne.',
    signals: mutate((signals) => {
      signals.headings.meanSeparationScore = 0.82;
      signals.headings.levelConsistency = 0.95;
    }),
  },
  {
    id: 'D08_15_INCONSISTENT_LIST_INDENTS',
    description: 'Listy istnieją, ale mają niestabilne wcięcia i zawijanie.',
    signals: mutate((signals) => {
      signals.lists.glyphConsistency = 0.90;
      signals.lists.indentQuality = 0.25;
      signals.lists.hangingIndentRatio = 0.45;
    }),
  },
  {
    id: 'D08_16_NO_LISTS_VALID',
    description: 'Poprawny dokument bez list. LISTS jest N/A, nie wadą.',
    signals: mutate((signals) => {
      signals.lists = { applicable: false, evidenceIds: [] };
    }),
  },
  {
    id: 'D08_17_HIDDEN_WHITE_TEXT',
    description: 'Kontrolowany przypadek z potwierdzonym ukrytym tekstem.',
    signals: mutate((signals) => {
      signals.adversarial.hiddenTextMeasured = true;
      signals.adversarial.hiddenTextRatio = 0.08;
      signals.adversarial.hiddenTextEvidenceIds = ['EV_HIDDEN_WHITE_TEXT'];
    }),
  },
  {
    id: 'D08_18_OFF_PAGE_TEXT',
    description: 'Tekst częściowo wypada poza granice strony.',
    signals: mutate((signals) => {
      signals.layout.clippingRatio = 0.20;
    }),
  },
  {
    id: 'D08_19_DUPLICATE_TEXT_LAYER_CONFIRMED',
    description: 'Kontrolowany fixture, w którym niezależny renderer potwierdził niewidzialną zduplikowaną warstwę.',
    signals: mutate((signals) => {
      signals.adversarial.duplicateInvisibleLayerMeasured = true;
      signals.adversarial.duplicateInvisibleLayerRatio = 0.15;
      signals.adversarial.duplicateLayerEvidenceIds = ['EV_DUPLICATE_LAYER_CONFIRMED'];
    }),
  },
  {
    id: 'D08_20_POLISH_DIACRITICS_CLEAN',
    description: 'Poprawny Unicode z polskimi znakami.',
    signals: clean(),
  },
];

export function getD08GoldenCase(id: string): D08GoldenCase {
  const match = D08_GOLDEN_CORPUS.find((item) => item.id === id);
  if (!match) throw new Error(`Nieznany przypadek golden corpus D08: ${id}`);
  return match;
}
