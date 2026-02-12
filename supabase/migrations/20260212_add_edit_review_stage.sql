-- Add EDIT_REVIEW as a production stage
-- Editor marks complete -> EDIT_REVIEW (admin reviews edited video)
-- Admin approves -> READY_TO_POST
-- Admin rejects -> back to EDITING (with disapproval_reason)

-- No schema changes needed - production_stage is a TEXT column, not an enum.
-- This migration documents the new stage in the workflow:
--   PLANNING -> SHOOTING -> READY_FOR_EDIT -> EDITING -> EDIT_REVIEW -> READY_TO_POST -> POSTED

-- Migrate any existing EDIT_REVIEW projects that were previously mapped to READY_TO_POST
-- (This is a no-op if there are none, since the old migration already moved them)
-- No action needed - the stage name EDIT_REVIEW is already valid in the text column.
