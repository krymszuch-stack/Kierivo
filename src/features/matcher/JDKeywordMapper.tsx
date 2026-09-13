import React, { useState, useMemo } from 'react';
import {
  FileCode,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingUp,
  Search,
  PlusCircle,
  Copy,
  Check,
  Zap,
  Tag,
  Briefcase,
  FolderGit2,
  ShieldCheck,
} from 'lucide-react';
import { MasterVault, TailoredResume } from '../../types';
import {
  mapJdKeywords,
  ExtractedKeyword,
  KeywordCategory,
  KeywordMatchStatus,
  KeywordSuggestion,
} from '../../lib/jdKeywordMapper';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Textarea } from '../../components/ui/Field';
import { SkillBridgeMatrixModal } from '../../components/bridge/SkillBridgeMatrixModal';

export interface JDKeywordMapperProps {
  initialJdText?: string;
  vault: MasterVault;
  tailoredResume?: TailoredResume | null;
  onApplySuggestion?: (suggestion: KeywordSuggestion) => void;
  className?: string;
}

type FilterCategory = 'ALL' | KeywordCategory;
type FilterStatus = 'ALL' | KeywordMatchStatus;

export const JDKeywordMapper: React.FC<JDKeywordMapperProps> = ({
  initialJdText = '',
  vault,
  tailoredResume,
  onApplySuggestion,
  className = '',
}) => {
  const [jdText, setJdText] = useState(initialJdText);
  const [isEditingJd, setIsEditingJd] = useState(!initialJdText);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('ALL');
  const [activeStatus, setActiveStatus] = useState<FilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bridgeSkillModal, setBridgeSkillModal] = useState<string | null>(null);

  // Analiza słów kluczowych
  const mappingResult = useMemo(() => {
    return mapJdKeywords(jdText, vault, tailoredResume);
  }, [jdText, vault, tailoredResume]);

  const { keywords, overallCvScore, overallVaultScore, categoryCoverage, suggestions, counts } =
    mappingResult;

  // Filtrowanie listy słów kluczowych
  const filteredKeywords = useMemo(() => {
    return (Array.isArray(keywords) ? keywords : []).filter((kw) => {
      if (!kw) return false;
      if (activeCategory !== 'ALL' && kw.category !== activeCategory) return false;
      if (activeStatus !== 'ALL' && kw.status !== activeStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (kw.term || '').toLowerCase().includes(query);
      }
      return true;
    });
  }, [keywords, activeCategory, activeStatus, searchQuery]);

  const handleCopySuggestion = (suggestion: KeywordSuggestion) => {
    navigator.clipboard.writeText(suggestion.message);
    setCopiedId(suggestion.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusBadges: Record<KeywordMatchStatus, { label: string; variant: 'success' | 'warning' | 'danger'; icon: any }> = {
    MATCHED_IN_CV: { label: 'W CV', variant: 'success', icon: CheckCircle2 },
    IN_VAULT_NOT_IN_CV: { label: 'W Vault (do dodania)', variant: 'warning', icon: Layers },
    MISSING_IN_VAULT: { label: 'Brak w profilu', variant: 'danger', icon: AlertTriangle },
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header & JD Input Switcher */}
      <Card tone="raised" className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink tracking-tight">
                Mapper słów kluczowych
              </h3>
              <p className="text-xs text-muted">
                Analiza pokrycia słów kluczowych ogłoszenia względem Master Vaultu i aktualnego CV.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditingJd(!isEditingJd)}
          >
            {isEditingJd ? 'Zwiń treść ogłoszenia' : 'Edytuj / Wklej inne ogłoszenie'}
          </Button>
        </div>

        {/* Pole edycji treści ogłoszenia */}
        {isEditingJd && (
          <div className="space-y-2 pt-2 border-t border-line">
            <Textarea
              label="Treść ogłoszenia o pracę (Job Description)"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Wklej tutaj treść ogłoszenia o pracę..."
              rows={5}
              className="font-mono text-xs"
            />
          </div>
        )}

        {/* Brak treści ogłoszenia — nie ma czego analizować */}
        {!jdText.trim() && (
          <EmptyState
            icon={Tag}
            title="Brak treści ogłoszenia do analizy"
            description="Wklej treść ogłoszenia o pracę powyżej, aby zobaczyć pokrycie słów kluczowych w Twoim CV i MasterVault."
            className="mt-2"
          />
        )}

        {/* GŁÓWNY HEATMAP BAR & WYNIKI DOPASOWANIA */}
        {keywords.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">Pokrycie w bieżącym CV:</span>
                <span className="text-lg font-black text-brand-600 font-mono">
                  {overallCvScore}%
                </span>
                <span className="text-muted font-mono text-meta">
                  ({counts.matchedInCv} / {counts.total} słów)
                </span>
              </div>

              {overallVaultScore > overallCvScore && (
                <div className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 font-mono text-xs font-bold text-brand-700">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Potencjał z MasterVault (szacunek): {overallVaultScore}% (+{overallVaultScore - overallCvScore}%)</span>
                </div>
              )}
            </div>

            {/* Wizualny segmentowy Heatmap Bar */}
            <div className="space-y-1.5">
              <div
                className="flex h-4 w-full overflow-hidden rounded-full border border-line bg-sunken p-0.5 shadow-inner"
                role="progressbar"
                aria-valuenow={overallCvScore}
                aria-valuemin={0}
                aria-valuemax={100}
                title={`W CV: ${counts.matchedInCv}, W Vault: ${counts.inVaultNotCv}, Brak: ${counts.missingInVault}`}
              >
                {/* Segment 1: W CV (Zielony / Success) */}
                {counts.matchedInCv > 0 && (
                  <div
                    style={{ width: `${(counts.matchedInCv / counts.total) * 100}%` }}
                    className="h-full rounded-l-full bg-success transition-[width] duration-[var(--duration-state)]"
                    title={`Wyeksponowane w CV: ${counts.matchedInCv} słów (${Math.round((counts.matchedInCv / counts.total) * 100)}%)`}
                  />
                )}

                {/* Segment 2: Dostępne w MasterVault (Bursztynowy / Fioletowy Brand) */}
                {counts.inVaultNotCv > 0 && (
                  <div
                    style={{ width: `${(counts.inVaultNotCv / counts.total) * 100}%` }}
                    className={`h-full bg-brand-500 transition-[width] duration-[var(--duration-state)] ${
                      counts.matchedInCv === 0 ? 'rounded-l-full' : ''
                    } ${counts.missingInVault === 0 ? 'rounded-r-full' : ''}`}
                    title={`Dostępne w MasterVault (do dodania do CV): ${counts.inVaultNotCv} słów (${Math.round((counts.inVaultNotCv / counts.total) * 100)}%)`}
                  />
                )}

                {/* Segment 3: Brakujące w profilu (Subtelny szary / czerwonawy) */}
                {counts.missingInVault > 0 && (
                  <div
                    style={{ width: `${(counts.missingInVault / counts.total) * 100}%` }}
                    className={`h-full bg-line-strong transition-[width] duration-[var(--duration-state)] ${
                      counts.matchedInCv === 0 && counts.inVaultNotCv === 0 ? 'rounded-l-full' : ''
                    } rounded-r-full`}
                    title={`Brak w profilu MasterVault: ${counts.missingInVault} słów (${Math.round((counts.missingInVault / counts.total) * 100)}%)`}
                  />
                )}
              </div>

              {/* Legenda Heatmapy */}
              <div className="flex flex-wrap items-center justify-between text-meta text-muted font-mono pt-1">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-success" />
                    <span>Wyeksponowane w CV ({counts.matchedInCv})</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                    <span>W Vault, poza CV ({counts.inVaultNotCv})</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                    <span>Brak w profilu ({counts.missingInVault})</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Mini-Heatmapy per kategoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3">
              {Object.values(categoryCoverage).map((cat) => {
                if (cat.total === 0) return null;
                return (
                  <div key={cat.category} className="rounded-xl border border-line bg-surface p-3 space-y-1.5">
                    <div className="flex items-baseline justify-between text-meta">
                      <span className="font-bold text-ink truncate">{cat.label}</span>
                      <span className="font-mono text-muted">{cat.matchedInCv}/{cat.total}</span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-sunken flex">
                      <div
                        style={{ width: `${cat.cvPercentage}%` }}
                        className="h-full bg-success"
                      />
                      <div
                        style={{ width: `${cat.vaultPercentage - cat.cvPercentage}%` }}
                        className="h-full bg-brand-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* INTELIGENTNE SUGESTIE (Smart Recommendations) */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-label font-extrabold uppercase tracking-wider text-muted font-mono flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-brand-600" />
              <span>Sugestie Optymalizacji ({suggestions.length})</span>
            </h4>
          </div>

          <div className="grid gap-2.5">
            {suggestions.map((sug) => {
              const isCopied = copiedId === sug.id;

              return (
                <div
                  key={sug.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-brand-500/20 bg-elevated p-3.5 shadow-xs hover:border-brand-500/40 transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      {sug.targetType === 'project' && <FolderGit2 className="h-3.5 w-3.5" />}
                      {sug.targetType === 'experience' && <Briefcase className="h-3.5 w-3.5" />}
                      {sug.targetType === 'skills' && <Zap className="h-3.5 w-3.5" />}
                      {sug.targetType === 'summary' && <FileCode className="h-3.5 w-3.5" />}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-semibold text-ink leading-snug">{sug.message}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted font-mono">
                        <span className="font-bold text-brand-600">wpływ wg heurystyki: +{sug.impactScore}%</span>
                        {sug.targetName && <span>Dotyczy: {sug.targetName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={isCopied ? Check : Copy}
                      onClick={() => handleCopySuggestion(sug)}
                    >
                      {isCopied ? 'Skopiowano' : 'Kopiuj'}
                    </Button>

                    {onApplySuggestion && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={PlusCircle}
                        onClick={() => onApplySuggestion(sug)}
                      >
                        Zastosuj
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MATRYCA / CHMURA SŁÓW KLUCZOWYCH */}
      {keywords.length > 0 && (
        <Card tone="flat" className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
            <h4 className="text-label font-extrabold uppercase tracking-wider text-ink font-mono">
              Wykryte Słowa Kluczowe ({filteredKeywords.length})
            </h4>

            {/* Szukajka */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
              <input
                type="text"
                placeholder="Filtruj słowa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-xs font-mono text-ink placeholder:text-muted focus:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
              />
            </div>
          </div>

          {/* Filtry statusów i kategorii */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveStatus('ALL')}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                activeStatus === 'ALL'
                  ? 'bg-ink text-surface'
                  : 'bg-sunken text-muted hover:text-ink'
              }`}
            >
              Wszystkie ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatus('MATCHED_IN_CV')}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                activeStatus === 'MATCHED_IN_CV'
                  ? 'bg-success-soft text-success-fg border border-success/30'
                  : 'bg-sunken text-muted hover:text-ink'
              }`}
            >
              ✓ W CV ({counts.matchedInCv})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatus('IN_VAULT_NOT_IN_CV')}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                activeStatus === 'IN_VAULT_NOT_IN_CV'
                  ? 'bg-brand-50 text-brand-fg border border-brand-200'
                  : 'bg-sunken text-muted hover:text-ink'
              }`}
            >
              🔄 W Vault ({counts.inVaultNotCv})
            </button>
            <button
              type="button"
              onClick={() => setActiveStatus('MISSING_IN_VAULT')}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                activeStatus === 'MISSING_IN_VAULT'
                  ? 'bg-danger-soft text-danger-fg border border-danger/30'
                  : 'bg-sunken text-muted hover:text-ink'
              }`}
            >
              ⚠️ Brak ({counts.missingInVault})
            </button>
          </div>

          {/* Siatka słów kluczowych */}
          {filteredKeywords.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Brak słów pasujących do filtra"
              description="Żadne wykryte słowo kluczowe nie spełnia obecnego filtra kategorii, statusu lub wyszukiwanej frazy. Zmień kryteria, aby zobaczyć wyniki."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveCategory('ALL');
                    setActiveStatus('ALL');
                    setSearchQuery('');
                  }}
                >
                  Wyczyść filtry
                </Button>
              }
              className="mt-2"
            />
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
            {filteredKeywords.map((kw) => {
              const badge = (kw?.status && statusBadges[kw.status]) || { label: 'Brak', variant: 'neutral' as const };

              return (
                <div
                  key={kw.id}
                  className="flex flex-col justify-between rounded-xl border border-line bg-elevated p-3 shadow-xs space-y-2 hover:border-line-strong transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-xs text-ink">{kw.term}</span>
                    <Chip variant={badge.variant} size="sm">
                      {badge.label}
                    </Chip>
                  </div>

                  <div className="space-y-1 text-[10px] font-mono text-muted">
                    <div className="flex items-center justify-between">
                      <span>Wystąpienia w JD:</span>
                      <span className="font-bold text-ink">{kw.occurrencesInJd}x</span>
                    </div>

                    {kw.foundInVaultLocations.length > 0 && (
                      <div className="truncate text-subtle" title={kw.foundInVaultLocations.join(', ')}>
                        Vault: {kw.foundInVaultLocations[0]}
                      </div>
                    )}

                    {kw.status === 'MISSING_IN_VAULT' && (
                      <button
                        type="button"
                        onClick={() => setBridgeSkillModal(kw.term)}
                        className="cursor-pointer mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-brand-500/30 bg-brand-500/10 py-1 font-mono text-[10px] font-bold text-brand-700 hover:bg-brand-500/20 transition-colors duration-[var(--duration-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Most kompetencyjny</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </Card>
      )}

      {/* Modal Skill Bridge Matrix */}
      <SkillBridgeMatrixModal
        isOpen={Boolean(bridgeSkillModal)}
        onClose={() => setBridgeSkillModal(null)}
        vault={vault}
        initialMissingSkill={bridgeSkillModal || undefined}
      />
    </div>
  );
};
