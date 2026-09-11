import { MasterVault } from '../types';
import { getSupabaseBrowserClient } from './supabaseClient';

/**
 * Vault w chmurze — odczyt i zapis wprost z przeglądarki.
 *
 * **Dlaczego nie przez `PUT /api/vault`, skoro ta trasa istnieje.** Pod
 * `cvelocity.oathcry.com` stoi sam frontend na Firebase Hosting: reguła
 * przepisująca oddaje `index.html` na każdą ścieżkę, więc `/api/*` na
 * produkcji nie istnieje. Serwer Express czeka na wdrożenie kontenerowe
 * opisane w `docs/BACKEND-ROADMAP.md`, a to wymaga karty płatniczej, czyli
 * rzeczy odłożonej na koniec kolejki. Kanał przez klienta `anon` działa na
 * dzisiejszym wdrożeniu, bez serwera i bez grosza.
 *
 * **Dlaczego to jest bezpieczne.** Klucz `anon` jest publiczny z definicji —
 * chroni go RLS, a nie utajnienie. Polityki na tabeli `vaults`
 * (`supabase/migrations/0001_init.sql:67-74`) przepuszczają wyłącznie wiersz,
 * w którym `auth.uid() = user_id`, a `scripts/test-rls.mjs` sprawdza to wprost:
 * Bob nie widzi vaultu Alicji. To jest dokładnie ten mechanizm, dla którego RLS
 * powstało — inaczej niż klucz `service_role` po stronie serwera, który RLS
 * omija i dlatego musi sam pilnować `user_id`.
 */

/** Ta sama tabela, z której korzysta `src/server/routes/vault.routes.ts`. */
const TABELA = 'vaults';

export class CloudVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudVaultError';
  }
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new CloudVaultError('Konta w chmurze nie są skonfigurowane w tej instalacji.');
  }
  return supabase;
}

/**
 * Vault zalogowanego użytkownika albo `null`, gdy konto jest świeże.
 *
 * Brak wiersza to **normalny stan nowego konta, nie błąd** — tak samo jak
 * w `GET /api/vault`, które z tego samego powodu zwraca 200 z `vault: null`,
 * a nie 404.
 */
export async function fetchCloudVault(): Promise<MasterVault | null> {
  const { data, error } = await client().from(TABELA).select('data').maybeSingle();

  if (error) throw new CloudVaultError(`Nie udało się odczytać CV z chmury: ${error.message}`);
  return (data?.data as MasterVault | undefined) ?? null;
}

/**
 * Zapisuje cały vault i potwierdza, że aktywna sesja nadal należy do właściciela
 * kolejki, która zleciła zapis. To odcina wyścig logout/login: zapis Alicji nie
 * może po zmianie sesji trafić do wiersza Boba tylko dlatego, że Promise ruszył
 * chwilę później.
 */
export async function saveCloudVault(
  vault: MasterVault,
  expectedOwnerId?: string
): Promise<void> {
  const supabase = client();
  const { data: sesja } = await supabase.auth.getSession();
  const userId = sesja.session?.user?.id;

  if (!userId) throw new CloudVaultError('Brak aktywnej sesji — zaloguj się ponownie.');
  if (expectedOwnerId && userId !== expectedOwnerId) {
    throw new CloudVaultError('Sesja zmieniła właściciela przed potwierdzeniem zapisu.');
  }

  const { error } = await supabase.from(TABELA).upsert(
    {
      user_id: userId,
      data: vault,
      version: vault.version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw new CloudVaultError(`Nie udało się zapisać CV w chmurze: ${error.message}`);
}
