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
  /** `peak` to historyczna nazwa trybu bieżących danych Azure; `smooth` pomija korki. */
  trafficMode?: 'peak' | 'smooth';
}

export interface RouteCalculationResult {
  source: 'azure_maps' | 'local_deterministic';
  /** Ruch drogowy pochodzi wyłącznie z Azure; model lokalny nie mierzy korków. */
  trafficDataAvailable: boolean;
  roadDistanceKm: number;
  freeFlowMinutes: number;
  trafficMinutes: number;
  trafficDelayMinutes: number;
  /** Brak danych o pojeździe i cenie energii nie pozwala oszacować kosztu. */
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

export class MobilityUnavailableError extends Error {
  readonly statusCode = 501;
  readonly expose = true;

  constructor(message: string) {
    super(message);
    this.name = 'MobilityUnavailableError';
  }
}

export class MobilityValidationError extends Error {
  readonly statusCode = 400;
  readonly expose = true;

  constructor(message: string) {
    super(message);
    this.name = 'MobilityValidationError';
  }
}

/**
 * Bezpiecznie odczytuje klucz Azure Maps ze środowiska.
 */
function getAzureMapsKey(): string | null {
  // Prefiks VITE_ publikuje zmienną w bundle klienta; klucz usługi czytamy tylko po stronie serwera.
  const key = process.env.AZURE_MAPS_KEY;
  return key && key.trim().length > 10 ? key.trim() : null;
}

/**
 * Szuka współrzędnych polskiej miejscowości w lokalnym rejestrze.
 */
function findCoordinates(cityName: string): { lat: number; lon: number; name: string } | null {
  const norm = cityName.toLowerCase().trim();
  const found = POLISH_LOCALITIES.find(
    (l) => l.name.toLowerCase() === norm || l.id.toLowerCase() === norm ||
      l.aliases?.some((alias) => alias.toLowerCase() === norm)
  );
  if (found) {
    return { lat: found.lat, lon: found.lng, name: found.name };
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

  if (!originCoord || !destCoord) {
    throw new MobilityUnavailableError('Nie znaleziono obu miejscowości w lokalnym rejestrze tras.');
  }

  // Transport publiczny jest obsługiwany tylko jako lokalna estymacja czasu.
  // Azure jest tu wyłącznie trasą samochodową, więc nie wolno podpinać jej pod Zbiorkom.
  if (params.engineType === 'transit' || !azureKey) {
    return fallbackCalculateRoute(params);
  }

  try {
    const query = `${originCoord.lat},${originCoord.lon}:${destCoord.lat},${destCoord.lon}`;
    const isPeak = params.trafficMode === 'peak';
    // Bez departAt Azure liczy trasę dla teraz; nie wolno opisywać wyniku jako prognozy na 07:45.
    const url = new URL('https://atlas.microsoft.com/route/directions/json');
    url.searchParams.set('api-version', '1.0');
    url.searchParams.set('subscription-key', azureKey);
    url.searchParams.set('query', query);
    url.searchParams.set('traffic', 'true');
    // Bez `all` Azure pomija porównawcze czasy bez ruchu.
    url.searchParams.set('computeTravelTimeFor', 'all');
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

    const { lengthInMeters, travelTimeInSeconds, noTrafficTravelTimeInSeconds, trafficDelayInSeconds } = route.summary;
    if (!Number.isFinite(lengthInMeters) || lengthInMeters < 0 ||
        !Number.isFinite(travelTimeInSeconds) || travelTimeInSeconds < 0 ||
        typeof noTrafficTravelTimeInSeconds !== 'number' ||
        !Number.isFinite(noTrafficTravelTimeInSeconds) || noTrafficTravelTimeInSeconds < 0 ||
        (trafficDelayInSeconds !== undefined &&
          (!Number.isFinite(trafficDelayInSeconds) || trafficDelayInSeconds < 0))) {
      return fallbackCalculateRoute(params);
    }

    const roadDistanceKm = Math.round((lengthInMeters / 1000) * 10) / 10;
    const freeFlowMinutes = Math.round(noTrafficTravelTimeInSeconds / 60);
    // `travelTimeInSeconds` już zawiera ruch; dodanie opóźnienia drugi raz zawyża czas.
    const measuredTrafficMinutes = Math.round(travelTimeInSeconds / 60);
    const trafficDelayMinutes = isPeak ? Math.max(0, measuredTrafficMinutes - freeFlowMinutes) : 0;
    const trafficMinutes = isPeak ? measuredTrafficMinutes : freeFlowMinutes;

    const points = (route.legs?.[0]?.points || []).map((p) => ({
      lat: p.latitude,
      lon: p.longitude,
    }));

    return {
      source: 'azure_maps',
      trafficDataAvailable: Number.isFinite(noTrafficTravelTimeInSeconds),
      roadDistanceKm,
      freeFlowMinutes,
      trafficMinutes,
      trafficDelayMinutes,
      energyConsumption: null,
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
    throw new MobilityUnavailableError('Nie znaleziono miejscowości w lokalnym rejestrze.');
  }

  if (!azureKey) {
    throw new MobilityUnavailableError('Wyznaczanie izochrony wymaga skonfigurowanej usługi Azure Maps.');
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
      throw new MobilityUnavailableError('Azure Maps nie zwrócił izochrony dla tej lokalizacji.');
    }

    const data = (await resp.json()) as {
      reachableRange?: {
        boundary?: Array<{ latitude: number; longitude: number }>;
      };
    };
    const boundary = data.reachableRange?.boundary;
    if (!boundary || !Array.isArray(boundary) || boundary.length < 3 || !boundary.every((point) =>
      Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 &&
      Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180
    )) {
      throw new MobilityUnavailableError('Azure Maps nie zwrócił izochrony dla tej lokalizacji.');
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
    throw new MobilityUnavailableError('Nie udało się pobrać izochrony z Azure Maps.');
  }
}

/* ------------------------------------------------------------------ */
/* Fallbacki i helpery geometryczne                                    */
/* ------------------------------------------------------------------ */

function fallbackCalculateRoute(params: RouteCalculationParams): RouteCalculationResult {
  const calc = getGeoDistanceRegistry().calculateCommute(params.origin, params.destination);
  if (!calc) {
    throw new MobilityUnavailableError('Nie znaleziono trasy w lokalnym rejestrze.');
  }

  const roadDistanceKm = calc.roadDistanceKm;
  const isTransit = params.engineType === 'transit';
  const freeFlowMinutes = isTransit ? calc.estimatedTransitTimeMinutes : calc.estimatedDriveTimeMinutes;
  // Lokalny rejestr estymuje czas bazowy, ale nie zawiera danych o aktualnych korkach.
  const trafficDelayMinutes = 0;
  const trafficMinutes = freeFlowMinutes;

  if (isTransit) {
    return {
      source: 'local_deterministic',
      trafficDataAvailable: false,
      roadDistanceKm,
      freeFlowMinutes,
      trafficMinutes,
      trafficDelayMinutes,
      energyConsumption: null,
      corridorDescription: calc.corridorDescription,
    };
  }

  return {
    source: 'local_deterministic',
    trafficDataAvailable: false,
    roadDistanceKm,
    freeFlowMinutes,
    trafficMinutes,
    trafficDelayMinutes,
    energyConsumption: null,
    corridorDescription: calc?.corridorDescription,
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
