import { api } from './apiClient';

export type VehicleEngineType = 'combustion' | 'electric' | 'transit';

export interface RouteCalculationParams {
  origin: string;
  destination: string;
  engineType?: VehicleEngineType;
  trafficMode?: 'peak' | 'smooth';
}

export interface RouteCalculationResult {
  source: 'azure_maps' | 'local_deterministic';
  trafficDataAvailable: boolean;
  roadDistanceKm: number;
  freeFlowMinutes: number;
  trafficMinutes: number;
  trafficDelayMinutes: number;
  /** Koszt pozostaje nieznany bez danych o pojeździe i cenie energii. */
  energyConsumption: null;
  corridorDescription?: string;
  points?: Array<{ lat: number; lon: number }>;
}

export interface ReachableRangeParams {
  centerCity: string;
  timeBudgetMinutes: 30 | 45 | 60;
  trafficMode?: 'peak' | 'smooth';
}

export interface ReachableRangeResult {
  source: 'azure_maps' | 'local_deterministic';
  center: { lat: number; lon: number; name: string };
  timeBudgetMinutes: number;
  boundaryPoints: Array<{ lat: number; lon: number }>;
  approxAreaKm2: number;
}

/**
 * Odpytuje endpoint Azure Maps /api/mobility/route o realny profil trasy, korki i spalanie.
 */
export async function fetchRouteMobility(
  params: RouteCalculationParams
): Promise<RouteCalculationResult> {
  const resp = await api.post<{ success: boolean; data: RouteCalculationResult }>(
    '/api/mobility/route',
    params
  );
  return resp.data;
}

/**
 * Odpytuje endpoint Azure Maps /api/mobility/range o izochronę czasu życia (obszar dojazdu w 30/45/60 min).
 */
export async function fetchReachableRange(
  params: ReachableRangeParams
): Promise<ReachableRangeResult> {
  const resp = await api.post<{ success: boolean; data: ReachableRangeResult }>(
    '/api/mobility/range',
    params
  );
  return resp.data;
}
