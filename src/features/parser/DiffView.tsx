import React, { useState } from 'react';
import {
  User,
  Briefcase,
  GraduationCap,
  Star,
  Check,
  ArrowRight,
  Plus,
  RefreshCw,
  Minus,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { MasterVault } from '../../types';
import { ParsedCVResult } from '../../lib/cvUniversalParser';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { EmptyState } from '../../components/ui/EmptyState';

export type SectionStrategy = 'merge' | 'replace' | 'keep';

export interface MergeStrategies {
  personal: SectionStrategy;
  skills: SectionStrategy;
  experience: SectionStrategy;
  education: SectionStrategy;
}

export interface DiffViewProps {
  currentVault: MasterVault;
  parsedData: ParsedCVResult;
  onApplyMerge: (strategies: MergeStrategies) => void;
  onCancel: () => void;
  className?: string;
}

export const DiffView: React.FC<DiffViewProps> = ({
  currentVault,
  parsedData,
  onApplyMerge,
  onCancel,
  className = '',
}) => {
  const [personalStrategy, setPersonalStrategy] = useState<SectionStrategy>('replace');
  const [skillsStrategy, setSkillsStrategy] = useState<SectionStrategy>('merge');
  const [expStrategy, setExpStrategy] = useState<SectionStrategy>('merge');
  const [eduStrategy, setEduStrategy] = useState<SectionStrategy>('merge');

  // Compute skill differences
  const existingHardSkills = new Set(
    (currentVault.skillsMatrix?.hardSkills || []).map((s) => s.toLowerCase())
  );
  const newHardSkills = (parsedData.hardSkills || []).filter(
    (s) => !existingHardSkills.has(s.toLowerCase())
  );
  const existingMatches = (parsedData.hardSkills || []).filter((s) =>
    existingHardSkills.has(s.toLowerCase())
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Diff Overview Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-success/30 bg-success-soft p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-success-fg">Nowe Elementy</span>
            <Plus className="h-4 w-4 text-success-fg" />
          </div>
          <p className="mt-1 font-mono text-2xl font-black text-success-fg">
            +{newHardSkills.length + (parsedData.history?.length || 0) + (parsedData.education?.length || 0)}
          </p>
          <p className="text-meta text-success-fg/80">Wykryte w dokumencie</p>
        </div>

        <div className="rounded-2xl border border-line bg-elevated p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">Stanowiska w CV</span>
            <Briefcase className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-1 font-mono text-2xl font-black text-ink">
            {parsedData.history?.length || 0}
          </p>
          <p className="text-meta text-muted">Zidentyfikowane pozycje</p>
        </div>

        <div className="rounded-2xl border border-line bg-elevated p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink">Format Źródłowy</span>
            <Sparkles className="h-4 w-4 text-violet" />
          </div>
          <p className="mt-1 font-mono text-xl font-black text-ink truncate">
            {parsedData.detectedFormat || 'Plik tekstowy'}
          </p>
          <p className="text-meta text-muted">Silnik Universal Parser</p>
        </div>
      </div>

      {/* Cyrillic Script Alert Banner */}
      {parsedData.hasCyrillicScript && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-bold block text-sm">Wykryto alfabet cyrylicki (cyrylicę)</span>
            Parser CV zoptymalizowany jest pod dokumenty w alfabecie łacińskim (język polski i angielski).
            Jeżeli niektóre sekcje nie zostały poprawnie odczytane, wprowadź dane ręcznie lub wklej wersję przetłumaczoną na język polski / angielski.
          </div>
        </div>
      )}

      {/* Section 1: Personal Info Diff */}
      <Card tone="raised" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-brand-600" />
            <h4 className="text-label font-bold uppercase tracking-wider text-ink">
              Dane Osobowe & Kontakt
            </h4>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPersonalStrategy('replace')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                personalStrategy === 'replace'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Zastąp
            </button>
            <button
              type="button"
              onClick={() => setPersonalStrategy('keep')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                personalStrategy === 'keep'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Zachowaj obecne
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          {/* Current Vault */}
          <div className="rounded-xl border border-line bg-sunken p-3.5 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase text-muted block mb-1">
              Obecnie w Vault (Ścieżka A)
            </span>
            <p className="font-bold text-ink">{currentVault.personalInfo?.fullName || '(Brak)'}</p>
            <p className="text-muted">{currentVault.personalInfo?.title || '(Brak tytułu)'}</p>
            <p className="text-muted">{currentVault.personalInfo?.email || '(Brak e-maila)'}</p>
            <p className="text-muted">{currentVault.personalInfo?.location || '(Brak lokalizacji)'}</p>
          </div>

          {/* Parsed CV */}
          <div className="rounded-xl border border-success/30 bg-success-soft/50 p-3.5 space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase text-success-fg block mb-1">
              Nowo Sparsowane z CV (Ścieżka B)
            </span>
            <p className="font-bold text-ink">{parsedData.personalInfo?.fullName || '(Nie wykryto)'}</p>
            <p className="text-ink">{parsedData.personalInfo?.title || '(Nie wykryto)'}</p>
            <p className="text-ink">{parsedData.personalInfo?.email || '(Nie wykryto)'}</p>
            <p className="text-ink">{parsedData.personalInfo?.location || '(Nie wykryto)'}</p>
          </div>
        </div>
      </Card>

      {/* Section 2: Skills Diff */}
      <Card tone="raised" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-brand-600" />
            <h4 className="text-label font-bold uppercase tracking-wider text-ink">
              Umiejętności Twarde & Technologie
            </h4>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSkillsStrategy('merge')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                skillsStrategy === 'merge'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Scal (+ nowe)
            </button>
            <button
              type="button"
              onClick={() => setSkillsStrategy('replace')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                skillsStrategy === 'replace'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Zastąp całą listę
            </button>
            <button
              type="button"
              onClick={() => setSkillsStrategy('keep')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                skillsStrategy === 'keep'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Ignoruj
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {newHardSkills.length > 0 && (
            <div>
              <span className="text-meta font-bold text-success-fg block mb-1.5">
                Nowe technologie do dodania (+{newHardSkills.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {newHardSkills.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-lg border border-success/30 bg-success-soft px-2 py-0.5 font-mono text-xs font-bold text-success-fg"
                  >
                    <Plus className="h-3 w-3" />
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {existingMatches.length > 0 && (
            <div>
              <span className="text-meta font-semibold text-muted block mb-1.5">
                Umiejętności już obecne w profilu ({existingMatches.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {existingMatches.map((s, idx) => (
                  <Chip key={idx} variant="neutral" className="text-xs">
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Section 3: Work Experience Diff */}
      <Card tone="raised" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-600" />
            <h4 className="text-label font-bold uppercase tracking-wider text-ink">
              Doświadczenie Zawodowe ({parsedData.history?.length || 0} pozycji)
            </h4>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpStrategy('merge')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                expStrategy === 'merge'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Dołącz do historii
            </button>
            <button
              type="button"
              onClick={() => setExpStrategy('replace')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                expStrategy === 'replace'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Zastąp historię
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {(parsedData.history || []).map((exp, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 text-xs"
            >
              <div>
                <p className="font-bold text-ink">{exp.role} w <span className="text-brand-fg">{exp.company}</span></p>
                <p className="font-mono text-meta text-muted">{exp.startDate} – {exp.isCurrent ? 'Obecnie' : exp.endDate || 'Brak daty'}</p>
              </div>
              <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-fg">
                Sparsowane
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Section 4: Education Diff */}
      <Card tone="raised" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-brand-600" />
            <h4 className="text-label font-bold uppercase tracking-wider text-ink">
              Wykształcenie ({parsedData.education?.length || 0} pozycji)
            </h4>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEduStrategy('merge')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                eduStrategy === 'merge'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Dołącz
            </button>
            <button
              type="button"
              onClick={() => setEduStrategy('replace')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                eduStrategy === 'replace'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Zastąp
            </button>
            <button
              type="button"
              onClick={() => setEduStrategy('keep')}
              className={`rounded-lg px-2.5 py-1 cursor-pointer text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                eduStrategy === 'keep'
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              Zachowaj obecne
            </button>
          </div>
        </div>

        {(parsedData.education || []).length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Nie wykryto wykształcenia w dokumencie"
            description="Parser nie znalazł sekcji wykształcenia w tym pliku. Możesz uzupełnić ją ręcznie w Master Vault."
          />
        ) : (
          <div className="space-y-2">
            {(parsedData.education || []).map((edu, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 text-xs"
              >
                <div>
                  <p className="font-bold text-ink">
                    {edu.degree ? (edu.fieldOfStudy ? `${edu.degree} - ${edu.fieldOfStudy}` : edu.degree) : (edu.fieldOfStudy || 'Edukacja')}
                    {edu.institution && <span className="text-brand-fg"> — {edu.institution}</span>}
                  </p>
                  <p className="font-mono text-[11px] text-muted">
                    {edu.startDate || '—'} – {edu.endDate || '—'}
                  </p>
                </div>
                <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-fg">
                  Sparsowane
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Global Actions Footer */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-line pt-4">
        <Button variant="ghost" size="md" onClick={onCancel}>
          Anuluj i wczytaj inny plik
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            icon={Check}
            onClick={() =>
              onApplyMerge({
                personal: personalStrategy,
                skills: skillsStrategy,
                experience: expStrategy,
                education: eduStrategy,
              })
            }
          >
            Zastosuj i Scal do Master Vault
          </Button>
        </div>
      </div>
    </div>
  );
};
