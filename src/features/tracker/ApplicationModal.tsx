import React, { useState, useEffect } from 'react';
import { Building2, Briefcase, DollarSign, Calendar, Globe, Check, Plus, Trash2, Pencil } from 'lucide-react';
import type { ApplicationEvent, ApplicationEventKind, ApplicationEventSource, ApplicationEventState, ApplicationStatus, JobApplication } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea, Select } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { getApplicationDisplayInfo } from './applicationDisplay';
import { normalizeExternalHttpUrl } from '../../lib/externalHttpUrl';
import {
  formatApplicationEventDate,
  getApplicationEventKindLabel,
  isoToLocalDateTime,
  localDateTimeToIso,
  removeApplicationEvent,
  upsertApplicationEvent,
} from './applicationEvents';
import { projectInterviewAt } from '../../lib/applicationInterview';
import { resolveApplicationSalary } from './applicationForm';

// Jak wyżej: definicja jest w `src/types`, tutaj zostaje tylko przepustka
// dla modułów, które importowały ją stąd.
export type { JobApplication };

export interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (application: JobApplication) => void;
  initialData?: JobApplication | null;
  receiptImport?: boolean;
}

export const ApplicationModal: React.FC<ApplicationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  receiptImport = false,
}) => {
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<ApplicationStatus>('Do wysłania');
  const [jobUrl, setJobUrl] = useState('');
  const [jobUrlError, setJobUrlError] = useState(false);
  const [notes, setNotes] = useState('');
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [draftEventKind, setDraftEventKind] = useState<ApplicationEventKind>('response_due');
  const [draftEventState, setDraftEventState] = useState<ApplicationEventState>('unknown');
  const [draftEventDate, setDraftEventDate] = useState('');
  const [draftEventTime, setDraftEventTime] = useState('');
  const [draftEventReminderAt, setDraftEventReminderAt] = useState('');
  const [draftEventEvidenceUrl, setDraftEventEvidenceUrl] = useState('');
  const [draftEventNote, setDraftEventNote] = useState('');
  const [eventEvidenceUrlError, setEventEvidenceUrlError] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventSource, setEditingEventSource] = useState<ApplicationEventSource>('user');
  const [editingEventSourceId, setEditingEventSourceId] = useState<string | undefined>();
  const [editingEventVerificationStatus, setEditingEventVerificationStatus] = useState<ApplicationEvent['verificationStatus']>();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  useEffect(() => {
    if (initialData) {
      const display = getApplicationDisplayInfo(initialData);
      setCompany(display.company);
      setPosition(display.position);
      setSalary(initialData.salary || '');
      setDate(initialData.date || new Date().toISOString().split('T')[0]);
      setStatus(initialData.status);
      setJobUrl(initialData.jobUrl || '');
      setNotes(initialData.notes || '');
      setEvents(initialData.events ?? []);
    } else {
      setCompany('');
      setPosition('');
      setSalary('');
      setDate(new Date().toISOString().split('T')[0]);
      setStatus('Do wysłania');
      setJobUrl('');
      setNotes('');
      setEvents([]);
    }
    setDraftEventKind('response_due');
    setDraftEventState('unknown');
    setDraftEventDate('');
    setDraftEventTime('');
    setDraftEventReminderAt('');
    setDraftEventEvidenceUrl('');
    setDraftEventNote('');
    setEventEvidenceUrlError(false);
    setEditingEventId(null);
    setEditingEventSource('user');
    setEditingEventSourceId(undefined);
    setEditingEventVerificationStatus(undefined);
  }, [initialData, isOpen]);

  const resetEventDraft = () => {
    setDraftEventKind('response_due');
    setDraftEventState('unknown');
    setDraftEventDate('');
    setDraftEventTime('');
    setDraftEventReminderAt('');
    setDraftEventEvidenceUrl('');
    setDraftEventNote('');
    setEventEvidenceUrlError(false);
    setEditingEventId(null);
    setEditingEventSource('user');
    setEditingEventSourceId(undefined);
    setEditingEventVerificationStatus(undefined);
  };

  const editEvent = (event: ApplicationEvent) => {
    const localScheduledAt = event.scheduledAt.includes('T')
      ? isoToLocalDateTime(event.scheduledAt)
      : '';
    setDraftEventKind(event.kind);
    setDraftEventState(event.state);
    setDraftEventDate(localScheduledAt ? localScheduledAt.slice(0, 10) : event.scheduledAt);
    setDraftEventTime(localScheduledAt ? localScheduledAt.slice(11, 16) : '');
    setDraftEventReminderAt(event.reminderAt ? isoToLocalDateTime(event.reminderAt) : '');
    setDraftEventEvidenceUrl(event.evidenceUrl ?? '');
    setDraftEventNote(event.note ?? '');
    setEditingEventId(event.id);
    setEditingEventSource(event.source);
    setEditingEventSourceId(event.sourceEventId);
    setEditingEventVerificationStatus(event.verificationStatus);
    setEventEvidenceUrlError(false);
  };

  const addEvent = () => {
    if (!draftEventDate) return;
    const scheduledAt = draftEventTime
      ? localDateTimeToIso(`${draftEventDate}T${draftEventTime}`)
      : draftEventDate;
    const reminderAt = draftEventReminderAt ? localDateTimeToIso(draftEventReminderAt) : undefined;
    const evidenceUrl = draftEventEvidenceUrl.trim()
      ? normalizeExternalHttpUrl(draftEventEvidenceUrl)
      : undefined;
    if (!scheduledAt || (draftEventReminderAt && !reminderAt) ||
        (draftEventEvidenceUrl.trim() && !evidenceUrl)) {
      setEventEvidenceUrlError(Boolean(draftEventEvidenceUrl.trim() && !evidenceUrl));
      return;
    }

    const event: ApplicationEvent = {
      id: editingEventId ?? globalThis.crypto.randomUUID(),
      kind: draftEventKind,
      scheduledAt,
      ...(draftEventTime ? { timeZone } : {}),
      state: draftEventState,
      source: editingEventSource,
      ...(editingEventVerificationStatus ? { verificationStatus: editingEventVerificationStatus } : {}),
      ...(editingEventSourceId ? { sourceEventId: editingEventSourceId } : {}),
      ...(evidenceUrl ? { evidenceUrl } : {}),
      ...(draftEventNote.trim() ? { note: draftEventNote.trim() } : {}),
      ...(reminderAt ? { reminderAt } : {}),
    };
    setEvents((current) => upsertApplicationEvent(current, event));
    resetEventDraft();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!position.trim() || (!initialData && !company.trim())) return;
    const normalizedJobUrl = jobUrl.trim() ? normalizeExternalHttpUrl(jobUrl) : undefined;
    if (jobUrl.trim() && !normalizedJobUrl) {
      setJobUrlError(true);
      return;
    }
    setJobUrlError(false);

    onSave({
      ...(initialData || {}),
      id: initialData?.id || `app-${Date.now()}`,
      company: company.trim(),
      position: position.trim(),
      salary: resolveApplicationSalary(salary),
      date,
      status,
      jobUrl: normalizedJobUrl ?? '',
      notes: notes.trim(),
      interviewAt: projectInterviewAt(events),
      events,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={receiptImport ? 'Sprawdź potwierdzenie z Huntera' : initialData ? 'Edytuj Aplikację' : 'Dodaj Nową Aplikację'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto px-1">
        {receiptImport && (
          <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900" role="status">
            To jest deklaracja użytkownika po ręcznym wysłaniu formularza. Sprawdź dane i zapisz ją w bieżącym profilu; Hunter nie wysyła aplikacji.
          </p>
        )}
        {initialData?.migrationQuarantine && initialData.migrationQuarantine.length > 0 && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" aria-labelledby="migration-quarantine-heading">
            <h3 id="migration-quarantine-heading" className="font-semibold">Zdarzenia zachowane do weryfikacji</h3>
            <p className="mt-1 text-xs">
              {initialData.migrationQuarantine.length} wpisów osi nie można było bezpiecznie odczytać. Oryginały pozostają zachowane.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold">Pokaż zachowane dane</summary>
              <ul className="mt-2 max-h-48 space-y-2 overflow-auto">
                {initialData.migrationQuarantine.map((entry, index) => {
                  let raw = '[nie można wyświetlić wpisu]';
                  try { raw = JSON.stringify(entry, null, 2) ?? raw; } catch { /* dane JSON powinny być możliwe do odczytu */ }
                  return (
                    <li key={index}>
                      <pre className="max-h-32 overflow-auto rounded-md bg-white/70 p-2 text-[10px]">{raw.slice(0, 4000)}</pre>
                      {raw.length > 4000 && <span className="text-[10px]">Podgląd skrócony; zapisany wpis nie został skrócony.</span>}
                    </li>
                  );
                })}
              </ul>
            </details>
          </section>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Firma Rekrutująca"
            icon={Building2}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="np. Budimex, DHL Express, Volvo, TechCorp"
            required={!initialData}
          />

          <Input
            label="Stanowisko Docelowe"
            icon={Briefcase}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="np. Monter instalacji HVAC, Kierownik magazynu, Spawacz TIG"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Widełki / Oczekiwania"
            icon={DollarSign}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="np. 6 500 - 8 500 PLN brutto / UoP"
            hint="Puste pole oznacza brak danych. Wpisz „Do negocjacji” tylko wtedy, gdy to informacja z ogłoszenia."
          />

          <Input
            label="Data Zgłoszenia"
            icon={Calendar}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Status Rekrutacji"
            value={status}
            onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
            options={[
              { value: 'Do wysłania', label: 'Do wysłania' },
              { value: 'Wysłana', label: 'Wysłana' },
              { value: 'Rozmowa', label: 'Rozmowa' },
              { value: 'Oferta', label: 'Oferta' },
              { value: 'Odrzucona', label: 'Odrzucona' },
            ]}
          />

          <Input
            label="Link do Ogłoszenia (Opcjonalnie)"
            icon={Globe}
            type="url"
            value={jobUrl}
            onChange={(e) => {
              setJobUrl(e.target.value);
              setJobUrlError(false);
            }}
            placeholder="https://pracuj.pl/... lub https://olx.pl/..."
            aria-invalid={jobUrlError}
          />
        </div>
        {jobUrlError && (
          <p role="alert" className="text-xs text-red-600">Link musi być poprawnym adresem http:// lub https://.</p>
        )}

        <Textarea
          label="Notatki z Procesu Rekrutacyjnego & Ustalenia"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="np. Rozmowa telefoniczna z HR zaliczona, termin próbki spawalniczej / weryfikacji uprawnień w piątek..."
        />

        <section className="space-y-3 border-t border-line pt-4" aria-labelledby="application-events-heading">
          <div>
            <h3 id="application-events-heading" className="font-semibold text-ink">Oś procesu</h3>
            <p className="mt-1 text-xs text-muted">
              Zapisuj terminy i ustalenia. Wpis nie wysyła wiadomości ani nie potwierdza faktów samodzielnie.
            </p>
          </div>

          {events.length > 0 ? (
            <ul className="space-y-2">
              {events.map((event) => {
                const evidenceUrl = event.evidenceUrl ? normalizeExternalHttpUrl(event.evidenceUrl) : undefined;
                return (
                  <li key={event.id} className="rounded-xl border border-line bg-sunken/50 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-ink">{getApplicationEventKindLabel(event.kind)}</p>
                        <p className="text-xs text-muted">
                          {formatApplicationEventDate(event, timeZone)}
                          {event.timeZone ? ` · ${event.timeZone}` : ''}
                          {' · '}{event.source === 'user' ? 'Wpis użytkownika' : event.source === 'page' ? 'Źródło ze strony' : 'Rozszerzenie'}
                          {event.verificationStatus === 'user_declared' ? ' · Zadeklarowano ręcznie (Hunter); bez potwierdzenia ATS' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          label="Stan zdarzenia"
                          value={event.state}
                          onChange={(e) => {
                            const state = e.target.value as ApplicationEventState;
                            setEvents((current) => current.map((entry) => entry.id === event.id ? { ...entry, state } : entry));
                          }}
                          options={[
                            { value: 'confirmed', label: 'Potwierdzone' },
                            { value: 'pending', label: 'Oczekuje' },
                            { value: 'unknown', label: 'Nieznane' },
                            { value: 'cancelled', label: 'Odwołane' },
                          ]}
                          className="min-w-32"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Pencil}
                          aria-label={`Edytuj zdarzenie: ${getApplicationEventKindLabel(event.kind)}`}
                          onClick={() => editEvent(event)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          aria-label={`Usuń zdarzenie: ${getApplicationEventKindLabel(event.kind)}`}
                          onClick={() => setEvents((current) => removeApplicationEvent(current, event.id))}
                        />
                      </div>
                    </div>
                    {evidenceUrl && (
                      <a href={evidenceUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-brand-700 underline">
                        Otwórz dowód
                      </a>
                    )}
                    {event.note && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{event.note}</p>}
                    {event.reminderAt && (
                      <p className="mt-2 text-xs font-medium text-amber-800">
                        Przypomnienie: {new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(event.reminderAt))}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">Brak zapisanych zdarzeń procesu.</p>
          )}

          <div className="space-y-3 rounded-xl border border-line p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Rodzaj zdarzenia"
                value={draftEventKind}
                onChange={(e) => setDraftEventKind(e.target.value as ApplicationEventKind)}
                options={[
                  { value: 'application_sent', label: 'Wysłanie aplikacji' },
                  { value: 'interview', label: 'Rozmowa' },
                  { value: 'email', label: 'Wiadomość e-mail' },
                  { value: 'response_due', label: 'Obiecana odpowiedź' },
                  { value: 'follow_up', label: 'Follow-up' },
                ]}
              />
              <Select
                label="Stan początkowy"
                value={draftEventState}
                onChange={(e) => setDraftEventState(e.target.value as ApplicationEventState)}
                options={[
                  { value: 'unknown', label: 'Nieznane' },
                  { value: 'pending', label: 'Oczekuje' },
                  { value: 'confirmed', label: 'Potwierdzone' },
                  { value: 'cancelled', label: 'Odwołane' },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Data"
                type="date"
                value={draftEventDate}
                onChange={(e) => setDraftEventDate(e.target.value)}
              />
              <Input
                label="Godzina (opcjonalnie)"
                type="time"
                value={draftEventTime}
                onChange={(e) => setDraftEventTime(e.target.value)}
                hint={draftEventTime ? `Strefa: ${timeZone}` : 'Bez godziny termin pozostanie całodniowy.'}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Termin przypomnienia (opcjonalnie)"
                type="datetime-local"
                value={draftEventReminderAt}
                onChange={(e) => setDraftEventReminderAt(e.target.value)}
                hint={`Termin zostanie pokazany w kalendarzu (${timeZone}).`}
              />
              <Input
                label="Link do dowodu (opcjonalnie)"
                type="url"
                value={draftEventEvidenceUrl}
                onChange={(e) => {
                  setDraftEventEvidenceUrl(e.target.value);
                  setEventEvidenceUrlError(false);
                }}
                error={eventEvidenceUrlError ? 'Podaj poprawny link http:// lub https://.' : undefined}
              />
            </div>
            <Textarea
              label="Notatka do zdarzenia (opcjonalnie)"
              rows={2}
              value={draftEventNote}
              onChange={(e) => setDraftEventNote(e.target.value)}
            />
            <div className="flex justify-end">
              <div className="flex gap-2">
                {editingEventId && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetEventDraft}>
                    Anuluj edycję
                  </Button>
                )}
                <Button type="button" variant="secondary" size="sm" icon={editingEventId ? Check : Plus} disabled={!draftEventDate} onClick={addEvent}>
                  {editingEventId ? 'Zapisz zdarzenie' : 'Dodaj zdarzenie'}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Anuluj
          </Button>

          <Button type="submit" variant="primary" size="md" icon={Check}>
            {receiptImport ? 'Zapisz potwierdzenie' : initialData ? 'Zapisz zmiany' : 'Dodaj do moich aplikacji'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
