/**
 * Serwis integracji z Azure Maps API dla modułu Mobility Intelligence.
 *
 * Zapewnia:
 * 1. Kalkulację realnych tras, odległości i czasów przejazdu z uwzględnieniem
 *    korków drogowych (Live & Historic Traffic).
 * 2. Modelowanie zużycia paliwa (silniki spalinowe PB/ON) oraz energii (pojazdy elektryczne EV).
 * 3. Wyznaczanie izochron (Reachable Range) — obszaru zasięgu dojazdu w 30/45/60 minut.
 * 4. Deterministyczny fallback do lokalnego rejestru korytarzy transportowych
 *    `geoDistanceEngine` w razie braku klucza API w środowisku (zgodnie z Regułą 1 i 7 z AGENTS.md).
 */

import { getGeoDistanceRegistry } from '../../lib/geoDistance/geoDistanceEngine';
import { POLISH_LOCALITIES } from '../../lib/geoDistance/polishLocalities';

export type VehicleEngineType = 'combustion' | 'electric' | 'transit';

export interface RouteCalculationParams {
  origin: string;
  destination: string;
  engineType?: VehicleEngineType;
  /** ISO datetime lub 'peak' (poranny szczyt 07:45) lub 'smooth' (11:00) */
  trafficMode?: 'peak' | 'smooth' | string;
}

export interface RouteCalculationResult {
  source: 'azure_maps' | 'local_deterministic';
  roadDistanceKm: number;
  freeFlowMinutes: number;
  trafficMinutes: number;
  trafficDelayMinutes: number;
  energyConsumption: {
    unit: 'liters' | 'kWh';
    amountPerOneWay: number;
    amountMonthly: number; // 2 strony * 21 dni
    costMonthlyPln: number;
  };
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

// Średnie rynkowe ceny energii i paliw w Polsce (założenia jawne, do wglądu)
const FUEL_PRICE_PLN_PER_LITER = 6.65;
const ELECTRICITY_PRICE_PLN_PER_KWH = 1.15;
const AVERAGE_FUEL_CONSUMPTION_L_PER_100KM = 7.2;
const AVERAGE_EV_CONSUMPTION_KWH_PER_100KM = 17.5;
const MONTHLY_WORK_DAYS = 21;

/**
 * Bezpiecznie odczytuje klucz Azure Maps ze środowiska.
 */
function getAzureMapsKey(): string | null {
  const key = process.env.AZURE_MAPS_KEY || process.env.VITE_AZURE_MAPS_KEY;
  return key && key.trim().length > 10 ? key.trim() : null;
}

/**
 * Szuka współrzędnych polskiej miejscowości w lokalnym rejestrze.
 */
function findCoordinates(cityName: string): { lat: number; lon: number; name: string } | null {
  const norm = cityName.toLowerCase().trim();
  const found = POLISH_LOCALITIES.find(
    (l) => l.name.toLowerCase() === norm || l.id.toLowerCase() === norm
  );
  if (found) {
    return { lat: found.lat, lon: found.lng, name: found.name };
  }
  // Częściowe dopasowanie
  const partial = POLISH_LOCALITIES.find(
    (l) => l.name.toLowerCase().includes(norm) || norm.includes(l.name.toLowerCase())
  );
  if (partial) {
    return { lat: partial.lat, lon: partial.lng, name: partial.name };
  }
  return null;
}

/**
 * Wylicza trasę drogową, korki i spalanie przez Azure Maps lub lokalny rejestr.
 */
export async function calculateRouteWithMobility(
  params: RouteCalculationParams
): Promise<RouteCalculationResult> {
  const azureKey = getAzureMapsKey();
  const originCoord = findCoordinates(params.origin);
  const destCoord = findCoordinates(params.destination);

  // Jeśli brak klucza Azure lub brak koordynatów w bazie, korzystamy z deterministycznego rejestru korytarzy
  if (!azureKey || !originCoord || !destCoord) {
    return fallbackCalculateRoute(params);
  }

  try {
    const query = `${originCoord.lat},${originCoord.lon}:${destCoord.lat},${destCoord.lon}`;
    const isPeak = params.trafficMode === 'peak';
    // Jeśli szczyt: kalkulujemy z traffic=true i departAt = najbliższy wtorek 07:45
    const url = new URL('https://atlas.microsoft.com/route/directions/json');
    url.searchParams.set('api-version', '1.0');
    url.searchParams.set('subscription-key', azureKey);
    url.searchParams.set('query', query);
    url.searchParams.set('traffic', 'true');
    url.searchParams.set('travelMode', 'car');
    url.searchParams.set(
      'vehicleEngineType',
      params.engineType === 'electric' ? 'electric' : 'combustion'
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) {
      return fallbackCalculateRoute(params);
    }

    const data = (await resp.json()) as {
      routes?: Array<{
        summary?: {
          lengthInMeters: number;
          travelTimeInSeconds: number;
          noTrafficTravelTimeInSeconds?: number;
          trafficDelayInSeconds?: number;
        };
        legs?: Array<{
          points?: Array<{ latitude: number; longitude: number }>;
        }>;
      }>;
    };
    const route = data.routes?.[0];
    if (!route || !route.summary) {
      return fallbackCalculateRoute(params);
    }

    const roadDistanceKm = Math.round((route.summary.lengthInMeters / 1000) * 10) / 10;
    const freeFlowMinutes = Math.round((route.summary.noTrafficTravelTimeInSeconds || route.summary.travelTimeInSeconds) / 60);
    // W godzinach szczytu uwzględniamy traffic delay
    const trafficDelayMinutes = Math.round((route.summary.trafficDelayInSeconds || 0) / 60);
    const trafficMinutes = isPeak ? freeFlowMinutes + trafficDelayMinutes : freeFlowMinutes;

    const isElectric = params.engineType === 'electric';
    const amountPerOneWay = isElectric
      ? Math.round(((roadDistanceKm * AVERAGE_EV_CONSUMPTION_KWH_PER_100KM) / 100) * 10) / 10
      : Math.round(((roadDistanceKm * AVERAGE_FUEL_CONSUMPTION_L_PER_100KM) / 100) * 10) / 10;

    const amountMonthly = Math.round(amountPerOneWay * 2 * MONTHLY_WORK_DAYS * 10) / 10;
    const costMonthlyPln = Math.round(
      amountMonthly * (isElectric ? ELECTRICITY_PRICE_PLN_PER_KWH : FUEL_PRICE_PLN_PER_LITER)
    );

    const points = (route.legs?.[0]?.points || []).map((p) => ({
      lat: p.latitude,
      lon: p.longitude,
    }));

    return {
      source: 'azure_maps',
      roadDistanceKm,
      freeFlowMinutes,
      trafficMinutes,
      trafficDelayMinutes,
      energyConsumption: {
        unit: isElectric ? 'kWh' : 'liters',
        amountPerOneWay,
        amountMonthly,
        costMonthlyPln,
      },
      points: points.length > 50 ? samplePoints(points, 40) : points,
    };
  } catch {
    return fallbackCalculateRoute(params);
  }
}

/**
 * Wyznacza izochronę czasu dojazdu (30 / 45 / 60 min) przez Azure Maps lub model geometryczny.
 */
export async function calculateReachableRangeWithMobility(
  params: ReachableRangeParams
): Promise<ReachableRangeResult> {
  const azureKey = getAzureMapsKey();
  const centerCoord = findCoordinates(params.centerCity);

  if (!centerCoord) {
    // Domyślnie Warszawa centrum jeśli miasto nieznane
    const defaultCenter = { lat: 52.2297, lon: 21.0122, name: params.centerCity || 'Warszawa' };
    return fallbackReachableRange(defaultCenter, params.timeBudgetMinutes, params.trafficMode);
  }

  if (!azureKey) {
    return fallbackReachableRange(centerCoord, params.timeBudgetMinutes, params.trafficMode);
  }

  try {
    const timeBudgetInSec = params.timeBudgetMinutes * 60;
    const url = new URL('https://atlas.microsoft.com/route/range/json');
    url.searchParams.set('api-version', '1.0');
    url.searchParams.set('subscription-key', azureKey);
    url.searchParams.set('query', `${centerCoord.lat},${centerCoord.lon}`);
    url.searchParams.set('timeBudgetInSec', String(timeBudgetInSec));
    url.searchParams.set('travelMode', 'car');
    url.searchParams.set('traffic', params.trafficMode === 'peak' ? 'true' : 'false');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (!resp.ok) {
      return fallbackReachableRange(centerCoord, params.timeBudgetMinutes, params.trafficMode);
    }

    const data = (await resp.json()) as {
      reachableRange?: {
        boundary?: Array<{ latitude: number; longitude: number }>;
      };
    };
    const boundary = data.reachableRange?.boundary;
    if (!boundary || !Array.isArray(boundary) || boundary.length === 0) {
      return fallbackReachableRange(centerCoord, params.timeBudgetMinutes, params.trafficMode);
    }

    const boundaryPoints = boundary.map((p) => ({
      lat: p.latitude,
      lon: p.longitude,
    }));

    return {
      source: 'azure_maps',
      center: centerCoord,
      timeBudgetMinutes: params.timeBudgetMinutes,
      boundaryPoints: samplePoints(boundaryPoints, 32),
      approxAreaKm2: calculateApproxPolygonAreaKm2(boundaryPoints),
    };
  } catch {
    return fallbackReachableRange(centerCoord, params.timeBudgetMinutes, params.trafficMode);
  }
}

/* ------------------------------------------------------------------ */
/* Fallbacki i helpery geometryczne                                    */
/* ------------------------------------------------------------------ */

function fallbackCalculateRoute(params: RouteCalculationParams): RouteCalculationResult {
  const calc = getGeoDistanceRegistry().calculateCommute(params.origin, params.destination);
  const roadDistanceKm = calc ? calc.roadDistanceKm : 35;
  const freeFlowMinutes = calc ? calc.estimatedDriveTimeMinutes : 32;
  const isPeak = params.trafficMode === 'peak';
  const trafficDelayMinutes = isPeak ? Math.round(freeFlowMinutes * 0.35) : 0;
  const trafficMinutes = freeFlowMinutes + trafficDelayMinutes;

  const isElectric = params.engineType === 'electric';
  const amountPerOneWay = isElectric
    ? Math.round(((roadDistanceKm * AVERAGE_EV_CONSUMPTION_KWH_PER_100KM) / 100) * 10) / 10
    : Math.round(((roadDistanceKm * AVERAGE_FUEL_CONSUMPTION_L_PER_100KM) / 100) * 10) / 10;

  const amountMonthly = Math.round(amountPerOneWay * 2 * MONTHLY_WORK_DAYS * 10) / 10;
  const costMonthlyPln = Math.round(
    amountMonthly * (isElectric ? ELECTRICITY_PRICE_PLN_PER_KWH : FUEL_PRICE_PLN_PER_LITER)
  );

  return {
    source: 'local_deterministic',
    roadDistanceKm,
    freeFlowMinutes,
    trafficMinutes,
    trafficDelayMinutes,
    energyConsumption: {
      unit: isElectric ? 'kWh' : 'liters',
      amountPerOneWay,
      amountMonthly,
      costMonthlyPln,
    },
    corridorDescription: calc?.corridorDescription,
  };
}

function fallbackReachableRange(
  center: { lat: number; lon: number; name: string },
  timeBudgetMinutes: number,
  trafficMode?: string
): ReachableRangeResult {
  // Prędkość średnia: w szczycie ok 45 km/h, płynnie ok 65 km/h
  const avgSpeed = trafficMode === 'peak' ? 42 : 62;
  const radiusKm = (avgSpeed * (timeBudgetMinutes / 60)) * 0.85; // współczynnik krętości

  const pointsCount = 24;
  const boundaryPoints: Array<{ lat: number; lon: number }> = [];

  for (let i = 0; i < pointsCount; i++) {
    const angle = (i / pointsCount) * 2 * Math.PI;
    // Lekkie zróżnicowanie promienia zależnie od kierunku (symulacja arterii)
    const factor = 0.9 + 0.2 * Math.sin(angle * 3);
    const r = radiusKm * factor;

    const dLat = (r / 111.32) * Math.cos(angle);
    const dLon = (r / (111.32 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle);

    boundaryPoints.push({
      lat: Math.round((center.lat + dLat) * 10000) / 10000,
      lon: Math.round((center.lon + dLon) * 10000) / 10000,
    });
  }

  const approxAreaKm2 = Math.round(Math.PI * radiusKm * radiusKm);

  return {
    source: 'local_deterministic',
    center,
    timeBudgetMinutes,
    boundaryPoints,
    approxAreaKm2,
  };
}

function samplePoints<T>(items: T[], maxCount: number): T[] {
  if (items.length <= maxCount) return items;
  const step = items.length / maxCount;
  const result: T[] = [];
  for (let i = 0; i < maxCount; i++) {
    result.push(items[Math.floor(i * step)]);
  }
  return result;
}

function calculateApproxPolygonAreaKm2(points: Array<{ lat: number; lon: number }>): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].lon * points[j].lat - points[j].lon * points[i].lat;
  }
  // Konwersja stopni kwadratowych na km2 przy szerokości geograficznej Polski (~52N)
  const deg2ToKm2 = 111.32 * (111.32 * Math.cos((52 * Math.PI) / 180));
  return Math.round(Math.abs(area / 2) * deg2ToKm2);
}
