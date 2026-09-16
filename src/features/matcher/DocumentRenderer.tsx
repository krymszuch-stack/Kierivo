import React, { useState, useMemo } from 'react';
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
  LayoutTemplate,
  Lightbulb,
  Download,
  Settings2,
  FolderArchive,
  BookmarkPlus,
  Tag,
} from 'lucide-react';
import { MasterVault, TailoredResume, HighlightMetric, GeneratedCvExport } from '../../types';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { showToast } from '../../store/useToastStore';
import {
  assessCvTemplate,
  CV_TEMPLATE_CATALOG,
  findCvTemplate,
} from '../../lib/cvTemplateEngine';
import { downloadSemanticPdf } from '../../lib/semanticPdfExporter';
import { saveCV, PRESET_TAGS } from '../../lib/cvLibraryStorage';
import { Modal } from '../../components/ui/Modal';

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
  const [activeTemplateId, setActiveTemplateId] = useState('cv-minimal');
  const [selectedColor, setSelectedColor] = useState(COLOR_SWATCHES[0].hex);
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [showEmptyHints, setShowEmptyHints] = useState(true);

  // Silnik Dual-Layer Semantic PDF (mvcv)
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfTheme, setPdfTheme] = useState('parchment');
  const [pdfLayout, setPdfLayout] = useState('sidebar');
  const [pdfTargetPages, setPdfTargetPages] = useState<1 | 2>(1);
  const [showPdfSettings, setShowPdfSettings] = useState(false);

  // Biblioteka CV
  const [isSaveLibraryOpen, setIsSaveLibraryOpen] = useState(false);
  const [saveLibraryTitle, setSaveLibraryTitle] = useState('');
  const [saveLibraryTags, setSaveLibraryTags] = useState<string[]>([]);
  const [saveCustomTag, setSaveCustomTag] = useState('');

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
  const previewValue = (value: string | undefined, hint: string) => value || (showEmptyHints ? `[${hint}]` : '');

  const buildExportMetadata = (): GeneratedCvExport => ({
    templateId: activeTemplate.id,
    templateName: activeTemplate.name,
    fit: activeTemplate.fit,
    exportedAt: new Date().toISOString(),
  });

  const handlePrint = () => {
    if (isEditing) {
      setIsEditing(false);
    }
    setTimeout(() => {
      window.print();
      onExported?.(buildExportMetadata());
    }, 40);
  };

  const handleExportSemanticPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await downloadSemanticPdf({
        vault: docVault,
        tailoredResume,
        theme: pdfTheme,
        layout: pdfLayout,
        targetPages: pdfTargetPages,
      });
      showToast('Pobrano dwuwarstwowy PDF', {
        message: 'Dokument z warstwą wizualną i drzewem Tagged PDF (ATS) został pomyślnie wygenerowany.',
        variant: 'success',
      });
      onExported?.({
        templateId: `semantic-${pdfTheme}`,
        templateName: `Dual-Layer ${pdfTheme} (${pdfLayout})`,
        fit: 'ats-friendly',
        exportedAt: new Date().toISOString(),
      });
    } catch (err) {
      showToast('Błąd generowania PDF', {
        message: err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd.',
        variant: 'error',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const openSaveLibraryModal = () => {
    const role = tailoredResume?.targetJobTitle || docVault.personalInfo?.title || 'CV';
    const company = tailoredResume?.companyName ? ` — ${tailoredResume.companyName}` : '';
    const defaultTitle = `${docVault.personalInfo?.fullName ? `${docVault.personalInfo.fullName} — ` : ''}${role}${company} (${new Date().toLocaleDateString('pl-PL')})`;
    setSaveLibraryTitle(defaultTitle);
    const initialTags: string[] = [pdfTargetPages === 1 ? '1-stronicowe' : '2-stronicowe'];
    if (tailoredResume?.atsScore) {
      initialTags.push('Zweryfikowane ATS');
    }
    setSaveLibraryTags(initialTags);
    setIsSaveLibraryOpen(true);
  };

  const handleConfirmSaveToLibrary = () => {
    const finalTitle = saveLibraryTitle.trim() || 'Moje CV';
    saveCV({
      title: finalTitle,
      tags: saveLibraryTags,
      theme: pdfTheme,
      layout: pdfLayout,
      targetPages: pdfTargetPages,
      targetRole: tailoredResume?.targetJobTitle || docVault.personalInfo?.title,
      companyName: tailoredResume?.companyName,
      summaryOverride: tailoredResume?.summary,
      vault: docVault,
      tailoredResume,
    });
    setIsSaveLibraryOpen(false);
    showToast('Zapisano w Bibliotece CV', {
      message: `Wersja „${finalTitle}” została zachowana. Możesz ją w każdej chwili pobrać ponownie bez limitów.`,
      variant: 'success',
    });
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

      {/* Pasek narzędzi dokumentu */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-elevated p-3.5 shadow-raised">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={showEmptyHints}
            onChange={(event) => setShowEmptyHints(event.target.checked)}
            className="h-4 w-4 rounded border-line accent-brand-600"
          />
          <Lightbulb className="h-4 w-4 text-brand-fg" aria-hidden="true" />
          <span>Podpowiedzi w pustym CV</span>
        </label>
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
            Drukuj
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Settings2}
            onClick={() => setShowPdfSettings(!showPdfSettings)}
            className="text-xs"
            aria-label="Ustawienia motywu PDF"
          >
            Motyw PDF
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={isExportingPdf ? Sparkles : Download}
            onClick={handleExportSemanticPdf}
            disabled={isExportingPdf}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
          >
            {isExportingPdf ? 'Generowanie...' : 'Dual-Layer PDF'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={FolderArchive}
            onClick={openSaveLibraryModal}
            className="text-xs text-brand-fg border-brand-500/30 hover:bg-brand-500/10 font-semibold"
            aria-label="Zapisz tę wersję do biblioteki CV"
          >
            Zapisz w bibliotece
          </Button>
        </div>
      </div>

      {/* Panel ustawień silnika Dual-Layer Semantic PDF */}
      {showPdfSettings && (
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 text-xs space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Silnik Dual-Layer Semantic PDF (ATS + Print)
            </span>
            <span className="text-[11px] text-muted">
              ReportLab + pikepdf · Tagged PDF · /ActualText · XMP JSON-LD
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">
                Motyw wizualny (33 presety)
              </label>
              <select
                value={pdfTheme}
                onChange={(e) => setPdfTheme(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="parchment">Parchment Warm (Szeryfowy, ciepły)</option>
                <option value="editorial">Editorial Slate (Magazynowy, szeryfowy)</option>
                <option value="cobalt">Cobalt Pro (Inżynierski błękit)</option>
                <option value="blueprint">Blueprint Technical (Precyzyjny)</option>
                <option value="coral">Coral Modern (Nowoczesny koral)</option>
                <option value="sand">Sand Minimal (Ciepły minimalizm)</option>
                <option value="classic">Classic Monochrome (Formalny B&W)</option>
                <option value="graphite">Graphite Dark Tint (Szmaragdowy akcent)</option>
                <option value="teal">Teal Nordic (Skandynawski morski)</option>
                <option value="navy">Corporate Navy (Klasyczny granat)</option>
                <option value="olive">Olive Industry (Przemysłowa oliwka)</option>
                <option value="charlotte">Charlotte Editorial (Fiolet szeryfowy)</option>
                <option value="zyra">Zyra Clean (Subtelny pastel)</option>
                <option value="slate">Slate Executive (Grafitowy)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">
                Układ siatki A4
              </label>
              <select
                value={pdfLayout}
                onChange={(e) => setPdfLayout(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="sidebar">Sidebar lewy (32/68) — standard</option>
                <option value="sidebar-right">Sidebar prawy (65/35)</option>
                <option value="banner-sidebar">Banner nagłówkowy + Sidebar</option>
                <option value="two-column">Dwie kolumny (48/52)</option>
                <option value="single">Jedna kolumna (Strict ATS)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted mb-1">
                Docelowa objętość (Governance)
              </label>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setPdfTargetPages(1)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    pdfTargetPages === 1
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-line bg-surface text-muted hover:text-ink'
                  }`}
                >
                  1 Strona (Zwięzłe)
                </button>
                <button
                  type="button"
                  onClick={() => setPdfTargetPages(2)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    pdfTargetPages === 2
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-line bg-surface text-muted hover:text-ink'
                  }`}
                >
                  2 Strony (Pełne)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-sunken/40 px-3 py-2 text-xs">
        <LayoutTemplate className="h-4 w-4 text-muted" />
        <span className="font-semibold text-ink">{activeTemplate.name}</span>
        <span className={templateAssessment.fit === 'ats-friendly' ? 'rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success-fg' : 'rounded-full bg-warning-soft px-2 py-0.5 font-semibold text-warning-fg'}>
          {templateAssessment.label}
        </span>
        <span className="text-muted">{templateAssessment.explanation}</span>
      </div>

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
              {personal.photoUrl && (
                <img
                  src={personal.photoUrl}
                  alt="Zdjęcie kandydata"
                  className="float-right ml-4 h-20 w-20 rounded-xl border-2 border-white object-cover shadow-sm"
                  style={{ outline: `2px solid ${selectedColor}` }}
                />
              )}
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
                    {previewValue(personal.fullName, 'Imię i nazwisko')}
                  </h1>
                  <p className="mt-0.5 text-sm font-semibold text-muted">
                    {tailoredResume?.targetJobTitle || previewValue(personal.title, 'Stanowisko')}
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
                  {tailoredResume?.summary || previewValue(personal.summary, '2–3 zdania o doświadczeniu i mocnych stronach')}
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

      <section className="rounded-2xl border border-line bg-elevated p-3 sm:p-4" aria-labelledby="template-gallery-title">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="template-gallery-title" className="text-sm font-bold text-ink">Zmień wygląd</h2>
            <p className="text-xs text-muted">Pięć wariantów — treść Twojego CV pozostaje bez zmian.</p>
          </div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted">{activeTemplate.name}</span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {CV_TEMPLATE_CATALOG.map((template) => (
            <Tooltip key={template.id} content={assessCvTemplate(template).explanation}>
              <button
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
                <span className="mt-1 block truncate text-center font-mono text-[9px] text-muted">{template.name}</span>
              </button>
            </Tooltip>
          ))}
        </div>
      </section>

      {/* Modal zapisu do Biblioteki CV */}
      <Modal
        isOpen={isSaveLibraryOpen}
        onClose={() => setIsSaveLibraryOpen(false)}
        title="Zapisz wersję w Bibliotece CV"
        description="Zapisane CV jest bezpiecznie przechowywane na Twoim urządzeniu. Będziesz mógł je w każdej chwili pobrać ponownie w formacie Dual-Layer PDF bez zużywania limitu importu ani kredytów."
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">
              Tytuł wersji dokumentu
            </label>
            <input
              type="text"
              value={saveLibraryTitle}
              onChange={(e) => setSaveLibraryTitle(e.target.value)}
              placeholder="np. Jan Kowalski — Automatyk KGHM (2026)"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-ink mb-1.5">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted" /> Tagi branżowe
              </span>
              <span className="text-[11px] font-normal text-muted">Kliknij tag, aby usunąć</span>
            </div>

            {/* Wybrane tagi */}
            <div className="flex flex-wrap gap-1.5 mb-2.5 min-h-[2rem] p-2 rounded-xl bg-surface-alt/40 border border-line/50 items-center">
              {saveLibraryTags.length === 0 ? (
                <span className="text-[11px] text-muted">Brak wybranych tagów — wybierz z listy poniżej lub wpisz własny</span>
              ) : (
                saveLibraryTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSaveLibraryTags(saveLibraryTags.filter((t) => t !== tag))}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 border border-brand-500/30 px-2.5 py-0.5 text-[11px] font-medium text-brand-fg hover:bg-brand-500/25 transition-colors cursor-pointer"
                  >
                    {tag}
                    <X className="h-3 w-3 ml-0.5 opacity-60" />
                  </button>
                ))
              )}
            </div>

            {/* Dostępne presety */}
            <div className="flex flex-wrap gap-1 mb-2.5">
              {PRESET_TAGS.filter((pt) => !saveLibraryTags.includes(pt)).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setSaveLibraryTags([...saveLibraryTags, pt])}
                  className="text-[10px] rounded-full border border-dashed border-line/70 px-2 py-0.5 text-muted hover:text-ink hover:border-brand-500/40 transition-colors cursor-pointer"
                >
                  + {pt}
                </button>
              ))}
            </div>

            {/* Własny tag */}
            <div className="flex gap-2">
              <input
                type="text"
                value={saveCustomTag}
                onChange={(e) => setSaveCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = saveCustomTag.trim();
                    if (trimmed && !saveLibraryTags.includes(trimmed)) {
                      setSaveLibraryTags([...saveLibraryTags, trimmed]);
                      setSaveCustomTag('');
                    }
                  }
                }}
                placeholder="Wpisz własny tag i wciśnij Enter..."
                className="flex-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!saveCustomTag.trim()}
                onClick={() => {
                  const trimmed = saveCustomTag.trim();
                  if (trimmed && !saveLibraryTags.includes(trimmed)) {
                    setSaveLibraryTags([...saveLibraryTags, trimmed]);
                    setSaveCustomTag('');
                  }
                }}
              >
                Dodaj
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSaveLibraryOpen(false)}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={BookmarkPlus}
              onClick={handleConfirmSaveToLibrary}
              disabled={!saveLibraryTitle.trim()}
            >
              Zapisz w bibliotece
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
