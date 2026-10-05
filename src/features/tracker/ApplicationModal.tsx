import React, { useState, useEffect } from 'react';
import { Building2, Briefcase, DollarSign, Calendar, Globe, FileText, Check } from 'lucide-react';
import { ApplicationStatus, JobApplication } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea, Select } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { getApplicationDisplayInfo } from './applicationDisplay';
import { normalizeExternalHttpUrl } from '../../lib/externalHttpUrl';

// Jak wyżej: definicja jest w `src/types`, tutaj zostaje tylko przepustka
// dla modułów, które importowały ją stąd.
export type { JobApplication };

export interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (application: JobApplication) => void;
  initialData?: JobApplication | null;
}

export const ApplicationModal: React.FC<ApplicationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<ApplicationStatus>('Do wysłania');
  const [jobUrl, setJobUrl] = useState('');
  const [jobUrlError, setJobUrlError] = useState(false);
  const [notes, setNotes] = useState('');

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
    } else {
      setCompany('');
      setPosition('');
      setSalary('');
      setDate(new Date().toISOString().split('T')[0]);
      setStatus('Do wysłania');
      setJobUrl('');
      setNotes('');
    }
  }, [initialData, isOpen]);

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
      salary: salary.trim() || 'Do negocjacji',
      date,
      status,
      jobUrl: normalizedJobUrl ?? '',
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edytuj Aplikację' : 'Dodaj Nową Aplikację'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Anuluj
          </Button>

          <Button type="submit" variant="primary" size="md" icon={Check}>
            {initialData ? 'Zapisz zmiany' : 'Dodaj do moich aplikacji'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
