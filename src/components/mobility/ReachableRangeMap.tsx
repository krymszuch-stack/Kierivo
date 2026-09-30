import React, { useMemo } from 'react';
import { Compass, Car, Zap, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import type { ReachableRangeResult, RouteCalculationResult } from '../../lib/mobilityClient';

export interface ReachableRangeMapProps {
  rangeData?: ReachableRangeResult | null;
  routeData?: RouteCalculationResult | null;
  originName: string;
  destinationName: string;
  timeBudget: 30 | 45 | 60;
  isPeakTraffic: boolean;
  engineType: 'combustion' | 'electric' | 'transit';
  isLoading?: boolean;
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
}) => {
  // Obliczenie bounding box dla SVG
  const mapProjection = useMemo(() => {
    const defaultCenter = { lat: 52.2297, lon: 21.0122 };
    const center = rangeData?.center || defaultCenter;

    const points = rangeData?.boundaryPoints || [];
    let minLat = center.lat - 0.5;
    let maxLat = center.lat + 0.5;
    let minLon = center.lon - 0.7;
    let maxLon = center.lon + 0.7;

    if (points.length > 0) {
      minLat = Math.min(minLat, ...points.map((p) => p.lat));
      maxLat = Math.max(maxLat, ...points.map((p) => p.lat));
      minLon = Math.min(minLon, ...points.map((p) => p.lon));
      maxLon = Math.max(maxLon, ...points.map((p) => p.lon));
    }

    // Dodaj margines
    const padLat = (maxLat - minLat) * 0.15 || 0.2;
    const padLon = (maxLon - minLon) * 0.15 || 0.2;
    minLat -= padLat;
    maxLat += padLat;
    minLon -= padLon;
    maxLon += padLon;

    const width = 480;
    const height = 280;

    const project = (lat: number, lon: number) => {
      const x = ((lon - minLon) / (maxLon - minLon)) * width;
      // Odwrócona oś Y (lat rośnie w górę)
      const y = height - ((lat - minLat) / (maxLat - minLat)) * height;
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    };

    const centerPt = project(center.lat, center.lon);
    const polygonPts = points
      .map((p) => {
        const pt = project(p.lat, p.lon);
        return `${pt.x},${pt.y}`;
      })
      .join(' ');

    return { width, height, centerPt, polygonPts };
  }, [rangeData]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-card-glass">
      {/* Pasek nagłówkowy mapy */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 bg-sunken/40 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-ink">
          <Compass className="h-4 w-4 text-[#155EEF]" />
          <span>Izochrona Czasu Życia (Zasięg {timeBudget} min)</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${isPeakTraffic ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            {isPeakTraffic ? 'Szczyt poranny (korki)' : 'Ruch płynny'}
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
            <span>Kalkulacja trasy i izochrony w Azure Maps...</span>
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
            {mapProjection.polygonPts && (
              <polygon
                points={mapProjection.polygonPts}
                fill="url(#rangeGrad)"
                stroke="#155EEF"
                strokeWidth="1.5"
                strokeDasharray={isPeakTraffic ? '4 3' : 'none'}
                className="transition-all duration-500 ease-out"
              />
            )}

            {/* Okrąg koncentryczny orientacyjny */}
            <circle
              cx={mapProjection.centerPt.x}
              cy={mapProjection.centerPt.y}
              r="65"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 4"
              className="text-line"
            />

            {/* Punkt centralny (Dom kandydata) */}
            <g transform={`translate(${mapProjection.centerPt.x}, ${mapProjection.centerPt.y})`}>
              <circle r="8" fill="#155EEF" fillOpacity="0.25" className="animate-ping" />
              <circle r="5" fill="#155EEF" stroke="#ffffff" strokeWidth="1.5" />
              <text x="8" y="4" className="fill-ink font-mono text-[10px] font-bold">
                {originName || 'Dom'}
              </text>
            </g>

            {/* Punkt docelowy (Biuro/Praca) */}
            {destinationName && (
              <g transform={`translate(${mapProjection.centerPt.x + 85}, ${mapProjection.centerPt.y - 45})`}>
                <circle r="5" fill="#047857" stroke="#ffffff" strokeWidth="1.5" />
                <text x="8" y="4" className="fill-ink font-mono text-[10px] font-bold">
                  {destinationName}
                </text>
                {/* Linia łącząca */}
                <line
                  x1={-(85)}
                  y1={45}
                  x2={0}
                  y2={0}
                  stroke="#155EEF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="4 4"
                />
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
                Czas trasy: <strong className="font-mono text-ink">{routeData.trafficMinutes} min</strong>
                {routeData.trafficDelayMinutes > 0 && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">
                    (+{routeData.trafficDelayMinutes} min zator)
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-muted">Szacowany koszt paliwa/prądu:</span>
              <strong className="text-ink">{routeData.energyConsumption.costMonthlyPln} zł/msc</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
