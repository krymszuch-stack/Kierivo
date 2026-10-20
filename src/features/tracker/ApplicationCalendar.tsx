import React, { useMemo, useState } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import type { JobApplication } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  type CalendarMonthDay,
  formatCalendarTime,
  dateKeyInTimeZone,
  getApplicationCalendarEntries,
  getCalendarMonthDays,
  getCalendarWeekDays,
  shiftCalendarDate,
  shiftCalendarMonth,
} from './applicationCalendar';

interface ApplicationCalendarProps {
  applications: JobApplication[];
  onSelectApplication: (application: JobApplication) => void;
}

const WEEKDAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'];

function getMonthTitle(year: number, month: number): string {
  return new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)));
}

function getWeekTitle(days: CalendarMonthDay[]): string {
  if (days.length !== 7) return 'Nieprawidłowy tydzień';
  const formatter = new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${formatter.format(new Date(`${days[0].date}T00:00:00Z`))} – ${formatter.format(new Date(`${days[6].date}T00:00:00Z`))}`;
}

export const ApplicationCalendar: React.FC<ApplicationCalendarProps> = ({ applications, onSelectApplication }) => {
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
  const [visibleDate, setVisibleDate] = useState(() => {
    const now = new Date();
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [anchorYear, anchorMonth] = visibleDate.split('-').map(Number);
  const monthDays = useMemo(
    () => getCalendarMonthDays(anchorYear, anchorMonth - 1),
    [anchorYear, anchorMonth],
  );
  const weekDays = useMemo(() => getCalendarWeekDays(visibleDate), [visibleDate]);
  const days = calendarMode === 'week' ? weekDays : monthDays;
  const entries = useMemo(
    () => getApplicationCalendarEntries(applications, timeZone),
    [applications, timeZone],
  );
  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, typeof entries>();
    for (const entry of entries) {
      const bucket = grouped.get(entry.date) ?? [];
      bucket.push(entry);
      grouped.set(entry.date, bucket);
    }
    return grouped;
  }, [entries]);
  const weekStartDate = weekDays[0]?.date ?? '';
  const weekEndDate = weekDays[6]?.date ?? '';
  const visibleEntries = entries.filter((entry) => calendarMode === 'week'
    ? Boolean(weekStartDate && weekEndDate && entry.date >= weekStartDate && entry.date <= weekEndDate)
    : (() => {
      const [year, month] = entry.date.split('-').map(Number);
      return year === anchorYear && month === anchorMonth;
    })());
  const today = dateKeyInTimeZone(new Date().toISOString(), timeZone);

  const moveMonth = (delta: number) => {
    setVisibleDate((current) => shiftCalendarMonth(current, delta) ?? current);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    const pad = (part: number) => String(part).padStart(2, '0');
    setVisibleDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  };

  const moveWeek = (delta: number) => {
    setVisibleDate((current) => shiftCalendarDate(current, delta * 7) ?? current);
  };

  const title = calendarMode === 'week' ? getWeekTitle(weekDays) : getMonthTitle(anchorYear, anchorMonth - 1);

  return (
    <div className="space-y-3">
      <Card tone="raised" className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold capitalize text-ink">{title}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {visibleEntries.length === 1 ? '1 pozycja' : `${visibleEntries.length} pozycji`} {calendarMode === 'week' ? 'w tym tygodniu' : 'w tym miesiącu'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-line p-0.5" role="group" aria-label="Zakres kalendarza">
              <Button
                type="button"
                variant={calendarMode === 'month' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={calendarMode === 'month'}
                onClick={() => setCalendarMode('month')}
              >
                Miesiąc
              </Button>
              <Button
                type="button"
                variant={calendarMode === 'week' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={calendarMode === 'week'}
                onClick={() => setCalendarMode('week')}
              >
                Tydzień
              </Button>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={goToCurrentMonth}>
              Dziś
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={ChevronLeft}
              aria-label={calendarMode === 'week' ? 'Poprzedni tydzień' : 'Poprzedni miesiąc'}
              onClick={() => calendarMode === 'week' ? moveWeek(-1) : moveMonth(-1)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={ChevronRight}
              aria-label={calendarMode === 'week' ? 'Następny tydzień' : 'Następny miesiąc'}
              onClick={() => calendarMode === 'week' ? moveWeek(1) : moveMonth(1)}
            />
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-line bg-sunken/60">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="px-1 py-2 text-center font-mono text-[10px] font-bold uppercase text-muted sm:px-2 sm:text-xs">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEntries = entriesByDate.get(day.date) ?? [];
            const dayNumber = Number(day.date.slice(-2));
            return (
              <section
                key={day.date}
                aria-label={day.date}
                className={`min-h-24 border-b border-r border-line p-1 sm:min-h-32 sm:p-2 ${
                  day.inCurrentMonth ? 'bg-surface' : 'bg-sunken/40 text-muted'
                } ${day.date === today ? 'ring-inset ring-2 ring-brand-400/50' : ''}`}
              >
                <time dateTime={day.date} className={`mb-1 block text-right text-xs font-semibold ${day.date === today ? 'text-brand-700' : ''}`}>
                  {dayNumber}
                </time>
                <div className="space-y-1">
                  {dayEntries.slice(0, 3).map((entry) => {
                    const application = applications.find((candidate) => candidate.id === entry.applicationId);
                    if (!application) return null;
                    const time = entry.timestamp ? formatCalendarTime(entry.timestamp, timeZone) : '';
                    const dateLabel = `${entry.date}${time ? ` ${time}` : ''}`;
                    const EventIcon = entry.kind === 'interview' ? Video : entry.kind === 'reminder' ? Bell : CalendarDays;
                    const eventTone = entry.kind === 'interview'
                      ? 'bg-violet-100 text-violet-800 hover:bg-violet-200'
                      : entry.kind === 'reminder'
                        ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                        : 'bg-brand-50 text-brand-800 hover:bg-brand-100';
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => onSelectApplication(application)}
                        aria-label={`${entry.title}, ${entry.detail}, ${dateLabel}`}
                        title={`${entry.title} · ${entry.detail}${time ? ` · ${time}` : ''}`}
                        className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] leading-tight sm:text-xs ${eventTone}`}
                      >
                        <span className="flex items-center gap-1">
                          <EventIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {time && <span className="shrink-0 font-semibold">{time}</span>}
                          <span className="truncate">{entry.title}</span>
                        </span>
                        <span className="mt-0.5 block truncate pl-4 opacity-80">{entry.detail}</span>
                      </button>
                    );
                  })}
                  {dayEntries.length > 3 && (
                    <span className="block px-1 text-[10px] text-muted">+{dayEntries.length - 3} więcej</span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </Card>

      <p className="px-1 text-xs text-muted" role="note">
        Kalendarz pokazuje daty zapisane w Pipeline. Terminy rozmów wyświetlane są w lokalnej strefie ({timeZone}); status pozostaje taki jak w rekordzie.
      </p>
      {visibleEntries.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted" role="status">
          Brak terminów w tym {calendarMode === 'week' ? 'tygodniu' : 'miesiącu'}.
        </p>
      )}
    </div>
  );
};
