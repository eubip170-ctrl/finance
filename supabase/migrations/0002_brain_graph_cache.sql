-- =====================================================================
-- Brain graph cluster label cache
-- =====================================================================
-- The graph endpoint clusters documents with k-means on their embeddings.
-- Cluster labels (e.g. "Monetary policy", "Geopolitical risk") are generated
-- by the LLM and cached here, keyed by a signature of the cluster contents,
-- so we don't burn tokens on every page load.

create table if not exists brain_cluster_labels (
  signature  text primary key,
  label      text not null,
  topics     text[] not null default '{}',
  created_at timestamptz not null default now()
);
