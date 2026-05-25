-- ---------------------------------------------------------------------
-- Second Brain · Phase 1 enrichment
-- ---------------------------------------------------------------------
-- Adds an AI-generated semantic layer on top of brain_documents so the
-- corpus is filterable by topic / sentiment / entity instead of pure
-- substring match, and so duplicate ingests get dropped early instead
-- of paying for a re-chunk + re-embed.
--
-- All columns are nullable so existing rows keep working — the backfill
-- route at POST /api/brain/admin/enrich populates them in batches.

alter table brain_documents
  add column if not exists summary       text,
  add column if not exists entities      jsonb       not null default '[]'::jsonb,
  add column if not exists topics        text[]      not null default array[]::text[],
  add column if not exists sentiment     text,
  add column if not exists content_hash  text,
  add column if not exists enriched_at   timestamptz;

alter table brain_documents
  add constraint brain_documents_sentiment_check
  check (sentiment is null or sentiment in ('bullish','bearish','neutral'))
  not valid;

-- Content-hash dedup: enforced as a partial unique index so old rows
-- without a hash don't block the constraint, and concurrent ingest of
-- the same text resolves to "use the existing row".
create unique index if not exists brain_documents_content_hash_uidx
  on brain_documents (content_hash)
  where content_hash is not null;

-- Topic + entity filtering needs GIN to stay cheap at scale.
create index if not exists brain_documents_topics_gin
  on brain_documents using gin (topics);

create index if not exists brain_documents_entities_gin
  on brain_documents using gin (entities jsonb_path_ops);

-- Coverage queries hit this often.
create index if not exists brain_documents_enriched_at_idx
  on brain_documents (enriched_at);
