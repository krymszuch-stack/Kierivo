import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAiOperation, reserveAiQuota, refundAiQuota, QuotaExceededError } from '../quota';
import * as supabaseModule from '../supabase';

vi.mock('../supabase');
vi.mock('../usageLedger', () => ({
  recordUsage: vi.fn(),
}));

describe('Atomic Quota Reservation & Refund', () => {
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();

  const mockSubscriptionsTable = (status: string | null) => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: status ? { status } : null, error: null }),
        };
      }
      throw new Error(`Nieoczekiwana tabela w teście: ${table}`);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionsTable('free');
    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue({
      rpc: mockRpc,
      from: mockFrom,
    } as any);
  });

  it('reserveAiQuota wywołuje RPC reserve_ai_quota z prawidłowymi parametrami', async () => {
    mockRpc.mockResolvedValueOnce({ data: { allowed: true, current_uses: 1 }, error: null });

    const res = await reserveAiQuota('user-123', 5);
    expect(mockRpc).toHaveBeenCalledWith('reserve_ai_quota', {
      p_user_id: 'user-123',
      p_max_daily_uses: 5,
    });
    expect(res).toEqual({ allowed: true, current_uses: 1 });
  });

  it('refundAiQuota wywołuje RPC refund_ai_quota z ID użytkownika', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    await refundAiQuota('user-123');
    expect(mockRpc).toHaveBeenCalledWith('refund_ai_quota', {
      p_user_id: 'user-123',
    });
  });

  it('executeAiOperation pomyślnie rezerwuje, wykonuje zadanie i zwraca wynik', async () => {
    mockRpc.mockResolvedValueOnce({ data: { allowed: true, current_uses: 1 }, error: null });

    const task = vi.fn().mockResolvedValueOnce({
      data: { success: true },
      usage: { promptTokens: 100, completionTokens: 50, model: 'gemini-2.5-flash-lite' },
    });

    const result = await executeAiOperation('user-123', 'test-context', task);

    expect(result).toEqual({ success: true });
    expect(task).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('reserve_ai_quota', {
      p_user_id: 'user-123',
      p_max_daily_uses: 25,
    });
  });

  it('w bezpłatnej becie historyczny plan opłacony nadal ma limit beta', async () => {
    mockSubscriptionsTable('active');
    mockRpc.mockResolvedValueOnce({ data: { allowed: true, current_uses: 1 }, error: null });

    await executeAiOperation(
      'user-pro',
      'test-context',
      vi.fn().mockResolvedValue({ data: { ok: true } })
    );

    expect(mockRpc).toHaveBeenCalledWith('reserve_ai_quota', {
      p_user_id: 'user-pro',
      p_max_daily_uses: 25,
    });
  });

  it('executeAiOperation rzuca QuotaExceededError gdy rezerwacja zostaje odrzucona', async () => {
    mockRpc.mockResolvedValueOnce({ data: { allowed: false, current_uses: 25 }, error: null });

    const task = vi.fn();

    await expect(executeAiOperation('user-123', 'test-context', task)).rejects.toThrow(
      QuotaExceededError
    );
    expect(task).not.toHaveBeenCalled();
  });

  it('executeAiOperation wykonuje refund_ai_quota w przypadku awarii zadania LLM', async () => {
    mockRpc.mockResolvedValueOnce({ data: { allowed: true, current_uses: 1 }, error: null });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const task = vi.fn().mockRejectedValueOnce(new Error('LLM Timeout'));

    await expect(executeAiOperation('user-123', 'test-context', task)).rejects.toThrow(
      'LLM Timeout'
    );

    expect(mockRpc).toHaveBeenLastCalledWith('refund_ai_quota', {
      p_user_id: 'user-123',
    });
  });
});
