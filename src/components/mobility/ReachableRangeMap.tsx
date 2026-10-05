import React, { useMemo } from 'react';
import { Compass, Car, Zap, Clock } from 'lucide-react';
import type { ReachableRangeResult, RouteCalculationResult } from '../../lib/mobilityClient';
import { projectReachableRange } from '../../lib/reachableRangeProjection';

export interface ReachableRangeMapProps {
  rangeData?: ReachableRangeResult | null;
  routeData?: RouteCalculationResult | null;
  originName: string;
  destinationName: string;
  timeBudget: 30 | 45 | 60;
  isPeakTraffic: boolean;
  engineType: 'combustion' | 'electric' | 'transit';
  isLoading?: boolean;
  dataUnavailable?: boolean;
}

export const ReachableRangeMap: React.FC<ReachableRangeMapProps> = ({
  rangeData,
  routeData,
  originName,
  destinationName,
  timeBudget,
  isPeakTraffic,
  engineType,
  isLoading = false,
  dataUnavailable = false,
}) => {
  const mapProjection = useMemo(() => {
    const center = rangeData?.center ?? { lat: 0, lon: 0 };
    const actualRoute = routeData?.source === 'azure_maps' ? routeData.points ?? [] : [];
    return projectReachableRange(center, rangeData?.boundaryPoints ?? [], actualRoute);
  }, [rangeData, routeData]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-card-glass">
      {/* Pasek nagłówkowy mapy */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 bg-sunken/40 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-ink">
          <Compass className="h-4 w-4 text-[#155EEF]" />
          <span>Obszar w zasięgu {timeBudget} min</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${isPeakTraffic ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            {routeData?.trafficDataAvailable
              ? (isPeakTraffic ? 'Ruch teraz — dane Azure' : 'Czas bez korków')
              : (isPeakTraffic ? 'Ruch teraz — brak danych' : 'Czas bazowy — bez danych o ruchu')}
          </span>
          <span className="text-line">•</span>
          <span className="inline-flex items-center gap-1 font-mono">
            {engineType === 'electric' ? <Zap className="h-3 w-3 text-emerald-500" /> : <Car className="h-3 w-3 text-[#155EEF]" />}
            {engineType === 'electric' ? 'EV' : engineType === 'transit' ? 'Zbiorkom' : 'Spalinowy'}
          </span>
          {rangeData?.source === 'azure_maps' && (
            <span className="rounded bg-[#155EEF]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#155EEF]">
              Azure Maps Live
            </span>
          )}
        </div>
      </div>

      {/* Wizualizacja wektorowa Canvas/SVG */}
      <div className="relative h-64 w-full bg-gradient-to-b from-sunken/60 to-surface/80 p-2">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center gap-2 text-xs text-muted">
            <Clock className="h-4 w-4 animate-spin text-[#155EEF]" />
            <span>Obliczanie czasu przejazdu i zasięgu...</span>
          </div>
        ) : !rangeData ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted">
            <Compass className="h-7 w-7 opacity-60" />
            <span>{dataUnavailable
              ? 'Nie udało się uzyskać danych dla tej lokalizacji. Sprawdź nazwę miasta lub dostępność Azure Maps.'
              : routeData
                ? 'Brak danych izochrony — mapa zasięgu nie jest rysowana.'
                : 'Podaj miasto zamieszkania, aby obliczyć zasięg dojazdu.'}</span>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${mapProjection.width} ${mapProjection.height}`}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Siatka tła */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-line/40" />
              </pattern>
              <linearGradient id="rangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#155EEF" stopOpacity={isPeakTraffic ? '0.22' : '0.35'} />
                <stop offset="100%" stopColor="#0ba5ec" stopOpacity={isPeakTraffic ? '0.08' : '0.15'} />
              </linearGradient>
            </defs>

            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Obszar izochrony (zasięg w minutach) */}
            {mapProjection.boundary && (
              <polygon
                points={mapProjection.boundary}
                fill="url(#rangeGrad)"
                stroke="#155EEF"
                strokeWidth="1.5"
                strokeDasharray={isPeakTraffic ? '4 3' : 'none'}
                className="transition-all duration-500 ease-out"
              />
            )}

            {mapProjection.route && (
              <polyline
                points={mapProjection.route}
                fill="none"
                stroke="var(--color-brand-600)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Okrąg koncentryczny orientacyjny */}
            <circle
              cx={mapProjection.center.x}
              cy={mapProjection.center.y}
              r="65"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 4"
              className="text-line"
            />

            {/* Punkt centralny (Dom kandydata) */}
            <g transform={`translate(${mapProjection.center.x}, ${mapProjection.center.y})`}>
              <circle r="8" fill="#155EEF" fillOpacity="0.25" className="animate-ping" />
              <circle r="5" fill="#155EEF" stroke="#ffffff" strokeWidth="1.5" />
              <text x="8" y="4" className="fill-ink font-mono text-[10px] font-bold">
                {originName || 'Dom'}
              </text>
            </g>

            {/* Lokalizację celu pokazujemy wyłącznie na końcu rzeczywistej geometrii trasy Azure. */}
            {mapProjection.destination && destinationName && (
              <g transform={`translate(${mapProjection.destination.x}, ${mapProjection.destination.y})`}>
                <circle r="5" fill="#047857" stroke="#ffffff" strokeWidth="1.5" />
                <text x="8" y="4" className="fill-ink font-mono text-[10px] font-bold">
                  {destinationName}
                </text>
              </g>
            )}
          </svg>
        )}

        {/* Dolna belka metryk drogowych */}
        {routeData && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/80 bg-surface/90 px-3 py-1.5 backdrop-blur-md text-[11px]">
            <div className="flex items-center gap-3">
              <span>
                Odległość: <strong className="font-mono text-ink">{routeData.roadDistanceKm} km</strong>
              </span>
              <span>
                {routeData.trafficDataAvailable ? 'Czas trasy:' : 'Szacowany czas bazowy:'}{' '}
                <strong className="font-mono text-ink">{routeData.trafficMinutes} min</strong>
                {routeData.trafficDelayMinutes > 0 && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
                    (+{routeData.trafficDelayMinutes} min zator)
                  </span>
                )}
              </span>
            </div>
            <div className="text-muted">
              Koszt wymaga danych o pojeździe i cenie energii/paliwa.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
