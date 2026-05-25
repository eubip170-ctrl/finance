-- ---------------------------------------------------------------------
-- Second Brain · Phase 3
-- ---------------------------------------------------------------------
-- Adds 'brief' to the allowed source_type values so the Daily Brief
-- generator can ingest its output back into the corpus as a first-class
-- searchable document. Briefs end up in /brain Library, /brain Search,
-- and the 3D graph alongside everything else.

alter table brain_documents
  drop constraint if exists brain_documents_source_type_check;

alter table brain_documents
  add constraint brain_documents_source_type_check
  check (source_type in (
    'news','rss','pdf','manual','sim_output','market_note','transcript','brief'
  ));
