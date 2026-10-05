import React, { useId, useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Search,
  Plus,
} from 'lucide-react';
import { motion } from 'motion/react';
import { MasterVault, SkillBridge } from '../../types';
import { generateSkillBridges } from '../../lib/skillBridgeEngine';
import { SkillBridgeCard } from './SkillBridgeCard';
import { Button } from '../ui/Button';
import { useOptionalAuth } from '../../context/AuthContext';

export interface SkillBridgeMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: MasterVault;
  initialMissingSkill?: string;
  missingSkillsList?: string[];
}

const COMMON_GAPS_SUGGESTIONS = [
  'Kafka',
  'AWS',
  'Kubernetes',
  'GraphQL',
  'TypeScript',
  'Spawanie TIG (141)',
  'SEP G2 (Cieplne)',
  'Sterowniki Siemens S7',
  'SAP WMS',
];

export const SkillBridgeMatrixModal: React.FC<SkillBridgeMatrixModalProps> = (props) => {
  const auth = useOptionalAuth();
  // Zamknięcie usuwa lokalny szkic. Inna luka lub profil nie dziedziczy poprzedniej sesji.
  if (!props.isOpen) return null;
  const contextKey = JSON.stringify({
    vault: { ...props.vault, updatedAt: undefined },
    initialMissingSkill: props.initialMissingSkill,
    missingSkillsList: props.missingSkillsList,
    ownerId: auth?.user?.id,
  });
  return <SkillBridgeMatrixSession key={contextKey} {...props} />;
};

const SkillBridgeMatrixSession: React.FC<SkillBridgeMatrixModalProps> = ({
  isOpen,
  onClose,
  vault,
  initialMissingSkill,
  missingSkillsList = [],
}) => {
  const skillInputId = useId();
  const [query, setQuery] = useState(initialMissingSkill || '');
  // Reguła 1: start z fabrykowanymi lukami ['Kafka','AWS','Kubernetes'] generował mosty
  // dla luki, której nikt nie wpisał. Pusty stan ma już własny komunikat zachęty.
  const [activeMissingSkills, setActiveMissingSkills] = useState<string[]>(() => {
    if (initialMissingSkill) return [initialMissingSkill];
    if (missingSkillsList.length > 0) return missingSkillsList;
    return [];
  });

  const handleAddSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    if (!activeMissingSkills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setActiveMissingSkills((prev) => [trimmed, ...prev]);
    }
    setQuery('');
  };

  const handleRemoveSkill = (skill: string) => {
    setActiveMissingSkills((prev) => prev.filter((s) => s.toLowerCase() !== skill.toLowerCase()));
  };

  // Wygeneruj mosty dla aktywnych brakujących umiejętności
  const bridges: SkillBridge[] = useMemo(() => {
    return generateSkillBridges(activeMissingSkills, vault);
  }, [activeMissingSkills, vault]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-4xl rounded-3xl border border-line bg-elevated shadow-floating p-6 space-y-6 my-8"
      >
        {/* Header Modala */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-on-brand shadow-raised">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              {/* Sufiks „(skill-bridge-matrix-v1)" to identyfikator wewnętrzny — nie dla UI. */}
              <h3 className="text-base font-extrabold text-ink tracking-tight font-mono">
                Most Kompetencyjny
              </h3>
              <p className="text-xs text-muted">
                Pokazuje powiązane wpisy z profilu i szkic odpowiedzi. Powiązanie nie potwierdza brakującej umiejętności ani formalnych uprawnień.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij most kompetencyjny"
            className="rounded-xl p-2 text-muted hover:bg-sunken hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sekcja wprowadzania luki kompetencyjnej */}
        <div className="rounded-2xl border border-line bg-surface p-4 space-y-3">
          <label htmlFor={skillInputId} className="font-mono text-xs font-bold text-ink uppercase tracking-wider block">
            Brakująca umiejętność
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
              <input
                id={skillInputId}
                type="text"
                placeholder="Wpisz brakującą technologię (np. Kafka, AWS, GraphQL, Spawanie TIG)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill(query);
                  }
                }}
                className="w-full rounded-xl border border-line bg-elevated py-2 pl-9 pr-3 text-xs font-mono text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              icon={Plus}
              onClick={() => handleAddSkill(query)}
            >
              Zbuduj Most
            </Button>
          </div>

          {/* Szybkie podpowiedzi */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-mono text-muted">Popularne luki:</span>
            {COMMON_GAPS_SUGGESTIONS.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => handleAddSkill(skill)}
                className="rounded-md border border-line bg-sunken px-2 py-0.5 font-mono text-[10px] font-medium text-ink hover:border-brand-500 hover:text-brand-600 transition-colors"
              >
                + {skill}
              </button>
            ))}
          </div>
        </div>

        {/* Aktywne luki kompetencyjne */}
        {activeMissingSkills.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-muted">Aktywne mosty ({activeMissingSkills.length}):</span>
            {activeMissingSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-2.5 py-1 text-xs font-mono font-bold text-ink shadow-xs"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  aria-label={`Usuń umiejętność ${skill}`}
                  className="text-muted hover:text-error"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Lista Mostów Kompetencyjnych (SkillBridge) */}
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          {bridges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center text-xs text-muted">
              {activeMissingSkills.length > 0
                ? 'Brak udokumentowanego powiązania dla wybranych umiejętności.'
                : 'Wpisz umiejętność powyżej, aby sprawdzić powiązane wpisy w profilu.'}
            </div>
          ) : (
            bridges.map((bridge) => (
              <SkillBridgeCard key={bridge.id} bridge={bridge} />
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};
