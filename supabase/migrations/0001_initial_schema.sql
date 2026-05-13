-- =====================================================================
-- Event / Macro Studier — initial schema
-- =====================================================================
-- Tables
--   brain_documents       : source docs (news, PDF, transcripts, market notes)
--   brain_chunks          : chunked text + embeddings (pgvector)
--   events                : macro / geopolitical seed events
--   entities              : graph nodes (CentralBank, Government, AssetClass, …)
--   relations             : graph edges (timeline-aware)
--   actors                : market-actor profiles generated from entities
--   simulations           : simulation runs over an event
--   actor_actions         : per-round agent actions log
--   reports               : final scenario reports
--   signals               : (sprint 2) anomalies / triggers — placeholder table
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ---------------------------------------------------------------------
-- Second Brain
-- ---------------------------------------------------------------------
create table if not exists brain_documents (
  id           uuid primary key default uuid_generate_v4(),
  source_type  text not null check (source_type in ('news','rss','pdf','manual','sim_output','market_note','transcript')),
  source_url   text,
  title        text not null,
  author       text,
  published_at timestamptz,
  raw_text     text not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists brain_documents_published_at_idx on brain_documents (published_at desc);
create index if not exists brain_documents_source_type_idx on brain_documents (source_type);

-- Embedding dimension: 1024 (Voyage voyage-3) — adjust if you swap provider.
create table if not exists brain_chunks (
  id           uuid primary key default uuid_generate_v4(),
  document_id  uuid not null references brain_documents(id) on delete cascade,
  chunk_index  int  not null,
  content      text not null,
  embedding    vector(1024),
  token_count  int,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists brain_chunks_embedding_idx
  on brain_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ---------------------------------------------------------------------
-- Events (seed macro / geopolitical)
-- ---------------------------------------------------------------------
create table if not exists events (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  summary      text,
  event_type   text not null check (event_type in (
                 'monetary_policy','fiscal_policy','geopolitical','regulation',
                 'macro_release','corporate','commodity','energy','other'
               )),
  occurred_at  timestamptz,
  source_url   text,
  raw_text     text not null,
  status       text not null default 'draft' check (status in (
                 'draft','graph_built','actors_generated','simulating','simulated','reported','failed'
               )),
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists events_status_idx on events (status);
create index if not exists events_occurred_at_idx on events (occurred_at desc);

-- ---------------------------------------------------------------------
-- Knowledge graph
-- ---------------------------------------------------------------------
create table if not exists entities (
  id           uuid primary key default uuid_generate_v4(),
  event_id     uuid not null references events(id) on delete cascade,
  label        text not null check (label in (
                 'CentralBank','Government','Regulator','Sovereign',
                 'Corporation','Sector','AssetClass','Currency','Commodity',
                 'MacroIndicator','GeographicRegion','MarketActor','Other'
               )),
  name         text not null,
  summary      text,
  attributes   jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (event_id, label, name)
);

create index if not exists entities_event_id_idx on entities (event_id);
create index if not exists entities_label_idx on entities (label);

create table if not exists relations (
  id           uuid primary key default uuid_generate_v4(),
  event_id     uuid not null references events(id) on delete cascade,
  source_id    uuid not null references entities(id) on delete cascade,
  target_id    uuid not null references entities(id) on delete cascade,
  rel_type     text not null,
  fact         text,
  valid_at     timestamptz,
  invalid_at   timestamptz,
  attributes   jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists relations_event_id_idx on relations (event_id);
create index if not exists relations_source_idx on relations (source_id);
create index if not exists relations_target_idx on relations (target_id);

-- ---------------------------------------------------------------------
-- Market actors (agents)
-- ---------------------------------------------------------------------
create table if not exists actors (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid not null references events(id) on delete cascade,
  source_entity_id uuid references entities(id) on delete set null,
  archetype       text not null check (archetype in (
                    'central_bank','treasury','sovereign_wealth','pension_fund',
                    'hedge_fund_macro','hedge_fund_event','asset_manager',
                    'market_maker','prop_desk','retail_aggregate','corporate_treasury','other'
                  )),
  name            text not null,
  mandate         text,
  risk_tolerance  text check (risk_tolerance in ('low','medium','high','speculative')),
  horizon         text check (horizon in ('intraday','days','weeks','months','years')),
  primary_assets  text[] not null default '{}',
  biases          jsonb not null default '{}'::jsonb,
  persona         text,
  created_at      timestamptz not null default now()
);

create index if not exists actors_event_id_idx on actors (event_id);

-- ---------------------------------------------------------------------
-- Simulations
-- ---------------------------------------------------------------------
create table if not exists simulations (
  id           uuid primary key default uuid_generate_v4(),
  event_id     uuid not null references events(id) on delete cascade,
  status       text not null default 'pending' check (status in (
                 'pending','running','completed','failed','cancelled'
               )),
  max_rounds   int  not null default 6,
  config       jsonb not null default '{}'::jsonb,
  started_at   timestamptz,
  finished_at  timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists simulations_event_id_idx on simulations (event_id);
create index if not exists simulations_status_idx on simulations (status);

create table if not exists actor_actions (
  id             uuid primary key default uuid_generate_v4(),
  simulation_id  uuid not null references simulations(id) on delete cascade,
  actor_id       uuid not null references actors(id) on delete cascade,
  round_number   int  not null,
  action_type    text not null,
  rationale      text,
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists actor_actions_sim_idx on actor_actions (simulation_id, round_number);
create index if not exists actor_actions_actor_idx on actor_actions (actor_id);

-- ---------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------
create table if not exists reports (
  id            uuid primary key default uuid_generate_v4(),
  event_id      uuid not null references events(id) on delete cascade,
  simulation_id uuid references simulations(id) on delete set null,
  title         text not null,
  body_md       text not null,
  scenarios     jsonb not null default '[]'::jsonb,
  impacted_assets jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists reports_event_id_idx on reports (event_id);

-- ---------------------------------------------------------------------
-- Signals (placeholder for sprint 2 anomaly detector)
-- ---------------------------------------------------------------------
create table if not exists signals (
  id           uuid primary key default uuid_generate_v4(),
  detector     text not null,
  symbol       text,
  severity     numeric,
  description  text,
  evidence     jsonb not null default '{}'::jsonb,
  event_id     uuid references events(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists signals_symbol_idx on signals (symbol);
create index if not exists signals_created_at_idx on signals (created_at desc);

-- ---------------------------------------------------------------------
-- Helper: similarity search
-- ---------------------------------------------------------------------
create or replace function match_brain_chunks(
  query_embedding vector(1024),
  match_count     int     default 8,
  min_similarity  float   default 0.0,
  filter_source   text    default null
)
returns table (
  id          uuid,
  document_id uuid,
  content     text,
  similarity  float,
  metadata    jsonb
)
language sql stable as $$
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.metadata
  from brain_chunks c
  join brain_documents d on d.id = c.document_id
  where c.embedding is not null
    and (filter_source is null or d.source_type = filter_source)
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
