import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculateRouteWithMobility,
  calculateReachableRangeWithMobility,
  MobilityUnavailableError,
} from '../services/azureMaps.service';

describe('azureMaps.service (Mobility Intelligence)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('zwraca jawnie oznaczoną estymację lokalną dla znanej trasy bez danych o korkach', async () => {
    vi.stubEnv('AZURE_MAPS_KEY', '');
    vi.stubEnv('VITE_AZURE_MAPS_KEY', '');

    const result = await calculateRouteWithMobility({
      origin: 'Warszawa',
      destination: 'Pruszków',
      engineType: 'combustion',
      trafficMode: 'peak',
    });

    expect(result.source).toBe('local_deterministic');
    expect(result.trafficDataAvailable).toBe(false);
    expect(result.roadDistanceKm).toBeGreaterThan(0);
    expect(result.trafficMinutes).toBe(result.freeFlowMinutes);
    expect(result.trafficDelayMinutes).toBe(0);
    expect(result.energyConsumption).toBeNull();
  });

  it('nie podstawia typowej odległości ani czasu dla nieznanej trasy', async () => {
    vi.stubEnv('AZURE_MAPS_KEY', '');
    vi.stubEnv('VITE_AZURE_MAPS_KEY', '');

    await expect(calculateRouteWithMobility({
      origin: 'Miasto bez wpisu',
      destination: 'Warszawa',
    })).rejects.toBeInstanceOf(MobilityUnavailableError);
  });

  it('nie używa klucza VITE_ jako poświadczenia serwera', async () => {
    vi.stubEnv('AZURE_MAPS_KEY', '');
    vi.stubEnv('VITE_AZURE_MAPS_KEY', 'client-exposed-key-must-not-be-used');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await calculateRouteWithMobility({
      origin: 'Warszawa',
      destination: 'Pruszków',
    });

    expect(result.source).toBe('local_deterministic');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nie dopasowuje niejednoznacznej części nazwy do pierwszego miasta z rejestru', async () => {
    vi.stubEnv('AZURE_MAPS_KEY', '');
    vi.stubEnv('VITE_AZURE_MAPS_KEY', '');

    await expect(calculateReachableRangeWithMobility({
      centerCity: 'Wars',
      timeBudgetMinutes: 30,
    })).rejects.toMatchObject({ statusCode: 501 });
  });

  it('nie rysuje izochrony bez Azure Maps ani dla lokalizacji nieznanej rejestrowi', async () => {
    vi.stubEnv('AZURE_MAPS_KEY', '');
    vi.stubEnv('VITE_AZURE_MAPS_KEY', '');

    await expect(calculateReachableRangeWithMobility({
      centerCity: 'Warszawa',
      timeBudgetMinutes: 30,
      trafficMode: 'smooth',
    })).rejects.toMatchObject({ statusCode: 501 });

    await expect(calculateReachableRangeWithMobility({
      centerCity: 'Miasto bez wpisu',
      timeBudgetMinutes: 30,
    })).rejects.toMatchObject({ statusCode: 501 });
  });

  it('szacuje czas transportu publicznego bez podszywania się pod trasę samochodową i jej koszty', async () => {
    vi.stubEnv('AZURE_MAPS_KEY', 'configured-but-not-used-for-transit');

    const result = await calculateRouteWithMobility({
      origin: 'Warszawa',
      destination: 'Pruszków',
      engineType: 'transit',
    });

    expect(result.source).toBe('local_deterministic');
    expect(result.trafficDataAvailable).toBe(false);
    expect(result.freeFlowMinutes).toBeGreaterThan(0);
    expect(result.energyConsumption).toBeNull();
  });

  it('używa czasu ruchu zwróconego przez Azure, gdy API jest skonfigurowane', async () => {
    vi.stubEnv('AZURE_MAPS_KEY', 'test-azure-maps-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{
          summary: {
            lengthInMeters: 12000,
            travelTimeInSeconds: 1500,
            noTrafficTravelTimeInSeconds: 900,
            trafficDelayInSeconds: 300,
          },
          legs: [{ points: [] }],
        }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await calculateRouteWithMobility({
      origin: 'Warszawa',
      destination: 'Pruszków',
      engineType: 'electric',
      trafficMode: 'peak',
    });

    expect(result.source).toBe('azure_maps');
    expect(result.trafficDataAvailable).toBe(true);
    expect(result.roadDistanceKm).toBe(12);
    expect(result.trafficDelayMinutes).toBe(10);
    expect(result.trafficMinutes).toBe(25);
    expect(result.energyConsumption).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get('computeTravelTimeFor')).toBe('all');
    expect(requestUrl.searchParams.get('traffic')).toBe('true');
    expect(requestUrl.searchParams.has('departAt')).toBe(false);
  });

  it('w trybie smooth pokazuje czas bez korków bez dopisywania zatoru', async () => {
    vi.stubEnv('AZURE_MAPS_KEY', 'test-azure-maps-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{
          summary: {
            lengthInMeters: 12000,
            travelTimeInSeconds: 1500,
            noTrafficTravelTimeInSeconds: 900,
            trafficDelayInSeconds: 300,
          },
          legs: [{ points: [] }],
        }],
      }),
    }));

    const result = await calculateRouteWithMobility({
      origin: 'Warszawa',
      destination: 'Pruszków',
      engineType: 'combustion',
      trafficMode: 'smooth',
    });

    expect(result.source).toBe('azure_maps');
    expect(result.trafficDataAvailable).toBe(true);
    expect(result.freeFlowMinutes).toBe(15);
    expect(result.trafficMinutes).toBe(15);
    expect(result.trafficDelayMinutes).toBe(0);
  });
});
