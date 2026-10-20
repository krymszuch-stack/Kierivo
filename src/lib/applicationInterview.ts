import type { ApplicationEvent, JobApplication } from '../types';

function isTimedInterview(event: ApplicationEvent): boolean {
  return event.kind === 'interview' && event.state !== 'cancelled' &&
    event.scheduledAt.includes('T') && Number.isFinite(Date.parse(event.scheduledAt));
}

/** Projekcja dla starszych konsumentów; oś zdarzeń pozostaje źródłem prawdy. */
export function projectInterviewAt(events: ApplicationEvent[] | undefined, now = Date.now()): string | undefined {
  const interviews = (events ?? []).filter(isTimedInterview);
  const future = interviews
    .filter((event) => Date.parse(event.scheduledAt) >= now)
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
  if (future[0]) return future[0].scheduledAt;

  return interviews
    .filter((event) => Date.parse(event.scheduledAt) < now)
    .sort((left, right) => Date.parse(right.scheduledAt) - Date.parse(left.scheduledAt))[0]?.scheduledAt;
}

/** Zmienia termin projekcji, aktualizując odpowiadające jej zdarzenie osi. */
export function upsertInterviewEvent(
  application: JobApplication,
  nextAt: string | undefined,
  timeZone: string,
  now = Date.now(),
): Pick<JobApplication, 'events' | 'interviewAt'> {
  const events = [...(application.events ?? [])];
  const currentAt = projectInterviewAt(events, now);
  const index = events.findIndex((event) => event.kind === 'interview' &&
    event.state !== 'cancelled' && event.scheduledAt === currentAt);

  if (index >= 0) {
    if (!nextAt) {
      events[index] = { ...events[index], state: 'cancelled' };
    } else {
      events[index] = { ...events[index], scheduledAt: nextAt, timeZone };
    }
  } else if (nextAt) {
    events.push({
      id: globalThis.crypto.randomUUID(),
      kind: 'interview',
      scheduledAt: nextAt,
      timeZone,
      state: 'confirmed',
      source: 'user',
    });
  }

  return { events, interviewAt: projectInterviewAt(events, now) };
}

/** Gwarantuje, że odrzucenie nie pozostawia aktywnych terminów rozmowy. */
export function normalizeApplicationInterviews(application: JobApplication): JobApplication {
  let events = [...(application.events ?? [])];
  if (application.status !== 'Odrzucona' && application.interviewAt?.includes('T') &&
      Number.isFinite(Date.parse(application.interviewAt)) && !events.some((event) =>
        event.kind === 'interview')) {
    events.push({
      id: `legacy-interview-${application.id}`,
      kind: 'interview',
      scheduledAt: application.interviewAt,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      state: 'confirmed',
      source: 'user',
    });
  }
  if (application.status === 'Odrzucona') {
    const now = Date.now();
    events = events.map((event) => event.kind === 'interview' && event.state !== 'cancelled' &&
      Date.parse(event.scheduledAt) >= now
      ? { ...event, state: 'cancelled' as const }
      : event);
  }
  return { ...application, events, interviewAt: projectInterviewAt(events) };
}
