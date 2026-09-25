-- PRD §8 data model. Nothing is ever deleted.
create extension if not exists pgcrypto;

create table voice_skill (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,           -- e.g. '1.0.0'
  content text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index one_active_voice on voice_skill (active) where active;

create table processed_updates (
  update_id bigint primary key,           -- Telegram update_id; insert-first idempotency for ALL updates
  created_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint,                         -- null for backlog imports
  message_id bigint,                      -- null for backlog imports
  import_key text unique,                 -- backlog: sha256(text); idempotent import
  text text not null,
  source text not null default 'telegram',
  status text not null check (status in ('received','rejected','passed','drafted','failed','backlog')),
  category text, score int, criteria jsonb, reason text, flags text[] default '{}',
  duplicate_of text, suggested_angle text, search_phrase text, entities text[] default '{}',
  override boolean not null default false,
  failed_stage text, rejection_message_id bigint, error_message_id bigint,
  created_at timestamptz not null default now(),
  unique (chat_id, message_id)            -- idempotency
);
create index on notes (status, created_at);
-- Reply lookups are scoped by chat (plan A4): message ids are only unique per chat.
create index on notes (chat_id, rejection_message_id);
create index on notes (chat_id, error_message_id);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id),
  body text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  news jsonb,                             -- chosen item {headline, source, date, url} or null
  news_status text,                       -- 'used' | 'unused' | 'none' | 'error'
  model text not null, voice_version text not null, prompt_version text not null,
  lint jsonb,                             -- {hard:[], soft:[], check_count:n}
  redo_feedback text, redo_count int not null default 0,
  post_message_id bigint, card_message_id bigint,
  decision_reason text, decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index on drafts (status);
create index on drafts (post_message_id);
create index on drafts (card_message_id);
create index on drafts (note_id);

alter table processed_updates enable row level security;
alter table voice_skill enable row level security;
alter table notes enable row level security;
alter table drafts enable row level security;   -- no policies: only the service role can access
