-- ADR-152: wyścig pierwszych równoległych rezerwacji AI.
-- Zastępuje istniejącą funkcję bez zmiany tabel, danych i przyznanych uprawnień.
-- CREATE OR REPLACE zachowuje ACL istniejącej funkcji; brak GRANT/REVOKE.
-- Regresja: scripts/test-rls.mjs, dziesięć żądań nowego konta, dokładnie 5/5.

create or replace function public.reserve_ai_quota(
    p_user_id uuid,
    p_max_daily_uses integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_quota public.user_quotas%rowtype;
begin
    -- SELECT FOR UPDATE nie blokuje nieistniejącego wiersza. Równoległe
    -- pierwsze żądania muszą najpierw uzgodnić jeden wiersz przez unikalny
    -- user_id, a dopiero potem serializować rezerwację pod jego blokadą.
    insert into public.user_quotas (user_id, ai_uses_count, daily_reset_date, karnet_ai_pool)
    values (p_user_id, 0, current_date, 0)
    on conflict (user_id) do nothing;

    select * into v_quota
    from public.user_quotas
    where user_id = p_user_id
    for update;

    -- 3. Sprawdź, czy użytkownik ma aktywny karnet z pulą kredytów
    if v_quota.karnet_expires_at is not null and v_quota.karnet_expires_at > now() then
        if v_quota.karnet_ai_pool > 0 then
            update public.user_quotas
            set karnet_ai_pool = karnet_ai_pool - 1,
                updated_at = now()
            where user_id = p_user_id;

            return jsonb_build_object('allowed', true, 'pool_left', v_quota.karnet_ai_pool - 1, 'type', 'KARNET');
        else
            return jsonb_build_object(
                'allowed', false,
                'reason', 'KARNET_POOL_EXHAUSTED',
                'message', 'Wykorzystano 30 wywołań AI z karnetu. Nielimitowane eksporty DOCX/PDF pozostają aktywne.'
            );
        end if;
    end if;

    -- 4. Fallback dla darmowego użytkownika / wygasłego karnetu (reset dobowy 5/dzień)
    if v_quota.daily_reset_date < current_date then
        update public.user_quotas
        set ai_uses_count = 1,
            daily_reset_date = current_date,
            updated_at = now()
        where user_id = p_user_id;

        return jsonb_build_object('allowed', true, 'current_uses', 1, 'type', 'FREE');
    end if;

    -- 5. Weryfikacja limitu dobowego
    if v_quota.ai_uses_count >= p_max_daily_uses then
        return jsonb_build_object('allowed', false, 'current_uses', v_quota.ai_uses_count, 'type', 'FREE');
    end if;

    -- 6. Atomowa inkrementacja rezerwacji dobowej
    update public.user_quotas
    set ai_uses_count = ai_uses_count + 1,
        updated_at = now()
    where user_id = p_user_id;

    return jsonb_build_object('allowed', true, 'current_uses', v_quota.ai_uses_count + 1, 'type', 'FREE');
end;
$$;
