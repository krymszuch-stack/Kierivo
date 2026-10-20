import type { ApplicationEvent, JobApplication } from '../types';

function isTimedInterview(event: ApplicationEvent): boolean {
  return event.kind === 'interview' && event.state !== 'cancelled' && event.state !== 'completed' &&
    event.scheduledAt.includes('T') && Number.isFinite(Date.parse(event.scheduledAt));
}

function isCompletedInterview(event: ApplicationEvent): boolean {
  return event.kind === 'interview' && event.state === 'completed' &&
    event.scheduledAt.includes('T') && Number.isFinite(Date.parse(event.scheduledAt));
}

export function shouldCancelInterviewOnRejection(event: ApplicationEvent, now = Date.now()): boolean {
  if (event.kind !== 'interview' || event.state === 'cancelled' || event.state === 'completed') return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.scheduledAt)) {
    const timeZone = event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const today = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
    return event.scheduledAt >= today;
  }
  const scheduledAt = Date.parse(event.scheduledAt);
  return Number.isFinite(scheduledAt) && scheduledAt >= now;
}

/** Projekcja dla starszych konsumentów; oś zdarzeń pozostaje źródłem prawdy. */
export function projectInterviewAt(events: ApplicationEvent[] | undefined, now = Date.now()): string | undefined {
  const interviews = (events ?? []).filter(isTimedInterview);
  // Status jest nadrzędny wobec zegara: wczorajsza rozmowa nadal zaplanowana
  // nie znika z projekcji, dopóki użytkownik nie oznaczy jej jako odbytej.
  const scheduled = interviews
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
  if (scheduled[0]) return scheduled[0].scheduledAt;

  return (events ?? []).filter(isCompletedInterview)
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
    event.state !== 'cancelled' && event.state !== 'completed' && event.scheduledAt === currentAt);

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
  // Legacy `interviewAt` jest migrowane do osi wyłącznie przez `migrateApplication`.
  // Powtarzanie syntezy przy każdym zapisie wskrzeszałoby termin po jego usunięciu.
  if (application.status === 'Odrzucona') {
    const now = Date.now();
    events = events.map((event) => shouldCancelInterviewOnRejection(event, now)
      ? { ...event, state: 'cancelled' as const }
      : event);
  }
  return { ...application, events, interviewAt: projectInterviewAt(events) };
}
