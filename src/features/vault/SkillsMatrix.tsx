import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Globe,
  Award,
  ShieldCheck,
  Car,
  Truck,
  HardHat,
  Zap,
  Flame,
  Sparkles,
  Network,
  Wind,
  Sliders,
  X,
  ExternalLink,
  FileCheck,
  Search,
} from 'lucide-react';
import { motion } from 'motion/react';
import { SkillsMatrix as SkillsMatrixType, LanguageProficiency, Certification } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Combobox } from '../../components/ui/Combobox';
import { MonthYearPicker } from '../../components/ui/MonthYearPicker';
import type { SuggestFn } from '../../hooks/useFieldSuggestions';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ALL_LICENSES } from '../../data/licenses';

export interface SkillsMatrixProps {
  skillsMatrix: SkillsMatrixType;
  languages: LanguageProficiency[];
  licenses?: string[];
  onUpdateSkillsMatrix: (updated: SkillsMatrixType) => void;
  onUpdateLanguages: (updated: LanguageProficiency[]) => void;
  onUpdateLicenses: (updated: string[]) => void;
  /**
   * Podpowiedzi do pól chipowych. Opcjonalne — bez nich `Combobox` dostaje
   * pustą listę i zachowuje się jak zwykły `Input`.
   */
  suggest?: SuggestFn;
  className?: string;
}

const CEFR_PROGRESS: Record<LanguageProficiency['level'], number> = {
  A1: 17,
  A2: 33,
  B1: 50,
  B2: 67,
  C1: 83,
  C2: 100,
  Native: 100,
};

/**
 * Ikony rozwiązywane po nazwie z katalogu — ten sam wzorzec co w
 * `LicenseGrid`. Katalog (`src/data/licenses.ts`) jest modułem danych i
 * świadomie nie wciąga `lucide-react`, więc widok tłumaczy `iconName`
 * na komponent.
 */
const LICENSE_ICONS: Record<string, React.ElementType> = {
  Car,
  Truck,
  HardHat,
  Zap,
  Flame,
  ShieldCheck,
  Award,
  Sparkles,
  Network,
  Wind,
  Sliders,
};

// Katalog uprawnień z jednego źródła (`src/data/licenses.ts`). Lokalna kopia
// rozjeżdżała się etykietami z katalogiem silnika knock-outów, a pozycja
// first_aid w ogóle nie istniała w katalogu — zaznaczona, nigdy nie trafiłaby
// do kryteriów ofert (reguły 1 i 3).
const COMMON_LICENSES = ALL_LICENSES.map((lic) => ({
  id: lic.id,
  label: lic.label,
  icon: LICENSE_ICONS[lic.iconName] ?? ShieldCheck,
}));

const POPULAR_LICENSE_IDS = new Set([
  'b_license',
  'udt_forklift',
  'sep_1kv',
  'sep_g2',
  'sep_g3',
  'fgas',
  'welding_tig_mig',
  'sanepid',
  'cloud_cert',
]);

export const SkillsMatrix: React.FC<SkillsMatrixProps> = ({
  skillsMatrix,
  languages,
  licenses = [],
  onUpdateSkillsMatrix,
  onUpdateLanguages,
  onUpdateLicenses,
  suggest,
  className = '',
}) => {
  const [hardSkillInput, setHardSkillInput] = useState('');
  const [softSkillInput, setSoftSkillInput] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newLangLevel, setNewLangLevel] = useState<LanguageProficiency['level']>('B2');

  // Stan wyszukiwarki i filtra uprawnień
  const [licenseSearch, setLicenseSearch] = useState('');
  const [licenseFilter, setLicenseFilter] = useState<'all' | 'selected' | 'popular'>('popular');

  // Stan formularza nowego certyfikatu
  const [certName, setCertName] = useState('');
  const [certIssuer, setCertIssuer] = useState('');
  const [certDate, setCertDate] = useState<string | null>('');
  const [certUrl, setCertUrl] = useState('');

  const handleAddCertification = () => {
    if (!certName.trim()) return;
    const newCert: Certification = {
      id: `cert-${Date.now()}`,
      name: certName.trim(),
      issuer: certIssuer.trim() || 'Nieokreślony wystawca',
      date: certDate || undefined,
      url: certUrl.trim() || undefined,
    };
    onUpdateSkillsMatrix({
      ...skillsMatrix,
      certifications: [...(skillsMatrix.certifications || []), newCert],
    });
    setCertName('');
    setCertIssuer('');
    setCertDate('');
    setCertUrl('');
  };

  const handleRemoveCertification = (id: string) => {
    onUpdateSkillsMatrix({
      ...skillsMatrix,
      certifications: (skillsMatrix.certifications || []).filter((c) => c.id !== id),
    });
  };

  // Add Hard Skill
  //
  // Przyjmuje wartość, zamiast czytać wyłącznie stan pola: wybór podpowiedzi ma
  // dodać chip od razu, a `setHardSkillInput` zadziałałoby dopiero w kolejnym
  // renderze i dołożyłoby pustą wartość.
  const handleAddHardSkill = (value: string = hardSkillInput) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const exists = (skillsMatrix.hardSkills || []).some(
      (s) => s.toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) {
      onUpdateSkillsMatrix({
        ...skillsMatrix,
        hardSkills: [...(skillsMatrix.hardSkills || []), trimmed],
      });
    }
    setHardSkillInput('');
  };

  // Remove Hard Skill
  const handleRemoveHardSkill = (skill: string) => {
    onUpdateSkillsMatrix({
      ...skillsMatrix,
      hardSkills: (skillsMatrix.hardSkills || []).filter((s) => s !== skill),
    });
  };

  // Add Soft Skill
  const handleAddSoftSkill = () => {
    if (!softSkillInput.trim()) return;
    const exists = (skillsMatrix.softSkills || []).some(
      (s) => s.toLowerCase() === softSkillInput.trim().toLowerCase()
    );
    if (!exists) {
      onUpdateSkillsMatrix({
        ...skillsMatrix,
        softSkills: [...(skillsMatrix.softSkills || []), softSkillInput.trim()],
      });
    }
    setSoftSkillInput('');
  };

  // Remove Soft Skill
  const handleRemoveSoftSkill = (skill: string) => {
    onUpdateSkillsMatrix({
      ...skillsMatrix,
      softSkills: (skillsMatrix.softSkills || []).filter((s) => s !== skill),
    });
  };

  // Add Language
  const handleAddLanguage = () => {
    if (!newLangName.trim()) return;
    const newLang: LanguageProficiency = {
      id: `lang-${Date.now()}`,
      language: newLangName.trim(),
      level: newLangLevel,
      // Puste pole zamiast gotowca: fabrykowany kontekst wchodził do vaultu
      // i dalej do CV jako treść, której nikt nie wpisał (reguła 1).
      context: '',
    };
    onUpdateLanguages([...languages, newLang]);
    setNewLangName('');
  };

  // Remove Language
  const handleRemoveLanguage = (id: string) => {
    onUpdateLanguages(languages.filter((l) => l.id !== id));
  };

  // Toggle License
  const handleToggleLicense = (licenseId: string) => {
    const isChecked = licenses.includes(licenseId);
    if (isChecked) {
      onUpdateLicenses(licenses.filter((l) => l !== licenseId));
    } else {
      onUpdateLicenses([...licenses, licenseId]);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Hard Skills Section */}
      <Card tone="raised" className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink">Umiejętności Twarde & Technologie</h3>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
              Rekomendowane pod ATS
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Języki programowania, frameworki, narzędzia bazodanowe, sprzęt i technologie.
          </p>
        </div>

        <div className="flex gap-2">
          <Combobox
            value={hardSkillInput}
            onChange={setHardSkillInput}
            // Już dodane chipy odpadają z listy — podpowiadanie tego, co
            // użytkownik ma na ekranie, jest samym szumem.
            suggestions={suggest?.('hardSkill', hardSkillInput, skillsMatrix.hardSkills ?? []) ?? []}
            onPick={(suggestion) => handleAddHardSkill(suggestion.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddHardSkill();
              }
            }}
            placeholder="Wpisz technologię (np. React, TypeScript, Docker, PostgreSQL) i naciśnij Enter..."
            containerClassName="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={Plus}
            onClick={() => handleAddHardSkill()}
          >
            Dodaj
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {(skillsMatrix.hardSkills || []).map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-fg shadow-xs"
            >
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => handleRemoveHardSkill(skill)}
                className="rounded-full p-0.5 hover:bg-brand-200/50 focus-visible:outline-none"
                aria-label={`Usuń ${skill}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </Card>

      {/* Soft Skills Section */}
      <Card tone="raised" className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink">Kompetencje Miękkie & Przywódcze</h3>
            <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold text-muted">
              Opcjonalne
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Umiejętności komunikacyjne, współpraca w zespole, zarządzanie czasem i rozwiązywanie problemów.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={softSkillInput}
            onChange={(e) => setSoftSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSoftSkill();
              }
            }}
            placeholder="Wpisz umiejętność miękką (np. Mentoring, Code Review, Negocjacje) i naciśnij Enter..."
            containerClassName="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={Plus}
            onClick={handleAddSoftSkill}
          >
            Dodaj
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {(skillsMatrix.softSkills || []).map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-xs"
            >
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => handleRemoveSoftSkill(skill)}
                className="rounded-full p-0.5 hover:bg-sunken focus-visible:outline-none"
                aria-label={`Usuń ${skill}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </Card>

      {/* Languages Section */}
      <Card tone="raised" className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink">Języki Obce (Skala CEFR)</h3>
            <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold text-muted">
              Opcjonalne
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Poziomy biegłości językowej według Europejskiego Systemu Opisu Kształcenia Językowego.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Input
            label="Język Obcy"
            value={newLangName}
            onChange={(e) => setNewLangName(e.target.value)}
            placeholder="np. Angielski, Niemiecki"
            containerClassName="flex-1 min-w-[180px]"
          />

          <Select
            label="Poziom Biegłości (CEFR)"
            value={newLangLevel}
            onChange={(e) => setNewLangLevel(e.target.value as LanguageProficiency['level'])}
            options={[
              { value: 'A1', label: 'A1 - Początkujący' },
              { value: 'A2', label: 'A2 - Podstawowy' },
              { value: 'B1', label: 'B1 - Średniozaawansowany' },
              { value: 'B2', label: 'B2 - Wyższy średniozaawansowany' },
              { value: 'C1', label: 'C1 - Zaawansowany' },
              { value: 'C2', label: 'C2 - Biegły' },
              { value: 'Native', label: 'Native - Język ojczysty' },
            ]}
            containerClassName="w-64"
          />

          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={Plus}
            onClick={handleAddLanguage}
            className="mb-1"
          >
            Dodaj Język
          </Button>
        </div>

        {/* Languages Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 pt-2">
          {languages.map((lang) => {
            const progress = CEFR_PROGRESS[lang.level] || 50;

            return (
              <div
                key={lang.id}
                className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-brand-600" />
                    <span className="text-xs font-bold text-ink">{lang.language}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-black text-brand-fg">
                      {lang.level}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLanguage(lang.id)}
                      className="text-muted hover:text-danger-fg p-1"
                      aria-label="Usuń język"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <ProgressBar value={progress} max={100} showLabel={false} barColor="bg-brand-600" />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Formal Licenses & Certifications Grid */}
      <Card tone="raised" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">Uprawnienia Formalne & Certyfikaty</h3>
              <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold text-muted">
                Opcjonalne
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Wybierz posiadane uprawnienia (np. SEP, UDT, prawo jazdy). Sekcja jest opcjonalna i nie blokuje ukończenia profilu.
            </p>
          </div>

          {/* Filtry */}
          <div className="flex items-center gap-1 bg-sunken/60 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setLicenseFilter('popular')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                licenseFilter === 'popular'
                  ? 'bg-surface text-brand-fg shadow-2xs font-bold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Popularne
            </button>
            <button
              type="button"
              onClick={() => setLicenseFilter('selected')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                licenseFilter === 'selected'
                  ? 'bg-surface text-brand-fg shadow-2xs font-bold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Wybrane ({licenses.length})
            </button>
            <button
              type="button"
              onClick={() => setLicenseFilter('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                licenseFilter === 'all'
                  ? 'bg-surface text-brand-fg shadow-2xs font-bold'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Wszystkie ({COMMON_LICENSES.length})
            </button>
          </div>
        </div>

        {/* Wyszukiwarka */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={licenseSearch}
            onChange={(e) => setLicenseSearch(e.target.value)}
            placeholder="Szukaj uprawnienia (np. SEP, UDT, Prawo jazdy, F-Gaz)..."
            className="w-full rounded-xl border border-line bg-surface pl-9 pr-8 py-2 text-xs text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {licenseSearch && (
            <button
              type="button"
              onClick={() => setLicenseSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-xs p-0.5 cursor-pointer"
              title="Wyczyść wyszukiwanie"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Siatka uprawnień */}
        {(() => {
          const filtered = COMMON_LICENSES.filter((lic) => {
            const matchesSearch = lic.label.toLowerCase().includes(licenseSearch.toLowerCase());
            if (!matchesSearch) return false;

            if (licenseFilter === 'selected') {
              return licenses.includes(lic.id);
            }
            if (licenseFilter === 'popular') {
              return POPULAR_LICENSE_IDS.has(lic.id) || licenses.includes(lic.id);
            }
            return true;
          });

          if (filtered.length === 0) {
            return (
              <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted space-y-2">
                <p>
                  {licenseFilter === 'selected'
                    ? 'Nie zaznaczono jeszcze żadnych uprawnień.'
                    : `Brak uprawnień pasujących do wyszukiwania „${licenseSearch}”.`}
                </p>
                {(licenseSearch || licenseFilter === 'selected') && (
                  <button
                    type="button"
                    onClick={() => {
                      setLicenseSearch('');
                      setLicenseFilter('all');
                    }}
                    className="text-brand-fg font-semibold hover:underline cursor-pointer"
                  >
                    Pokaż wszystkie uprawnienia
                  </button>
                )}
              </div>
            );
          }

          return (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((lic) => {
                const isChecked = licenses.includes(lic.id);
                const Icon = lic.icon;

                return (
                  <motion.button
                    key={lic.id}
                    type="button"
                    onClick={() => handleToggleLicense(lic.id)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150 focus-visible:outline-none cursor-pointer ${
                      isChecked
                        ? 'border-brand-300 bg-brand-50 text-brand-fg shadow-raised ring-2 ring-brand-500/20 dark:bg-brand-950/40 dark:border-brand-700'
                        : 'border-line bg-surface text-muted hover:border-brand-200/60 hover:text-ink'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                          isChecked ? 'bg-brand-600 text-on-brand' : 'bg-sunken text-muted'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="font-mono text-[9px] font-semibold">
                        {isChecked ? 'Zaznaczone' : 'Brak'}
                      </span>
                    </div>

                    <div>
                      <span className="block text-xs font-bold leading-snug">
                        {lic.label}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          );
        })()}
      </Card>

      {/* Certyfikaty Użytkownika */}
      <Card tone="raised" className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-brand-600" />
            <h3 className="text-base font-bold text-ink">Certyfikaty, Szkolenia i Uprawnienia Imienne</h3>
            <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold text-muted">
              Opcjonalne
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Dodaj zdobyte certyfikaty branżowe, szkolenia specjalistyczne i uprawnienia z datą uzyskania.
          </p>
        </div>

        {/* Formularz dodawania certyfikatu */}
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Combobox
              label="Nazwa Certyfikatu"
              icon={FileCheck}
              value={certName}
              onChange={setCertName}
              suggestions={suggest?.('certificateName', certName) ?? []}
              placeholder="np. Certyfikat F-Gaz / AWS Architect"
              required
            />

            <Combobox
              label="Instytucja / Wystawca"
              icon={ShieldCheck}
              value={certIssuer}
              onChange={setCertIssuer}
              suggestions={suggest?.('certificateIssuer', certIssuer) ?? []}
              placeholder="np. UDT / SEP / Cisco / Microsoft"
            />

            <MonthYearPicker
              label="Data Uzyskania"
              value={certDate}
              onChange={setCertDate}
              placeholder="np. 05.2023"
            />

            <Input
              label="Link weryfikacyjny (opcjonalnie)"
              icon={ExternalLink}
              value={certUrl}
              onChange={(e) => setCertUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={handleAddCertification}
              disabled={!certName.trim()}
            >
              Dodaj Certyfikat
            </Button>
          </div>
        </div>

        {/* Lista certyfikatów */}
        <div className="space-y-2 pt-1">
          {(skillsMatrix.certifications || []).length === 0 ? (
            <p className="text-xs text-muted italic text-center py-2">
              Brak dodanych certyfikatów imiennych. Wpisz certyfikat powyżej, aby wzmocnić profil pod kryteria formalne.
            </p>
          ) : (
            (skillsMatrix.certifications || []).map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Award className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs font-bold text-ink truncate">
                      {cert.name}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {cert.issuer} {cert.date ? `• ${cert.date}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {cert.url && (
                    <a
                      href={cert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-muted hover:text-brand-fg transition-colors"
                      title="Otwórz link do certyfikatu"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveCertification(cert.id)}
                    className="p-1 text-muted hover:text-danger-fg transition-colors rounded-md cursor-pointer"
                    title="Usuń certyfikat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
