import { Router, Request, Response, NextFunction } from 'express';
import { mobilityEndpointsLimiter } from '../middleware/rateLimiter';
import {
  calculateRouteWithMobility,
  calculateReachableRangeWithMobility,
  MobilityValidationError,
  RouteCalculationParams,
  ReachableRangeParams,
} from '../services/azureMaps.service';

export const mobilityRouter = Router();

/**
 * POST /api/mobility/route
 *
 * Wylicza realną trasę, profil drogowy, czas w korkach i spalanie/zużycie prądu
 * na podstawie Azure Maps z bezpiecznym fallbackiem deterministycznym.
 */
mobilityRouter.post(
  '/mobility/route',
  mobilityEndpointsLimiter,
  async (req: Request<unknown, unknown, RouteCalculationParams>, res: Response, next: NextFunction) => {
    try {
      const { origin, destination, engineType, trafficMode } = req.body || {};

      if (!origin || typeof origin !== 'string' || !destination || typeof destination !== 'string') {
        throw new MobilityValidationError('Podaj miejscowość początkową (origin) oraz docelową (destination).');
      }

      if (!origin.trim() || !destination.trim()) {
        throw new MobilityValidationError('Lokalizacje nie mogą być puste.');
      }
      if (engineType !== undefined && !['combustion', 'electric', 'transit'].includes(engineType)) {
        throw new MobilityValidationError('Nieobsługiwany rodzaj transportu.');
      }
      if (trafficMode !== undefined && !['peak', 'smooth'].includes(trafficMode)) {
        throw new MobilityValidationError('Wybierz tryb ruchu: peak albo smooth.');
      }

      const result = await calculateRouteWithMobility({
        origin: origin.trim(),
        destination: destination.trim(),
        engineType: engineType || 'combustion',
        trafficMode: trafficMode || 'peak',
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/mobility/range
 *
 * Wylicza izochronę (Reachable Range) obszaru dojazdu w 30/45/60 minut
 * w godzinach szczytu.
 */
mobilityRouter.post(
  '/mobility/range',
  mobilityEndpointsLimiter,
  async (req: Request<unknown, unknown, ReachableRangeParams>, res: Response, next: NextFunction) => {
    try {
      const { centerCity, timeBudgetMinutes = 45, trafficMode = 'peak' } = req.body || {};

      if (!centerCity || typeof centerCity !== 'string') {
        throw new MobilityValidationError('Podaj miasto centralne (centerCity) do wyznaczenia zasięgu.');
      }

      if (!centerCity.trim()) {
        throw new MobilityValidationError('Miasto centralne nie może być puste.');
      }

      if (timeBudgetMinutes !== undefined && ![30, 45, 60].includes(Number(timeBudgetMinutes))) {
        throw new MobilityValidationError('Czas zasięgu musi wynosić 30, 45 albo 60 minut.');
      }
      if (trafficMode !== undefined && !['peak', 'smooth'].includes(trafficMode)) {
        throw new MobilityValidationError('Wybierz tryb ruchu: peak albo smooth.');
      }

      const budget = (Number(timeBudgetMinutes ?? 45) as 30 | 45 | 60);

      const result = await calculateReachableRangeWithMobility({
        centerCity: centerCity.trim(),
        timeBudgetMinutes: budget,
        trafficMode: trafficMode === 'smooth' ? 'smooth' : 'peak',
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);
