import React, { useState, useRef, useMemo } from 'react';
import {
  User,
  Briefcase,
  GraduationCap,
  Sliders,
  Star,
  Download,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  LayoutList,
  Layers,
  Eye,
  ChevronDown,
  Database,
  Maximize2,
  Sparkles,
  FolderGit2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MasterVault, ProfilerState } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { DocumentRenderer } from '../matcher/DocumentRenderer';
import { StepIndicator, StepItem } from './StepIndicator';
import { PersonalSection } from './PersonalSection';
import { ExperienceSection } from './ExperienceSection';
import { SkillsMatrix } from './SkillsMatrix';
import { SpecializationPicker } from './SpecializationPicker';
import { EducationSection } from './EducationSection';
import { ProjectsSection } from './ProjectsSection';
import { PreferencesSection } from './PreferencesSection';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { PageHeader } from '../../components/ui/PageHeader';
import { showToast } from '../../store/useToastStore';
import { useFieldSuggestions } from '../../hooks/useFieldSuggestions';
import { bestSubRoleMatch } from '../../lib/specializationIndex';
import { useAuth } from '../../context/AuthContext';

export interface MasterVaultEditorProps {
  vault: MasterVault;
  onChange: (updatedVault: MasterVault) => void;
  onOpenCvParser?: () => void;
  className?: string;
}

type ViewMode = 'stepper' | 'full';

const VAULT_STEPS: StepItem[] = [
  { id: 'personal', label: 'Dane Osobowe', icon: User, description: 'Kontakt i nagłówek' },
  { id: 'experience', label: 'Doświadczenie', icon: Briefcase, description: 'Stanowiska & STAR' },
  { id: 'projects', label: 'Projekty', icon: FolderGit2, description: 'Wdrożenia i portfolio' },
  { id: 'skills', label: 'Umiejętności', icon: Star, description: 'Tech, soft & języki' },
  { id: 'education', label: 'Edukacja', icon: GraduationCap, description: 'Uczelnie i stopnie' },
  { id: 'preferences', label: 'Preferencje', icon: Sliders, description: 'Stawki i dojazd' },
];

export const MasterVaultEditor: React.FC<MasterVaultEditorProps> = ({
  vault,
  onChange,
  onOpenCvParser,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('stepper');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);
  const { mode } = useAuth();

  // Podpowiedzi liczone raz na cały edytor
  const suggest = useFieldSuggestions(vault);

  const detectedSubRoleId = useMemo(() => {
    if (vault.profiler?.subRoleId) return vault.profiler.subRoleId;
    const signal = [vault.personalInfo.title, vault.history[0]?.role, vault.history[0]?.company]
      .filter(Boolean)
      .join(' ');
    return signal.trim() ? bestSubRoleMatch(signal)?.subRole.id : undefined;
  }, [vault.profiler?.subRoleId, vault.personalInfo.title, vault.history]);

  const storageDescription = mode === 'cloud'
    ? 'Zmiany zapisują się w tle na koncie i synchronizują, gdy połączenie jest dostępne.'
    : 'Zmiany zapisują się w tle w tej przeglądarce. Możesz wygenerować CV bez konta, a konto umożliwia synchronizację między urządzeniami.';

  const handleSubRoleChange = (subRoleId: string | undefined) => {
    onChange({ ...vault, profiler: { ...vault.profiler, subRoleId } });
  };
  const [activeStep, setActiveStep] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Export JSON handler
  const handleExportJSON = () => {
    setIsDataMenuOpen(false);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(vault, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `MasterVault_${vault.personalInfo?.fullName?.replace(/\s+/g, '_') || 'Profile'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification('Pomyślnie wyeksportowano profil MasterVault do pliku JSON.');
  };

  // Import JSON handler
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDataMenuOpen(false);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.personalInfo) {
          onChange({
            ...vault,
            ...parsed,
          });
          showNotification('Profil MasterVault został pomyślnie zaimportowany z pliku JSON.');
        } else {
          showToast('Niepoprawny plik', { message: 'To nie jest prawidłowy plik MasterVault JSON.', variant: 'error' });
        }
      } catch (err) {
        showToast('Błąd odczytu', { message: 'Nie udało się odczytać pliku JSON.', variant: 'error' });
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const viewModeOptions = [
    { id: 'stepper' as ViewMode, label: 'Krok po kroku', icon: Layers },
    { id: 'full' as ViewMode, label: 'Pełny formularz', icon: LayoutList },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Hidden File Input for JSON import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportJSON}
        className="hidden"
      />

      {/* Header with Mode Switcher & Actions */}
      <PageHeader
        title="Master Vault • Profil Główny Kandydata"
        description={`Jedyne źródło danych dokumentów: kompetencje, doświadczenie i preferencje. ${storageDescription}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Eye}
              onClick={() => setIsPreviewOpen(true)}
              title="Zobacz gotowy dokument CV na arkuszu A4, zmień szablon i wydrukuj"
            >
              Podgląd i Druk CV
            </Button>

          </div>
        }
      />

      {/* Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success-soft p-4 text-xs font-semibold text-success-fg shadow-xs"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Główny układ 2-kolumnowy: Ściśnięty formularz po lewej + Żywy podgląd CV po prawej */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEWA KOLUMNA: Formularz (7/12 szerokości na desktopie) */}
        <div className="lg:col-span-7 space-y-6">
          {viewMode === 'stepper' ? (
            <div className="space-y-6">
              <StepIndicator
                steps={VAULT_STEPS}
                activeStep={activeStep}
                onStepClick={setActiveStep}
              />

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeStep === 0 && (
                    <PersonalSection
                      data={vault.personalInfo}
                      onChange={(personalInfo) => onChange({ ...vault, personalInfo })}
                      suggest={suggest}
                      onOpenCvParser={onOpenCvParser}
                      vault={vault}
                    />
                  )}

                  {activeStep === 1 && (
                    <ExperienceSection
                      history={vault.history}
                      onChange={(history) => onChange({ ...vault, history })}
                      userSkills={vault.skillsMatrix?.hardSkills || []}
                      suggest={suggest}
                    />
                  )}

                  {activeStep === 2 && (
                    <ProjectsSection
                      projects={vault.projects || []}
                      onChange={(projects) => onChange({ ...vault, projects })}
                      suggest={suggest}
                    />
                  )}

                  {activeStep === 3 && (
                    <div className="space-y-6">
                      <SpecializationPicker
                        skillsMatrix={vault.skillsMatrix}
                        onUpdateSkillsMatrix={(skillsMatrix) => onChange({ ...vault, skillsMatrix })}
                        initialSubRoleId={detectedSubRoleId}
                        onSubRoleChange={handleSubRoleChange}
                      />
                      <SkillsMatrix
                        skillsMatrix={vault.skillsMatrix}
                        languages={vault.profiler?.languages || []}
                        licenses={vault.profiler?.licenses}
                        onUpdateSkillsMatrix={(skillsMatrix) => onChange({ ...vault, skillsMatrix })}
                        onUpdateLanguages={(languages) =>
                          onChange({
                            ...vault,
                            profiler: { ...vault.profiler, languages },
                          })
                        }
                        onUpdateLicenses={(licenses) =>
                          onChange({
                            ...vault,
                            profiler: { ...vault.profiler, licenses },
                          })
                        }
                        suggest={suggest}
                      />
                    </div>
                  )}

                  {activeStep === 4 && (
                    <EducationSection
                      education={vault.education || []}
                      onChange={(education) => onChange({ ...vault, education })}
                      suggest={suggest}
                    />
                  )}

                  {activeStep === 5 && (
                    <PreferencesSection
                      profiler={vault.profiler}
                      onChange={(profiler: ProfilerState) => onChange({ ...vault, profiler })}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Stepper Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-line/60">
                <Button
                  variant="outline"
                  size="sm"
                  icon={ArrowLeft}
                  onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                  disabled={activeStep === 0}
                >
                  Wstecz
                </Button>

                <span className="font-mono text-xs text-muted">
                  Krok {activeStep + 1} z {VAULT_STEPS.length}
                </span>

                <Button
                  variant="primary"
                  size="sm"
                  icon={ArrowRight}
                  onClick={() => setActiveStep((prev) => Math.min(VAULT_STEPS.length - 1, prev + 1))}
                  disabled={activeStep === VAULT_STEPS.length - 1}
                >
                  Dalej
                </Button>
              </div>
            </div>
          ) : (
            /* Pełny widok formularza */
            <div className="space-y-6">
              <PersonalSection
                data={vault.personalInfo}
                onChange={(personalInfo) => onChange({ ...vault, personalInfo })}
                suggest={suggest}
                onOpenCvParser={onOpenCvParser}
                vault={vault}
              />

              <ExperienceSection
                history={vault.history}
                onChange={(history) => onChange({ ...vault, history })}
                userSkills={vault.skillsMatrix?.hardSkills || []}
                suggest={suggest}
              />

              <ProjectsSection
                projects={vault.projects || []}
                onChange={(projects) => onChange({ ...vault, projects })}
                suggest={suggest}
              />

              <SpecializationPicker
                skillsMatrix={vault.skillsMatrix}
                onUpdateSkillsMatrix={(skillsMatrix) => onChange({ ...vault, skillsMatrix })}
                initialSubRoleId={detectedSubRoleId}
                onSubRoleChange={handleSubRoleChange}
              />

              <SkillsMatrix
                skillsMatrix={vault.skillsMatrix}
                languages={vault.profiler?.languages || []}
                licenses={vault.profiler?.licenses}
                onUpdateSkillsMatrix={(skillsMatrix) => onChange({ ...vault, skillsMatrix })}
                onUpdateLanguages={(languages) =>
                  onChange({
                    ...vault,
                    profiler: { ...vault.profiler, languages },
                  })
                }
                onUpdateLicenses={(licenses) =>
                  onChange({
                    ...vault,
                    profiler: { ...vault.profiler, licenses },
                  })
                }
                suggest={suggest}
              />

              <EducationSection
                education={vault.education || []}
                onChange={(education) => onChange({ ...vault, education })}
                suggest={suggest}
              />

              <PreferencesSection
                profiler={vault.profiler}
                onChange={(profiler: ProfilerState) => onChange({ ...vault, profiler })}
              />
            </div>
          )}
        </div>

        {/* PRAWA KOLUMNA: Żywy Podgląd CV (5/12 szerokości na desktopie) */}
        <div className="lg:col-span-5 space-y-3 sticky top-4">
          <div className="rounded-3xl border border-line bg-elevated p-4 shadow-floating space-y-3">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink">Żywy Podgląd CV (A4)</h4>
                  <p className="text-[10px] text-muted font-mono">Aktualizuje się na bieżąco</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Maximize2}
                  onClick={() => setIsPreviewOpen(true)}
                  className="h-7 text-[11px] px-2 text-brand-fg hover:bg-brand-500/10"
                  title="Otwórz pełny ekran i druk"
                >
                  Powiększ
                </Button>
              </div>
            </div>

            {/* Żywa kartka A4 w miniaturowym, krystalicznym formacie */}
            <div className="rounded-2xl border border-line bg-sunken/40 p-2 sm:p-3 overflow-hidden">
              <div className="doc-paper rounded-xl border border-line/80 bg-white p-5 text-[11px] text-slate-800 shadow-sm space-y-4 max-h-[620px] overflow-y-auto">
                {/* Live Header */}
                <div className="border-b border-slate-200 pb-3">
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                    {vault.personalInfo?.fullName || 'Imię i Nazwisko'}
                  </h2>
                  <p className="text-[11px] font-semibold text-brand-700 mt-0.5">
                    {vault.personalInfo?.title || 'Twój Tytuł Zawodowy'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[9px] text-slate-500 mt-1.5 font-mono">
                    {vault.personalInfo?.email && <span>{vault.personalInfo.email}</span>}
                    {vault.personalInfo?.phone && <span>• {vault.personalInfo.phone}</span>}
                    {vault.personalInfo?.location && <span>• {vault.personalInfo.location}</span>}
                  </div>
                </div>

                {/* Live Summary */}
                {vault.personalInfo?.summary && (
                  <div className="space-y-1">
                    <h5 className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Podsumowanie
                    </h5>
                    <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-3">
                      {vault.personalInfo.summary}
                    </p>
                  </div>
                )}

                {/* Live Skills */}
                {vault.skillsMatrix?.hardSkills?.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Kluczowe Umiejętności ({vault.skillsMatrix.hardSkills.length})
                    </h5>
                    <div className="flex flex-wrap gap-1">
                      {vault.skillsMatrix.hardSkills.slice(0, 10).map((s, i) => (
                        <span
                          key={i}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 font-mono"
                        >
                          {s}
                        </span>
                      ))}
                      {vault.skillsMatrix.hardSkills.length > 10 && (
                        <span className="text-[9px] text-slate-400 font-mono">
                          +{vault.skillsMatrix.hardSkills.length - 10} więcej
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Live Experience */}
                {vault.history?.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Doświadczenie ({vault.history.length})
                    </h5>
                    <div className="space-y-2">
                      {vault.history.slice(0, 3).map((h) => (
                        <div key={h.id} className="space-y-0.5 text-[10px]">
                          <div className="flex items-baseline justify-between font-bold text-slate-800">
                            <span>{h.role}</span>
                            <span className="font-mono text-[9px] text-slate-400">
                              {h.startDate} – {h.isCurrent ? 'Obecnie' : h.endDate}
                            </span>
                          </div>
                          <p className="text-[9px] text-brand-700 font-semibold">{h.company}</p>
                          {h.highlights && h.highlights.length > 0 && (
                            <p className="text-[9px] text-slate-500 line-clamp-2 pl-2 border-l border-slate-200">
                              • {h.highlights[0].text}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Education */}
                {vault.education?.length > 0 && (
                  <div className="space-y-1 border-t border-slate-100 pt-2">
                    <h5 className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Edukacja
                    </h5>
                    <div className="text-[9px] text-slate-600">
                      <span className="font-bold text-slate-800">{vault.education[0].degree}</span>, {vault.education[0].fieldOfStudy}
                      <span className="text-slate-400 block">{vault.education[0].institution}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal pełnego podglądu i druku CV */}
      {isPreviewOpen && (
        <Modal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          title={`Podgląd i Druk CV • ${vault.personalInfo?.fullName || 'Profil Kandydata'}`}
          size="full"
        >
          <DocumentRenderer
            vault={vault}
            onUpdateVault={onChange}
            onExported={() => {
              showToast('Eksport CV', {
                message: 'Dokument CV został przekazany do druku / zapisu PDF.',
                variant: 'info',
              });
            }}
          />
        </Modal>
      )}
    </div>
  );
};
