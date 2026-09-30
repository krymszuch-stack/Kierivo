import { Router, Request, Response, NextFunction } from 'express';
import { standardApiLimiter } from '../middleware/rateLimiter';
import {
  calculateRouteWithMobility,
  calculateReachableRangeWithMobility,
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
  standardApiLimiter,
  async (req: Request<unknown, unknown, RouteCalculationParams>, res: Response, next: NextFunction) => {
    try {
      const { origin, destination, engineType, trafficMode } = req.body || {};

      if (!origin || typeof origin !== 'string' || !destination || typeof destination !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Podaj miejscowość początkową (origin) oraz docelową (destination).',
        });
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
  standardApiLimiter,
  async (req: Request<unknown, unknown, ReachableRangeParams>, res: Response, next: NextFunction) => {
    try {
      const { centerCity, timeBudgetMinutes = 45, trafficMode = 'peak' } = req.body || {};

      if (!centerCity || typeof centerCity !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Podaj miasto centralne (centerCity) do wyznaczenia zasięgu.',
        });
      }

      const budget = [30, 45, 60].includes(Number(timeBudgetMinutes))
        ? (Number(timeBudgetMinutes) as 30 | 45 | 60)
        : 45;

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
