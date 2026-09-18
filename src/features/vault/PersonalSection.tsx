import React, { useState, useMemo } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Globe,
  Briefcase,
  Paperclip,
  Plus,
  X,
  Sparkles,
  ImagePlus,
} from 'lucide-react';
import { PersonalInfo, MasterVault } from '../../types';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Field';
import { Combobox } from '../../components/ui/Combobox';
import { Button } from '../../components/ui/Button';
import { SummaryAssistantModal } from './SummaryAssistantModal';
import type { SuggestFn } from '../../hooks/useFieldSuggestions';

export interface PersonalSectionProps {
  data: PersonalInfo;
  onChange: (updated: PersonalInfo) => void;
  /** Pełny vault do kontekstowego generowania podsumowań */
  vault?: MasterVault;
  /**
   * Podpowiedzi do pól tekstowych. Opcjonalne, bo ta sekcja bywa renderowana
   * bez dostępu do całego vaultu — wtedy `Combobox` dostaje pustą listę
   * i zachowuje się dokładnie jak zwykły `Input`.
   */
  suggest?: SuggestFn;
  /** Wywołanie szybkiego importu / wgrania CV z agrafką */
  onOpenCvParser?: () => void;
  className?: string;
}

export const PersonalSection: React.FC<PersonalSectionProps> = ({
  data,
  onChange,
  vault,
  suggest,
  onOpenCvParser,
  className = '',
}) => {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Rozbijamy fullName na części, jeśli brak jawnych firstName / lastName
  const parsedName = useMemo(() => {
    if (data.firstName || data.lastName) {
      return {
        first: data.firstName || '',
        middle: data.middleName || '',
        last: data.lastName || '',
      };
    }
    const parts = (data.fullName || '').trim().split(/\s+/);
    if (parts.length <= 1) {
      return { first: parts[0] || '', middle: '', last: '' };
    }
    if (parts.length === 2) {
      return { first: parts[0], middle: '', last: parts[1] };
    }
    return {
      first: parts[0],
      middle: parts[1],
      last: parts.slice(2).join(' '),
    };
  }, [data.firstName, data.middleName, data.lastName, data.fullName]);

  const [showMiddleName, setShowMiddleName] = useState(() => Boolean(data.middleName || parsedName.middle));

  const handleNamePartChange = (part: 'first' | 'middle' | 'last', val: string) => {
    const nextFirst = part === 'first' ? val : (data.firstName ?? parsedName.first);
    const nextMiddle = part === 'middle' ? val : (data.middleName ?? parsedName.middle);
    const nextLast = part === 'last' ? val : (data.lastName ?? parsedName.last);

    const composed = [nextFirst.trim(), showMiddleName ? nextMiddle.trim() : '', nextLast.trim()]
      .filter(Boolean)
      .join(' ');

    onChange({
      ...data,
      firstName: nextFirst,
      middleName: showMiddleName ? nextMiddle : '',
      lastName: nextLast,
      fullName: composed,
    });
  };

  const handleChange = (field: keyof PersonalInfo, value: string) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handlePhotoChange = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ ...data, photoUrl: typeof reader.result === 'string' ? reader.result : data.photoUrl });
    reader.readAsDataURL(file);
  };

  const isEmailValid = !data.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);

  // Zbudowanie fallbackowego obiektu vault dla asystenta, jeśli prop nie został podany
  const effectiveVault: MasterVault = useMemo(() => {
    if (vault) return vault;
    return {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      personalInfo: data,
      history: [],
      skillsMatrix: { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
      education: [],
      projects: [],
      profiler: {
        flags: ['OFFICE_IT'],
        experienceLevel: 'MID',
        location: {
          city: data.location || '',
          radiusKm: 30,
          willingnessToTravel: false,
          hybridWork: true,
          remoteOnly: false,
        },
        languages: [],
      },
    };
  }, [vault, data]);

  return (
    <Card tone="raised" className={`space-y-6 ${className}`}>
      {/* Nagłówek i widoczny przycisk Wgraj CV z agrafką */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <User className="h-4 w-4 text-brand-600" />
            Dane Osobowe i Kontaktowe
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Informacje widoczne w nagłówku Twojego gotowego CV oraz formularzy rekrutacyjnych.
          </p>
        </div>

        {onOpenCvParser && (
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Paperclip}
            onClick={onOpenCvParser}
            className="shrink-0 font-bold shadow-xs"
          >
            Wgraj CV (PDF / DOCX)
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-sunken/40 p-3">
        {data.photoUrl ? (
          <img src={data.photoUrl} alt="Zdjęcie do CV" className="h-14 w-14 rounded-xl border-2 border-surface object-cover shadow-xs" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-surface text-muted">
            <ImagePlus className="h-5 w-5" />
          </div>
        )}
        <label className="min-w-0 cursor-pointer">
          <span className="block text-xs font-bold text-ink">Dodaj zdjęcie do CV</span>
          <span className="block text-[11px] text-muted">Kwadratowy kadr i obramowanie będą widoczne w podglądzie.</span>
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => handlePhotoChange(event.target.files?.[0])} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {/* Imię z opcją dodania drugiego imienia */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-ink flex items-center gap-1">
              Imię <span className="text-danger-fg">*</span>
            </label>
            {!showMiddleName && (
              <button
                type="button"
                onClick={() => setShowMiddleName(true)}
                className="text-[11px] font-semibold text-brand-fg hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> Drugie imię
              </button>
            )}
          </div>
          <Input
            value={data.firstName ?? parsedName.first}
            onChange={(e) => handleNamePartChange('first', e.target.value)}
            placeholder="np. Jan"
            required
          />
        </div>

        {/* Drugie imię (opcjonalne) */}
        {showMiddleName && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted flex items-center gap-1">
                Drugie imię
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowMiddleName(false);
                  handleNamePartChange('middle', '');
                }}
                className="text-[11px] text-muted hover:text-danger-fg cursor-pointer flex items-center gap-0.5"
                title="Usuń drugie imię"
              >
                <X className="h-3 w-3" /> Usuń
              </button>
            </div>
            <Input
              value={data.middleName ?? parsedName.middle}
              onChange={(e) => handleNamePartChange('middle', e.target.value)}
              placeholder="np. Paweł"
            />
          </div>
        )}

        {/* Nazwisko */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-ink flex items-center gap-1">
            Nazwisko <span className="text-danger-fg">*</span>
          </label>
          <Input
            value={data.lastName ?? parsedName.last}
            onChange={(e) => handleNamePartChange('last', e.target.value)}
            placeholder="np. Kowalski"
            required
          />
        </div>

        {/* Professional Title */}
        <Combobox
          label="Tytuł Zawodowy"
          icon={Briefcase}
          value={data.title}
          onChange={(value) => handleChange('title', value)}
          suggestions={suggest?.('jobTitle', data.title) ?? []}
          placeholder="np. Senior Frontend Architect"
          required
        />

        {/* Location */}
        <Combobox
          label="Miasto / Lokalizacja"
          icon={MapPin}
          value={data.location}
          onChange={(value) => handleChange('location', value)}
          suggestions={suggest?.('location', data.location) ?? []}
          placeholder="np. Warszawa, Polska"
        />

        {/* Email with validation */}
        <Input
          label="Adres E-mail"
          icon={Mail}
          type="email"
          value={data.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="adrian.k@example.com"
          error={!isEmailValid ? 'Niepoprawny format adresu e-mail' : undefined}
          required
        />

        {/* Phone */}
        <Input
          label="Numer Telefonu"
          icon={Phone}
          type="tel"
          value={data.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="+48 600 000 000"
        />

        {/* LinkedIn */}
        <Input
          label="Profil LinkedIn"
          icon={Linkedin}
          value={data.linkedin || ''}
          onChange={(e) => handleChange('linkedin', e.target.value)}
          placeholder="linkedin.com/in/jankowalski"
        />

        {/* GitHub */}
        <Input
          label="Profil GitHub"
          icon={Github}
          value={data.github || ''}
          onChange={(e) => handleChange('github', e.target.value)}
          placeholder="github.com/jankowalski"
        />

        {/* Portfolio / Website */}
        <Input
          label="Strona / Portfolio"
          icon={Globe}
          value={data.website || ''}
          onChange={(e) => handleChange('website', e.target.value)}
          placeholder="jankowalski.dev"
        />
      </div>

      {/* Summary Section z asystentem beztokenowej generacji */}
      <div className="space-y-1.5 pt-2 border-t border-line/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-bold text-ink">
            Podsumowanie Profilu Zawodowego
          </label>
          <button
            type="button"
            onClick={() => setIsAssistantOpen(true)}
            className="text-[11px] font-bold text-brand-fg hover:underline cursor-pointer flex items-center gap-1.5 bg-brand-500/10 hover:bg-brand-500/20 px-2.5 py-1 rounded-xl transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>Zaproponuj podsumowanie (beztokenowe)</span>
          </button>
        </div>

        <Textarea
          rows={4}
          value={data.summary}
          onChange={(e) => handleChange('summary', e.target.value)}
          placeholder="Doświadczony inżynier oprogramowania z ponad 6-letnim stażem w budowie systemów chmurowych..."
          hint="Podsumowanie powinno zawierać Twoje 3 najmocniejsze atuty i kluczowe technologie"
        />
      </div>

      {/* Modal Asystenta Podsumowań */}
      <SummaryAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        vault={effectiveVault}
        onSelectSummary={(text) => handleChange('summary', text)}
      />
    </Card>
  );
};
