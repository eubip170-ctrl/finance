-- =====================================================================
-- Market data cache
-- =====================================================================
-- Caches pre-computed market payloads (dashboard, focus, per-ticker OHLCV)
-- so the daily GitHub Action can refresh them in one shot and every page
-- read becomes a single Supabase select instead of N MarketStack calls.

create table if not exists market_cache (
  key         text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists market_cache_updated_idx
  on market_cache (updated_at desc);
