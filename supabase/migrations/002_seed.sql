-- ============================================================
-- BIZOS — Seed Data
-- Run AFTER 001_initial_schema.sql
-- Replace the auth user IDs with real IDs after creating users
-- via Supabase Auth dashboard or the app's Settings page.
-- ============================================================

-- Step 1: Create auth users via Supabase Auth UI or API, then
-- run this seed with the correct UUIDs.

-- Demo users will be created through the app's auth flow.
-- This file seeds reference/config data only.

-- Sample clients (run after users exist)
-- INSERT INTO public.clients (name, industry, source_vendor, fee_percentage, payment_terms, intake_score, health_status, account_owner_id)
-- VALUES
--   ('Acme Corp', 'BFSI', 'direct', 8.33, 'Net 30', 16, 'green', '<admin-user-id>'),
--   ('TechCo Ltd', 'Technology', 'Qrewz', 10.00, 'Net 45', 12, 'amber', '<recruiter-a-id>');

-- App settings are already seeded in migration 001.
SELECT 'Seed file ready. Create auth users first, then add sample data.' AS message;
