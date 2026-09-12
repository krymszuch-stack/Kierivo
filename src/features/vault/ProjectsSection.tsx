import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  Trash2,
  ExternalLink,
  Code2,
  TrendingUp,
  X,
  Briefcase,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Field';
import { Combobox } from '../../components/ui/Combobox';
import type { SuggestFn } from '../../hooks/useFieldSuggestions';
import { EmptyState } from '../../components/ui/EmptyState';

export interface ProjectsSectionProps {
  projects: Project[];
  onChange: (updated: Project[]) => void;
  suggest?: SuggestFn;
  className?: string;
}

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({
  projects,
  onChange,
  suggest,
  className = '',
}) => {
  const [techInputMap, setTechInputMap] = useState<Record<string, string>>({});

  const handleAddProject = () => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: '',
      role: '',
      description: '',
      techStack: [],
      metrics: '',
      link: '',
    };
    onChange([...projects, newProject]);
  };

  const handleUpdateProject = <K extends keyof Project>(
    id: string,
    field: K,
    value: Project[K]
  ) => {
    onChange(
      projects.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveProject = (id: string) => {
    onChange(projects.filter((item) => item.id !== id));
  };

  const handleAddTech = (projectId: string, techName: string) => {
    const trimmed = techName.trim();
    if (!trimmed) return;
    const currentProj = projects.find((p) => p.id === projectId);
    if (!currentProj) return;

    const exists = (currentProj.techStack || []).some(
      (t) => t.toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) {
      handleUpdateProject(projectId, 'techStack', [
        ...(currentProj.techStack || []),
        trimmed,
      ]);
    }
    setTechInputMap((prev) => ({ ...prev, [projectId]: '' }));
  };

  const handleRemoveTech = (projectId: string, techName: string) => {
    const currentProj = projects.find((p) => p.id === projectId);
    if (!currentProj) return;
    handleUpdateProject(
      projectId,
      'techStack',
      (currentProj.techStack || []).filter((t) => t !== techName)
    );
  };

  return (
    <Card tone="raised" className={`space-y-6 ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
        <div>
          <h3 className="text-base font-bold text-ink flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-brand-600" />
            Projekty i Osiągnięcia Specjalistyczne
          </h3>
          <p className="text-xs text-muted">
            Zaprezentuj zrealizowane projekty inżynierskie, wdrożenia komercyjne, instalacje lub aplikacje open-source.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={handleAddProject}
        >
          Dodaj Projekt
        </Button>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {projects.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="Brak dodanych projektów"
              description="Projekty stanowią twardy dowód Twoich kompetencji technologicznych w analizie ATS i rozmowie rekrutacyjnej."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={handleAddProject}
                >
                  Dodaj pierwszy projekt
                </Button>
              }
            />
          ) : (
            projects.map((project, index) => {
              const currentTechInput = techInputMap[project.id] || '';

              return (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: [0.19, 1, 0.22, 1] }}
                  className="rounded-2xl border border-line bg-surface p-4 sm:p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <span className="font-mono text-label font-bold text-brand-fg">
                      Projekt #{index + 1}: {project.name || 'Nowy projekt'}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => handleRemoveProject(project.id)}
                      className="text-danger-fg hover:bg-danger-soft"
                      title="Usuń projekt"
                    >
                      Usuń
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Nazwa Projektu */}
                    <Input
                      label="Nazwa Projektu"
                      icon={FolderGit2}
                      value={project.name}
                      onChange={(e) => handleUpdateProject(project.id, 'name', e.target.value)}
                      placeholder="np. Modernizacja Kotłowni Przemysłowej / Aplikacja Webowa"
                      required
                    />

                    {/* Rola w Projekcie */}
                    <Combobox
                      label="Twoja Rola"
                      icon={Briefcase}
                      value={project.role}
                      onChange={(value) => handleUpdateProject(project.id, 'role', value)}
                      suggestions={suggest?.('jobTitle', project.role) ?? []}
                      placeholder="np. Główny Wykonawca / Tech Lead / Architekt"
                    />
                  </div>

                  {/* Opis Projektu */}
                  <Textarea
                    label="Opis Projektu i Rezultaty"
                    rows={3}
                    value={project.description}
                    onChange={(e) => handleUpdateProject(project.id, 'description', e.target.value)}
                    placeholder="Opisz cel projektu, wyzwania inżynierskie, zastosowane rozwiązania oraz efekt końcowy..."
                  />

                  {/* Technologie w Projekcie */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-label font-semibold text-muted uppercase tracking-wider">
                        Użyte Narzędzia i Technologie
                      </label>
                      <span className="text-[11px] text-muted">
                        Możesz wybrać z istniejących lub wpisać nową
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Combobox
                        icon={Code2}
                        value={currentTechInput}
                        onChange={(val) =>
                          setTechInputMap((prev) => ({ ...prev, [project.id]: val }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTech(project.id, currentTechInput);
                          }
                        }}
                        onPick={(sug) => handleAddTech(project.id, sug.value)}
                        suggestions={suggest?.('projectTech', currentTechInput, project.techStack) ?? []}
                        placeholder="Wpisz technologię (np. Docker, Sterowniki PLC, React) i naciśnij Enter..."
                        containerClassName="flex-1"
                      />

                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        icon={Plus}
                        onClick={() => handleAddTech(project.id, currentTechInput)}
                      >
                        Dodaj
                      </Button>
                    </div>

                    {/* Lista tagów technologii */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(project.techStack || []).map((tech) => (
                        <span
                          key={tech}
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-2xs"
                        >
                          <span>{tech}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTech(project.id, tech)}
                            className="rounded-full p-0.5 hover:bg-sunken text-muted hover:text-ink cursor-pointer"
                            aria-label={`Usuń ${tech}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Metryki i Link */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-line/50">
                    <Input
                      label="Mierzalny Wpływ / Metryki (opcjonalnie)"
                      icon={TrendingUp}
                      value={project.metrics || ''}
                      onChange={(e) => handleUpdateProject(project.id, 'metrics', e.target.value)}
                      placeholder="np. Skrócenie czasu przestoju o 40%, budżet 200 tys. PLN"
                      hint="Twarde liczby drastycznie podnoszą wiarygodność profilu"
                    />

                    <Input
                      label="Link do Projektu / Dokumentacji (opcjonalnie)"
                      icon={ExternalLink}
                      value={project.link || ''}
                      onChange={(e) => handleUpdateProject(project.id, 'link', e.target.value)}
                      placeholder="https://github.com/... lub https://twojprojekt.pl"
                    />
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
};
