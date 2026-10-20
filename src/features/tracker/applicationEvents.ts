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

function sameInstant(left: string | undefined, right: string): boolean {
  if (!left) return false;
  if (left === right) return true;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

/** Utrzymuje pole zgodności interviewAt przy zmianie zdarzeń osi procesu. */
export function synchronizeInterviewAt(
  previousEvents: ApplicationEvent[],
  nextEvents: ApplicationEvent[],
  currentInterviewAt?: string,
): string | undefined {
  const nextTimedInterviews = nextEvents.filter((event) =>
    event.kind === 'interview' && event.scheduledAt.includes('T') && Number.isFinite(Date.parse(event.scheduledAt)),
  );
  const changedInterview = nextTimedInterviews.find((event) => {
    const previous = previousEvents.find((candidate) => candidate.id === event.id || isSameEvent(candidate, event));
    return !previous || previous.kind !== 'interview' || !previous.scheduledAt.includes('T') ||
      !sameInstant(previous.scheduledAt, event.scheduledAt);
  });
  if (changedInterview) return changedInterview.scheduledAt;

  const currentTimelineInterview = nextEvents.find((event) =>
    event.kind === 'interview' && sameInstant(currentInterviewAt, event.scheduledAt),
  );
  if (currentTimelineInterview) return currentInterviewAt;

  const interviewAtCameFromTimeline = previousEvents.some((event) =>
    event.kind === 'interview' && sameInstant(currentInterviewAt, event.scheduledAt),
  );
  if (!interviewAtCameFromTimeline) return currentInterviewAt;

  return nextTimedInterviews
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt))[0]?.scheduledAt;
}

/** Przenosi lub usuwa wpis osi odpowiadający starszemu terminowi z panelu rozmowy. */
export function synchronizeInterviewEventSchedule(
  events: ApplicationEvent[] | undefined,
  previousInterviewAt: string | undefined,
  nextInterviewAt: string | undefined,
): ApplicationEvent[] | undefined {
  if (!events || !previousInterviewAt) return events;
  const matchingIndex = events.findIndex((event) =>
    event.kind === 'interview' && sameInstant(previousInterviewAt, event.scheduledAt),
  );
  if (matchingIndex === -1) return events;
  if (!nextInterviewAt) return events.filter((_, index) => index !== matchingIndex);
  return events.map((event, index) => index === matchingIndex
    ? { ...event, scheduledAt: nextInterviewAt }
    : event);
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
