import React, { useState } from 'react';
import {
  Car,
  Truck,
  HardHat,
  Zap,
  Flame,
  ShieldCheck,
  Award,
  Sparkles,
  Network,
  Wind,
  Sliders,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { ALL_LICENSES, LICENSE_CATEGORIES, LicenseDefinition } from '../../data/licenses';

const LICENSE_ICONS: Record<string, React.ElementType> = {
  Car,
  Truck,
  HardHat,
  Zap,
  Flame,
  ShieldCheck,
  Award,
  Sparkles,
  Network,
  Wind,
  Sliders,
};

export interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLicenses: string[];
  onToggleLicense: (id: string) => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  selectedLicenses,
  onToggleLicense,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Wszystkie');

  const categories = ['Wszystkie', ...LICENSE_CATEGORIES];

  const filteredLicenses = ALL_LICENSES.filter((lic: LicenseDefinition) => {
    const matchesCategory =
      selectedCategory === 'Wszystkie' || lic.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      lic.label.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      lic.category.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Wybierz posiadane uprawnienia i certyfikaty"
      description="Zaznacz tylko te kwalifikacje, które rzeczywiście posiadasz. Będą one brane pod uwagę przy dopasowywaniu ofert pracy."
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-muted">
            Wybrano: <strong className="text-ink font-bold">{selectedLicenses.length}</strong>
          </span>
          <Button variant="primary" size="md" onClick={onClose}>
            Gotowe
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Wyszukiwarka */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj uprawnienia... np. SEP, UDT, Prawo jazdy, F-Gaz..."
            className="w-full rounded-xl border border-line bg-sunken pl-10 pr-4 py-2.5 text-xs text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Kategorie */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-brand-600 text-on-brand'
                  : 'border border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Lista uprawnień */}
        <div className="max-h-[380px] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredLicenses.map((lic) => {
            const isSelected = selectedLicenses.includes(lic.id);
            const Icon = LICENSE_ICONS[lic.iconName] ?? ShieldCheck;

            return (
              <button
                key={lic.id}
                type="button"
                onClick={() => onToggleLicense(lic.id)}
                className={`flex items-center justify-between gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/30 text-ink ring-1 ring-brand-500'
                    : 'border-line bg-surface hover:border-brand-300 text-ink'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-elevated text-muted border border-line/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink truncate leading-tight">
                      {lic.label}
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">{lic.category}</div>
                  </div>
                </div>

                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                )}
              </button>
            );
          })}

          {filteredLicenses.length === 0 && (
            <div className="col-span-full py-8 text-center text-xs text-muted">
              Nie znaleziono uprawnień pasujących do wyszukiwania.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
