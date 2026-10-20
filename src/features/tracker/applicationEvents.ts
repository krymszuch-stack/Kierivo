import type { ApplicationEvent, ApplicationEventKind, ApplicationEventState } from '../../types';

const EVENT_KIND_LABELS: Record<ApplicationEventKind, string> = {
  application_sent: 'Wysłano aplikację',
  interview: 'Rozmowa',
  email: 'Wiadomość e-mail',
  response_due: 'Obiecana odpowiedź',
  follow_up: 'Follow-up',
};

const EVENT_STATE_LABELS: Record<ApplicationEventState, string> = {
  confirmed: 'Potwierdzone',
  pending: 'Oczekuje',
  unknown: 'Nieznane',
  completed: 'Odbyta',
  cancelled: 'Odwołane',
};

export function getApplicationEventKindLabel(kind: ApplicationEventKind): string {
  return EVENT_KIND_LABELS[kind];
}

export function getApplicationEventStateLabel(state: ApplicationEventState): string {
  return EVENT_STATE_LABELS[state];
}

function isSameEvent(current: ApplicationEvent, incoming: ApplicationEvent): boolean {
  if (current.id === incoming.id) return true;
  return Boolean(
    incoming.sourceEventId &&
    current.source === incoming.source &&
    current.sourceEventId === incoming.sourceEventId,
  );
}

/** Powtórny import tego samego zdarzenia aktualizuje wpis zamiast go dublować. */
export function upsertApplicationEvent(
  existing: ApplicationEvent[],
  incoming: ApplicationEvent,
): ApplicationEvent[] {
  const firstMatch = existing.findIndex((event) => isSameEvent(event, incoming));
  if (firstMatch === -1) return [...existing, incoming];

  const stableId = existing[firstMatch].id;
  let inserted = false;
  return existing.flatMap((event) => {
    if (!isSameEvent(event, incoming)) return [event];
    if (inserted) return [];
    inserted = true;
    return [{ ...event, ...incoming, id: stableId }];
  });
}

export function removeApplicationEvent(existing: ApplicationEvent[], eventId: string): ApplicationEvent[] {
  return existing.filter((event) => event.id !== eventId);
}

export function localDateTimeToIso(value: string): string | undefined {
  if (!value) return undefined;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) ? instant.toISOString() : undefined;
}

export function isoToLocalDateTime(value: string): string {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}T${pad(instant.getHours())}:${pad(instant.getMinutes())}`;
}

export function formatApplicationEventDate(event: ApplicationEvent, fallbackTimeZone: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.scheduledAt)) return event.scheduledAt;
  const instant = new Date(event.scheduledAt);
  if (!Number.isFinite(instant.getTime())) return 'Nieprawidłowy termin';
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: event.timeZone || fallbackTimeZone,
  }).format(instant);
}
