/**
 * Narzędzie operacyjne zgłoszeń błędów klienta — dla człowieka, CLI i agentów.
 *
 * Podkomendy (alias npm w package.json):
 *   lista  [--limit N]              — ostatnie grupy błędów
 *   rozwiaz <fingerprint|all>       — oznacz przyczynę jako ustąpioną
 *   czysc   [--resolved-dni N] [--open-dni N] — retencja po ustąpieniu przyczyny
 *   bramka                          — bramka wdrożeniowa: exit 1 gdy są otwarte
 *   linear [--suche] [--limit N]    — synchronizacja grup z issue'ami Linear
 *
 * Zaplecze wybierane automatycznie: komplet SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * w środowisku → baza; w przeciwnym razie lokalny plik JSONL (CLIENT_ERRORS_LOCAL_FILE
 * albo logs/client-errors.jsonl). Bez żadnego zaplecza komenda mówi wprost,
 * że nie ma czego sprawdzać — nigdy nie udaje zielonego stanu.
 *
 * Linear (LINEAR_API_KEY): jedna grupa = jeden issue. Deduplikacja po fingerprintie
 * zapisanym w opisie; nawrót na zamkniętym issue otwiera go ponownie z komentarzem,
 * więc cykl „błąd → naprawa → regres" jest widoczny w jednym miejscu.
 */

import { countUnresolvedClientErrors, listErrorGroups, pruneClientErrors, setErrorStatus } from '../src/server/errorStore';
import type { ErrorGroup } from '../src/server/errorStore';

const LINEAR_GRAPHQL_ENDPOINT = 'https://api.linear.app/graphql';

function fail(message: string, exitCode = 1): never {
  console.error(`✗ ${message}`);
  process.exit(exitCode);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'lista':
      return void (await cmdLista(rest));
    case 'rozwiaz':
      return void (await cmdRozwiaz(rest));
    case 'czysc':
      return void (await cmdCzysc(rest));
    case 'bramka':
      return void (await cmdBramka(rest));
    case 'linear':
      return void (await cmdLinear(rest));
    default:
      console.log('Użycie: npm run bledy -- <lista|rozwiaz|czysc|bramka|linear> [opcje]');
      if (!command) process.exit(0);
      fail(`Nieznana podkomenda: ${command}`);
  }
}

// ---------------------------------------------------------------------------
// Wspólne
// ---------------------------------------------------------------------------

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function shortDate(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

function printGroups(groups: ErrorGroup[]): void {
  for (const group of groups) {
    const statusIcon = group.status === 'open' ? '✗' : group.status === 'triaged' ? '•' : '✓';
    console.log(
      `${statusIcon} [${group.status.toUpperCase().padEnd(8)}] ${group.fingerprint} ` +
        `${group.kind} · ${group.surface} · ${group.occurrences} wyst. · ost. ${shortDate(group.lastSeenAt)}` +
        (group.linearIssueUrl ? `\n        Linear: ${group.linearIssueUrl}` : '')
    );
    console.log(`        ${group.message}`);
  }
}

async function loadGroupsOrExplain(limit: number): Promise<{ mode: string; groups: ErrorGroup[] }> {
  try {
    return await listErrorGroups(limit);
  } catch {
    // Brak zaplecza to stan informacyjny (np. CI bez sekretów), nie awaria narzędzia.
    return { mode: 'brak', groups: [] };
  }
}

// ---------------------------------------------------------------------------
// lista
// ---------------------------------------------------------------------------

async function cmdLista(args: string[]): Promise<void> {
  const limit = Number(flagValue(args, '--limit') ?? 30);
  const { mode, groups } = await loadGroupsOrExplain(limit);

  if (mode === 'brak') {
    console.log('Brak skonfigurowanego zaplecza (SUPABASE_URL/SERVICE_ROLE albo plik JSONL). Nie ma czego listować.');
    return;
  }
  console.log(`Zaplecze: ${mode}; grup: ${groups.length}`);
  printGroups(groups);
}

// ---------------------------------------------------------------------------
// rozwiaz
// ---------------------------------------------------------------------------

async function cmdRozwiaz(args: string[]): Promise<void> {
  const target = args.find((arg) => !arg.startsWith('--'));
  if (!target) fail('Podaj fingerprint grupy albo "all". Lista: npm run bledy -- lista');

  try {
    const changed = await setErrorStatus(target, 'resolved');
    console.log(`✓ Oznaczono jako resolved: ${changed} grup(a).`);
    console.log('  Retencja usunie je po oknie resolved-dni (`npm run bledy:czysc`).');
  } catch (error) {
    fail(`Nie udało się oznaczyć: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// czysc
// ---------------------------------------------------------------------------

async function cmdCzysc(args: string[]): Promise<void> {
  const policy = {
    resolvedDays: Number(flagValue(args, '--resolved-dni') ?? 14),
    openDays: Number(flagValue(args, '--open-dni') ?? 90),
  };

  try {
    const { removed, mode } = await pruneClientErrors(policy);
    console.log(`✓ Usunięto ${removed} grup (zaplecze: ${mode}); polityka: resolved>${policy.resolvedDays} dni, open nietykane>${policy.openDays} dni.`);
  } catch (error) {
    fail(`Retencja nie powiodła się: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// bramka — krok CI / agent przy każdym wdrożeniu
// ---------------------------------------------------------------------------

async function cmdBramka(args: string[]): Promise<void> {
  const required = hasFlag(args, '--required');
  try {
    const { mode, count } = await countUnresolvedClientErrors();
    if (hasFlag(args, '--cloud') && mode !== 'cloud') {
      console.log('UNKNOWN: wymagane źródło chmurowe; lokalny plik nie dowodzi stanu produkcji.');
      process.exitCode = 2;
      return;
    }
    console.log(`${count === 0 ? 'PASS' : 'FAIL'}: ${count} otwartych grup błędów klienta; źródło: ${mode}. Wynik dotyczy wyłącznie odczytanego źródła.`);
    process.exitCode = count === 0 ? 0 : 1;
  } catch (error) {
    const absent = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    const skipped = absent && !required;
    console.log(`${skipped ? 'SKIPPED' : 'UNKNOWN'}: źródło zgłoszeń niedostępne lub nieprawidłowe; brak dowodu stanu produktu.`);
    process.exitCode = skipped ? 0 : 2;
  }
}

// ---------------------------------------------------------------------------
// linear — jedna grupa = jeden issue, deduplikacja po fingerprintzie
// ---------------------------------------------------------------------------

interface LinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  updatedAt: string;
  url: string;
  state: { type: string; name: string };
}

async function linearRequest<T>(apiKey: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Linear HTTP ${response.status}`);
  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(`Linear: ${json.errors.map((e) => e.message).join('; ')}`);
  if (!json.data) throw new Error('Linear zwrócił pustą odpowiedź.');
  return json.data;
}

/** Fingerprint jest unikalnym tokenem deduplikacji — musi być w opisie w całości. */
async function findIssueByFingerprint(apiKey: string, fingerprint: string): Promise<LinearIssueNode | null> {
  const data = await linearRequest<{ issueSearch: { nodes: LinearIssueNode[] } }>(
    apiKey,
    'query ($term: String!) { issueSearch(term: $term, first: 10) { nodes { id identifier title description updatedAt url state { type name } } } }',
    { term: fingerprint }
  );
  return (
    data.issueSearch.nodes.find((node) => (node.description ?? '').includes(fingerprint)) ?? null
  );
}

function issueBody(group: ErrorGroup): string {
  const lines = [
    '## Zgłoszenie błędu klienta (anonimizowane)',
    '',
    `- **Fingerprint:** \`${group.fingerprint}\` ← token deduplikacji, nie zmieniaj`,
    `- **Rodzaj:** \`${group.kind}\` · **Miejsce:** \`${group.surface}\``,
    `- **Wystąpienia:** ${group.occurrences} · **Pierwsze:** ${shortDate(group.firstSeenAt)} · **Ostatnie:** ${shortDate(group.lastSeenAt)}`,
    `- **Środowisko:** ${group.env ?? '?'} · **Przeglądarka:** ${group.uaFamily ?? '?'} · **Ekran:** ${group.viewportBucket ?? '?'}`,
    '',
    '### Komunikat po sanityzacji',
    '```',
    group.message,
    '```',
    '',
    '_Zgłoszenie nie zawiera danych użytkownika — treść przeszła sanityzację u źródła._',
    `_Aktualizacja licznika: \`npm run bledy:linear\`_`,
  ];
  return lines.join('\n');
}

function priorityFor(group: ErrorGroup): number {
  // Skala Linear: 1 = Urgent … 4 = Low.
  return group.kind === 'ui-crash' || group.kind === 'cv-export' ? 2 : 3;
}

async function resolveTeamId(apiKey: string): Promise<string> {
  const teamKey = process.env.LINEAR_TEAM_KEY?.trim();
  const data = await linearRequest<{ teams: { nodes: Array<{ id: string; key: string; name: string }> } }>(
    apiKey,
    '{ teams { nodes { id key name } } }',
    {}
  );
  const teams = data.teams.nodes;
  if (teams.length === 0) throw new Error('Klucz Linear nie ma dostępu do żadnego zespołu.');
  const chosen = (teamKey && teams.find((team) => team.key === teamKey)) || teams[0];
  return chosen.id;
}

async function startedStateId(apiKey: string, teamId: string): Promise<string | null> {
  const data = await linearRequest<{
    team: { states: { nodes: Array<{ id: string; type: string }> } };
  }>(
    apiKey,
    'query ($teamId: String!) { team(id: $teamId) { states(filter: { type: { eq: "started" } }) { nodes { id type } } } }',
    { teamId }
  );
  return data.team.states.nodes[0]?.id ?? null;
}

async function cmdLinear(args: string[]): Promise<void> {
  const dryRun = hasFlag(args, '--suche');
  const limit = Number(flagValue(args, '--limit') ?? 30);
  const apiKey = process.env.LINEAR_API_KEY?.trim();

  if (!apiKey) {
    console.error('Pomijam synchronizację z Linear: brak LINEAR_API_KEY w środowisku.');
    process.exit(2);
  }

  const { mode, groups } = await loadGroupsOrExplain(limit);
  if (mode === 'brak') fail('Brak zaplecza zgłoszeń — nie ma czego synchronizować.');

  let created = 0;
  let updated = 0;
  let reopened = 0;

  for (const group of groups) {
    if (group.status === 'resolved') continue;

    try {
      const existing = await findIssueByFingerprint(apiKey, group.fingerprint);

      if (!existing) {
        if (dryRun) {
          console.log(`[suche] utworzyłby issue: ${group.fingerprint} (${group.kind} · ${group.surface})`);
          continue;
        }
        const teamId = await resolveTeamId(apiKey);
        const data = await linearRequest<{
          issueCreate: { success: boolean; issue: { identifier: string; url: string } };
        }>(
          apiKey,
          'mutation ($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { identifier url } } }',
          {
            input: {
              teamId,
              title: `[BŁĄD] ${group.kind} · ${group.surface} · ${group.fingerprint.slice(0, 8)}`,
              description: issueBody(group),
              priority: priorityFor(group),
            },
          }
        );
        created += 1;
        console.log(`+ utworzono ${data.issueCreate.issue.identifier}: ${group.fingerprint}`);
        await setErrorStatus(group.fingerprint, 'triaged').catch(() => undefined);
      } else if (['completed', 'canceled'].includes(existing.state.type)) {
        if (dryRun) {
          console.log(`[suche] otworzyłby ponownie ${existing.identifier}: nawrót ${group.fingerprint}`);
          continue;
        }
        const teamId = await resolveTeamId(apiKey);
        const stateId = await startedStateId(apiKey, teamId);
        await linearRequest(
          apiKey,
          'mutation ($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }',
          { id: existing.id, input: stateId ? { stateId } : {} }
        );
        await linearRequest(
          apiKey,
          'mutation ($input: CommentCreateInput!) { commentCreate(input: $input) { success } }',
          {
            input: {
              issueId: existing.id,
              body: `**Nawrót po zamknięciu.** Błąd wrócił (${group.occurrences} wystąpień łącznie, ostatnio ${shortDate(group.lastSeenAt)}) — naprawa była nietrwała.`,
            },
          }
        );
        reopened += 1;
        console.log(`↻ ponownie otwarto ${existing.identifier}: ${group.fingerprint}`);
      } else if (new Date(group.lastSeenAt) > new Date(existing.updatedAt)) {
        if (dryRun) {
          console.log(`[suche] dopisałby komentarz w ${existing.identifier}: +${group.occurrences} wyst.`);
          continue;
        }
        await linearRequest(
          apiKey,
          'mutation ($input: CommentCreateInput!) { commentCreate(input: $input) { success } }',
          {
            input: {
              issueId: existing.id,
              body: `Nadal występuje: **${group.occurrences}** wystąpień, ostatnio ${shortDate(group.lastSeenAt)} (\`${group.env ?? '?'}\`, ${group.uaFamily ?? '?'}).`,
            },
          }
        );
        updated += 1;
        console.log(`~ zaktualizowano ${existing.identifier}: ${group.fingerprint}`);
      }
    } catch (error) {
      console.error(`! pominięto ${group.fingerprint}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\nLinear: utworzono ${created}, zaktualizowano ${updated}, ponownie otwarto ${reopened}${dryRun ? ' (tryb suche)' : ''}.`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
