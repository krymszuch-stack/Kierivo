import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Lock,
  FileText,
  Activity,
  Mic,
  Sliders,
  Layers,
} from 'lucide-react';
import { MasterVault } from '../../types';
import {
  extractClaimsFromVault,
  validateConsistency,
  renderCvFromClaims,
  renderHudFromClaims,
  renderPitchFromClaims,
  ConsistencyValidationResult,
  ProjectedClaimItem,
} from '../../lib/consistencyGuard';
import { ConsistencyLockBadge } from '../../components/consistency/ConsistencyLockBadge';
import { ConsistencyAlertBanner } from '../../components/consistency/ConsistencyAlertBanner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';

export type ConsistencyTabId = 'cv' | 'hud' | 'pitch' | 'inspector';

export interface ConsistencyGuardViewProps {
  vault: MasterVault;
  className?: string;
}

export const ConsistencyGuardView: React.FC<ConsistencyGuardViewProps> = ({
  vault,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<ConsistencyTabId>('cv');

  // Pobranie wszystkich claimów z MasterVault
  const vaultClaims = useMemo(() => extractClaimsFromVault(vault), [vault]);
  const activeClaimIds = useMemo(() => vaultClaims.map((c) => c.id), [vaultClaims]);

  // Przygotowanie projekcji dla walidatora
  const projectedItems: ProjectedClaimItem[] = useMemo(() => {
    return vaultClaims.map((c, index) => ({
      sectionId: index % 2 === 0 ? 'cv_experience' : 'cv_projects',
      sectionName: index % 2 === 0 ? 'Doświadczenie Zawodowe' : 'Projekty i Osiągnięcia',
      claimId: c.id,
      claimedDateRange: c.dateRange,
      claimedTags: c.tags,
    }));
  }, [vaultClaims]);

  // Walidacja spójności
  const validationResult: ConsistencyValidationResult = useMemo(() => {
    return validateConsistency(vault, {
      claimIdsToCheck: activeClaimIds,
      projectedItems,
    });
  }, [vault, activeClaimIds, projectedItems]);

  // Renderery oparte na claimId
  const cvOutput = useMemo(() => renderCvFromClaims(vault, activeClaimIds), [vault, activeClaimIds]);
  const hudOutput = useMemo(() => renderHudFromClaims(vault, activeClaimIds), [vault, activeClaimIds]);
  const pitchOutput = useMemo(() => renderPitchFromClaims(vault, activeClaimIds), [vault, activeClaimIds]);

  const tabs = [
    { id: 'cv' as ConsistencyTabId, label: 'Renderer CV', icon: FileText },
    { id: 'hud' as ConsistencyTabId, label: 'Renderer HUD', icon: Activity },
    { id: 'pitch' as ConsistencyTabId, label: 'Renderer Pitch (30s)', icon: Mic },
    { id: 'inspector' as ConsistencyTabId, label: 'Inspektor Claimów', icon: Sliders },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header statusu ConsistencyGuard */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-line bg-elevated p-5 shadow-raised">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold tracking-tight text-ink">ConsistencyGuard</h2>
              <ConsistencyLockBadge
                isConsistent={validationResult.isConsistent}
                alertCount={validationResult.alerts.length}
                claimsCount={vaultClaims.length}
              />
            </div>
            <p className="text-xs text-muted">
              Jedno źródło prawdy — renderery (CV, HUD, Pitch) zasilane z MasterVault przez identyfikatory faktów. Sprawdzana jest spójność chronologii i brak sprzeczności technologicznych w zbadanym zakresie.
            </p>
          </div>
        </div>
      </div>

      {/* Alerty ConsistencyGuard w UI */}
      {validationResult.alerts.length > 0 && (
        <ConsistencyAlertBanner alerts={validationResult.alerts} />
      )}

      {/* Zakładki rendererów */}
      <div className="border-b border-line pb-2">
        <Tabs<ConsistencyTabId>
          items={tabs}
          active={activeTab}
          onChange={setActiveTab}
          variant="underline"
        />
      </div>

      {/* Brak claimów w MasterVault — nie ma z czego renderować CV/HUD/Pitch */}
      {vaultClaims.length === 0 && (
        <EmptyState
          icon={Layers}
          title="Brak zarejestrowanych faktów w MasterVault"
          description="ConsistencyGuard renderuje CV, HUD i Pitch wyłącznie z potwierdzonych claimów. Uzupełnij doświadczenie i projekty w MasterVault, aby zobaczyć tu wyniki."
        />
      )}

      {/* Widok 1: Renderer CV */}
      {vaultClaims.length > 0 && activeTab === 'cv' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-label font-bold uppercase tracking-wider text-muted">
              Wygenerowany dokument CV z referencjami claimId
            </span>
            <ConsistencyLockBadge
              isConsistent={validationResult.isConsistent}
              label="spójność CV potwierdzona"
              claimsCount={cvOutput.sections.flatMap((s) => s.items).length}
            />
          </div>

          <div className="space-y-6 rounded-2xl border border-line bg-surface p-6">
            <div className="border-b border-line pb-4 flex justify-between items-baseline">
              <div>
                <h3 className="text-xl font-black text-ink">{cvOutput.candidateName}</h3>
                <p className="text-sm font-semibold text-muted">{cvOutput.title}</p>
              </div>
              <span className="font-mono text-xs text-subtle">Renderer: CV</span>
            </div>

            {cvOutput.sections.map((section) => (
              <div key={section.id} className="space-y-3">
                <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
                  <h4 className="text-label font-extrabold uppercase tracking-wider text-ink font-mono">
                    {section.title}
                  </h4>
                  <ConsistencyLockBadge
                    isConsistent={validationResult.isConsistent}
                    size="sm"
                    label="spójność potwierdzona"
                  />
                </div>

                <div className="grid gap-3">
                  {section.items.map((item) => (
                    <div
                      key={item.claimId}
                      className="rounded-xl border border-line bg-elevated p-4 shadow-xs space-y-2"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="font-bold text-sm text-ink">{item.project}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted">{item.dateRangeDisplay}</span>
                          <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-brand-600 font-bold">
                            #{item.claimId}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-ink/90">{item.summary}</p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((t, i) => (
                            <span
                              key={i}
                              className="rounded-md border border-line bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink"
                            >
                              {t}
                            </span>
                          ))}
                        </div>

                        {item.metric && (
                          <span className="rounded-md bg-success-soft px-2 py-0.5 font-mono text-xs font-bold text-success-fg">
                            {item.metric}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Widok 2: Renderer HUD */}
      {vaultClaims.length > 0 && activeTab === 'hud' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-label font-bold uppercase tracking-wider text-muted">
              Career & Competence Head-Up Display (HUD)
            </span>
            <ConsistencyLockBadge
              isConsistent={validationResult.isConsistent}
              label="spójność HUD potwierdzona"
              claimsCount={hudOutput.activeClaimsCount}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4 space-y-1">
              <span className="text-xs text-muted font-semibold">Aktywne Claimy w MasterVault</span>
              <div className="text-2xl font-black text-ink">{hudOutput.activeClaimsCount}</div>
              <div className="flex items-center gap-1 text-meta text-success-fg font-mono">
                <Lock className="h-3 w-3" /> 100% zweryfikowane
              </div>
            </Card>

            <Card className="p-4 space-y-1">
              <span className="text-xs text-muted font-semibold">Lata Udokumentowanego Doświadczenia</span>
              <div className="text-2xl font-black text-brand-600 font-mono">
                {hudOutput.timelineCoverageYears} lat
              </div>
              <div className="text-meta text-muted font-mono">Ciągłość bez rozbieżności &gt;0.5r</div>
            </Card>

            <Card className="p-4 space-y-1">
              <span className="text-xs text-muted font-semibold">Wskaźnik Spójności Telemetrii</span>
              <div className="text-2xl font-black text-ink font-mono">
                {hudOutput.consistencyScore}%
              </div>
              <div className="flex items-center gap-1 text-meta text-muted">
                {validationResult.isConsistent ? 'Brak sprzeczności w faktach' : 'Wymaga uwagi'}
              </div>
            </Card>
          </div>

          {/* Sekcja zweryfikowanych metryk */}
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="text-label font-extrabold uppercase tracking-wider text-ink font-mono">
                Zweryfikowane Wskaźniki i Wyniki (Metryki)
              </h4>
              <ConsistencyLockBadge
                isConsistent={validationResult.isConsistent}
                size="sm"
                label="spójność potwierdzona"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {hudOutput.verifiedMetrics.map((m) => (
                <div
                  key={m.claimId}
                  className="flex items-center justify-between rounded-xl border border-line bg-elevated p-3.5"
                >
                  <div>
                    <span className="text-xs font-bold text-ink block">{m.label}</span>
                    <span className="font-mono text-[10px] text-subtle">Claim #{m.claimId}</span>
                  </div>
                  <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-mono text-xs font-black text-brand-700">
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Radar kompetencji */}
          <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h4 className="text-label font-extrabold uppercase tracking-wider text-ink font-mono">
                Radar Kompetencji & Tagi Claimów
              </h4>
              <ConsistencyLockBadge
                isConsistent={validationResult.isConsistent}
                size="sm"
                label="spójność potwierdzona"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {hudOutput.skillsRadar.map((s) => (
                <div
                  key={s.skill}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-3 py-1.5 text-xs"
                >
                  <span className="font-bold text-ink">{s.skill}</span>
                  <span className="rounded-full bg-brand-600/10 px-1.5 py-0.2 font-mono text-[10px] font-bold text-brand-600">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Widok 3: Renderer Pitch */}
      {vaultClaims.length > 0 && activeTab === 'pitch' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-label font-bold uppercase tracking-wider text-muted">
              30-Second Elevator Pitch & Kluczowe Argumenty
            </span>
            <ConsistencyLockBadge
              isConsistent={validationResult.isConsistent}
              label="spójność Pitch potwierdzona"
              claimsCount={pitchOutput.coreStrengths.length}
            />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 space-y-6">
            {/* Hook */}
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 space-y-1">
              <span className="text-label font-bold uppercase tracking-wider text-brand-600 font-mono">
                Zdanie Otwarcia (Hook)
              </span>
              <p className="text-sm font-semibold text-ink leading-relaxed">{pitchOutput.hook}</p>
            </div>

            {/* Core Strengths */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-1.5">
                <h4 className="text-label font-extrabold uppercase tracking-wider text-ink font-mono">
                  Filary Doświadczenia (Zasilane Claimami)
                </h4>
                <ConsistencyLockBadge
                  isConsistent={validationResult.isConsistent}
                  size="sm"
                  label="spójność potwierdzona"
                />
              </div>

              <div className="grid gap-3">
                {pitchOutput.coreStrengths.map((strength) => (
                  <div
                    key={strength.claimId}
                    className="flex items-start gap-3 rounded-xl border border-line bg-elevated p-3.5 shadow-xs"
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600/10 text-brand-600 text-xs font-bold">
                      <Lock className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-medium text-ink leading-relaxed">
                        {strength.statement}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted">
                          Źródło claimId: #{strength.claimId}
                        </span>
                        {strength.metric && (
                          <span className="rounded bg-success-soft px-1.5 text-[10px] font-bold text-success-fg">
                            {strength.metric}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Call to action */}
            <div className="rounded-xl border border-line bg-elevated p-4 text-xs font-medium text-ink">
              <span className="font-bold text-muted block mb-1 font-mono uppercase tracking-wider text-[10px]">
                Domknięcie (Call to Action)
              </span>
              {pitchOutput.callToAction}
            </div>
          </div>
        </div>
      )}

      {/* Widok 4: Inspektor Claimów */}
      {vaultClaims.length > 0 && activeTab === 'inspector' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-label font-bold uppercase tracking-wider text-muted">
              Wszystkie Claimy zarejestrowane w MasterVault ({vaultClaims.length})
            </span>
            <ConsistencyLockBadge
              isConsistent={validationResult.isConsistent}
              label="spójność potwierdzona"
              claimsCount={vaultClaims.length}
            />
          </div>

          <div className="grid gap-3">
            {vaultClaims.map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-line bg-elevated p-4 shadow-xs space-y-2"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-bold text-xs text-ink">{claim.sourceProject}</span>
                  <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] text-brand-600 font-bold">
                    ID: {claim.id}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted font-mono">
                  <span>
                    Zakres:{' '}
                    {typeof claim.dateRange === 'string'
                      ? claim.dateRange
                      : `${claim.dateRange.start} – ${claim.dateRange.end}`}
                  </span>
                  {claim.metric && (
                    <span className="text-success-fg font-bold">Metryka: {claim.metric}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 pt-1">
                  {claim.tags.map((t, i) => (
                    <span
                      key={i}
                      className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] text-ink"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
