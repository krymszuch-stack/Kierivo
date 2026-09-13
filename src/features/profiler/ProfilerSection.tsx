import React from 'react';
import {
  ShieldCheck,
  Navigation,
  Globe,
  Award,
  Sliders,
  CheckCircle2,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ProfilerState, ExperienceLevel } from '../../types';
import { SENIORITY_LEVELS, seniorityLabel } from '../../data/seniority';
import { LicenseGrid } from './LicenseGrid';
import { CommuteMap } from './CommuteMap';
import { StatTile } from '../../components/ui/StatTile';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/PageHeader';

export interface ProfilerSectionProps {
  profiler: ProfilerState;
  onChange: (updated: ProfilerState) => void;
  className?: string;
}

export const ProfilerSection: React.FC<ProfilerSectionProps> = ({
  profiler,
  onChange,
  className = '',
}) => {
  const currentLicenses = profiler.licenses || [];
  const radiusKm = profiler.location.commuteRadiusKm || profiler.location.radiusKm || 30;

  const handleToggleLicense = (licenseId: string) => {
    const isPresent = currentLicenses.includes(licenseId);
    const updated = isPresent
      ? currentLicenses.filter((id) => id !== licenseId)
      : [...currentLicenses, licenseId];

    onChange({
      ...profiler,
      licenses: updated,
    });
  };

  const handleSelectSeniority = (level: ExperienceLevel) => {
    onChange({
      ...profiler,
      experienceLevel: level,
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <PageHeader
        title="Filtry, Uprawnienia & Dealbreakery"
        description="Skonfiguruj twarde kryteria selekcji ofert. Silnik dopasowania Kierivo automatycznie odrzuca ogłoszenia niespełniające Twoich progów minimalnych."
        badge="ATS Guardrails"
      />

      {/* KPI Top Stat Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Uprawnienia"
          value={currentLicenses.length}
          icon={Award}
          subtext="Aktywne certyfikaty"
        />

        <StatTile
          label="Zasięg Dojazdu"
          value={profiler.location.remoteOnly ? 'Zdalnie' : `${radiusKm} km`}
          icon={Navigation}
          subtext={profiler.location.city || 'Wokół bazy'}
        />

        <StatTile
          label="Relokacja"
          value={profiler.location.relocationReady ? 'Gotowy' : 'Lokalnie'}
          icon={Globe}
          subtext={profiler.location.relocationReady ? 'Inne miasta/kraje' : 'Brak przeprowadzek'}
        />

        <StatTile
          label="Poziom"
          // Etykieta ze wspólnego źródła (`src/data/seniority.ts`) — kafelek
          // pokazywał wcześniej surowy enum („ENTRY"/„PIVOT") zamiast nazwy,
          // którą użytkownik widzi przy wyborze poziomu.
          value={seniorityLabel(profiler.experienceLevel)}
          icon={Briefcase}
          subtext="Targetowany seniority tier"
        />
      </div>

      {/* Seniority Level Pill Selector */}
      <Card tone="raised" className="space-y-3">
        <div>
          <h3 className="text-label font-bold uppercase tracking-wider text-muted">
            Poziom Zaszeregowania (Seniority Tier)
          </h3>
          <p className="text-meta text-subtle">
            Wpływa na wagę doświadczenia wymaganego w ogłoszeniach o pracę.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SENIORITY_LEVELS.map((item) => {
            const isSelected = profiler.experienceLevel === item.id;

            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => handleSelectSeniority(item.id)}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className={`flex flex-col items-start rounded-2xl p-3 text-left cursor-pointer transition-colors duration-[var(--duration-state)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]/50 ${
                  isSelected
                    ? 'bg-brand-600 text-on-brand shadow-raised ring-2 ring-brand-500/20'
                    : 'border border-line bg-sunken text-ink hover:border-brand-300'
                }`}
              >
                <span className="text-xs font-bold leading-tight">{item.label}</span>
                <span
                  className={`mt-0.5 font-mono text-[10px] ${
                    isSelected ? 'text-on-brand/80' : 'text-muted'
                  }`}
                >
                  {item.range ? `${item.range} doświadczenia` : item.description}
                </span>
              </motion.button>
            );
          })}
        </div>
      </Card>

      {/* 2-Column Main Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Commute & Location */}
        <div className="lg:col-span-5">
          <CommuteMap
            location={profiler.location}
            onChange={(updatedLoc) => onChange({ ...profiler, location: updatedLoc })}
          />
        </div>

        {/* Right Column: Formal Licenses & Qualifications */}
        <div className="lg:col-span-7">
          <LicenseGrid
            selectedLicenses={currentLicenses}
            onToggleLicense={handleToggleLicense}
          />
        </div>
      </div>
    </div>
  );
};
