import { Request, Response, Router } from 'express';
import { PURCHASES_DISABLED_REASON } from '../../lib/betaConfig';

export const billingRouter = Router();

function paymentsUnavailable(res: Response): void {
  res.status(503).json({
    success: false,
    error: PURCHASES_DISABLED_REASON,
  });
}

/**
 * POST /api/billing/checkout-session
 *
 * W wersji bezpłatnej beta tworzenie sesji płatności jest bezwzględnie wyłączone.
 */
billingRouter.post(
  '/billing/checkout-session',
  async (_req: Request, res: Response) => {
    return paymentsUnavailable(res);
  }
);

/**
 * POST /api/billing/portal-session
 *
 * W wersji bezpłatnej beta portal zarządzania subskrypcjami komercyjnymi jest wyłączony.
 */
billingRouter.post(
  '/billing/portal-session',
  async (_req: Request, res: Response) => {
    return paymentsUnavailable(res);
  }
);

