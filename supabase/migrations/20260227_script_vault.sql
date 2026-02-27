-- Script Vault: Standalone PWA for managing BCH video marketing scripts
-- Public access, no auth required. All tables prefixed sv_ to avoid VCA collisions.

-- ═══════════════════════════════════════════════════════════════════════
-- Extensions
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ═══════════════════════════════════════════════════════════════════════
-- Tables
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE sv_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  story TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  shot_done BOOLEAN NOT NULL DEFAULT false,
  search_vector TSVECTOR,
  raw_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sv_synonyms (
  id SERIAL PRIMARY KEY,
  canonical TEXT NOT NULL,
  synonym TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  UNIQUE(canonical, synonym)
);

-- ═══════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_sv_scripts_search ON sv_scripts USING GIN (search_vector);
CREATE INDEX idx_sv_scripts_raw_trgm ON sv_scripts USING GIN (raw_text gin_trgm_ops);
CREATE INDEX idx_sv_scripts_rating ON sv_scripts (rating DESC);
CREATE INDEX idx_sv_scripts_shot_done ON sv_scripts (shot_done);
CREATE INDEX idx_sv_scripts_tags ON sv_scripts USING GIN (tags);
CREATE INDEX idx_sv_synonyms_canonical ON sv_synonyms (canonical);
CREATE INDEX idx_sv_synonyms_synonym ON sv_synonyms (synonym);

-- ═══════════════════════════════════════════════════════════════════════
-- Trigger: auto-update search_vector + raw_text
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sv_update_script_search()
RETURNS TRIGGER AS $$
BEGIN
  NEW.raw_text := LOWER(
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.hook, '') || ' ' ||
    COALESCE(NEW.story, '') || ' ' ||
    COALESCE(NEW.cta, '') || ' ' ||
    COALESCE(ARRAY_TO_STRING(NEW.tags, ' '), '')
  );
  NEW.search_vector := TO_TSVECTOR('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.hook, '') || ' ' ||
    COALESCE(NEW.story, '') || ' ' ||
    COALESCE(NEW.cta, '') || ' ' ||
    COALESCE(ARRAY_TO_STRING(NEW.tags, ' '), '')
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sv_update_search
  BEFORE INSERT OR UPDATE ON sv_scripts
  FOR EACH ROW EXECUTE FUNCTION sv_update_script_search();

-- ═══════════════════════════════════════════════════════════════════════
-- RPC: search_scripts
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
  WHERE
    EXISTS (
      SELECT 1 FROM UNNEST(all_terms) t
      WHERE sc.raw_text LIKE '%' || t || '%'
    )
    OR sc.search_vector @@ PLAINTO_TSQUERY('english', query_text)
    OR SIMILARITY(sc.raw_text, LOWER(query_text)) > 0.15
  ORDER BY
    sc.shot_done ASC,
    relevance_score DESC,
    sc.rating DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- RLS: Public access (no auth required)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE sv_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sv_synonyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY sv_scripts_public_select ON sv_scripts FOR SELECT USING (true);
CREATE POLICY sv_scripts_public_insert ON sv_scripts FOR INSERT WITH CHECK (true);
CREATE POLICY sv_scripts_public_update ON sv_scripts FOR UPDATE USING (true);
CREATE POLICY sv_scripts_public_delete ON sv_scripts FOR DELETE USING (true);

CREATE POLICY sv_synonyms_public_select ON sv_synonyms FOR SELECT USING (true);
CREATE POLICY sv_synonyms_public_insert ON sv_synonyms FOR INSERT WITH CHECK (true);
CREATE POLICY sv_synonyms_public_update ON sv_synonyms FOR UPDATE USING (true);
CREATE POLICY sv_synonyms_public_delete ON sv_synonyms FOR DELETE USING (true);

-- ═══════════════════════════════════════════════════════════════════════
-- Grant access to PostgREST roles
-- ═══════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON sv_scripts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON sv_synonyms TO anon;
GRANT USAGE, SELECT ON SEQUENCE sv_synonyms_id_seq TO anon;
GRANT EXECUTE ON FUNCTION search_scripts(TEXT, TEXT[]) TO anon;

-- ═══════════════════════════════════════════════════════════════════════
-- Seed: 7 BCH Scripts
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO sv_scripts (title, hook, story, cta, tags, rating) VALUES
(
  'The Vegetable Bag',
  'Man in faded lungi and torn chappals DUMPS a heavy cloth vegetable bag on BCH''s glass counter. Tomatoes and onions ROLL across the surface. Staff LUNGES to catch a rolling tomato.',
  'Staff assumes he''s lost, directs him to budget section. Man seems embarrassed, looks at floor. Then reaches INTO the vegetable bag — past onions, past coriander — pulls out a THICK brick of Rs. 500 notes. "Pack two. One for me. One for my DRIVER."',
  'Never judge a customer. Or a vegetable bag. BCH — premium e-cycles for EVERYONE.',
  ARRAY['judge', 'appearance', 'premium', 'cash', 'vegetable', 'lungi', 'surprise', 'rich'],
  5
),
(
  'The Auto Driver''s Revenge',
  'Auto SCREECHES to halt outside BCH. Driver in stained uniform RIPS the meter off dashboard, SLAMS it on the roof. "LAST DAY. Done."',
  'Well-dressed customer inside patronizes him: "Even auto drivers are window-shopping now." Auto driver shows 6-figure bank balance. "I saved for 2 years while HE was paying EMIs on his PHONE." Full cash payment. Rides out on new e-cycle, pats his old auto goodbye.',
  'BCH: Cash or EMI — Rs. 999/month. Your money, your choice.',
  ARRAY['auto', 'driver', 'revenge', 'class', 'cash', 'emi', 'savings', 'blue collar'],
  4
),
(
  'The Cement Boots',
  'Cement-covered construction boots STEP onto BCH''s clean white floor. Grey footprints everywhere. Dusty hard hat, rebar dust. Points at the MOST EXPENSIVE cycle.',
  'Mother pulls kid away. Customer whispers "Is he lost?" Worker pulls out a BUSINESS CARD — "Managing Director." Building 200 flats next door. Buying 5 cycles for site managers. "Bill my company."',
  'BCH: 300+ e-cycles. From 1 to 50 — we handle every order. Walk in as you are.',
  ARRAY['construction', 'worker', 'judge', 'appearance', 'bulk', 'order', 'premium', 'builder'],
  4
),
(
  'The Roadside Mechanic',
  'Man with OIL-BLACK hands walks in and PICKS UP a premium e-cycle one-handed. Forearm veins pop. Staff RUSHES over panicking.',
  'Staff dismisses him — "repair section is outside." Then he starts NAMING every part: "Brushless DC motor. 250 watt. Lithium-ion 36V. Hall sensor." Flips cycle upside down, checks brakes. "Hydraulic disc. Good." He fixes 40 cycles a day, knows what breaks. "THIS one won''t break. I''ll take it." Staff hands warranty card. He LAUGHS: "2-year warranty? Brother, I AM the warranty."',
  'Even mechanics choose BCH. 2-year warranty. 8 trained mechanics.',
  ARRAY['mechanic', 'repair', 'warranty', 'knowledge', 'expert', 'judge', 'appearance', 'specs'],
  5
),
(
  'The School Uniform Kid',
  'Kid in TORN school uniform — ink stains, broken strap, glued shoes — SLAPS a handwritten comparison chart on the counter. 15 models with specs in NEAT columns.',
  'Rich dad next to him buying randomly, zero research. Kid overhears wrong choice, SHAKES HEAD. Rich dad: "You know better, kid?" Kid UNFOLDS his paper — 6 months of research, names every spec. Even staff takes notes. "Tell my father the EMI details. He''s parking the auto outside." Rich dad stares at his iPad-kid. Whispers: "Put the iPad down."',
  'BCH: even kids do the research. Rs. 999 EMI. 15 accessories. 2-year warranty.',
  ARRAY['kid', 'child', 'school', 'research', 'smart', 'emi', 'comparison', 'ipad', 'parenting'],
  5
),
(
  'The Delivery Boy''s Payday',
  'Swiggy bag SLAMS onto BCH counter. Food container spills, sauce dripping. Rain-drenched delivery boy, helmet on. "I''m not here to DELIVER. I''m here to BUY."',
  'Customers snicker about his salary. He pulls out phone — Rs. 45,000 earnings. "Rs. 5,000 on petrol. E-cycle costs Rs. 33 a DAY. In 4 months I''m in profit. Are YOU in profit?" Drops pre-counted cash on counter.',
  'Rs. 33/day. The cycle that pays for itself. BCH — smart money moves.',
  ARRAY['delivery', 'swiggy', 'zomato', 'gig', 'worker', 'savings', 'petrol', 'profit', 'blue collar'],
  4
),
(
  'The Watchman''s Lathi',
  'Security guard''s bamboo lathi DROPS on BCH counter like a gavel. THUD. Everyone FREEZES. Full khaki uniform. Unbuckles pocket, unfolds a carefully kept Rs. 100 note.',
  'Others laugh — "Rs. 100 will buy a bell maybe." Guard speaks calmly: "Rs. 99 home test ride. Book it. My duty ends 10 PM. Bring it to my house at 10:30. If my FAMILY approves, I buy on spot. EMI." Taps lathi on counter. "Understood?" — CUT to 10:30 PM, BCH delivery at his house. Kids scream. Wife smiles. He nods: "Pack it."',
  'Rs. 99 home test ride. We come to YOU. Book now.',
  ARRAY['watchman', 'guard', 'security', 'family', 'home', 'test ride', 'emi', 'night', 'delivery', 'emotional'],
  5
);

-- ═══════════════════════════════════════════════════════════════════════
-- Seed: Synonyms (~500+ entries)
-- ═══════════════════════════════════════════════════════════════════════

-- Helper: bulk insert with canonical mapping
-- FORMAT: (canonical, synonym, language)

INSERT INTO sv_synonyms (canonical, synonym, language) VALUES
-- ─── ELDERLY / OLD PERSON ───
('elderly', 'old', 'en'),
('elderly', 'old man', 'en'),
('elderly', 'old woman', 'en'),
('elderly', 'old person', 'en'),
('elderly', 'senior', 'en'),
('elderly', 'senior citizen', 'en'),
('elderly', 'aged', 'en'),
('elderly', 'grandpa', 'en'),
('elderly', 'grandma', 'en'),
('elderly', 'grandfather', 'en'),
('elderly', 'grandmother', 'en'),
('elderly', 'budha', 'hi'),
('elderly', 'budhha', 'hi'),
('elderly', 'buddhi', 'hi'),
('elderly', 'buddhha', 'hi'),
('elderly', 'buzurg', 'hi'),
('elderly', 'buzurk', 'hi'),
('elderly', 'vriddh', 'hi'),
('elderly', 'vriddha', 'hi'),
('elderly', 'baba', 'hi'),
('elderly', 'dada', 'hi'),
('elderly', 'dadi', 'hi'),
('elderly', 'nana', 'hi'),
('elderly', 'nani', 'hi'),
('elderly', 'dadaji', 'hi'),
('elderly', 'nanaji', 'hi'),
('elderly', 'old uncle', 'hinglish'),
('elderly', 'old aunty', 'hinglish'),
('elderly', 'aged person', 'hinglish'),
('elderly', 'budhe log', 'hinglish'),
('elderly', 'buzurg aadmi', 'hinglish'),
('elderly', 'ajja', 'kn'),
('elderly', 'ajji', 'kn'),
('elderly', 'mudhuka', 'kn'),
('elderly', 'mudhuki', 'kn'),
('elderly', 'hireya', 'kn'),
('elderly', 'hireyaru', 'kn'),
('elderly', 'vruddha', 'kn'),
('elderly', 'thaatha', 'kn'),
('elderly', 'boodha', 'ur'),
('elderly', 'boodhi', 'ur'),
('elderly', 'peer', 'ur'),
('elderly', 'baray', 'ur'),
('elderly', 'booddha', 'misspelling'),
('elderly', 'budhha', 'misspelling'),
('elderly', 'buzorg', 'misspelling'),
('elderly', 'bujurg', 'misspelling'),
('elderly', 'bujurk', 'misspelling'),
('elderly', 'thaata', 'misspelling'),

-- ─── CHILD / KID ───
('child', 'kid', 'en'),
('child', 'boy', 'en'),
('child', 'girl', 'en'),
('child', 'baby', 'en'),
('child', 'toddler', 'en'),
('child', 'young', 'en'),
('child', 'youngster', 'en'),
('child', 'little one', 'en'),
('child', 'small child', 'en'),
('child', 'children', 'en'),
('child', 'bachcha', 'hi'),
('child', 'bachchi', 'hi'),
('child', 'bacche', 'hi'),
('child', 'bacha', 'hi'),
('child', 'bachi', 'hi'),
('child', 'ladka', 'hi'),
('child', 'ladki', 'hi'),
('child', 'chota', 'hi'),
('child', 'chhota', 'hi'),
('child', 'chhoti', 'hi'),
('child', 'munna', 'hi'),
('child', 'munni', 'hi'),
('child', 'baalak', 'hi'),
('child', 'chotu', 'hi'),
('child', 'small kid', 'hinglish'),
('child', 'chhota baccha', 'hinglish'),
('child', 'little baccha', 'hinglish'),
('child', 'young kid', 'hinglish'),
('child', 'small boy', 'hinglish'),
('child', 'small girl', 'hinglish'),
('child', 'magu', 'kn'),
('child', 'maga', 'kn'),
('child', 'magalu', 'kn'),
('child', 'huduga', 'kn'),
('child', 'hudugi', 'kn'),
('child', 'paapa', 'kn'),
('child', 'papu', 'kn'),
('child', 'chikka', 'kn'),
('child', 'larka', 'ur'),
('child', 'larki', 'ur'),
('child', 'tifal', 'ur'),
('child', 'naujawan', 'ur'),
('child', 'bachha', 'misspelling'),
('child', 'hudga', 'misspelling'),
('child', 'hudgi', 'misspelling'),

-- ─── RICH PERSON ───
('rich', 'wealthy', 'en'),
('rich', 'rich person', 'en'),
('rich', 'rich man', 'en'),
('rich', 'affluent', 'en'),
('rich', 'millionaire', 'en'),
('rich', 'loaded', 'en'),
('rich', 'ameer', 'hi'),
('rich', 'amir', 'hi'),
('rich', 'dhanwan', 'hi'),
('rich', 'paisa wala', 'hi'),
('rich', 'paise wala', 'hi'),
('rich', 'rasees', 'hi'),
('rich', 'seth', 'hi'),
('rich', 'sethji', 'hi'),
('rich', 'lakhpati', 'hi'),
('rich', 'crorepati', 'hi'),
('rich', 'dhani', 'hi'),
('rich', 'maaldar', 'hi'),
('rich', 'rich aadmi', 'hinglish'),
('rich', 'ameer aadmi', 'hinglish'),
('rich', 'bada aadmi', 'hinglish'),
('rich', 'big shot', 'hinglish'),
('rich', 'shreemanta', 'kn'),
('rich', 'sirivantu', 'kn'),
('rich', 'dhanavantu', 'kn'),
('rich', 'dhaniga', 'kn'),
('rich', 'doddavanu', 'kn'),
('rich', 'daulat mand', 'ur'),
('rich', 'raees', 'ur'),
('rich', 'daulat wala', 'ur'),
('rich', 'aamir', 'misspelling'),
('rich', 'shreemant', 'misspelling'),

-- ─── POOR PERSON ───
('poor', 'needy', 'en'),
('poor', 'underprivileged', 'en'),
('poor', 'broke', 'en'),
('poor', 'poverty', 'en'),
('poor', 'destitute', 'en'),
('poor', 'beggar', 'en'),
('poor', 'gareeb', 'hi'),
('poor', 'garib', 'hi'),
('poor', 'kangaal', 'hi'),
('poor', 'nirdhan', 'hi'),
('poor', 'daridra', 'hi'),
('poor', 'fakeer', 'hi'),
('poor', 'bhikari', 'hi'),
('poor', 'mohtaj', 'hi'),
('poor', 'gareeb aadmi', 'hinglish'),
('poor', 'poor aadmi', 'hinglish'),
('poor', 'broke wala', 'hinglish'),
('poor', 'badava', 'kn'),
('poor', 'badavanu', 'kn'),
('poor', 'bikkari', 'kn'),
('poor', 'ghareeb', 'ur'),
('poor', 'gharib', 'ur'),
('poor', 'miskeen', 'ur'),
('poor', 'faqeer', 'ur'),
('poor', 'muflis', 'ur'),
('poor', 'kangal', 'misspelling'),
('poor', 'badva', 'misspelling'),

-- ─── WORKER / LABORER ───
('worker', 'laborer', 'en'),
('worker', 'labourer', 'en'),
('worker', 'daily wage', 'en'),
('worker', 'daily wager', 'en'),
('worker', 'construction worker', 'en'),
('worker', 'hard worker', 'en'),
('worker', 'coolie', 'en'),
('worker', 'mazdoor', 'hi'),
('worker', 'mazdur', 'hi'),
('worker', 'majdoor', 'hi'),
('worker', 'kaamgar', 'hi'),
('worker', 'karmachari', 'hi'),
('worker', 'karigar', 'hi'),
('worker', 'kuli', 'hi'),
('worker', 'dihadi', 'hi'),
('worker', 'sramik', 'hi'),
('worker', 'labour wala', 'hinglish'),
('worker', 'kaam karne wala', 'hinglish'),
('worker', 'daily wages wala', 'hinglish'),
('worker', 'construction wala', 'hinglish'),
('worker', 'worker bhai', 'hinglish'),
('worker', 'karmika', 'kn'),
('worker', 'karmikaru', 'kn'),
('worker', 'kelasagara', 'kn'),
('worker', 'koolie', 'kn'),
('worker', 'mehnatee', 'ur'),
('worker', 'rozee daar', 'ur'),
('worker', 'majdur', 'misspelling'),
('worker', 'kamgar', 'misspelling'),
('worker', 'cooly', 'misspelling'),

-- ─── MECHANIC ───
('mechanic', 'technician', 'en'),
('mechanic', 'repair man', 'en'),
('mechanic', 'repairman', 'en'),
('mechanic', 'fixer', 'en'),
('mechanic', 'garage man', 'en'),
('mechanic', 'workshop guy', 'en'),
('mechanic', 'mistri', 'hi'),
('mechanic', 'mistree', 'hi'),
('mechanic', 'puncture wala', 'hi'),
('mechanic', 'garage wala', 'hi'),
('mechanic', 'mistri bhai', 'hinglish'),
('mechanic', 'repair wala', 'hinglish'),
('mechanic', 'fix karne wala', 'hinglish'),
('mechanic', 'cycle mechanic', 'hinglish'),
('mechanic', 'mekyanik', 'kn'),
('mechanic', 'rippair maduvavanu', 'kn'),
('mechanic', 'marammat karne wala', 'ur'),
('mechanic', 'mistry', 'misspelling'),
('mechanic', 'mistary', 'misspelling'),
('mechanic', 'mechnic', 'misspelling'),
('mechanic', 'mecanic', 'misspelling'),
('mechanic', 'mechenik', 'misspelling'),

-- ─── DRIVER ───
('driver', 'auto driver', 'en'),
('driver', 'taxi driver', 'en'),
('driver', 'truck driver', 'en'),
('driver', 'cab driver', 'en'),
('driver', 'chauffeur', 'en'),
('driver', 'rickshaw driver', 'en'),
('driver', 'chalak', 'hi'),
('driver', 'auto wala', 'hi'),
('driver', 'riksha wala', 'hi'),
('driver', 'taxi wala', 'hi'),
('driver', 'cab wala', 'hi'),
('driver', 'truck wala', 'hi'),
('driver', 'gaadi wala', 'hi'),
('driver', 'uber wala', 'hinglish'),
('driver', 'ola wala', 'hinglish'),
('driver', 'driver bhai', 'hinglish'),
('driver', 'calaka', 'kn'),
('driver', 'auto chalaka', 'kn'),
('driver', 'taxi chalaka', 'kn'),
('driver', 'chalka', 'misspelling'),
('driver', 'autowala', 'misspelling'),
('driver', 'autovala', 'misspelling'),
('driver', 'rikshawala', 'misspelling'),
('driver', 'taxiwala', 'misspelling'),
('driver', 'cabwala', 'misspelling'),
('driver', 'truckwala', 'misspelling'),
('driver', 'chofer', 'misspelling'),

-- ─── DELIVERY PERSON ───
('delivery', 'delivery boy', 'en'),
('delivery', 'delivery man', 'en'),
('delivery', 'delivery person', 'en'),
('delivery', 'courier boy', 'en'),
('delivery', 'courier', 'en'),
('delivery', 'postman', 'en'),
('delivery', 'delivery guy', 'en'),
('delivery', 'delivery agent', 'en'),
('delivery', 'delivery wala', 'hi'),
('delivery', 'dakia', 'hi'),
('delivery', 'courier wala', 'hi'),
('delivery', 'zomato boy', 'hi'),
('delivery', 'swiggy boy', 'hi'),
('delivery', 'parcel wala', 'hi'),
('delivery', 'delivery wala bhai', 'hinglish'),
('delivery', 'parcel boy', 'hinglish'),
('delivery', 'food delivery wala', 'hinglish'),
('delivery', 'amazon wala', 'hinglish'),
('delivery', 'delivery huduga', 'kn'),
('delivery', 'dakiya', 'misspelling'),
('delivery', 'delivry', 'misspelling'),
('delivery', 'delivary', 'misspelling'),
('delivery', 'delvry', 'misspelling'),
('delivery', 'coureer', 'misspelling'),

-- ─── SECURITY GUARD / WATCHMAN ───
('watchman', 'security guard', 'en'),
('watchman', 'guard', 'en'),
('watchman', 'security', 'en'),
('watchman', 'bouncer', 'en'),
('watchman', 'gateman', 'en'),
('watchman', 'gatekeeper', 'en'),
('watchman', 'chowkidar', 'hi'),
('watchman', 'chaukidar', 'hi'),
('watchman', 'darban', 'hi'),
('watchman', 'darbaan', 'hi'),
('watchman', 'rakhwala', 'hi'),
('watchman', 'pahredaar', 'hi'),
('watchman', 'security wala', 'hinglish'),
('watchman', 'gate wala', 'hinglish'),
('watchman', 'watchman uncle', 'hinglish'),
('watchman', 'guard bhai', 'hinglish'),
('watchman', 'building security', 'hinglish'),
('watchman', 'kavalugara', 'kn'),
('watchman', 'rakshanegara', 'kn'),
('watchman', 'bhadrategara', 'kn'),
('watchman', 'nigahban', 'ur'),
('watchman', 'muhafiz', 'ur'),
('watchman', 'pahredar', 'ur'),
('watchman', 'chokidar', 'misspelling'),
('watchman', 'chowkidaar', 'misspelling'),
('watchman', 'chowkeedar', 'misspelling'),
('watchman', 'wachman', 'misspelling'),
('watchman', 'wochman', 'misspelling'),

-- ─── FARMER ───
('farmer', 'agriculturist', 'en'),
('farmer', 'peasant', 'en'),
('farmer', 'cultivator', 'en'),
('farmer', 'land owner', 'en'),
('farmer', 'kisan', 'hi'),
('farmer', 'kisaan', 'hi'),
('farmer', 'anna data', 'hi'),
('farmer', 'zamindar', 'hi'),
('farmer', 'kheti karne wala', 'hi'),
('farmer', 'krishak', 'hi'),
('farmer', 'kisan bhai', 'hinglish'),
('farmer', 'farmer uncle', 'hinglish'),
('farmer', 'kheti wala', 'hinglish'),
('farmer', 'gaon wala', 'hinglish'),
('farmer', 'raita', 'kn'),
('farmer', 'raithu', 'kn'),
('farmer', 'raitharu', 'kn'),
('farmer', 'krishika', 'kn'),
('farmer', 'kashtkar', 'ur'),
('farmer', 'muzaara', 'ur'),
('farmer', 'kissan', 'misspelling'),
('farmer', 'raitha', 'misspelling'),
('farmer', 'zamindaar', 'misspelling'),
('farmer', 'zameendar', 'misspelling'),

-- ─── SHOPKEEPER ───
('shopkeeper', 'shop owner', 'en'),
('shopkeeper', 'store owner', 'en'),
('shopkeeper', 'merchant', 'en'),
('shopkeeper', 'vendor', 'en'),
('shopkeeper', 'retailer', 'en'),
('shopkeeper', 'dukandar', 'hi'),
('shopkeeper', 'dukaandar', 'hi'),
('shopkeeper', 'vyapari', 'hi'),
('shopkeeper', 'baniya', 'hi'),
('shopkeeper', 'baniyaa', 'hi'),
('shopkeeper', 'banik', 'hi'),
('shopkeeper', 'dukan wala', 'hi'),
('shopkeeper', 'dukan wala', 'hinglish'),
('shopkeeper', 'shop wala', 'hinglish'),
('shopkeeper', 'store uncle', 'hinglish'),
('shopkeeper', 'angadiyavanu', 'kn'),
('shopkeeper', 'dukaanadaar', 'kn'),
('shopkeeper', 'tajir', 'ur'),
('shopkeeper', 'saudagar', 'ur'),
('shopkeeper', 'dukandaar', 'misspelling'),
('shopkeeper', 'byapari', 'misspelling'),
('shopkeeper', 'bania', 'misspelling'),
('shopkeeper', 'shopkepper', 'misspelling'),

-- ─── STUDENT ───
('student', 'pupil', 'en'),
('student', 'learner', 'en'),
('student', 'scholar', 'en'),
('student', 'school kid', 'en'),
('student', 'college student', 'en'),
('student', 'schoolboy', 'en'),
('student', 'schoolgirl', 'en'),
('student', 'vidyarthi', 'hi'),
('student', 'vidyaarthi', 'hi'),
('student', 'chhatra', 'hi'),
('student', 'talib ilm', 'hi'),
('student', 'padhnewala', 'hi'),
('student', 'padhai karne wala', 'hinglish'),
('student', 'college wala', 'hinglish'),
('student', 'school wala', 'hinglish'),
('student', 'exam wala', 'hinglish'),
('student', 'sisya', 'kn'),
('student', 'oduvavanu', 'kn'),
('student', 'shagird', 'ur'),
('student', 'vidyarti', 'misspelling'),
('student', 'vidyarthy', 'misspelling'),
('student', 'chatra', 'misspelling'),
('student', 'shagerd', 'misspelling'),

-- ─── TEACHER ───
('teacher', 'professor', 'en'),
('teacher', 'instructor', 'en'),
('teacher', 'tutor', 'en'),
('teacher', 'school teacher', 'en'),
('teacher', 'tuition teacher', 'en'),
('teacher', 'adhyapak', 'hi'),
('teacher', 'guruji', 'hi'),
('teacher', 'guru', 'hi'),
('teacher', 'masterji', 'hi'),
('teacher', 'pandit', 'hi'),
('teacher', 'panditji', 'hi'),
('teacher', 'shikshak', 'hi'),
('teacher', 'teacher sir', 'hinglish'),
('teacher', 'tuition sir', 'hinglish'),
('teacher', 'coaching sir', 'hinglish'),
('teacher', 'siksaka', 'kn'),
('teacher', 'gurugalu', 'kn'),
('teacher', 'adhyapaka', 'kn'),
('teacher', 'ustaad', 'ur'),
('teacher', 'muallim', 'ur'),
('teacher', 'maulvi', 'ur'),
('teacher', 'ustad', 'misspelling'),
('teacher', 'ustadji', 'misspelling'),
('teacher', 'adhyapk', 'misspelling'),
('teacher', 'sikshak', 'misspelling'),

-- ─── HOUSEWIFE / HOMEMAKER ───
('housewife', 'homemaker', 'en'),
('housewife', 'stay at home mom', 'en'),
('housewife', 'mother', 'en'),
('housewife', 'mom', 'en'),
('housewife', 'gharelu aurat', 'hi'),
('housewife', 'ghar wali', 'hi'),
('housewife', 'gharelu mahila', 'hi'),
('housewife', 'griha lakshmi', 'hi'),
('housewife', 'ghar ki malkin', 'hi'),
('housewife', 'house wife', 'hinglish'),
('housewife', 'gharwali', 'hinglish'),
('housewife', 'mummy ji', 'hinglish'),
('housewife', 'aunty ji', 'hinglish'),
('housewife', 'gruha lakshmi', 'kn'),
('housewife', 'mane hendathi', 'kn'),
('housewife', 'maneyavalu', 'kn'),
('housewife', 'khaatoon', 'ur'),
('housewife', 'bibi', 'ur'),
('housewife', 'begum', 'ur'),
('housewife', 'grihalakshmi', 'misspelling'),
('housewife', 'khatoon', 'misspelling'),
('housewife', 'begam', 'misspelling'),

-- ─── BUSINESSMAN ───
('businessman', 'business owner', 'en'),
('businessman', 'entrepreneur', 'en'),
('businessman', 'tycoon', 'en'),
('businessman', 'industrialist', 'en'),
('businessman', 'trader', 'en'),
('businessman', 'karobaari', 'hi'),
('businessman', 'udyogpati', 'hi'),
('businessman', 'udyami', 'hi'),
('businessman', 'lalaji', 'hi'),
('businessman', 'business wala', 'hinglish'),
('businessman', 'company wala', 'hinglish'),
('businessman', 'boss', 'hinglish'),
('businessman', 'udyogapati', 'kn'),
('businessman', 'vaanijyagara', 'kn'),
('businessman', 'taajir', 'ur'),
('businessman', 'karobari', 'misspelling'),

-- ─── FUNNY / COMEDY ───
('funny', 'comedy', 'en'),
('funny', 'humor', 'en'),
('funny', 'humour', 'en'),
('funny', 'hilarious', 'en'),
('funny', 'joke', 'en'),
('funny', 'lol', 'en'),
('funny', 'hasi', 'hi'),
('funny', 'hansi', 'hi'),
('funny', 'mazaak', 'hi'),
('funny', 'mazak', 'hi'),
('funny', 'hasna', 'hi'),
('funny', 'hasaane wala', 'hi'),
('funny', 'mazedar', 'hi'),
('funny', 'chutkula', 'hi'),
('funny', 'haasya', 'hi'),
('funny', 'nagu', 'kn'),
('funny', 'nagisu', 'kn'),
('funny', 'vinoda', 'kn'),
('funny', 'thamaasha', 'ur'),
('funny', 'latifa', 'ur'),
('funny', 'khushmazaq', 'ur'),

-- ─── EMOTIONAL / SAD ───
('emotional', 'sad', 'en'),
('emotional', 'touching', 'en'),
('emotional', 'heartfelt', 'en'),
('emotional', 'moving', 'en'),
('emotional', 'tearjerker', 'en'),
('emotional', 'rona', 'hi'),
('emotional', 'dukhi', 'hi'),
('emotional', 'dard', 'hi'),
('emotional', 'dardnak', 'hi'),
('emotional', 'aansu', 'hi'),
('emotional', 'ashk', 'hi'),
('emotional', 'udaas', 'hi'),
('emotional', 'ghamgeen', 'hi'),
('emotional', 'gham', 'hi'),
('emotional', 'dukh', 'hi'),
('emotional', 'bhawuk', 'hi'),
('emotional', 'dukkha', 'kn'),
('emotional', 'dukha', 'kn'),
('emotional', 'alu', 'kn'),
('emotional', 'aluvike', 'kn'),
('emotional', 'hrudaya sparshi', 'kn'),
('emotional', 'judai', 'ur'),
('emotional', 'ranj', 'ur'),
('emotional', 'malaal', 'ur'),
('emotional', 'dil shikasta', 'ur'),

-- ─── REVENGE / PAYBACK ───
('revenge', 'payback', 'en'),
('revenge', 'vengeance', 'en'),
('revenge', 'retribution', 'en'),
('revenge', 'badla', 'hi'),
('revenge', 'badlaa', 'hi'),
('revenge', 'intiqaam', 'hi'),
('revenge', 'intekam', 'hi'),
('revenge', 'hisaab', 'hi'),
('revenge', 'sabak', 'hi'),
('revenge', 'sabak sikhana', 'hi'),
('revenge', 'soodu', 'kn'),
('revenge', 'pratishodha', 'kn'),
('revenge', 'pratikaara', 'kn'),
('revenge', 'qisaas', 'ur'),

-- ─── SURPRISE / TWIST ───
('surprise', 'twist', 'en'),
('surprise', 'unexpected', 'en'),
('surprise', 'shocking', 'en'),
('surprise', 'plot twist', 'en'),
('surprise', 'hairat', 'hi'),
('surprise', 'hairaani', 'hi'),
('surprise', 'ajooba', 'hi'),
('surprise', 'chaunk', 'hi'),
('surprise', 'chaunka dene wala', 'hi'),
('surprise', 'ashcharya', 'kn'),
('surprise', 'vismaya', 'kn'),
('surprise', 'adbutha', 'kn'),
('surprise', 'taaajub', 'ur'),

-- ─── FAMILY / RELATIONSHIPS ───
('family', 'relationships', 'en'),
('family', 'relatives', 'en'),
('family', 'parivaar', 'hi'),
('family', 'parivar', 'hi'),
('family', 'rishta', 'hi'),
('family', 'rishtey', 'hi'),
('family', 'maa', 'hi'),
('family', 'baap', 'hi'),
('family', 'bhai', 'hi'),
('family', 'behen', 'hi'),
('family', 'beta', 'hi'),
('family', 'beti', 'hi'),
('family', 'gharwale', 'hi'),
('family', 'apne', 'hi'),
('family', 'khandan', 'hi'),
('family', 'khandaan', 'hi'),
('family', 'kutumba', 'kn'),
('family', 'samsara', 'kn'),
('family', 'appa', 'kn'),
('family', 'amma', 'kn'),
('family', 'anna', 'kn'),
('family', 'akka', 'kn'),
('family', 'thayi', 'kn'),
('family', 'tandhe', 'kn'),
('family', 'khaandaan', 'ur'),
('family', 'naate', 'ur'),
('family', 'waalid', 'ur'),
('family', 'waalida', 'ur'),

-- ─── PRIDE / DIGNITY ───
('pride', 'dignity', 'en'),
('pride', 'self respect', 'en'),
('pride', 'honor', 'en'),
('pride', 'honour', 'en'),
('pride', 'garv', 'hi'),
('pride', 'gaurav', 'hi'),
('pride', 'izzat', 'hi'),
('pride', 'izzaat', 'hi'),
('pride', 'shaan', 'hi'),
('pride', 'swabhiman', 'hi'),
('pride', 'abhimana', 'kn'),
('pride', 'hemmay', 'kn'),
('pride', 'gaurava', 'kn'),
('pride', 'ghairat', 'ur'),
('pride', 'waqaar', 'ur'),
('pride', 'fakhr', 'ur'),

-- ─── RESPECT / DISRESPECT ───
('respect', 'disrespect', 'en'),
('respect', 'insult', 'en'),
('respect', 'humiliation', 'en'),
('respect', 'beizzati', 'hi'),
('respect', 'apmaan', 'hi'),
('respect', 'samman', 'hi'),
('respect', 'badtameezi', 'hi'),
('respect', 'zillat', 'hi'),
('respect', 'tameez', 'hi'),
('respect', 'maryade', 'kn'),
('respect', 'gourava', 'kn'),
('respect', 'apamaana', 'kn'),
('respect', 'avamana', 'kn'),
('respect', 'tiraskaara', 'kn'),
('respect', 'toheen', 'ur'),
('respect', 'gustakhi', 'ur'),

-- ─── ANGER ───
('anger', 'angry', 'en'),
('anger', 'furious', 'en'),
('anger', 'rage', 'en'),
('anger', 'gussa', 'hi'),
('anger', 'gusse', 'hi'),
('anger', 'krodh', 'hi'),
('anger', 'naraz', 'hi'),
('anger', 'naraaz', 'hi'),
('anger', 'jalan', 'hi'),
('anger', 'chid', 'hi'),
('anger', 'kopa', 'kn'),
('anger', 'krodha', 'kn'),
('anger', 'sinidda', 'kn'),
('anger', 'ghazab', 'ur'),
('anger', 'ghussaa', 'ur'),
('anger', 'taish', 'ur'),

-- ─── HAPPINESS / JOY ───
('happiness', 'joy', 'en'),
('happiness', 'happy', 'en'),
('happiness', 'celebration', 'en'),
('happiness', 'khushi', 'hi'),
('happiness', 'khushee', 'hi'),
('happiness', 'aanand', 'hi'),
('happiness', 'anand', 'hi'),
('happiness', 'maza', 'hi'),
('happiness', 'mazaa', 'hi'),
('happiness', 'jashn', 'hi'),
('happiness', 'umang', 'hi'),
('happiness', 'santosha', 'kn'),
('happiness', 'santhosha', 'kn'),
('happiness', 'harsha', 'kn'),
('happiness', 'ananda', 'kn'),
('happiness', 'ullasa', 'kn'),
('happiness', 'musarrat', 'ur'),
('happiness', 'farhat', 'ur'),
('happiness', 'suroor', 'ur'),

-- ─── MONEY / CASH ───
('money', 'cash', 'en'),
('money', 'currency', 'en'),
('money', 'funds', 'en'),
('money', 'paisa', 'hi'),
('money', 'paise', 'hi'),
('money', 'rupaya', 'hi'),
('money', 'rupaye', 'hi'),
('money', 'rupaiya', 'hi'),
('money', 'dhan', 'hi'),
('money', 'nakad', 'hi'),
('money', 'naqad', 'hi'),
('money', 'haana', 'kn'),
('money', 'hana', 'kn'),
('money', 'duddu', 'kn'),
('money', 'rupaayi', 'kn'),
('money', 'zar', 'ur'),
('money', 'maal', 'ur'),

-- ─── EXPENSIVE / COSTLY ───
('expensive', 'costly', 'en'),
('expensive', 'premium', 'en'),
('expensive', 'pricey', 'en'),
('expensive', 'mehnga', 'hi'),
('expensive', 'mehngaa', 'hi'),
('expensive', 'mahenga', 'hi'),
('expensive', 'keemat', 'hi'),
('expensive', 'bhaari', 'hi'),
('expensive', 'doddadu', 'kn'),
('expensive', 'jasti bele', 'kn'),
('expensive', 'qeemti', 'ur'),
('expensive', 'giran', 'ur'),

-- ─── CHEAP / AFFORDABLE ───
('cheap', 'affordable', 'en'),
('cheap', 'budget', 'en'),
('cheap', 'low cost', 'en'),
('cheap', 'sasta', 'hi'),
('cheap', 'sastaa', 'hi'),
('cheap', 'kam daam', 'hi'),
('cheap', 'kam keemat', 'hi'),
('cheap', 'muft', 'hi'),
('cheap', 'free', 'en'),
('cheap', 'kade bele', 'kn'),
('cheap', 'kami bele', 'kn'),
('cheap', 'sulabha', 'kn'),
('cheap', 'arzan', 'ur'),

-- ─── EMI / INSTALLMENT ───
('emi', 'installment', 'en'),
('emi', 'loan', 'en'),
('emi', 'finance', 'en'),
('emi', 'monthly payment', 'en'),
('emi', 'kisht', 'hi'),
('emi', 'masik kisht', 'hi'),
('emi', 'karza', 'hi'),
('emi', 'qarz', 'hi'),
('emi', 'udhar', 'hi'),
('emi', 'qist', 'ur'),

-- ─── SAVINGS ───
('savings', 'save', 'en'),
('savings', 'discount', 'en'),
('savings', 'offer', 'en'),
('savings', 'bachat', 'hi'),
('savings', 'bachaat', 'hi'),
('savings', 'chhoot', 'hi'),
('savings', 'daam kam', 'hi'),
('savings', 'ulitaya', 'kn'),
('savings', 'kifayat', 'ur'),

-- ─── PROFIT ───
('profit', 'gain', 'en'),
('profit', 'earnings', 'en'),
('profit', 'return', 'en'),
('profit', 'munafa', 'hi'),
('profit', 'munaafa', 'hi'),
('profit', 'fayda', 'hi'),
('profit', 'faayda', 'hi'),
('profit', 'labh', 'hi'),
('profit', 'kamai', 'hi'),
('profit', 'amdani', 'hi'),
('profit', 'laabha', 'kn'),
('profit', 'nafa', 'ur'),

-- ─── SALARY / INCOME ───
('salary', 'income', 'en'),
('salary', 'wages', 'en'),
('salary', 'pay', 'en'),
('salary', 'earnings', 'en'),
('salary', 'tankha', 'hi'),
('salary', 'tankhaah', 'hi'),
('salary', 'pagaar', 'hi'),
('salary', 'vetan', 'hi'),
('salary', 'naukri', 'hi'),
('salary', 'rozgar', 'hi'),
('salary', 'sambala', 'kn'),
('salary', 'veethana', 'kn'),
('salary', 'tankhwah', 'ur'),
('salary', 'maash', 'ur'),
('salary', 'rozee', 'ur'),

-- ─── BICYCLE / CYCLE ───
('cycle', 'bicycle', 'en'),
('cycle', 'bike', 'en'),
('cycle', 'saikal', 'hi'),
('cycle', 'saikil', 'hi'),
('cycle', 'do pahiya', 'hi'),
('cycle', 'saaikalu', 'kn'),
('cycle', 'baisikalu', 'kn'),
('cycle', 'e-cycle', 'en'),
('cycle', 'ecycle', 'en'),
('cycle', 'electric cycle', 'en'),
('cycle', 'electric saikal', 'hi'),
('cycle', 'battery wali saikal', 'hi'),
('cycle', 'bijli wali saikal', 'hi'),
('cycle', 'e-saikal', 'hi'),
('cycle', 'battery cycle', 'en'),
('cycle', 'pedal assist', 'en'),

-- ─── AUTO RICKSHAW ───
('auto', 'riksha', 'hi'),
('auto', 'auto riksha', 'hi'),
('auto', 'teen pahiya', 'hi'),
('auto', 'chhakda', 'hi'),
('auto', 'mooru chakra', 'kn'),
('auto', 'chhingchi', 'hi'),
('auto', 'rickshaw', 'en'),
('auto', 'tuk tuk', 'en'),

-- ─── SCOOTER / MOTORCYCLE ───
('scooter', 'scooty', 'en'),
('scooter', 'motorcycle', 'en'),
('scooter', 'motor bike', 'en'),
('scooter', 'motor saikal', 'hi'),
('scooter', 'activa', 'en'),
('scooter', 'bullet', 'en'),
('scooter', 'splendor', 'en'),
('scooter', 'pulsar', 'en'),

-- ─── CAR ───
('car', 'gaadi', 'hi'),
('car', 'gaari', 'hi'),
('car', 'motor gaadi', 'hi'),
('car', 'chaar pahiya', 'hi'),
('car', 'kaaru', 'kn'),

-- ─── BUS ───
('bus', 'roadways', 'en'),
('bus', 'sarkari bus', 'hi'),
('bus', 'private bus', 'hi'),
('bus', 'BMTC', 'en'),
('bus', 'KSRTC', 'en'),

-- ─── SHOP / STORE ───
('shop', 'store', 'en'),
('shop', 'showroom', 'en'),
('shop', 'dukaan', 'hi'),
('shop', 'dukan', 'hi'),
('shop', 'pedhhi', 'hi'),
('shop', 'angadi', 'kn'),
('shop', 'pedhi', 'hi'),

-- ─── MARKET ───
('market', 'bazaar', 'hi'),
('market', 'baazar', 'hi'),
('market', 'mandi', 'hi'),
('market', 'haat', 'hi'),
('market', 'pete', 'kn'),
('market', 'santhi', 'kn'),
('market', 'marukatte', 'kn'),

-- ─── SCHOOL / COLLEGE ───
('school', 'college', 'en'),
('school', 'pathshala', 'hi'),
('school', 'vidyalaya', 'hi'),
('school', 'vidyalay', 'hi'),
('school', 'coaching', 'en'),
('school', 'tuition', 'en'),
('school', 'shaale', 'kn'),
('school', 'shale', 'kn'),
('school', 'mahavidyalaya', 'kn'),
('school', 'madrasa', 'ur'),
('school', 'darsgaah', 'ur'),

-- ─── HOSPITAL ───
('hospital', 'aspatal', 'hi'),
('hospital', 'aspataal', 'hi'),
('hospital', 'davakhana', 'hi'),
('hospital', 'dawakhana', 'hi'),
('hospital', 'chikitsalay', 'hi'),
('hospital', 'aaspathre', 'kn'),
('hospital', 'aspatre', 'kn'),
('hospital', 'shifa khaana', 'ur'),

-- ─── HOME / HOUSE ───
('home', 'house', 'en'),
('home', 'ghar', 'hi'),
('home', 'makaan', 'hi'),
('home', 'makana', 'hi'),
('home', 'haveli', 'hi'),
('home', 'aashiyana', 'hi'),
('home', 'mane', 'kn'),
('home', 'maneya', 'kn'),
('home', 'griha', 'kn'),
('home', 'khana', 'ur'),

-- ─── ROAD / STREET ───
('road', 'street', 'en'),
('road', 'rasta', 'hi'),
('road', 'rastaa', 'hi'),
('road', 'sadak', 'hi'),
('road', 'sarak', 'hi'),
('road', 'gali', 'hi'),
('road', 'highway', 'en'),
('road', 'chauraha', 'hi'),
('road', 'beedi', 'kn'),
('road', 'shahrah', 'ur'),

-- ─── BUYING / PURCHASING ───
('buying', 'purchasing', 'en'),
('buying', 'shopping', 'en'),
('buying', 'kharidna', 'hi'),
('buying', 'khareedna', 'hi'),
('buying', 'khareed', 'hi'),
('buying', 'lena', 'hi'),
('buying', 'mol lena', 'hi'),
('buying', 'sauda', 'hi'),
('buying', 'kone', 'kn'),
('buying', 'koneyuvudu', 'kn'),
('buying', 'kharidi', 'ur'),

-- ─── SELLING ───
('selling', 'sale', 'en'),
('selling', 'bechna', 'hi'),
('selling', 'bikna', 'hi'),
('selling', 'bikri', 'hi'),
('selling', 'bik raha', 'hi'),
('selling', 'sasta bech', 'hi'),
('selling', 'maaratte', 'kn'),
('selling', 'maaruvudu', 'kn'),
('selling', 'marate', 'kn'),
('selling', 'farookht', 'ur'),
('selling', 'baikri', 'ur'),

-- ─── JUDGING (BY APPEARANCE) ───
('judge', 'judging', 'en'),
('judge', 'appearance', 'en'),
('judge', 'stereotype', 'en'),
('judge', 'prejudice', 'en'),
('judge', 'bhedbhav', 'hi'),
('judge', 'dikhawa', 'hi'),
('judge', 'dikhave pe mat jao', 'hi'),
('judge', 'tiraskara', 'kn'),
('judge', 'bhedbhava', 'kn'),
('judge', 'soorat se na judge karo', 'ur'),
('judge', 'fark', 'ur'),

-- ─── WORKING ───
('working', 'job', 'en'),
('working', 'employment', 'en'),
('working', 'kaam karna', 'hi'),
('working', 'mehnat', 'hi'),
('working', 'kaam', 'hi'),
('working', 'naukri', 'hi'),
('working', 'kelasa', 'kn'),
('working', 'kelsa', 'kn'),
('working', 'kelasa maadu', 'kn'),
('working', 'shugal', 'ur'),

-- ─── RIDING / DRIVING ───
('riding', 'driving', 'en'),
('riding', 'chalana', 'hi'),
('riding', 'savaari', 'hi'),
('riding', 'gaadi chalana', 'hi'),
('riding', 'saikal chalana', 'hi'),
('riding', 'bike chalana', 'hi'),
('riding', 'odisu', 'kn'),
('riding', 'odisuvudu', 'kn'),

-- ─── REPAIRING / FIXING ───
('repair', 'fixing', 'en'),
('repair', 'maintenance', 'en'),
('repair', 'marammat', 'hi'),
('repair', 'theek karna', 'hi'),
('repair', 'sahi karna', 'hi'),
('repair', 'repair karna', 'hi'),
('repair', 'tamir', 'hi'),
('repair', 'puncture banana', 'hi'),
('repair', 'rippair', 'kn'),
('repair', 'rippair maadu', 'kn'),
('repair', 'sariyaagi maadu', 'kn'),
('repair', 'tameer', 'ur'),

-- ─── BICYCLE PARTS & FEATURES ───
('parts', 'gear', 'en'),
('parts', 'brake', 'en'),
('parts', 'tire', 'en'),
('parts', 'tyre', 'en'),
('parts', 'wheel', 'en'),
('parts', 'seat', 'en'),
('parts', 'pedal', 'en'),
('parts', 'chain', 'en'),
('parts', 'handle', 'en'),
('parts', 'bell', 'en'),
('parts', 'basket', 'en'),
('parts', 'carrier', 'en'),
('parts', 'light', 'en'),
('parts', 'lock', 'en'),
('parts', 'pump', 'en'),
('parts', 'pahiya', 'hi'),
('parts', 'ghanti', 'hi'),
('parts', 'tokri', 'hi'),
('parts', 'chakra', 'hi'),
('parts', 'disc brake', 'en'),
('parts', 'fat tyre', 'en'),
('parts', 'gear wala cycle', 'hinglish'),
('parts', 'disc brake cycle', 'hinglish'),
('parts', 'fat tyre cycle', 'hinglish'),

-- ─── ELECTRIC VEHICLE TERMS ───
('electric', 'ev', 'en'),
('electric', 'electric vehicle', 'en'),
('electric', 'battery', 'en'),
('electric', 'charging', 'en'),
('electric', 'lithium', 'en'),
('electric', 'motor', 'en'),
('electric', 'watt', 'en'),
('electric', 'volt', 'en'),
('electric', 'bijli', 'hi'),
('electric', 'battery wala', 'hinglish'),
('electric', 'charge karna', 'hinglish')

ON CONFLICT (canonical, synonym) DO NOTHING;
