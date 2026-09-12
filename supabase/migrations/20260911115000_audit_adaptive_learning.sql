-- D20: bounded adaptive learning storage for Audit Core.
-- No raw CV text, no user_id, no email/phone/company names. Only aggregated,
-- privacy-filtered lexeme statistics and validated versioned snapshots.

create table if not exists public.audit_learning_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_version text not null unique,
  corpus_fingerprint text not null,
  status text not null check (status in ('SHADOW', 'VALIDATED', 'ACTIVE', 'REJECTED')),
  module_models jsonb not null default '{}'::jsonb,
  validation_metrics jsonb not null default '{}'::jsonb,
  privacy_manifest jsonb not null default '{"storesRawText":false,"storesUserIdentifiers":false,"piiFiltered":true}'::jsonb,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint audit_learning_snapshot_no_raw_text check (
    not (module_models ? 'rawText')
    and not (module_models ? 'fullText')
    and not (privacy_manifest ? 'userId')
  )
);

create table if not exists public.audit_lexeme_statistics (
  id uuid primary key default gen_random_uuid(),
  snapshot_version text not null references public.audit_learning_snapshots(snapshot_version) on delete cascade,
  module_id text not null,
  label text not null,
  lexeme text not null,
  ngram_size smallint not null check (ngram_size between 1 and 3),
  support_positive integer not null check (support_positive >= 0),
  support_negative integer not null check (support_negative >= 0),
  positive_documents integer not null check (positive_documents >= support_positive),
  negative_documents integer not null check (negative_documents >= support_negative),
  log_odds double precision not null,
  z_score double precision not null,
  lift double precision not null check (lift >= 0),
  confidence double precision not null check (confidence between 0 and 1),
  direction text not null check (direction in ('POSITIVE', 'NEGATIVE')),
  pii_safe boolean not null default false,
  created_at timestamptz not null default now(),
  constraint audit_lexeme_k_anonymity check ((support_positive + support_negative) >= 3),
  constraint audit_lexeme_no_placeholders check (lexeme !~* '\[(email|telefon|adres|linkedin|kandydat|rodo)_'),
  unique(snapshot_version, module_id, label, lexeme)
);

create index if not exists audit_learning_snapshots_status_idx
  on public.audit_learning_snapshots(status, created_at desc);
create index if not exists audit_lexeme_statistics_module_idx
  on public.audit_lexeme_statistics(snapshot_version, module_id, label);

alter table public.audit_learning_snapshots enable row level security;
alter table public.audit_lexeme_statistics enable row level security;

-- This is an internal calibration store. It is intentionally invisible to the
-- public Data API for anon/authenticated clients; service_role/admin jobs own it.
revoke all on table public.audit_learning_snapshots from anon, authenticated;
revoke all on table public.audit_lexeme_statistics from anon, authenticated;

-- One ACTIVE snapshot at a time. Promotion is an explicit administrative act.
create unique index if not exists audit_learning_single_active_idx
  on public.audit_learning_snapshots ((status))
  where status = 'ACTIVE';

comment on table public.audit_learning_snapshots is
  'Versioned Audit Core adaptive models. Stores aggregates only; raw CV text and user identifiers are forbidden.';
comment on table public.audit_lexeme_statistics is
  'Privacy-filtered aggregated lexeme statistics. Minimum document support prevents one-person vocabulary leakage.';
