import * as cheerio from 'cheerio';
import type { ExtractedJob, ExtractionResult } from './types';
import { extractFromJsonLd } from './jsonLd';
import { extractHydrationState } from './hydration';
import {
  companyFromMarkup,
  extractFromOpenGraph,
  extractMainContent,
  titleFromDocumentTitle,
  MIN_USABLE_DESCRIPTION,
} from './fallbacks';

export type { ExtractedJob, ExtractionResult, ExtractionTier } from './types';
export { MIN_USABLE_DESCRIPTION } from './fallbacks';
export { runAtsExtract, type AtsExtractResult } from './atsExtract';

/**
 * Drabina ekstrakcji ogłoszenia.
 *
 * Kolejność jest celowa: schodzimy w dół tylko wtedy, gdy wyższy szczebel nie
 * dał treści. Szczeble 1–3 są deterministyczne i darmowe, więc każdy z nich
 * oszczędza całe wywołanie modelu — a na justjoin.it i nofluffjobs.com szczebel
 * pierwszy wystarcza do kompletu danych (tytuł, firma, widełki, tryb pracy,
 * umiejętności), co wcześniej próbowaliśmy uzyskiwać płatnym wywołaniem AI.
 *
 * 1. JSON-LD `schema.org/JobPosting`
 * 2. Stan hydracji SPA (`__NEXT_DATA__`, `__NUXT__`, `__INITIAL_STATE__`)
 * 3. OpenGraph
 * 4. Treść główna dokumentu
 *
 * Do modelu (szczebel 5) zjeżdżamy poza tym modułem i tylko po to, by rozbić
 * `description` na wymagania i obowiązki — nigdy po dane, które już mamy.
 */
export function extractJobPosting(html: string): ExtractionResult {
  // Jeden parse na całą drabinę. Szczeble niżej usuwają węzły z drzewa, więc
  // JSON-LD i stan hydracji muszą zostać odczytane wcześniej — kolejność
  // wywołań poniżej to gwarantuje.
  const $ = cheerio.load(html);

  const documentTitle = titleFromDocumentTitle($('title').first().text());
  const headingTitle = $('h1').first().text().replace(/\s+/g, ' ').trim();

  const structured = extractFromJsonLd($);
  if (structured && structured.description.length >= MIN_USABLE_DESCRIPTION) {
    return {
      job: {
        ...structured,
        title: structured.title || headingTitle || documentTitle,
      },
      tier: 'json-ld',
      structured: true,
    };
  }

  // Stan hydracji czytamy PRZED ekstrakcją treści głównej: ta usuwa wpisane
  // skrypty jako szum, a razem z nimi usunęłaby blok `__INITIAL_STATE__`.
  const hydrated = extractHydrationState($);

  const openGraph = extractFromOpenGraph($);
  const markupCompany = companyFromMarkup($);

  // Dopiero teraz — ta funkcja usuwa węzły z dokumentu.
  const mainText = extractMainContent($);

  // Szczebel bez pełnej treści nadal jest lepszym źródłem metadanych niż
  // zgadywanie ze znaczników — zachowujemy go i dokładamy tylko opis.
  const base: Partial<ExtractedJob> = structured ?? hydrated ?? { title: '', company: '', description: '' };

  const description =
    base.description && base.description.length >= MIN_USABLE_DESCRIPTION
      ? base.description
      : mainText.length >= MIN_USABLE_DESCRIPTION
        ? mainText
        : (openGraph.description ?? '');

  const job: ExtractedJob = {
    ...base,
    title: base.title || headingTitle || openGraph.title || documentTitle,
    company: base.company || markupCompany || openGraph.company || '',
    description,
  };

  if (structured) return { job, tier: 'json-ld', structured: true };
  if (
    hydrated &&
    (hydrated.description?.length ?? 0) >= MIN_USABLE_DESCRIPTION
  ) {
    return { job, tier: 'hydration', structured: true };
  }
  if (mainText.length >= MIN_USABLE_DESCRIPTION) return { job, tier: 'main-content', structured: false };
  if (description.length > 0) return { job, tier: 'open-graph', structured: false };

  return { job, tier: 'none', structured: false };
}
