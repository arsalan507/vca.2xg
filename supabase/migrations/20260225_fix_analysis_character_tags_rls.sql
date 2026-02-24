-- analysis_character_tags had no anon INSERT policy, only authenticated ALL.
-- All PostgREST requests use the static anon JWT, so tag saves silently failed.
-- Same root cause as character_tags fix.

CREATE POLICY "Allow anon insert analysis character tags" ON analysis_character_tags
  FOR INSERT
  WITH CHECK (true);
