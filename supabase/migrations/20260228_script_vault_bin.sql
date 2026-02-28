-- Script Vault: Bin (Soft Delete + Trash) Feature
-- Adds deleted_at column for soft deletes and updates search_scripts to exclude deleted items

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Add deleted_at column
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE sv_scripts ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX idx_sv_scripts_deleted_at ON sv_scripts (deleted_at) WHERE deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Update search_scripts RPC to exclude soft-deleted scripts
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_scripts(
  query_text TEXT,
  expanded_terms TEXT[] DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  hook TEXT,
  story TEXT,
  cta TEXT,
  tags TEXT[],
  rating INTEGER,
  shot_done BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  relevance_score FLOAT
) AS $$
DECLARE
  all_terms TEXT[];
  syn_terms TEXT[];
  term TEXT;
BEGIN
  -- Start with original query words
  all_terms := STRING_TO_ARRAY(LOWER(TRIM(query_text)), ' ');

  -- Add frontend-expanded terms
  IF ARRAY_LENGTH(expanded_terms, 1) > 0 THEN
    all_terms := all_terms || expanded_terms;
  END IF;

  -- Expand via synonym table (server-side double coverage)
  FOR term IN SELECT UNNEST(all_terms) LOOP
    SELECT ARRAY_AGG(s.synonym) INTO syn_terms
    FROM sv_synonyms s
    WHERE s.canonical = term OR s.synonym = term;

    IF syn_terms IS NOT NULL THEN
      all_terms := all_terms || syn_terms;
    END IF;
  END LOOP;

  -- Also add canonical terms for any matched synonyms
  FOR term IN SELECT UNNEST(all_terms) LOOP
    SELECT ARRAY_AGG(s.canonical) INTO syn_terms
    FROM sv_synonyms s
    WHERE s.synonym = term;

    IF syn_terms IS NOT NULL THEN
      all_terms := all_terms || syn_terms;
    END IF;
  END LOOP;

  -- Remove duplicates
  SELECT ARRAY_AGG(DISTINCT t) INTO all_terms FROM UNNEST(all_terms) t;

  RETURN QUERY
  SELECT
    sc.id, sc.title, sc.hook, sc.story, sc.cta,
    sc.tags, sc.rating, sc.shot_done, sc.created_at, sc.updated_at,
    (
      -- Exact phrase match (highest weight)
      CASE WHEN sc.raw_text LIKE '%' || LOWER(query_text) || '%' THEN 50 ELSE 0 END +
      -- Trigram similarity to original query
      SIMILARITY(sc.raw_text, LOWER(query_text)) * 30 +
      -- Full-text rank
      COALESCE(TS_RANK(sc.search_vector, PLAINTO_TSQUERY('english', query_text)) * 20, 0) +
      -- Synonym/expanded term matches
      (SELECT COUNT(*)::INTEGER FROM UNNEST(all_terms) t WHERE sc.raw_text LIKE '%' || t || '%') * 3 +
      -- Rating boost
      COALESCE(sc.rating, 0) * 2 -
      -- Shot done penalty
      CASE WHEN sc.shot_done THEN 100 ELSE 0 END
    )::FLOAT AS relevance_score
  FROM sv_scripts sc
  WHERE sc.deleted_at IS NULL AND (
    EXISTS (
      SELECT 1 FROM UNNEST(all_terms) t
      WHERE sc.raw_text LIKE '%' || t || '%'
    )
    OR sc.search_vector @@ PLAINTO_TSQUERY('english', query_text)
    OR SIMILARITY(sc.raw_text, LOWER(query_text)) > 0.15
  )
  ORDER BY
    sc.shot_done ASC,
    relevance_score DESC,
    sc.rating DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;
