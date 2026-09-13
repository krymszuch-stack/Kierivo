import React, { useState } from 'react';
import { Sparkles, Palette, Type, Box, ShieldCheck, Sun, Moon } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { Tabs } from './ui/Tabs';
import { useTheme } from '../providers/ThemeProvider';

interface DesignTokensShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 'shadows' było martwą wartością — żadna zakładka jej nie renderuje.
type ShowcaseTab = 'colors' | 'typography' | 'radii' | 'semantics';

export const DesignTokensShowcaseModal: React.FC<DesignTokensShowcaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('colors');

  // Motyw należy do ThemeProvider — ten modal nie może mieć własnej kopii stanu
  // ani własnego zapisu do schowka. Druga kopia pisała po starym kluczu
  // `cvelocity-theme` i rozjeżdżała się z przełącznikiem w pasku: jedno miejsce
  // ustawiało ciemny, drugie czytało jasny, a po odświeżeniu wracał stan trzeci.
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const tabs = [
    { id: 'colors' as ShowcaseTab, label: 'Paleta & Ramp Brand', icon: Palette },
    { id: 'typography' as ShowcaseTab, label: 'Typografia Geist', icon: Type },
    { id: 'semantics' as ShowcaseTab, label: 'Semantyka & Statusy', icon: ShieldCheck },
    { id: 'radii' as ShowcaseTab, label: 'Promienie & Cienie', icon: Box },
  ];

  const brandRamp = [
    { name: 'brand-50', varName: 'var(--brand-50)' },
    { name: 'brand-100', varName: 'var(--brand-100)' },
    { name: 'brand-200', varName: 'var(--brand-200)' },
    { name: 'brand-300', varName: 'var(--brand-300)' },
    { name: 'brand-400', varName: 'var(--brand-400)' },
    { name: 'brand-500', varName: 'var(--brand-500)' },
    { name: 'brand-600', varName: 'var(--brand-600)' },
    { name: 'brand-700', varName: 'var(--brand-700)' },
    { name: 'brand-800', varName: 'var(--brand-800)' },
    { name: 'brand-900', varName: 'var(--brand-900)' },
    { name: 'brand-950', varName: 'var(--brand-950)' },
  ];

  const surfaces = [
    { name: 'bg-surface', desc: 'Podstawowa powierzchnia aplikacji (tło)', className: 'bg-surface' },
    { name: 'bg-sunken', desc: 'Powierzchnia zagłębiona (paski, tracki scrollbara)', className: 'bg-sunken' },
    { name: 'bg-elevated', desc: 'Powierzchnia uniesiona (karty, modale, panele)', className: 'bg-elevated' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Podgląd tokenów design systemu"
      size="xl"
    >
      <div className="space-y-6">
        {/* Header Bar with Live Theme Toggle */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-line bg-surface p-4">
          <div>
            <h4 className="text-sm font-bold text-ink">System Tokenów Projektowych v4</h4>
            <p className="text-xs text-muted">
              Wartości czytane dynamicznie z custom properties — bez zaszywanych duplikatów.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={isDark ? Sun : Moon}
            onClick={toggleTheme}
          >
            Motyw: {isDark ? 'Ciemny (Dark)' : 'Jasny (Light)'}
          </Button>
        </div>

        {/* Navigation Tabs */}
        <Tabs<ShowcaseTab>
          items={tabs}
          active={activeTab}
          onChange={(id) => setActiveTab(id as ShowcaseTab)}
        />

        {/* Tab 1: Colors & Brand Ramp */}
        {activeTab === 'colors' && (
          <div className="space-y-6">
            {/* Surfaces */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                Powierzchnie (Surfaces)
              </span>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {surfaces.map((s) => (
                  <div
                    key={s.name}
                    className={`rounded-2xl border border-line p-4 shadow-xs ${s.className}`}
                  >
                    <span className="font-mono text-xs font-bold text-ink">{s.name}</span>
                    <p className="mt-1 text-[11px] text-muted">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Complete Brand Ramp 50-950 */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                Rampa marki Kierivo (50–950)
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {brandRamp.map((b) => (
                  <div
                    key={b.name}
                    className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs"
                  >
                    <div
                      className="h-14 w-full"
                      style={{ backgroundColor: b.varName }}
                    />
                    <div className="p-2">
                      <p className="font-mono text-[10px] font-bold text-ink">{b.name}</p>
                      <p className="font-mono text-[9px] text-subtle">{b.varName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Opalizing Utilities */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                Kolory Opalizujące & Efekty Specjalne
              </span>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-4">
                  <p className="font-mono text-xs font-bold text-brand-fg">bg-brand-500/5</p>
                  <p className="text-[11px] text-muted">border-brand-500/20</p>
                </div>
                <div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4">
                  <p className="font-mono text-xs font-bold text-brand-fg">bg-brand-500/10</p>
                  <p className="text-[11px] text-muted">border-brand-500/30</p>
                </div>
                <div className="rounded-2xl border border-brand-500/30 bg-brand-500/20 p-4">
                  <p className="font-mono text-xs font-bold text-brand-fg">bg-brand-500/20</p>
                  <p className="text-[11px] text-muted">Aktywny gradient brand</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Typography */}
        {activeTab === 'typography' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-subtle uppercase">Geist Sans (UI & Nagłówki)</span>
                <h1 className="text-3xl font-extrabold text-ink mt-1">Tekst 3XL Nagłówek (30px)</h1>
                <h2 className="text-2xl font-bold text-ink mt-1">Tekst 2XL Sekcja (24px)</h2>
                <h3 className="text-xl font-bold text-ink mt-1">Tekst XL Podtytuł (20px)</h3>
                <p className="text-sm font-medium text-ink mt-2">
                  Tekst SM: Szybki brązowy lis przeskakuje nad leniwym psem w nowoczesnym interfejsie KIERIVO.
                </p>
                <p className="text-xs text-muted mt-1">
                  Tekst XS: Pomocnicze opisy, etykiety formularzy oraz wskazówki rekrutacyjne (12px).
                </p>
              </div>

              <div className="border-t border-line pt-4">
                <span className="text-[10px] font-mono font-bold text-subtle uppercase">Geist Mono (Dane Techniczne, Ceny, SKU)</span>
                {/* Próbki typograficzne bez wymyślonych liczb (reguła 1) —
                    „98.4% ATS" i TOTP udawały pomiar i dane bezpieczeństwa. */}
                <p className="font-mono text-sm font-bold text-brand-fg mt-1">
                  Próbka znaków mono: 0123456789 • Kierivo • pl-PL
                </p>
                <p className="font-mono text-xs text-muted mt-1">
                  Próba tekstu technicznego • pl-PL
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Semantics & Statuses */}
        {activeTab === 'semantics' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-success/30 bg-success-soft p-4">
              <span className="font-mono text-xs font-bold text-success-fg">SUCCESS (Sukces)</span>
              <p className="mt-1 text-xs text-success-fg">
                Operacja zapisu zakończona powodzeniem.
              </p>
              <div className="mt-3">
                <Chip variant="success" size="sm">Zgodny z ATS</Chip>
              </div>
            </div>

            <div className="rounded-2xl border border-warning/30 bg-warning-soft p-4">
              <span className="font-mono text-xs font-bold text-warning-fg">WARNING (Ostrzeżenie)</span>
              <p className="mt-1 text-xs text-warning-fg">
                Brakuje 2 słów kluczowych w podsumowaniu zawodowym.
              </p>
              <div className="mt-3">
                <Chip variant="warning" size="sm">Uzupełnij Vault</Chip>
              </div>
            </div>

            <div className="rounded-2xl border border-danger/30 bg-danger-soft p-4">
              <span className="font-mono text-xs font-bold text-danger-fg">DANGER (Błąd krytyczny)</span>
              <p className="mt-1 text-xs text-danger-fg">
                Brak wymaganego uprawnienia formalnego (Dealbreaker).
              </p>
              <div className="mt-3">
                <Chip variant="danger" size="sm">Dealbreaker</Chip>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Radii & Shadows */}
        {activeTab === 'radii' && (
          <div className="space-y-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                Skala Zaokrągleń (Border Radii)
              </span>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-sm border border-line bg-surface p-3 text-center">
                  <span className="font-mono text-xs font-bold text-ink">--radius-sm</span>
                  <p className="text-[10px] text-muted">0.5rem (8px)</p>
                </div>
                <div className="rounded-md border border-line bg-surface p-3 text-center">
                  <span className="font-mono text-xs font-bold text-ink">--radius-md</span>
                  <p className="text-[10px] text-muted">0.75rem (12px)</p>
                </div>
                <div className="rounded-xl border border-line bg-surface p-3 text-center">
                  <span className="font-mono text-xs font-bold text-ink">--radius-xl</span>
                  <p className="text-[10px] text-muted">1.0rem (16px)</p>
                </div>
                <div className="rounded-2xl border border-line bg-surface p-3 text-center">
                  <span className="font-mono text-xs font-bold text-ink">--radius-2xl</span>
                  <p className="text-[10px] text-muted">1.5rem (24px)</p>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-subtle">
                Głębokość Cieni (Box Shadows)
              </span>
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-elevated p-5 shadow-raised">
                  <span className="font-mono text-xs font-bold text-ink">shadow-raised</span>
                  <p className="text-xs text-muted mt-1">
                    Używany dla interaktywnych kart, ofert pracy i kafelków szybkiego startu.
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-elevated p-5 shadow-floating">
                  <span className="font-mono text-xs font-bold text-ink">shadow-floating</span>
                  <p className="text-xs text-muted mt-1">
                    Używany dla modali, dropdownów oraz bocznego menu nawigacji.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Zamknij Podgląd Tokenów
          </Button>
        </div>
      </div>
    </Modal>
  );
};
