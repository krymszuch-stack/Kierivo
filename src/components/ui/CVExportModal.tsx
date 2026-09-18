import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Sparkles,
  Circle,
  Square,
  ImageOff,
  Loader2,
  Shield,
  Palette,
  Printer,
  FileCheck,
  Check,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './Button';
import { fetchSemanticThemes, downloadSemanticPdf, SemanticThemeItem, SemanticLayoutItem } from '../../lib/semanticPdfExporter';
import { ApiError } from '../../lib/apiClient';
import { MasterVault, TailoredResume } from '../../types';
import { showToast } from '../../store/useToastStore';
import { AtsValidationPanel } from '../../features/ats/AtsValidationPanel';
import type { AtsPdfValidationReport } from '../../lib/atsPdfValidator';

/**
 * Formatowanie komunikatów błędów eksportu PDF z uwzględnieniem kodu HTTP i requestId.
 */
export function formatPdfExportErrorMessage(err: unknown): { title: string; message: string } {
  if (err instanceof ApiError) {
    const codeSuffix = err.requestId ? ` Kod zgłoszenia: ${err.requestId}` : '';

    switch (err.status) {
      case 400:
        return {
          title: 'Nieprawidłowe dane CV',
          message: `${err.message || 'Sprawdź, czy Twój profil zawiera wymagane dane podstawowe.'}${codeSuffix}`,
        };
      case 503:
        return {
          title: 'Eksport chwilowo niedostępny',
          message: `${err.message || 'Silnik generowania PDF lub wymagane pakiety są niedostępne.'}${codeSuffix}`,
        };
      case 504:
        return {
          title: 'Przekroczono limit czasu',
          message: `${err.message || 'Generowanie dokumentu zajęło zbyt dużo czasu. Spróbuj wybrać 1 stronę lub prostszy układ.'}${codeSuffix}`,
        };
      case 500:
        return {
          title: 'Błąd silnika PDF',
          message: `${err.message || 'Wystąpił błąd podczas generowania dokumentu.'}${codeSuffix}`,
        };
      default:
        return {
          title: 'Błąd generowania PDF',
          message: `${err.message || 'Wystąpił nieoczekiwany błąd.'}${codeSuffix}`,
        };
    }
  }

  const message = err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd.';
  return {
    title: 'Błąd generowania PDF',
    message,
  };
}

export type CVModalMode = 'export' | 'theme' | 'audit';

export interface CVExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: MasterVault;
  tailoredResume?: TailoredResume | null;
  initialMode?: CVModalMode;
  initialTheme?: string;
  initialLayout?: string;
  initialTargetPages?: 1 | 2;
  initialAvatar?: 'circle' | 'square' | 'none';
  onApplyAppearance?: (settings: {
    theme: string;
    layout: string;
    targetPages: 1 | 2;
    avatar: 'circle' | 'square' | 'none';
  }) => void;
  onPrint?: () => void;
  onAuditOpen?: () => void;
}

export const CVExportModal: React.FC<CVExportModalProps> = ({
  isOpen,
  onClose,
  vault,
  tailoredResume,
  initialMode = 'export',
  initialTheme = 'parchment',
  initialLayout = 'sidebar',
  initialTargetPages = 1,
  initialAvatar = 'none',
  onApplyAppearance,
  onPrint,
  onAuditOpen,
}) => {
  const [currentMode, setCurrentMode] = useState<CVModalMode>(initialMode);
  const [themes, setThemes] = useState<SemanticThemeItem[]>([]);
  const [layouts, setLayouts] = useState<SemanticLayoutItem[]>([]);
  const [selectedTheme, setSelectedTheme] = useState(initialTheme);
  const [selectedLayout, setSelectedLayout] = useState(initialLayout);
  const [selectedAvatar, setSelectedAvatar] = useState<'circle' | 'square' | 'none'>(initialAvatar);
  const [targetPages, setTargetPages] = useState<1 | 2>(initialTargetPages);
  const [selectedExportFormat, setSelectedExportFormat] = useState<'dual-layer' | 'standard' | 'print'>('dual-layer');
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [atsValidation, setAtsValidation] = useState<AtsPdfValidationReport | null>(null);

  // Synchronizacja trybu po otwarciu
  useEffect(() => {
    if (isOpen) {
      setCurrentMode(initialMode);
      setSelectedTheme(initialTheme);
      setSelectedLayout(initialLayout);
      setTargetPages(initialTargetPages);
      setSelectedAvatar(initialAvatar);
    }
  }, [isOpen, initialMode, initialTheme, initialLayout, initialTargetPages, initialAvatar]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setIsLoadingThemes(true);
      try {
        const data = await fetchSemanticThemes();
        if (!cancelled && data.themes.length > 0) {
          setThemes(data.themes);
          if (!selectedTheme || !data.themes.some((t) => t.id === selectedTheme)) {
            setSelectedTheme(data.themes[0].id);
          }
        }
        if (!cancelled && data.layouts.length > 0) {
          setLayouts(data.layouts);
          if (!selectedLayout || !data.layouts.some((l) => l.id === selectedLayout)) {
            setSelectedLayout(data.layouts[0].id);
          }
        }
      } catch {
        // Fallback: zachowaj domyślne motywy
      } finally {
        if (!cancelled) setIsLoadingThemes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  /**
   * Zastosowanie wyglądu — wyłącznie konfiguracja, zero generowania PDF.
   */
  const handleApplyAppearance = () => {
    onApplyAppearance?.({
      theme: selectedTheme,
      layout: selectedLayout,
      targetPages,
      avatar: selectedAvatar,
    });
    showToast('Zastosowano wygląd dokumentu', {
      message: `Motyw: ${selectedTheme}, Układ: ${selectedLayout}, ${targetPages} str.`,
      variant: 'success',
    });
    onClose();
  };

  /**
   * Eksport dokumentu w wybranym formacie lub uruchomienie wydruku.
   */
  const handleExecuteExport = async () => {
    if (selectedExportFormat === 'print') {
      onClose();
      if (onPrint) {
        onPrint();
      } else {
        window.print();
      }
      return;
    }

    setIsExporting(true);
    setAtsValidation(null);
    try {
      const result = await downloadSemanticPdf({
        vault,
        tailoredResume,
        theme: selectedTheme,
        layout: selectedLayout,
        targetPages,
        avatar: selectedAvatar,
        pdfType: selectedExportFormat,
      });

      const formatLabel = selectedExportFormat === 'dual-layer' ? 'PDF ATS / Dual-Layer' : 'Standardowy PDF';
      showToast(`Pobrano dokument: ${formatLabel}`, {
        message: `Motyw: ${selectedTheme}, Układ: ${selectedLayout}`,
        variant: 'success',
      });

      // Pokaż wyniki walidacji ATS jeśli dostępne
      if (result.atsValidation) {
        setAtsValidation(result.atsValidation);
      } else {
        onClose();
      }
    } catch (err) {
      const { title, message } = formatPdfExportErrorMessage(err);
      showToast(title, {
        message,
        variant: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const modeConfig = {
    export: {
      title: 'Eksportuj CV',
      desc: 'Wybierz format eksportu dokumentu dopasowany do Twojego celu.',
      icon: Download,
    },
    theme: {
      title: 'Wygląd CV',
      desc: 'Dostosuj motyw kolorystyczny, układ arkusza A4 oraz zdjęcie w dokumencie.',
      icon: Palette,
    },
    audit: {
      title: 'Audyt CV 360°',
      desc: 'Weryfikacja jakości dokumentu pod kątem reguł ATS, metryk STAR i spójności danych.',
      icon: ShieldCheck,
    },
  }[currentMode];

  const HeaderIcon = modeConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.22, ease: [0.19, 1, 0.22, 1] }}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-floating"
      >
        {/* Przełącznik zakładek trybów */}
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div className="inline-flex rounded-xl bg-sunken/60 p-1 border border-line/60">
            <button
              type="button"
              onClick={() => setCurrentMode('export')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                currentMode === 'export'
                  ? 'bg-elevated text-brand-fg shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
              aria-label="Przełącz na tryb eksportu CV"
            >
              <Download className="h-3.5 w-3.5" />
              Eksportuj CV
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('theme')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                currentMode === 'theme'
                  ? 'bg-elevated text-brand-fg shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
              aria-label="Przełącz na tryb wyglądu CV"
            >
              <Palette className="h-3.5 w-3.5" />
              Wygląd CV
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('audit')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                currentMode === 'audit'
                  ? 'bg-elevated text-brand-fg shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
              aria-label="Przełącz na tryb audytu CV 360°"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Audyt CV 360°
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            aria-label="Zamknij okno"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nagłówek aktywnego trybu */}
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-brand-50 dark:bg-brand-950/60 p-2.5 text-brand-fg border border-brand-200/60 dark:border-brand-800/60">
            <HeaderIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink sm:text-lg">
              {modeConfig.title}
            </h3>
            <p className="text-xs text-muted mt-0.5">
              {modeConfig.desc}
            </p>
          </div>
        </div>

        {/* Ciało okna */}
        {isLoadingThemes ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            <span className="ml-2 text-sm text-muted">Ładowanie motywów z silnika...</span>
          </div>
        ) : atsValidation ? (
          /* Wyniki walidacji ATS po eksporcie */
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Shield className="h-4 w-4 text-brand-600" />
              <h4 className="text-sm font-bold text-ink">Walidacja ATS — Wyniki</h4>
            </div>
            <AtsValidationPanel report={atsValidation} />
            <div className="flex justify-end pt-3 border-t border-line">
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="Zamknij raport walidacji ATS">
                Zamknij
              </Button>
            </div>
          </div>
        ) : currentMode === 'export' ? (
          /* TRYB EKSPORTU: Menu formatów eksportu */
          <div className="space-y-5">
            <div className="space-y-2.5">
              {/* Opcja 1: PDF ATS / Dual-Layer */}
              <button
                type="button"
                onClick={() => setSelectedExportFormat('dual-layer')}
                className={`w-full flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition-all ${
                  selectedExportFormat === 'dual-layer'
                    ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 ring-2 ring-brand-600/20'
                    : 'border-line bg-surface hover:border-brand-400/50'
                }`}
                aria-label="Pobierz PDF ATS / Dual-Layer"
              >
                <div className={`mt-0.5 rounded-xl p-2 shrink-0 ${
                  selectedExportFormat === 'dual-layer' ? 'bg-brand-600 text-white' : 'bg-sunken text-muted'
                }`}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink">PDF ATS / Dual-Layer</span>
                    <span className="rounded-full bg-brand-100 dark:bg-brand-900/60 px-2 py-0.5 text-[10px] font-extrabold text-brand-fg">
                      Rekomendowane
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    Dwuwarstwowy PDF ze znacznikami semantycznymi (Tagged PDF) gwarantujący bezbłędny odczyt przez systemy skanujące ATS przy zachowaniu estetyki.
                  </p>
                </div>
              </button>

              {/* Opcja 2: Pobierz standardowy PDF */}
              <button
                type="button"
                onClick={() => setSelectedExportFormat('standard')}
                className={`w-full flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition-all ${
                  selectedExportFormat === 'standard'
                    ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 ring-2 ring-brand-600/20'
                    : 'border-line bg-surface hover:border-brand-400/50'
                }`}
                aria-label="Pobierz standardowy PDF"
              >
                <div className={`mt-0.5 rounded-xl p-2 shrink-0 ${
                  selectedExportFormat === 'standard' ? 'bg-brand-600 text-white' : 'bg-sunken text-muted'
                }`}>
                  <FileCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-ink">Pobierz standardowy PDF</span>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    Uniwersalny plik PDF o tradycyjnej strukturze do bezpośredniej wysyłki mailowej lub archiwizacji.
                  </p>
                </div>
              </button>

              {/* Opcja 3: Drukuj CV */}
              <button
                type="button"
                onClick={() => setSelectedExportFormat('print')}
                className={`w-full flex items-start gap-3.5 rounded-2xl border-2 p-4 text-left transition-all ${
                  selectedExportFormat === 'print'
                    ? 'border-brand-600 bg-brand-50/50 dark:bg-brand-950/30 ring-2 ring-brand-600/20'
                    : 'border-line bg-surface hover:border-brand-400/50'
                }`}
                aria-label="Drukuj CV"
              >
                <div className={`mt-0.5 rounded-xl p-2 shrink-0 ${
                  selectedExportFormat === 'print' ? 'bg-brand-600 text-white' : 'bg-sunken text-muted'
                }`}>
                  <Printer className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-ink">Drukuj CV</span>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    Bezpośrednie przekazanie arkusza A4 do okna drukowania przeglądarki z zachowaniem proporcji i marginesów.
                  </p>
                </div>
              </button>
            </div>

            {/* Stopka trybu eksportu */}
            <div className="flex items-center justify-between pt-4 border-t border-line">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMode('theme')}
                className="text-xs text-brand-fg"
                aria-label="Dostosuj wygląd przed eksportem"
              >
                <Palette className="h-3.5 w-3.5 mr-1.5" />
                Dostosuj wygląd CV
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={isExporting}
                  aria-label="Anuluj eksport"
                >
                  Anuluj
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  icon={isExporting ? Loader2 : selectedExportFormat === 'print' ? Printer : Download}
                  onClick={handleExecuteExport}
                  disabled={isExporting}
                  loading={isExporting}
                  className="min-w-[170px]"
                  aria-label={
                    selectedExportFormat === 'print'
                      ? 'Uruchom drukowanie CV'
                      : selectedExportFormat === 'dual-layer'
                        ? 'Pobierz PDF ATS Dual-Layer'
                        : 'Pobierz standardowy PDF'
                  }
                >
                  {isExporting
                    ? 'Generowanie...'
                    : selectedExportFormat === 'print'
                      ? 'Drukuj CV'
                      : selectedExportFormat === 'dual-layer'
                        ? 'Pobierz PDF ATS'
                        : 'Pobierz standardowy PDF'}
                </Button>
              </div>
            </div>
          </div>
        ) : currentMode === 'theme' ? (
          /* TRYB WYGLĄDU: Tylko konfiguracja bez generowania PDF */
          <div className="space-y-5">
            {/* Theme Grid */}
            <div>
              <label className="block text-xs font-bold text-ink mb-2">
                Motyw wizualny ({themes.length} dostępnych)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`relative rounded-xl border-2 p-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      selectedTheme === theme.id
                        ? 'border-brand-600 ring-2 ring-brand-600/20'
                        : 'border-line hover:border-brand-400/50'
                    }`}
                    aria-label={`Wybierz motyw: ${theme.name}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: theme.accent }}
                      />
                      <span className="text-[11px] font-semibold text-ink">
                        {theme.name}
                      </span>
                    </div>
                    <span className="text-[9px] text-muted">{theme.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Layout */}
            <div>
              <label className="block text-xs font-bold text-ink mb-2">
                Układ A4
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {layouts.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    onClick={() => setSelectedLayout(layout.id)}
                    className={`rounded-xl border-2 px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      selectedLayout === layout.id
                        ? 'border-brand-600 bg-brand-50 text-brand-fg'
                        : 'border-line bg-surface text-muted hover:border-brand-400/50'
                    }`}
                    aria-label={`Wybierz układ A4: ${layout.name}`}
                  >
                    <span className="text-[11px] font-semibold">{layout.name}</span>
                    <span className="block text-[9px] opacity-70">{layout.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar */}
            <div>
              <label className="block text-xs font-bold text-ink mb-2">
                Zdjęcie / Avatar
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'circle' as const, icon: Circle, label: 'Okrągły' },
                  { value: 'square' as const, icon: Square, label: 'Kwadratowy' },
                  { value: 'none' as const, icon: ImageOff, label: 'Brak' },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedAvatar(value)}
                    className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      selectedAvatar === value
                        ? 'border-brand-600 bg-brand-50 text-brand-fg'
                        : 'border-line bg-surface text-muted hover:border-brand-400/50'
                    }`}
                    aria-label={`Format zdjęcia: ${label}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Pages */}
            <div>
              <label className="block text-xs font-bold text-ink mb-2">
                Docelowa liczba stron
              </label>
              <div className="flex gap-2">
                {[1, 2].map((pages) => (
                  <button
                    key={pages}
                    type="button"
                    onClick={() => setTargetPages(pages as 1 | 2)}
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                      targetPages === pages
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-line bg-surface text-muted hover:border-brand-400/50'
                    }`}
                    aria-label={`Liczba stron: ${pages}`}
                  >
                    {pages} strona{pages > 1 ? 'i' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Stopka trybu wyglądu: Zastosuj bez pobierania */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Anuluj zmiany wyglądu"
              >
                Anuluj
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={Check}
                onClick={handleApplyAppearance}
                className="min-w-[160px]"
                aria-label="Zastosuj wygląd CV"
              >
                Zastosuj wygląd
              </Button>
            </div>
          </div>
        ) : (
          /* TRYB AUDYTU */
          <div className="space-y-5">
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-6 w-6 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-ink">Kompleksowa weryfikacja dokumentu (Potrójna Pętla)</h4>
                  <p className="text-xs text-muted leading-relaxed">
                    Audyt analizuje zgodność struktury pod kątem parsowania ATS, obecność metryk twardych w osiągnięciach oraz spójność faktów z MasterVault.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-line bg-surface p-3 text-xs">
                  <div className="font-semibold text-ink flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-brand-fg" /> Zgodność ATS
                  </div>
                  <p className="mt-1 text-[11px] text-muted">Jednokolumnowy przepływ i czytelne etykiety sekcji.</p>
                </div>
                <div className="rounded-xl border border-line bg-surface p-3 text-xs">
                  <div className="font-semibold text-ink flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-brand-fg" /> Metryki STAR
                  </div>
                  <p className="mt-1 text-[11px] text-muted">Weryfikacja mierzalnych rezultatów w punktach doświadczenia.</p>
                </div>
                <div className="rounded-xl border border-line bg-surface p-3 text-xs">
                  <div className="font-semibold text-ink flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-brand-fg" /> Prawdomówność
                  </div>
                  <p className="mt-1 text-[11px] text-muted">Brak halucynacji i pełna zgodność z bazą faktów.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Zamknij audyt"
              >
                Zamknij
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={ShieldCheck}
                onClick={() => {
                  onClose();
                  onAuditOpen?.();
                }}
                className="min-w-[160px]"
                aria-label="Uruchom audyt CV 360°"
              >
                Uruchom weryfikację
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
