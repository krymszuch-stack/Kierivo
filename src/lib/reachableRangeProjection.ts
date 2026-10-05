export interface GeographicPoint {
  lat: number;
  lon: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ReachableRangeProjection {
  width: number;
  height: number;
  center: ScreenPoint;
  boundary: string;
  route: string;
  destination: ScreenPoint | null;
}

function isValidPoint(point: GeographicPoint): boolean {
  return Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90 &&
    Number.isFinite(point.lon) && point.lon >= -180 && point.lon <= 180;
}

/** Rzutuje geometrię, którą rzeczywiście zwróciły usługi; nie wyznacza położenia z etykiety miasta. */
export function projectReachableRange(
  center: GeographicPoint,
  boundaryPoints: GeographicPoint[],
  routePoints: GeographicPoint[] = [],
): ReachableRangeProjection {
  const safeCenter = isValidPoint(center) ? center : { lat: 0, lon: 0 };
  const safeBoundary = boundaryPoints.filter(isValidPoint);
  // Nie łączymy fragmentów trasy przez wadliwy punkt — brak geometrii jest czytelniejszy niż fałszywa linia.
  const safeRoute = routePoints.length >= 2 && routePoints.every(isValidPoint) ? routePoints : [];
  const coordinates = [safeCenter, ...safeBoundary, ...safeRoute];

  let minLat = safeCenter.lat - 0.5;
  let maxLat = safeCenter.lat + 0.5;
  let minLon = safeCenter.lon - 0.7;
  let maxLon = safeCenter.lon + 0.7;
  if (safeBoundary.length > 0 || safeRoute.length > 0) {
    minLat = Math.min(...coordinates.map((point) => point.lat));
    maxLat = Math.max(...coordinates.map((point) => point.lat));
    minLon = Math.min(...coordinates.map((point) => point.lon));
    maxLon = Math.max(...coordinates.map((point) => point.lon));
  }

  const padLat = Math.max((maxLat - minLat) * 0.15, 0.02);
  const padLon = Math.max((maxLon - minLon) * 0.15, 0.02);
  minLat -= padLat;
  maxLat += padLat;
  minLon -= padLon;
  maxLon += padLon;

  const width = 480;
  const height = 280;
  const project = (point: GeographicPoint): ScreenPoint => ({
    x: Math.round(((point.lon - minLon) / (maxLon - minLon)) * width * 10) / 10,
    y: Math.round((height - ((point.lat - minLat) / (maxLat - minLat)) * height) * 10) / 10,
  });

  const projectedRoute = safeRoute.map(project);
  return {
    width,
    height,
    center: project(safeCenter),
    boundary: safeBoundary.map((point) => {
      const screen = project(point);
      return `${screen.x},${screen.y}`;
    }).join(' '),
    route: projectedRoute.map((point) => `${point.x},${point.y}`).join(' '),
    destination: projectedRoute.at(-1) ?? null,
  };
}
