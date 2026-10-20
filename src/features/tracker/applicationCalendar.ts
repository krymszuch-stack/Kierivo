import type { JobApplication } from '../../types';
import { getApplicationEventKindLabel, getApplicationEventStateLabel } from './applicationEvents';

export interface ApplicationCalendarEntry {
  id: string;
  applicationId: string;
  date: string;
  kind: 'application' | 'application_sent' | 'interview' | 'email' | 'response_due' | 'follow_up' | 'reminder';
  title: string;
  detail: string;
  timestamp?: string;
}

export interface CalendarMonthDay {
  date: string;
  inCurrentMonth: boolean;
}

function dateKeyFromParts(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return dateKeyFromParts(year, month - 1, day) === value;
}

export function dateKeyInTimeZone(value: string, timeZone: string): string | null {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function applicationTitle(application: JobApplication): string {
  return [application.company.trim(), application.position.trim()]
    .filter(Boolean)
    .join(' · ') || 'Aplikacja bez nazwy';
}

/** Buduje kalendarz z istniejących rekordów, bez dopowiadania ich statusu. */
export function getApplicationCalendarEntries(
  applications: JobApplication[],
  timeZone: string,
): ApplicationCalendarEntry[] {
  const entries: ApplicationCalendarEntry[] = [];

  for (const application of applications) {
    if (isDateOnly(application.date)) {
      entries.push({
        id: `${application.id}:application`,
        applicationId: application.id,
        date: application.date,
        kind: 'application',
        title: applicationTitle(application),
        detail: application.status,
      });
    }

    const hasMatchingTimelineInterview = Boolean(application.interviewAt && application.events?.some((event) =>
      event.kind === 'interview' &&
      !isDateOnly(event.scheduledAt) &&
      Date.parse(event.scheduledAt) === Date.parse(application.interviewAt!),
    ));

    if (application.interviewAt && !hasMatchingTimelineInterview && Number.isFinite(Date.parse(application.interviewAt))) {
      const date = dateKeyInTimeZone(application.interviewAt, timeZone);
      if (date) {
        entries.push({
          id: `${application.id}:interview`,
          applicationId: application.id,
          date,
          kind: 'interview',
          title: applicationTitle(application),
          detail: 'Rozmowa · dane z rekordu',
          timestamp: application.interviewAt,
        });
      }
    }

    for (const event of application.events ?? []) {
      if (event.state === 'cancelled') continue;
      const date = isDateOnly(event.scheduledAt)
        ? event.scheduledAt
        : dateKeyInTimeZone(event.scheduledAt, timeZone);
      const duplicatesApplicationDate = event.kind === 'application_sent' &&
        isDateOnly(application.date) && date === application.date;
      if (date && !duplicatesApplicationDate) {
        entries.push({
          id: `${application.id}:event:${event.id}`,
          applicationId: application.id,
          date,
          kind: event.kind,
          title: applicationTitle(application),
          detail: `${getApplicationEventKindLabel(event.kind)} · ${getApplicationEventStateLabel(event.state)}${event.verificationStatus === 'user_declared' ? ' · Zadeklarowano (Hunter), niepotwierdzone przez ATS' : ''}`,
          timestamp: isDateOnly(event.scheduledAt) ? undefined : event.scheduledAt,
        });
      }

      if (event.reminderAt && Number.isFinite(Date.parse(event.reminderAt))) {
        const reminderDate = dateKeyInTimeZone(event.reminderAt, timeZone);
        if (reminderDate) {
          entries.push({
            id: `${application.id}:reminder:${event.id}`,
            applicationId: application.id,
            date: reminderDate,
            kind: 'reminder',
            title: applicationTitle(application),
            detail: `Przypomnienie · ${getApplicationEventKindLabel(event.kind)}`,
            timestamp: event.reminderAt,
          });
        }
      }
    }
  }

  return entries.sort((left, right) => {
    const dateOrder = left.date.localeCompare(right.date);
    if (dateOrder !== 0) return dateOrder;
    const timeOrder = (left.timestamp ? Date.parse(left.timestamp) : 0) -
      (right.timestamp ? Date.parse(right.timestamp) : 0);
    return timeOrder || left.title.localeCompare(right.title) || left.kind.localeCompare(right.kind);
  });
}

/** Tygodnie zaczynają się w poniedziałek; daty są liczone jako dni kalendarzowe UTC. */
export function getCalendarMonthDays(year: number, monthIndex: number): CalendarMonthDay[] {
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const cellCount = mondayOffset + daysInMonth > 35 ? 42 : 35;
  const start = Date.UTC(year, monthIndex, 1 - mondayOffset);

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(start + index * 24 * 60 * 60 * 1000);
    return {
      date: date.toISOString().slice(0, 10),
      inCurrentMonth: date.getUTCFullYear() === firstDay.getUTCFullYear() && date.getUTCMonth() === firstDay.getUTCMonth(),
    };
  });
}

/** Tygodniowy widok używa dni kalendarzowych, także na granicy miesiąca i roku. */
export function getCalendarWeekDays(date: string): CalendarMonthDay[] {
  if (!isDateOnly(date)) return [];
  const [year, month, day] = date.split('-').map(Number);
  const selected = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (selected.getUTCDay() + 6) % 7;
  const start = Date.UTC(year, month - 1, day - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start + index * 24 * 60 * 60 * 1000);
    return { date: current.toISOString().slice(0, 10), inCurrentMonth: true };
  });
}

export function shiftCalendarDate(date: string, days: number): string | null {
  if (!isDateOnly(date) || !Number.isInteger(days)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function shiftCalendarMonth(date: string, months: number): string | null {
  if (!isDateOnly(date) || !Number.isInteger(months)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const targetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  const target = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(day, lastDay)));
  return target.toISOString().slice(0, 10);
}

export function formatCalendarTime(value: string, timeZone: string): string {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return '';
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant);
}
