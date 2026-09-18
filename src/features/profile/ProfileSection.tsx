import React, { useState } from 'react';
import { FileText, FolderOpen, SlidersHorizontal } from 'lucide-react';
import { MasterVault, ProfilerState } from '../../types';
import { Tabs } from '../../components/ui/Tabs';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { measureVaultCompleteness, VAULT_SECTIONS } from '../../lib/vaultCompleteness';

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
  const missingLabels = completeness.missing
    .map((id) => VAULT_SECTIONS.find((s) => s.id === id)?.label)
    .filter(Boolean);

  const handleApplyAndSwitch = (imported: MasterVault) => {
    onApplyVault(imported);
    setStep('dane');
  };

  return (
    <div className="space-y-5">
      {step === 'import' ? (
        <div className="mx-auto w-full max-w-[820px] px-4 sm:px-6">
          <div className="rounded-xl border border-line/60 bg-surface/60 px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="text-ink font-medium">Postęp profilu:</span>
              <span className="font-mono font-bold text-brand-fg">{completeness.percent}%</span>
              <span className="hidden sm:inline text-subtle">• Zaimportowane dane uzupełnią brakujące sekcje</span>
            </div>
            <div className="w-24 shrink-0">
              <ProgressBar value={completeness.percent} className="h-1.5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-elevated p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-black tracking-tight text-ink m-0">Kompletność danych profilu</h2>
            <span className="font-mono text-xs font-bold text-brand-fg">
              {completeness.percent}% danych profilu dodane
            </span>
          </div>

          <ProgressBar value={completeness.percent} className="mt-3 h-2" />

          {completeness.weakest ? (
            <div className="mt-2.5 space-y-1">
              <p className="text-xs text-muted">
                Do 100% wzmocnienia dokumentu brakuje:{' '}
                <strong className="text-ink font-semibold">
                  {missingLabels.join(', ')}
                </strong>
              </p>
              <p className="text-[11px] text-subtle">
                Następna kluczowa sekcja: <strong className="text-ink">{completeness.weakest.label}</strong>{' '}
                — {completeness.weakest.blocks}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Profil kompletny (100% danych profilu dodane). Każda sekcja ma treść, z której korzystają generator i symulator ATS.
            </p>
          )}
        </div>
      )}

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
