-- ---------------------------------------------------------------------
-- Second Brain · Phase 2 hybrid search
-- ---------------------------------------------------------------------
-- Adds:
--   1. A generated tsvector on brain_documents covering title + summary +
--      raw_text, with title weighted highest. GIN-indexed.
--   2. match_brain_chunks_hybrid(): vector cosine ⊕ BM25 fused via RRF,
--      with optional pre-filters on source_type / topics / sentiment /
--      entity value. Pre-filtering through brain_documents means the
--      Phase-1 GIN indexes are actually used and the candidate set
--      shrinks before the expensive ranking math runs.

alter table brain_documents
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(title, '')),     'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(summary, '')),   'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(raw_text, '')),  'C')
  ) stored;

create index if not exists brain_documents_search_tsv_idx
  on brain_documents using gin (search_tsv);

create or replace function match_brain_chunks_hybrid(
  query_text       text,
  query_embedding  vector(1024),
  match_count      int     default 20,
  min_similarity   float   default 0.0,
  filter_source    text    default null,
  filter_topic     text    default null,
  filter_sentiment text    default null,
  filter_entity    text    default null,
  rrf_k            int     default 60
)
returns table (
  id           uuid,
  document_id  uuid,
  content      text,
  similarity   float,
  bm25         float,
  rrf_score    float,
  metadata     jsonb
)
language sql stable as $$
  with q as (
    select case
      when coalesce(trim(query_text), '') = '' then null
      else websearch_to_tsquery('english'::regconfig, query_text)
    end as tsq
  ),
  filtered_docs as (
    select d.id, d.search_tsv
    from brain_documents d
    where (filter_source    is null or d.source_type = filter_source)
      and (filter_topic     is null or filter_topic   = any(d.topics))
      and (filter_sentiment is null or d.sentiment   = filter_sentiment)
      and (filter_entity    is null or d.entities   @> jsonb_build_array(jsonb_build_object('value', filter_entity)))
  ),
  vec as (
    select
      c.id, c.document_id, c.content, c.metadata,
      1 - (c.embedding <=> query_embedding) as similarity,
      row_number() over (order by c.embedding <=> query_embedding asc) as rank
    from brain_chunks c
    join filtered_docs d on d.id = c.document_id
    where c.embedding is not null
      and 1 - (c.embedding <=> query_embedding) >= min_similarity
    order by c.embedding <=> query_embedding
    limit greatest(match_count * 3, 30)
  ),
  bm as (
    select
      c.id, c.document_id, c.content, c.metadata,
      ts_rank(d.search_tsv, (select tsq from q)) as bm25,
      row_number() over (order by ts_rank(d.search_tsv, (select tsq from q)) desc) as rank
    from brain_chunks c
    join filtered_docs d on d.id = c.document_id
    where c.embedding is not null
      and (select tsq from q) is not null
      and d.search_tsv @@ (select tsq from q)
    order by ts_rank(d.search_tsv, (select tsq from q)) desc
    limit greatest(match_count * 3, 30)
  ),
  merged as (
    select
      coalesce(v.id, b.id)                       as id,
      coalesce(v.document_id, b.document_id)     as document_id,
      coalesce(v.content, b.content)             as content,
      coalesce(v.metadata, b.metadata)           as metadata,
      coalesce(v.similarity, 0)                  as similarity,
      coalesce(b.bm25, 0)                        as bm25,
      coalesce(case when v.rank is not null then 1.0 / (rrf_k + v.rank) else 0 end, 0) +
      coalesce(case when b.rank is not null then 1.0 / (rrf_k + b.rank) else 0 end, 0) as rrf_score
    from vec v
    full outer join bm b on b.id = v.id
  )
  select id, document_id, content, similarity, bm25, rrf_score, metadata
  from merged
  order by rrf_score desc nulls last
  limit match_count;
$$;
