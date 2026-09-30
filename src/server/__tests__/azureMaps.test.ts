import { describe, it, expect } from 'vitest';
import {
  calculateRouteWithMobility,
  calculateReachableRangeWithMobility,
} from '../services/azureMaps.service';

describe('azureMaps.service (Mobility Intelligence)', () => {
  it('wylicza trasę drogową w trybie fallback lokalnego rejestru (Warszawa -> Pruszków)', async () => {
    const res = await calculateRouteWithMobility({
      origin: 'Warszawa',
      destination: 'Pruszków',
      engineType: 'combustion',
      trafficMode: 'smooth',
    });

    expect(res.source).toBe('local_deterministic');
    expect(res.roadDistanceKm).toBeGreaterThan(10);
    expect(res.freeFlowMinutes).toBeGreaterThan(10);
    expect(res.energyConsumption.unit).toBe('liters');
    expect(res.energyConsumption.costMonthlyPln).toBeGreaterThan(0);
  });

  it('uwzględnia narzut korków porannego szczytu w trybie peak', async () => {
    const smoothRes = await calculateRouteWithMobility({
      origin: 'Warszawa',
      destination: 'Pruszków',
      trafficMode: 'smooth',
    });

    const peakRes = await calculateRouteWithMobility({
      origin: 'Warszawa',
      destination: 'Pruszków',
      trafficMode: 'peak',
    });

    expect(peakRes.trafficMinutes).toBeGreaterThan(smoothRes.freeFlowMinutes);
    expect(peakRes.trafficDelayMinutes).toBeGreaterThan(0);
  });

  it('przełącza jednostkę na kWh dla silnika elektrycznego EV', async () => {
    const res = await calculateRouteWithMobility({
      origin: 'Warszawa',
      destination: 'Piaseczno',
      engineType: 'electric',
    });

    expect(res.energyConsumption.unit).toBe('kWh');
    expect(res.energyConsumption.amountPerOneWay).toBeGreaterThan(0);
  });

  it('generuje wielokąt izochrony zasięgu dojazdu w 30 minut', async () => {
    const range = await calculateReachableRangeWithMobility({
      centerCity: 'Warszawa',
      timeBudgetMinutes: 30,
      trafficMode: 'smooth',
    });

    expect(range.boundaryPoints.length).toBeGreaterThan(10);
    expect(range.timeBudgetMinutes).toBe(30);
    expect(range.approxAreaKm2).toBeGreaterThan(100);
    expect(range.center.lat).toBeCloseTo(52.23, 1);
  });
});
