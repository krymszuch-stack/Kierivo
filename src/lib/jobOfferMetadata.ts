import { isKnownSectionHeader } from './jdOptionality';

const LOCATION_LABEL = /^(?:lokalizacja|miejsce pracy|location)$/i;
const INLINE_LOCATION = /^(?:lokalizacja|miejsce pracy|location)\s*:\s*(.*)$/i;
const OTHER_METADATA_LABEL = /^(?:wynagrodzenie|salary|typ umowy|contract type|wymiar pracy|work time|firma|company)\s*:?$/i;

export interface ExplicitLocationEntry {
  value: string;
  lineCount: 1 | 2;
}

/** Odczytuje lokalizację tylko z jawnie oznaczonego pola, nie z dowolnej wzmianki o mieście. */
export function explicitLocationEntryAt(lines: readonly string[], index: number): ExplicitLocationEntry | null {
  const line = (lines[index] ?? '').trim();
  const inline = line.match(INLINE_LOCATION);
  if (inline?.[1]?.trim()) return { value: inline[1].trim(), lineCount: 1 };
  if (!LOCATION_LABEL.test(line) && !INLINE_LOCATION.test(line)) return null;

  const next = (lines[index + 1] ?? '').trim();
  if (!next || isKnownSectionHeader(next) || OTHER_METADATA_LABEL.test(next)) return null;
  return { value: next, lineCount: 2 };
}

/** Znajduje lokalizację podaną w polu „Lokalizacja”, „Miejsce pracy” lub „Location”. */
export function extractExplicitJobLocation(text: string): string {
  const lines = (text ?? '').replace(/\r/g, '').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const entry = explicitLocationEntryAt(lines, index);
    if (entry) return entry.value;
  }
  return '';
}
