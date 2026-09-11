-- D04: legacy projects may still carry broad default grants even when newer
-- projects start closed. RLS remains mandatory, but object grants should expose
-- only the operations that the browser actually uses.

revoke all on table
  public.profiles,
  public.vaults,
  public.applications,
  public.plans,
  public.subscriptions,
  public.stripe_events,
  public.ai_usage_events,
  public.usage_counters,
  public.user_quotas,
  public.consents,
  public.cv_question_skips,
  public.suggestion_contributions,
  public.user_gamification,
  public.crowdsourced_companies,
  public.crowdsourced_job_insights,
  public.application_feedbacks,
  public.template_entitlements,
  public.client_errors
from anon, authenticated;

-- Browser: only operations backed by an intentional RLS policy.
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.vaults to authenticated;
grant select, insert, update, delete on table public.applications to authenticated;
grant select on table public.plans to authenticated;
grant select on table public.subscriptions to authenticated;
grant select on table public.ai_usage_events to authenticated;
grant select on table public.usage_counters to authenticated;
grant select on table public.user_quotas to authenticated;
grant select, insert on table public.consents to authenticated;
grant select, insert, delete on table public.cv_question_skips to authenticated;
grant select, insert, delete on table public.suggestion_contributions to authenticated;
grant select on table public.user_gamification to authenticated;
grant select on table public.template_entitlements to authenticated;

-- Intentional public read-only corpus.
grant select on table public.crowdsourced_companies to anon, authenticated;
grant select on table public.crowdsourced_job_insights to anon, authenticated;

-- Sensitive SECURITY DEFINER RPCs remain server-only even if an old project
-- once granted EXECUTE to PUBLIC.
revoke all on function public.consume_quota(uuid, text) from public, anon, authenticated;
revoke all on function public.reserve_ai_quota(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid) from public, anon, authenticated;
revoke all on function public.delete_user_data(uuid) from public, anon, authenticated;
revoke all on function public.activate_application_pass(uuid, integer) from public, anon, authenticated;
revoke all on function public.record_client_errors(jsonb) from public, anon, authenticated;

-- Explicit server execution survives the revoke above.
grant execute on function public.consume_quota(uuid, text) to service_role;
grant execute on function public.reserve_ai_quota(uuid, integer) to service_role;
grant execute on function public.refund_ai_quota(uuid) to service_role;
grant execute on function public.delete_user_data(uuid) to service_role;
grant execute on function public.activate_application_pass(uuid, integer) to service_role;
grant execute on function public.record_client_errors(jsonb) to service_role;
