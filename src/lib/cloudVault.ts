import { MasterVault } from '../types';
import { cloudVaultOutboxKeyFor, cloudVaultRevisionKeyFor } from './cloudVaultKeys';
import { getSupabaseBrowserClient } from './supabaseClient';
import { readJson } from './storage';
import { migrateVault } from './dataMigration';

/**
 * Vault w chmurze — odczyt i zapis wprost z przeglądarki.
 *
 * **Dlaczego nie przez `PUT /api/vault`, skoro ta trasa istnieje.** Pod
 * Stara instalacja frontendowa na Firebase Hosting miała następującą regułę:
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

const TABELA = 'vaults';

interface PendingVaultEnvelope {
  ownerId: string;
  conflict?: boolean;
  baseUpdatedAt?: string | null;
  vault: MasterVault;
}

export interface CloudVaultFetchResult {
  vault: MasterVault | null;
  /** False means a local pending copy was returned without confirming the remote base. */
  remoteReadSucceeded: boolean;
  remoteUpdatedAt: string | null;
  /**
   * Konflikt CAS nie ma wspólnej bazy do bezpiecznego automatycznego scalania.
   * W takim przypadku `vault` zachowuje pending lokalny, a wersja chmurowa
   * udostępniana jest osobno do jawnego rozstrzygnięcia.
   */
  pendingConflict: boolean;
  conflictRemoteVault?: MasterVault | null;
}

export class CloudVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudVaultError';
  }
}

export class CloudVaultConflictError extends CloudVaultError {
  constructor() {
    super('CV zmieniło się na innym urządzeniu. Lokalna kopia została zachowana; odczytaj aktualny stan konta przed kolejną synchronizacją.');
    this.name = 'CloudVaultConflictError';
  }
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new CloudVaultError('Konta w chmurze nie są skonfigurowane w tej instalacji.');
  }
  return supabase;
}

function pendingEnvelopeFor(ownerId: string): PendingVaultEnvelope | null {
  const pending = readJson<PendingVaultEnvelope | null>(cloudVaultOutboxKeyFor(ownerId), null);
  return pending?.ownerId === ownerId && pending.vault
    ? {
        ...pending,
        baseUpdatedAt: pending.baseUpdatedAt !== undefined
          ? pending.baseUpdatedAt
          : readJson<string | null>(cloudVaultRevisionKeyFor(ownerId), null),
        vault: migrateVault(pending.vault),
      }
    : null;
}

/**
 * Vault zalogowanego użytkownika albo `null`, gdy konto jest świeże.
 *
 * Jeżeli dla tego samego właściciela istnieje trwały, jeszcze niepotwierdzony
 * zapis, odczyt uwzględnia go jako najnowszą lokalną warstwę. Przy braku sieci
 * sama ta wersja wystarcza do odtworzenia pracy po ponownym otwarciu aplikacji.
 */
export async function fetchCloudVault(expectedOwnerId?: string): Promise<CloudVaultFetchResult> {
  const supabase = client();
  const { data: sessionData } = await supabase.auth.getSession();
  const ownerId = sessionData.session?.user?.id;

  if (!ownerId) throw new CloudVaultError('Brak aktywnej sesji — zaloguj się ponownie.');
  if (expectedOwnerId && ownerId !== expectedOwnerId) {
    throw new CloudVaultError('Sesja zmieniła właściciela przed odczytem danych.');
  }

  const pendingEnvelope = pendingEnvelopeFor(ownerId);
  const pending = pendingEnvelope?.vault ?? null;
  const { data, error } = await supabase.from(TABELA).select('data, updated_at').maybeSingle();
  const { data: confirmationData } = await supabase.auth.getSession();
  if (expectedOwnerId && confirmationData.session?.user?.id !== expectedOwnerId) {
    throw new CloudVaultError('Sesja zmieniła właściciela podczas odczytu danych.');
  }

  // Brak sieci nie odbiera dostępu do ostatniej niedostarczonej wersji. Jeśli
  // pending nie istnieje, błąd pozostaje błędem i wywołujący pokaże komunikat.
  if (error) {
    if (pending) {
      return {
        vault: pending,
        remoteReadSucceeded: false,
        remoteUpdatedAt: null,
        pendingConflict: pendingEnvelope?.conflict === true,
      };
    }
    throw new CloudVaultError(`Nie udało się odczytać CV z chmury: ${error.message}`);
  }

  const rawRemote = (data?.data as MasterVault | undefined) ?? null;
  const remote = rawRemote ? migrateVault(rawRemote) : null;
  const remoteUpdatedAt = typeof data?.updated_at === 'string' ? data.updated_at : null;
  if (!pending) {
    return { vault: remote, remoteReadSucceeded: true, remoteUpdatedAt, pendingConflict: false };
  }
  const pendingIsBasedOnCurrentRemote = pendingEnvelope?.baseUpdatedAt === remoteUpdatedAt;
  if (pendingEnvelope?.conflict || !pendingIsBasedOnCurrentRemote) {
    // Outbox zna tylko numer rewizji, nie pełną wspólną bazę. Nawet gdy wpisy
    // nie mają tego samego klucza, sumowanie list mogłoby cofnąć usunięcie
    // umiejętności lub projektu wykonane offline.
    return {
      vault: pending,
      remoteReadSucceeded: true,
      remoteUpdatedAt,
      pendingConflict: true,
      conflictRemoteVault: remote,
    };
  }
  // Gdy rewizja jest identyczna, zdalny snapshot nie zmienił się od chwili
  // powstania pendingu. Lokalna wersja jest kompletnym następcą, także dla
  // usunięć i pustych pól; merge przez unię nie byłby odwracalny.
  return { vault: pending, remoteReadSucceeded: true, remoteUpdatedAt, pendingConflict: false };
}

/**
 * Zapisuje cały vault i potwierdza, że aktywna sesja nadal należy do właściciela
 * kolejki, która zleciła zapis. To odcina wyścig logout/login: zapis Alicji nie
 * może po zmianie sesji trafić do wiersza Boba tylko dlatego, że Promise ruszył
 * chwilę później.
 *
 * Zapis wymaga rewizji odczytanej z chmury. Porównanie odbywa się w tym samym
 * atomowym UPDATE, który zapisuje JSONB; sprawdzenie wyłącznie w JS nie zamknęłoby
 * wyścigu między dwoma urządzeniami.
 */
export async function saveCloudVault(
  vault: MasterVault,
  expectedOwnerId: string,
  expectedUpdatedAt: string | null
): Promise<{ updatedAt: string }> {
  const supabase = client();
  const { data: sesja } = await supabase.auth.getSession();
  const userId = sesja.session?.user?.id;

  if (!userId) throw new CloudVaultError('Brak aktywnej sesji — zaloguj się ponownie.');
  if (expectedOwnerId && userId !== expectedOwnerId) {
    throw new CloudVaultError('Sesja zmieniła właściciela przed potwierdzeniem zapisu.');
  }

  const normalizedVault = migrateVault(vault);

  const updatedAt = new Date().toISOString();
  const payload = {
    user_id: userId,
    data: normalizedVault,
    version: normalizedVault.version,
    updated_at: updatedAt,
  };

  if (expectedUpdatedAt === null) {
    // INSERT rozstrzyga atomowo wyścig dwóch nowych urządzeń. Unikalny klucz
    // user_id sprawia, że drugie urządzenie dostaje konflikt, nie nadpisanie.
    const { data, error } = await supabase.from(TABELA).insert(payload).select('updated_at').single();
    if (error?.code === '23505') throw new CloudVaultConflictError();
    if (error) throw new CloudVaultError(`Nie udało się zapisać CV w chmurze: ${error.message}`);
    return { updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : updatedAt };
  }

  // Filtr po odczytanej rewizji to compare-and-swap po stronie Postgresa.
  // Samo porównanie w JS byłoby podatne na dokładnie ten sam wyścig.
  const { data, error } = await supabase
    .from(TABELA)
    .update({ data: payload.data, version: payload.version, updated_at: updatedAt })
    .eq('user_id', userId)
    .eq('updated_at', expectedUpdatedAt)
    .select('updated_at')
    .maybeSingle();

  if (!error && !data) throw new CloudVaultConflictError();
  if (error) throw new CloudVaultError(`Nie udało się zapisać CV w chmurze: ${error.message}`);
  return { updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : updatedAt };
}
