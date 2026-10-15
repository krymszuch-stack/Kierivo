import { afterEach, describe, expect, it, vi } from 'vitest';
import { countUnresolvedClientErrors } from '../errorStore';
import * as config from '../config';
import * as supabase from '../supabase';

afterEach(() => vi.restoreAllMocks());

describe('bramka zgłoszeń — źródło chmurowe', () => {
  it.each([
    { count: 101, error: null },
    { count: 0, error: null },
  ])('liczy wszystkie nierozwiązane grupy: $count', async result => {
    vi.spyOn(config, 'loadConfig').mockReturnValue({ backendEnabled: true } as ReturnType<typeof config.loadConfig>);
    const inFilter = vi.fn().mockResolvedValue(result);
    const select = vi.fn(() => ({ in: inFilter }));
    const from = vi.fn(() => ({ select }));
    vi.spyOn(supabase, 'getSupabase').mockReturnValue({ from } as unknown as ReturnType<typeof supabase.getSupabase>);
    expect(await countUnresolvedClientErrors()).toEqual({ mode: 'cloud', count: result.count });
    expect(from).toHaveBeenCalledWith('client_errors');
    expect(select).toHaveBeenCalledWith('fingerprint', { count: 'exact', head: true });
    expect(inFilter).toHaveBeenCalledWith('status', ['open', 'triaged']);
  });
  it.each([{ count: null, error: null }, { count: 0, error: { message: 'awaria' } }])('odmawia potwierdzenia przy błędzie lub braku count', async result => {
    vi.spyOn(config, 'loadConfig').mockReturnValue({ backendEnabled: true } as ReturnType<typeof config.loadConfig>);
    vi.spyOn(supabase, 'getSupabase').mockReturnValue({ from: () => ({ select: () => ({ in: async () => result }) }) } as unknown as ReturnType<typeof supabase.getSupabase>);
    await expect(countUnresolvedClientErrors()).rejects.toThrow('Nie udało się policzyć');
  });
});
