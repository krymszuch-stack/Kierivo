import { NextFunction, Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { validateBody } from '../middleware/validate';
import { vaultPayloadSchema, type VaultPayload } from '../../types/contracts';
import { getSupabase } from '../supabase';

export const vaultRouter = Router();

/**
 * GET /api/vault
 *
 * Brak zapisanego vaultu to normalny stan nowego konta, nie błąd — stąd 200
 * z `vault: null`, a nie 404. Klient i tak musi wtedy pokazać pusty formularz.
 */
vaultRouter.get('/vault', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await getSupabase()
      .from('vaults')
      .select('data, version, updated_at')
      .eq('user_id', req.user!.id)
      .maybeSingle();

    if (error) throw new Error(`Nie udało się odczytać profilu: ${error.message}`);

    res.json({
      success: true,
      vault: data?.data ?? null,
      updatedAt: data?.updated_at ?? null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/vault
 *
 * Zapis całości, nie zmiana przyrostowa. `expectedUpdatedAt` jest rewizją
 * zwróconą przez GET; warunek aktualizacji musi zostać wykonany w bazie, bo
 * porównanie przed żądaniem nie zamknęłoby wyścigu dwóch urządzeń.
 *
 * `user_id` pochodzi wyłącznie z tokenu. Klient `service_role` omija RLS, więc
 * gdyby brać go z ciała żądania, wystarczyłoby podmienić jedno pole, żeby
 * nadpisać cudze CV.
 */
vaultRouter.put(
  '/vault',
  requireAuth,
  validateBody(vaultPayloadSchema),
  async (req: Request<unknown, unknown, VaultPayload>, res: Response, next: NextFunction) => {
    try {
      const { vault, expectedUpdatedAt } = req.body;
      const supabase = getSupabase();
      const updatedAt = new Date().toISOString();
      const row = {
        user_id: req.user!.id,
        data: vault,
        version: vault.version,
        updated_at: updatedAt,
      };

      if (expectedUpdatedAt === null) {
        const { data, error } = await supabase.from('vaults').insert(row).select('updated_at').single();
        if (error?.code === '23505') {
          return next(Object.assign(new Error('CV zmieniło się na innym urządzeniu. Odczytaj aktualną wersję przed zapisem.'), {
            status: 409,
            expose: true,
          }));
        }
        if (error) throw new Error(`Nie udało się zapisać profilu: ${error.message}`);
        return res.json({ success: true, updatedAt: data?.updated_at ?? updatedAt });
      }

      const { data, error } = await supabase
        .from('vaults')
        .update({ data: row.data, version: row.version, updated_at: updatedAt })
        .eq('user_id', req.user!.id)
        .eq('updated_at', expectedUpdatedAt)
        .select('updated_at')
        .maybeSingle();

      if (error) throw new Error(`Nie udało się zapisać profilu: ${error.message}`);
      if (!data) {
        return next(Object.assign(new Error('CV zmieniło się na innym urządzeniu. Odczytaj aktualną wersję przed zapisem.'), {
          status: 409,
          expose: true,
        }));
      }

      return res.json({ success: true, updatedAt: data.updated_at ?? updatedAt });
    } catch (err) {
      next(err);
    }
  }
);
