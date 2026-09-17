import React, { useState } from 'react';
import { FileText, FolderOpen, SlidersHorizontal } from 'lucide-react';
import { MasterVault, ProfilerState } from '../../types';
import { Tabs } from '../../components/ui/Tabs';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { measureVaultCompleteness } from '../../lib/vaultCompleteness';

/**
 * Sekcja PROFIL — wszystko, co składa się na „kim jestem".
 *
 * Wcześniej te trzy ekrany były trzema osobnymi pozycjami menu: „Master Vault",
 * „Wczytaj CV" i „Filtry i Priorytety". Każda z nich brzmiała jak inne
 * narzędzie, choć wszystkie trzy edytują ten sam obiekt — import CV to sposób
 * na wypełnienie profilu, a nie funkcja obok niego.
 *
 * Kroki, a nie zakładki równorzędne: kolejność jest podpowiedzią, od czego
 * zacząć. Pasek kompletności nad nimi mówi, ile jeszcze zostało, i jest tym
 * samym pomiarem, którym posługuje się silnik „następnego kroku" — użytkownik
 * widzi więc dokładnie tę liczbę, na podstawie której dostaje rekomendacje.
 */

type ProfileStep = 'dane' | 'import' | 'preferencje';

export interface ProfileSectionProps {
  vault: MasterVault;
  onChangeVault: (vault: MasterVault) => void;
  /** Otrzymuje kompletny vault po scaleniu importu z diffem — podstawia 1:1. */
  onApplyVault: (vault: MasterVault) => void;
  renderEditor: (props: {
    vault: MasterVault;
    onChange: (vault: MasterVault) => void;
    onOpenCvParser?: () => void;
  }) => React.ReactNode;
  renderParser: (props: {
    currentVault: MasterVault;
    onApplyVault: (vault: MasterVault) => void;
  }) => React.ReactNode;
  renderProfiler: (props: {
    profiler: ProfilerState;
    onChange: (profiler: ProfilerState) => void;
  }) => React.ReactNode;
}

const STEPS = [
  { id: 'dane' as const, label: 'Dane i doświadczenie', icon: FolderOpen },
  { id: 'import' as const, label: 'Importuj CV', icon: FileText },
  { id: 'preferencje' as const, label: 'Filtry i priorytety', icon: SlidersHorizontal },
];

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  vault,
  onChangeVault,
  onApplyVault,
  renderEditor,
  renderParser,
  renderProfiler,
}) => {
  const [step, setStep] = useState<ProfileStep>('dane');
  const completeness = measureVaultCompleteness(vault);

  const handleApplyAndSwitch = (imported: MasterVault) => {
    onApplyVault(imported);
    setStep('dane');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-elevated p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-black tracking-tight text-ink m-0">Twój profil</h2>
          <span className="font-mono text-xs font-bold text-brand-fg">
            {completeness.percent}% uzupełnione
          </span>
        </div>

        <ProgressBar value={completeness.percent} className="mt-3 h-2" />

        {completeness.weakest ? (
          <p className="mt-2 text-xs text-muted">
            Następne w kolejce: <strong className="text-ink">{completeness.weakest.label}</strong>{' '}
            — {completeness.weakest.blocks}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Profil kompletny. Każda sekcja ma treść, z której korzystają generator i symulator ATS.
          </p>
        )}
      </div>

      <Tabs items={STEPS} active={step} onChange={setStep} variant="underline" />

      {step === 'dane' &&
        renderEditor({
          vault,
          onChange: onChangeVault,
          onOpenCvParser: () => setStep('import'),
        })}

      {step === 'import' && renderParser({ currentVault: vault, onApplyVault: handleApplyAndSwitch })}

      {step === 'preferencje' &&
        renderProfiler({
          profiler: vault.profiler,
          onChange: (profiler) => onChangeVault({ ...vault, profiler }),
        })}
    </div>
  );
};
