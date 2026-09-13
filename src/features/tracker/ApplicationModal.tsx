import React, { useState, useEffect } from 'react';
import { Building2, Briefcase, DollarSign, Calendar, Globe, FileText, Check } from 'lucide-react';
import { ApplicationStatus, JobApplication } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea, Select } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';

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
  const [status, setStatus] = useState<ApplicationStatus>('Wysłana');
  const [jobUrl, setJobUrl] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      setCompany(initialData.company);
      setPosition(initialData.position);
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
      setStatus('Wysłana');
      setJobUrl('');
      setNotes('');
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !position.trim()) return;

    onSave({
      ...(initialData || {}),
      id: initialData?.id || `app-${Date.now()}`,
      company: company.trim(),
      position: position.trim(),
      salary: salary.trim() || 'Do negocjacji',
      date,
      status,
      jobUrl: jobUrl.trim(),
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
            placeholder="np. Snowflake, Google, SoftwarePlant"
            required
          />

          <Input
            label="Stanowisko Docelowe"
            icon={Briefcase}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="np. Senior Frontend Architect"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Widełki / Oczekiwania"
            icon={DollarSign}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="np. 24 000 - 30 000 PLN B2B"
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
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://justjoin.it/..."
          />
        </div>

        <Textarea
          label="Notatki z Procesu Rekrutacyjnego & Ustalenia"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="np. I etap techniczny z lematyzacji i Reacta zaliczony, feedback do piątku..."
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
