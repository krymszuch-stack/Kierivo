import { clientErrorEventSchema, type ClientErrorEvent } from '../types/contracts';

export interface ParsedClientErrorBuffer {
  events: ClientErrorEvent[];
  invalidCount: number;
}

/** Waliduje odzyskaną kolejkę zanim zdarzenia trafią do raportera lub API. */
export function parseClientErrorBuffer(value: unknown, maxEvents: number): ParsedClientErrorBuffer {
  if (!Array.isArray(value)) return { events: [], invalidCount: 1 };

  const events: ClientErrorEvent[] = [];
  let invalidCount = 0;
  for (const record of value) {
    const parsed = clientErrorEventSchema.safeParse(record);
    if (parsed.success) events.push(parsed.data);
    else invalidCount += 1;
  }

  const boundedEvents = events.slice(-maxEvents);
  invalidCount += events.length - boundedEvents.length;
  return { events: boundedEvents, invalidCount };
}
