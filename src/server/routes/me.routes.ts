import { NextFunction, Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { getEntitlements } from '../quota';
import { getSupabase } from '../supabase';

export const meRouter = Router();

/**
 * GET /api/me
 *
 * Profil i **prawdziwy** stan uprawnień. Interfejs trzyma własną kopię tych
 * liczb w `localStorage`, żeby licznik reagował natychmiast, ale to jest ta
 * odpowiedź, która rozstrzyga. Stąd wywołanie po zalogowaniu i po powrocie
 * z bramki płatności — status subskrypcji potwierdza webhook Stripe'a, a nie
 * powrót użytkownika pod adres z `?checkout=success`, który da się wpisać ręcznie.
 */
meRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabase();

    const [profileResult, entitlements] = await Promise.all([
      supabase
        .from('profiles')
        .select('display_name, created_at, plan_expires_at')
        .eq('id', userId)
        .maybeSingle(),
      getEntitlements(userId),
    ]);

    // W bezpłatnej wersji beta podstawowy przepływ testera nie wymaga płatnego karnetu:
    // dostęp do narzędzi jest odblokowany bez opłat, a serwer nadal egzekwuje dobowe limity AI.
    const expiresAt = profileResult.data?.plan_expires_at;
    const hasActivePass =
      (typeof expiresAt === 'string' && new Date(expiresAt).getTime() > Date.now()) || true;

    res.json({
      success: true,
      user: {
        id: userId,
        email: req.user!.email,
        displayName: profileResult.data?.display_name ?? null,
        createdAt: profileResult.data?.created_at ?? null,
      },
      ...entitlements,
      hasActivePass,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/me
 *
 * Usunięcie konta wraz ze wszystkimi danymi (RODO art. 17).
 *
 * Sprzątanie robi funkcja `delete_user_data` w bazie, a nie ciąg wywołań
 * stąd — inaczej każda nowa tabela wymagałaby pamiętania o dopisaniu jej tutaj,
 * a „usuń moje dane", które czegoś nie usuwa, jest gorsze niż brak takiej
 * funkcji. Ten sam błąd zdarzył się już w wersji przeglądarkowej.
 *
 * `ai_usage_events` celowo przeżywa usunięcie konta z wyzerowanym `user_id`:
 * koszt wywołań musi zostać w rozliczeniach, ale wiersz przestaje wtedy być
 * daną osobową.
 */
meRouter.delete('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const supabase = getSupabase();

    const { error: dataError } = await supabase.rpc('delete_user_data', { p_user: userId });
    if (dataError) throw new Error(`Nie udało się usunąć danych użytkownika: ${dataError.message}`);

    // Samo konto na końcu: gdyby poszło pierwsze, a sprzątanie danych zawiodło,
    // zostałyby osierocone wiersze bez możliwości zalogowania się i powtórzenia.
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) throw new Error(`Nie udało się usunąć konta: ${authError.message}`);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
