-- Phase 4: Database Optimization
-- Drop duplicate indexes (saves write overhead)
-- Add missing indexes (speeds up common queries)

-- Drop duplicate indexes on production_files
-- idx_production_files_analysis and idx_production_files_analysis_id are both btree on (analysis_id)
DROP INDEX IF EXISTS idx_production_files_analysis;
-- idx_production_files_file_type and idx_production_files_type are both btree on (file_type)
DROP INDEX IF EXISTS idx_production_files_type;

-- Add missing indexes for common query patterns
-- Profiles: role lookups (admin user listing, role-based filtering)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);

-- Viral analyses: status + production_stage compound index (most list queries filter on both)
CREATE INDEX IF NOT EXISTS idx_viral_analyses_status_stage ON viral_analyses (status, production_stage);

-- Project skips: compound index for user+role lookups (every available-projects query uses this)
CREATE INDEX IF NOT EXISTS idx_project_skips_user_role ON project_skips (user_id, role);
