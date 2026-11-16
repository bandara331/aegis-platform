-- =============================================================================
-- DESTRUCTIVE RESET SCRIPT — DEVELOPMENT / COURSEWORK RESET ONLY
-- Drops the entire "aegis" schema and all tables, sequences, triggers, and data.
-- After running this script, re-apply migrations with:
--   dotnet ef database update -p src/Aegis.Infrastructure -s src/Aegis.Api
-- =============================================================================

DROP SCHEMA IF EXISTS aegis CASCADE;
