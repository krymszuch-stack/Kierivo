import React from 'react';
import { Briefcase, DollarSign, MapPin, Globe, Compass, ShieldCheck } from 'lucide-react';
import { ProfilerState, ExperienceLevel, LocationPreferences } from '../../types';
import { SENIORITY_LEVELS } from '../../data/seniority';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Field';
import { Slider } from '../../components/ui/Slider';
import { Toggle } from '../../components/ui/Toggle';
import { RadioGroup } from '../../components/ui/RadioGroup';

export interface PreferencesSectionProps {
  profiler: ProfilerState;
  onChange: (updated: ProfilerState) => void;
  className?: string;
}

export const PreferencesSection: React.FC<PreferencesSectionProps> = ({
  profiler,
  onChange,
  className = '',
}) => {
  // Poziomy z jednego źródła (`src/data/seniority.ts`) — wcześniej lista żyła
  // tu lokalnie i rozjeżdżała się nazwami z kafelkami w ProfilerSection
  // (reguła 3). Zakres doklejany jest tylko tam, gdzie istnieje.
  const experienceOptions = SENIORITY_LEVELS.map((level) => ({
    value: level.id,
    label: level.label,
    description: level.range ? `${level.description} (${level.range})` : level.description,
  }));

  const handleUpdateLocation = <K extends keyof LocationPreferences>(field: K, value: LocationPreferences[K]) => {
    onChange({
      ...profiler,
      location: {
        ...profiler.location,
        [field]: value,
      },
    });
  };

  return (
    <Card tone="raised" className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-base font-bold text-ink">Preferencje Zawodowe i Kryteria Ofert</h3>
        <p className="text-xs text-muted">
          Parametry wykorzystywane do filtrowania ofert w JobMatcher oraz kalkulacji zgodności ATS.
        </p>
      </div>

      {/* Experience Level Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-muted uppercase tracking-wider">
          Docelowy Poziom Doświadczenia
        </label>
        <RadioGroup
          value={profiler.experienceLevel}
          onChange={(val) => onChange({ ...profiler, experienceLevel: val as ExperienceLevel })}
          options={experienceOptions}
        />
      </div>

      {/* Work Mode & Location */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-line/60 pt-4">
        <Input
          label="Miasto Docelowe"
          icon={MapPin}
          value={profiler.location.city || ''}
          onChange={(e) => handleUpdateLocation('city', e.target.value)}
          placeholder="np. Warszawa"
        />

        <div className="flex items-center gap-4 pt-6">
          <Toggle
            checked={profiler.location.remoteOnly}
            onChange={(checked) => handleUpdateLocation('remoteOnly', checked)}
            label="Tylko praca zdalna (100%)"
          />

          <Toggle
            checked={profiler.location.hybridWork}
            onChange={(checked) => handleUpdateLocation('hybridWork', checked)}
            label="Praca hybrydowa"
          />
        </div>
      </div>

      {/* Commute Radius & Relocation */}
      <div className="space-y-4 border-t border-line/60 pt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Toggle
            checked={profiler.location.willingnessToTravel}
            onChange={(checked) => handleUpdateLocation('willingnessToTravel', checked)}
            label="Gotowość do podróży służbowych"
            description="Wyjazdy do klientów lub oddziałów firmy"
          />

          <Toggle
            checked={profiler.location.relocationReady || false}
            onChange={(checked) => handleUpdateLocation('relocationReady', checked)}
            label="Gotowość do relokacji"
            description="Otwartość na oferty z pakietem relokacyjnym"
          />
        </div>

        {!profiler.location.remoteOnly && (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <Slider
              label="Maksymalny Promień Dojazdu do Biura"
              value={profiler.location.commuteRadiusKm || profiler.location.radiusKm || 30}
              onChange={(val) => {
                handleUpdateLocation('commuteRadiusKm', val);
                handleUpdateLocation('radiusKm', val);
              }}
              min={0}
              max={100}
              step={5}
              unit="km"
            />
          </div>
        )}
      </div>
    </Card>
  );
};
