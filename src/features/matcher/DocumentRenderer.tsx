import React, { useState, useMemo, useEffect } from 'react';
import {
  Printer,
  Copy,
  Check,
  Sparkles,
  Palette,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Github,
  Edit3,
  Save,
  Plus,
  Trash2,
  X,
  Shuffle,
  LayoutTemplate,
} from 'lucide-react';
import { MasterVault, TailoredResume, HighlightMetric, GeneratedCvExport } from '../../types';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { showToast } from '../../store/useToastStore';
import {
  assessCvTemplate,
  CV_TEMPLATE_BETA_LIMIT,
  CV_TEMPLATE_CATALOG,
  findCvTemplate,
  pickCvTemplate,
} from '../../lib/cvTemplateEngine';
import { readJson, StorageKeys, writeJson } from '../../lib/storage';

interface TemplateBetaUsage {
  attempts: number;
}

function readTemplateBetaUsage(): TemplateBetaUsage {
  const value = readJson<TemplateBetaUsage>(StorageKeys.cvTemplateBetaUsage, { attempts: 0 });
  return { attempts: Math.max(0, Math.min(CV_TEMPLATE_BETA_LIMIT, Math.floor(value.attempts || 0))) };
}

export interface DocumentRendererProps {
  vault: MasterVault;
  tailoredResume?: TailoredResume | null;
  onUpdateVault?: (updatedVault: MasterVault) => void;
  /**
   * Dokument opuścił aplikację (druk/PDF albo skopiowana treść). Woła to ten,
   * kto wie, o którą ofertę chodzi — renderer sam tego nie wie.
   */
  onExported?: (exportedCv: GeneratedCvExport) => void;
  className?: string;
}

// Kontrast każdego koloru wobec tła #FFFFFF (WCAG 2.x, wzór na luminancję względną) min. 4,5:1.
const COLOR_SWATCHES = [
  { id: 'brand', label: 'Indigo Brand', hex: '#4f46e5' },
  { id: 'emerald', label: 'Emerald Green', hex: '#047857' },
  { id: 'sky', label: 'Sky Blue', hex: '#0369a1' },
  { id: 'rose', label: 'Rose Velvet', hex: '#e11d48' },
  { id: 'amber', label: 'Amber Gold', hex: '#b45309' },
  { id: 'slate', label: 'Classic Slate', hex: '#334155' },
];

export const DocumentRenderer: React.FC<DocumentRendererProps> = ({
  vault,
  tailoredResume,
  onUpdateVault,
  onExported,
  className = '',
}) => {
  const [activeTemplateId, setActiveTemplateId] = useState('cv-01');
  const [selectedColor, setSelectedColor] = useState(COLOR_SWATCHES[0].hex);
  const [betaUsage, setBetaUsage] = useState<TemplateBetaUsage>(readTemplateBetaUsage);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);

  // Lokalna robocza wersja dokumentu z możliwością edycji przed drukiem
  const [docVault, setDocVault] = useState<MasterVault>(() => JSON.parse(JSON.stringify(vault)));

  const hasChanges = useMemo(() => {
    return JSON.stringify(docVault) !== JSON.stringify(vault);
  }, [docVault, vault]);

  const personal = docVault.personalInfo;
  const history = docVault.history || [];
  const education = docVault.education || [];
  const hardSkills = docVault.skillsMatrix?.hardSkills || [];
  const activeTemplate = findCvTemplate(activeTemplateId);
  const templateAssessment = assessCvTemplate(activeTemplate);

  const buildExportMetadata = (): GeneratedCvExport => ({
    templateId: activeTemplate.id,
    templateName: activeTemplate.name,
    fit: activeTemplate.fit,
    exportedAt: new Date().toISOString(),
  });

  const handlePrint = () => {
    window.print();
    onExported?.(buildExportMetadata());
  };

  const handleCopyText = () => {
    const textContent = `
${personal.fullName}
${personal.title}
${personal.email} | ${personal.phone} | ${personal.location}

PODSUMOWANIE ZAWODOWE:
${tailoredResume?.summary || personal.summary}

DOŚWIADCZENIE ZAWODOWE:
${history
  .map(
    (h) =>
      `${h.role} | ${h.company} (${h.startDate} - ${h.isCurrent ? 'Obecnie' : h.endDate})\n${(h.highlights || []).map((hl) => `• ${hl.text}`).join('\n')}`
  )
  .join('\n\n')}

UMIEJĘTNOŚCI:
${hardSkills.join(', ')}

EDUKACJA:
${education.map((e) => `${e.degree} - ${e.institution} (${e.startDate} - ${e.endDate})`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(textContent);
    onExported?.(buildExportMetadata());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleGenerateTemplate = () => {
    if (betaUsage.attempts >= CV_TEMPLATE_BETA_LIMIT) {
      showToast('Wykorzystano lokalny limit bety', {
        message: 'W tej przeglądarce wykorzystano 15 prób losowania wariantu. Wybór istniejącego szablonu nadal nie zmienia danych CV.',
        variant: 'info',
      });
      return;
    }

    const nextUsage = { attempts: betaUsage.attempts + 1 };
    const template = pickCvTemplate(Date.now() + nextUsage.attempts);
    writeJson(StorageKeys.cvTemplateBetaUsage, nextUsage);
    setBetaUsage(nextUsage);
    setActiveTemplateId(template.id);
    setSelectedColor(template.accent);
  };

  const handleUpdatePersonalInfo = (field: string, value: string) => {
    setDocVault((prev) => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value,
      },
    }));
  };

  const handleUpdateHighlight = (historyId: string, highlightId: string, text: string) => {
    setDocVault((prev) => ({
      ...prev,
      history: prev.history.map((h) =>
        h.id === historyId
          ? {
              ...h,
              highlights: (h.highlights || []).map((hl) =>
                hl.id === highlightId ? { ...hl, text } : hl
              ),
            }
          : h
      ),
    }));
  };

  const handleAddHighlight = (historyId: string) => {
    const newHl: HighlightMetric = {
      id: `hl-${crypto.randomUUID()}`,
      text: 'Wdrożyłem / zrealizowałem zadanie osiągając mierzalny rezultat...',
      metric: '',
      target: '',
      action: '',
      tool: '',
      keywords: [],
    };

    setDocVault((prev) => ({
      ...prev,
      history: prev.history.map((h) =>
        h.id === historyId
          ? {
              ...h,
              highlights: [...(h.highlights || []), newHl],
            }
          : h
      ),
    }));
  };

  const handleRemoveHighlight = (historyId: string, highlightId: string) => {
    setDocVault((prev) => ({
      ...prev,
      history: prev.history.map((h) =>
        h.id === historyId
          ? {
              ...h,
              highlights: (h.highlights || []).filter((hl) => hl.id !== highlightId),
            }
          : h
      ),
    }));
  };

  const handleRemoveSkill = (skillIndex: number) => {
    setDocVault((prev) => ({
      ...prev,
      skillsMatrix: {
        ...prev.skillsMatrix,
        hardSkills: prev.skillsMatrix.hardSkills.filter((_, i) => i !== skillIndex),
      },
    }));
  };

  const handleAddSkill = (skillName: string) => {
    if (!skillName.trim()) return;
    setDocVault((prev) => ({
      ...prev,
      skillsMatrix: {
        ...prev.skillsMatrix,
        hardSkills: [...prev.skillsMatrix.hardSkills, skillName.trim()],
      },
    }));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Baner synchronizacji z MasterVault, gdy wprowadzono zmiany */}
      {hasChanges && !hasSynced && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <div>
              <span className="font-bold text-ink">Wprowadzono poprawki w dokumencie.</span>
              <p className="text-muted text-[11px]">
                Czy chcesz zaktualizować profil główny (MasterVault) na podstawie tych zmian?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHasSynced(true)}
              className="text-xs h-8"
            >
              Tylko do tego wydruku
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Save}
              onClick={() => {
                onUpdateVault?.(docVault);
                setHasSynced(true);
                showToast('Zaktualizowano profil główny', {
                  message: 'Twój MasterVault został zaktualizowany o poprawki z podglądu CV.',
                  variant: 'success',
                });
              }}
              className="text-xs h-8"
            >
              Zaktualizuj MasterVault
            </Button>
          </div>
        </div>
      )}

      {/* Controls Bar: Templates, Colors, Edit Mode & Export Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-elevated p-3.5 shadow-raised">
        {/* Wybór szablonu */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Szablon dokumentu"
        >
          <span className="mr-1 text-label font-bold uppercase tracking-wider text-muted text-xs">
            Szablon
          </span>
          {CV_TEMPLATE_CATALOG.slice(0, 6).map((tmpl) => (
            <Tooltip key={tmpl.id} content={assessCvTemplate(tmpl).explanation}>
              <button
                type="button"
                onClick={() => {
                  setActiveTemplateId(tmpl.id);
                  setSelectedColor(tmpl.accent);
                }}
                aria-pressed={activeTemplateId === tmpl.id}
                className={`cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-bold transition-colors duration-[var(--duration-fast)] ease-out focus-visible:outline-none ${
                  activeTemplateId === tmpl.id
                    ? 'border-brand-600 bg-brand-600 text-on-brand shadow-xs'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                {tmpl.name}
              </button>
            </Tooltip>
          ))}
          <Tooltip content="Losuje jeden z 82 deterministycznie zdefiniowanych wariantów i zużywa jedną z 15 lokalnych prób beta.">
            <button
              type="button"
              onClick={handleGenerateTemplate}
              disabled={betaUsage.attempts >= CV_TEMPLATE_BETA_LIMIT}
              className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1 text-xs font-bold text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Shuffle className="h-3.5 w-3.5" /> Losuj {betaUsage.attempts}/{CV_TEMPLATE_BETA_LIMIT}
            </button>
          </Tooltip>
        </div>

        {/* Color Accent Picker */}
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted" />
          <div className="flex items-center gap-1.5">
            {COLOR_SWATCHES.map((swatch) => (
              <Tooltip key={swatch.id} content={swatch.label}>
                <button
                  type="button"
                  onClick={() => setSelectedColor(swatch.hex)}
                  style={{ backgroundColor: swatch.hex }}
                  aria-pressed={selectedColor === swatch.hex}
                  className={`h-4.5 w-4.5 cursor-pointer rounded-full transition-transform focus-visible:outline-none ${
                    selectedColor === swatch.hex
                      ? 'scale-125 ring-2 ring-brand-500/50 ring-offset-2 ring-offset-surface'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`Kolor akcentu: ${swatch.label}`}
                />
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Action Buttons: Nanieś poprawki, Kopiuj, Drukuj */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={isEditing ? 'primary' : 'secondary'}
            size="sm"
            icon={isEditing ? Check : Edit3}
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs"
          >
            {isEditing ? 'Zakończ poprawki' : 'Nanieś poprawki'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={isCopied ? Check : Copy}
            onClick={handleCopyText}
            className="text-xs"
          >
            {isCopied ? 'Skopiowano!' : 'Kopiuj'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={Printer}
            onClick={handlePrint}
            className="text-xs"
          >
            Drukuj / PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-sunken/40 px-3 py-2 text-xs">
        <LayoutTemplate className="h-4 w-4 text-muted" />
        <span className="font-semibold text-ink">{activeTemplate.name}</span>
        <span className={templateAssessment.fit === 'ats-friendly' ? 'rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success-fg' : 'rounded-full bg-warning-soft px-2 py-0.5 font-semibold text-warning-fg'}>
          {templateAssessment.label}
        </span>
        <span className="text-muted">{templateAssessment.explanation}</span>
      </div>

      <section className="rounded-2xl border border-line bg-elevated p-3 sm:p-4" aria-labelledby="template-gallery-title">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="template-gallery-title" className="text-sm font-bold text-ink">Wybierz wygląd gotowego CV</h2>
            <p className="text-xs text-muted">Miniatury pokazują układ. Treść Twojego CV pozostaje bez zmian.</p>
          </div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted">82 warianty</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-9">
          {CV_TEMPLATE_CATALOG.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                setActiveTemplateId(template.id);
                setSelectedColor(template.accent);
              }}
              aria-pressed={activeTemplateId === template.id}
              aria-label={`Wybierz ${template.name}: ${assessCvTemplate(template).label}`}
              className={`rounded-lg border p-1 text-left transition-colors focus-visible:outline-none ${
                activeTemplateId === template.id ? 'border-brand-600 ring-2 ring-brand-500/30' : 'border-line hover:border-line-strong'
              }`}
            >
              <span
                aria-hidden="true"
                className={`cv-template-thumbnail cv-template-thumbnail-${template.layout}`}
                style={{ '--cv-thumbnail-accent': template.accent, '--cv-thumbnail-soft': template.accentSoft } as React.CSSProperties}
              >
                <i /><i /><i /><i />
              </span>
              <span className="mt-1 block truncate font-mono text-[9px] text-muted">{template.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* A4 Sheet Container — responsywny arkusz A4 */}
      <div className="overflow-x-auto p-2 sm:p-6 flex flex-col items-center justify-center bg-sunken/40 rounded-3xl border border-line">
        <div className="w-full flex justify-center">
          <div
            id="cv-printable-document"
            data-cv-layout={activeTemplate.layout}
            data-cv-density={activeTemplate.density}
            data-cv-heading={activeTemplate.headingFont}
            style={{ '--doc-accent': selectedColor, '--cv-accent-soft': activeTemplate.accentSoft } as React.CSSProperties}
            className="doc-paper relative min-h-[1050px] w-full max-w-[794px] rounded-2xl border border-line p-8 sm:p-12 shadow-floating space-y-6"
          >
            {/* Header Section */}
            <div
              data-cv-section="header"
              className={`border-b pb-5 ${
                activeTemplate.family === 'creative'
                  ? 'border-l-4 pl-4'
                  : 'border-line'
              }`}
              style={{ borderLeftColor: activeTemplate.family === 'creative' ? selectedColor : undefined }}
            >
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={personal.fullName}
                    onChange={(e) => handleUpdatePersonalInfo('fullName', e.target.value)}
                    placeholder="Twoje Imię i Nazwisko"
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight w-full bg-transparent border-b border-dashed border-line focus:border-brand-500 focus:outline-none"
                    style={{ color: activeTemplate.family === 'modern' ? selectedColor : undefined }}
                  />
                  <input
                    type="text"
                    value={personal.title}
                    onChange={(e) => handleUpdatePersonalInfo('title', e.target.value)}
                    placeholder="Tytuł Zawodowy / Stanowisko"
                    className="text-sm font-semibold text-muted w-full bg-transparent border-b border-dashed border-line focus:border-brand-500 focus:outline-none"
                  />
                </div>
              ) : (
                <>
                  <h1
                    className="text-2xl sm:text-3xl font-extrabold tracking-tight"
                    style={{ color: activeTemplate.family === 'modern' ? selectedColor : undefined }}
                  >
                    {personal.fullName || 'Imię i Nazwisko'}
                  </h1>
                  <p className="mt-0.5 text-sm font-semibold text-muted">
                    {tailoredResume?.targetJobTitle || personal.title || 'Twój Tytuł Zawodowy'}
                  </p>
                </>
              )}

              {/* Contact Info Row */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted font-mono">
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full pt-1">
                    <input
                      type="text"
                      value={personal.email}
                      onChange={(e) => handleUpdatePersonalInfo('email', e.target.value)}
                      placeholder="Email"
                      className="border border-dashed border-line rounded px-1.5 py-0.5 text-xs bg-transparent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={personal.phone}
                      onChange={(e) => handleUpdatePersonalInfo('phone', e.target.value)}
                      placeholder="Telefon"
                      className="border border-dashed border-line rounded px-1.5 py-0.5 text-xs bg-transparent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={personal.location}
                      onChange={(e) => handleUpdatePersonalInfo('location', e.target.value)}
                      placeholder="Miasto / Lokalizacja"
                      className="border border-dashed border-line rounded px-1.5 py-0.5 text-xs bg-transparent focus:outline-none"
                    />
                  </div>
                ) : (
                  <>
                    {personal.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-subtle" />
                        {personal.email}
                      </span>
                    )}
                    {personal.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-subtle" />
                        {personal.phone}
                      </span>
                    )}
                    {personal.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-subtle" />
                        {personal.location}
                      </span>
                    )}
                    {personal.linkedin && (
                      <span className="flex items-center gap-1">
                        <Linkedin className="h-3.5 w-3.5 text-subtle" />
                        {personal.linkedin}
                      </span>
                    )}
                    {personal.github && (
                      <span className="flex items-center gap-1">
                        <Github className="h-3.5 w-3.5 text-subtle" />
                        {personal.github}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Summary */}
            <div data-cv-section="summary" className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h2
                  className="text-xs font-extrabold uppercase tracking-wider text-muted font-mono"
                  style={{ color: activeTemplate.family === 'executive' ? selectedColor : undefined }}
                >
                  Podsumowanie Zawodowe
                </h2>
              </div>
              {isEditing ? (
                <textarea
                  rows={3}
                  value={personal.summary || ''}
                  onChange={(e) => handleUpdatePersonalInfo('summary', e.target.value)}
                  placeholder="Krótki zarys profilu zawodowego..."
                  className="w-full text-xs leading-relaxed border border-dashed border-line rounded-lg p-2 bg-transparent focus:outline-none focus:border-brand-500"
                />
              ) : (
                <p className="text-xs leading-relaxed text-ink/90">
                  {tailoredResume?.summary || personal.summary || 'Brak podsumowania zawodowego.'}
                </p>
              )}
            </div>

            {/* Skills Matrix */}
            <div data-cv-section="skills" className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted font-mono">
                  Kluczowe Umiejętności & Narzędzia
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {hardSkills.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-sunken px-2 py-0.5 font-mono text-[11px] font-bold text-ink"
                    style={{
                      borderColor: i < 3 ? selectedColor : undefined,
                      color: i < 3 ? selectedColor : undefined,
                    }}
                  >
                    {s}
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(i)}
                        className="hover:text-danger-fg cursor-pointer ml-0.5"
                        title="Usuń umiejętność"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                {isEditing && (
                  <input
                    type="text"
                    placeholder="+ Dodaj i [Enter]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                    className="text-[11px] font-mono border border-dashed border-line rounded px-2 py-0.5 bg-transparent focus:outline-none w-32"
                  />
                )}
              </div>
            </div>

            {/* Work Experience */}
            <div data-cv-section="experience" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted font-mono">
                  Doświadczenie Zawodowe
                </h2>
              </div>

              <div className="space-y-4">
                {history.map((h) => (
                  <div key={h.id} className="page-break-inside-avoid space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-xs text-ink">
                        {h.role} • <span style={{ color: selectedColor }}>{h.company}</span>
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        {h.startDate} – {h.isCurrent ? 'Obecnie' : h.endDate}
                      </span>
                    </div>

                    {h.description && (
                      <p className="text-xs text-muted leading-relaxed">{h.description}</p>
                    )}

                    {/* Highlights */}
                    <div className="space-y-1">
                      {(h.highlights || []).map((hl) => (
                        <div key={hl.id} className="flex items-start gap-1.5 text-xs text-ink/90">
                          <span className="text-muted mt-0.5">•</span>
                          {isEditing ? (
                            <div className="flex-1 flex items-center gap-1.5">
                              <input
                                type="text"
                                value={hl.text}
                                onChange={(e) =>
                                  handleUpdateHighlight(h.id, hl.id, e.target.value)
                                }
                                className="w-full text-xs bg-transparent border-b border-dashed border-line focus:outline-none focus:border-brand-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveHighlight(h.id, hl.id)}
                                className="text-muted hover:text-danger-fg cursor-pointer p-0.5"
                                title="Usuń ten punkt"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="leading-relaxed">{hl.text}</span>
                          )}
                        </div>
                      ))}

                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => handleAddHighlight(h.id)}
                          className="text-[11px] text-brand-fg font-semibold flex items-center gap-1 pt-1 hover:underline cursor-pointer"
                        >
                          <Plus className="h-3 w-3" /> Dodaj punkt osiągnięcia
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            {education.length > 0 && (
              <div data-cv-section="education" className="space-y-2 border-t border-line/60 pt-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted font-mono">
                    Edukacja & Wykształcenie
                  </h2>
                </div>
                <div className="space-y-2">
                  {education.map((e) => (
                    <div key={e.id} className="flex items-baseline justify-between text-xs">
                      <div>
                        <span className="font-bold text-ink">
                          {e.degree}, {e.fieldOfStudy}
                        </span>
                        <span className="text-muted block">{e.institution}</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted">
                        {e.startDate} – {e.endDate}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer RODO Clause */}
            <footer data-cv-section="rodo" className="border-t border-line/50 pt-4 text-[9px] text-subtle leading-tight">
              Wyrażam zgodę na przetwarzanie moich danych osobowych dla potrzeb niezbędnych do realizacji procesu rekrutacji zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};
