import React, { useState, useEffect } from 'react';
import { X, Download, Sparkles, Circle, Square, ImageOff, Loader2, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './Button';
import { fetchSemanticThemes, downloadSemanticPdf, SemanticThemeItem, SemanticLayoutItem } from '../../lib/semanticPdfExporter';
import { MasterVault, TailoredResume } from '../../types';
import { showToast } from '../../store/useToastStore';
import { AtsValidationPanel } from '../../features/ats/AtsValidationPanel';
import type { AtsPdfValidationReport } from '../../lib/atsPdfValidator';

interface CVExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: MasterVault;
  tailoredResume?: TailoredResume | null;
}

export const CVExportModal: React.FC<CVExportModalProps> = ({
  isOpen,
  onClose,
  vault,
  tailoredResume,
}) => {
  const [themes, setThemes] = useState<SemanticThemeItem[]>([]);
  const [layouts, setLayouts] = useState<SemanticLayoutItem[]>([]);
  const [selectedTheme, setSelectedTheme] = useState('parchment');
  const [selectedLayout, setSelectedLayout] = useState('sidebar');
  const [selectedAvatar, setSelectedAvatar] = useState<'circle' | 'square' | 'none'>('none');
  const [targetPages, setTargetPages] = useState<1 | 2>(1);
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [atsValidation, setAtsValidation] = useState<AtsPdfValidationReport | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setIsLoadingThemes(true);
      try {
        const data = await fetchSemanticThemes();
        if (!cancelled && data.themes.length > 0) {
          setThemes(data.themes);
          setSelectedTheme(data.themes[0].id);
        }
        if (!cancelled && data.layouts.length > 0) {
          setLayouts(data.layouts);
          setSelectedLayout(data.layouts[0].id);
        }
      } catch {
        // Fallback: themes/layouts already have defaults
      } finally {
        if (!cancelled) setIsLoadingThemes(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleExport = async () => {
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
      });
      showToast('Pobrano dwuwarstwowy PDF', {
        message: `Motyw: ${selectedTheme}, Layout: ${selectedLayout}, Avatar: ${selectedAvatar === 'none' ? 'brak' : selectedAvatar}`,
        variant: 'success',
      });

      // Pokaż wyniki walidacji ATS jeśli dostępne
      if (result.atsValidation) {
        setAtsValidation(result.atsValidation);
      } else {
        onClose();
      }
    } catch (err) {
      showToast('Błąd generowania PDF', {
        message: err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd.',
        variant: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
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
        {/* Header */}
        <div className="mb-5 flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-600" />
            <h3 className="text-base font-bold text-ink sm:text-lg">
              Eksportuj CV — Silnik PDF
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

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
              <Button variant="ghost" size="sm" onClick={onClose}>
                Zamknij
              </Button>
            </div>
          </div>
        ) : (
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
                  >
                    {pages} strona{pages > 1 ? 'i' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isExporting}
              >
                Anuluj
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={isExporting ? Loader2 : Download}
                onClick={handleExport}
                disabled={isExporting}
                loading={isExporting}
                className="min-w-[160px]"
              >
                {isExporting ? 'Generowanie...' : 'Generuj i Pobierz PDF'}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
