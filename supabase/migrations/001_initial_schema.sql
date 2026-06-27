-- ============================================================
-- BIZOS — Initial Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'recruiter', 'viewer');
CREATE TYPE health_status AS ENUM ('green', 'amber', 'red');
CREATE TYPE engagement_type AS ENUM ('Permanent', 'Contract', 'C2H', 'C2C');
CREATE TYPE opening_status AS ENUM ('Open', 'On Hold', 'Closed');
CREATE TYPE submission_stage AS ENUM (
  'Sourced', 'Screened', 'Submitted', 'Client Review',
  'Interview L1', 'Interview L2', 'Offer', 'Joined', 'Dropped'
);
CREATE TYPE interview_status AS ENUM ('Scheduled', 'Completed', 'No-show', 'Cancelled');
CREATE TYPE report_status AS ENUM ('Draft', 'Approved', 'Sent');
CREATE TYPE practice_area AS ENUM (
  'SAP', 'Cloud', 'Full Stack', 'Data/AI', 'GenAI',
  'Salesforce', 'ServiceNow', 'DevOps', 'Other'
);

-- ============================================================
-- USERS (extends auth.users)
-- ============================================================
CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        user_role NOT NULL DEFAULT 'recruiter',
  team_lead_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE public.clients (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  industry         TEXT NOT NULL DEFAULT '',
  source_vendor    TEXT NOT NULL DEFAULT 'direct',
  fee_percentage   NUMERIC(5,2) NOT NULL DEFAULT 0,
  payment_terms    TEXT NOT NULL DEFAULT '',
  intake_score     INT NOT NULL DEFAULT 0 CHECK (intake_score BETWEEN 0 AND 20),
  health_status    health_status NOT NULL DEFAULT 'green',
  intake_rationale TEXT,
  account_owner_id UUID NOT NULL REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- OPENINGS
-- ============================================================
CREATE TABLE public.openings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id             UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  practice_area         practice_area NOT NULL DEFAULT 'Other',
  seniority             TEXT NOT NULL DEFAULT '',
  ctc_band              TEXT NOT NULL DEFAULT '',
  engagement_type       engagement_type NOT NULL DEFAULT 'Permanent',
  status                opening_status NOT NULL DEFAULT 'Open',
  assigned_recruiter_id UUID NOT NULL REFERENCES public.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CANDIDATES
-- ============================================================
CREATE TABLE public.candidates (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               TEXT NOT NULL,
  current_employer   TEXT NOT NULL DEFAULT '',
  ctc_current        NUMERIC(12,2) NOT NULL DEFAULT 0,
  ctc_expected       NUMERIC(12,2) NOT NULL DEFAULT 0,
  source             TEXT NOT NULL DEFAULT '',
  scorecard_total    INT NOT NULL DEFAULT 0 CHECK (scorecard_total BETWEEN 0 AND 100),
  market_fit_score   INT NOT NULL DEFAULT 0 CHECK (market_fit_score BETWEEN 0 AND 100),
  market_fit_notes   TEXT,
  resume_url         TEXT,
  -- Scorecard breakdown (each 0-20, sum = scorecard_total)
  sc_skills_match         INT NOT NULL DEFAULT 0,
  sc_experience_relevance INT NOT NULL DEFAULT 0,
  sc_communication        INT NOT NULL DEFAULT 0,
  sc_stability            INT NOT NULL DEFAULT 0,
  sc_compensation_fit     INT NOT NULL DEFAULT 0,
  added_by_id        UUID REFERENCES public.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBMISSIONS (Kanban join table)
-- ============================================================
CREATE TABLE public.submissions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id     UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  opening_id       UUID NOT NULL REFERENCES public.openings(id) ON DELETE CASCADE,
  stage            submission_stage NOT NULL DEFAULT 'Sourced',
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recruiter_id     UUID NOT NULL REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(candidate_id, opening_id)
);

-- ============================================================
-- INTERVIEWS
-- ============================================================
CREATE TABLE public.interviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id   UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  round           INT NOT NULL DEFAULT 1,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          interview_status NOT NULL DEFAULT 'Scheduled',
  feedback_text   TEXT,
  feedback_score  INT CHECK (feedback_score BETWEEN 1 AND 10),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID NOT NULL REFERENCES public.users(id),
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  action      TEXT NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_actor ON public.activity_logs(actor_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE public.reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by  UUID REFERENCES public.users(id),
  sent_at      TIMESTAMPTZ,
  pdf_url      TEXT,
  status       report_status NOT NULL DEFAULT 'Draft',
  content      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DAILY LOGS
-- ============================================================
CREATE TABLE public.daily_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id),
  log_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  resumes_sourced     INT NOT NULL DEFAULT 0,
  calls_made          INT NOT NULL DEFAULT 0,
  submissions_done    INT NOT NULL DEFAULT 0,
  interviews_arranged INT NOT NULL DEFAULT 0,
  offers_made         INT NOT NULL DEFAULT 0,
  notes               TEXT,
  blockers            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, log_date)
);

-- ============================================================
-- APP SETTINGS
-- ============================================================
CREATE TABLE public.app_settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default settings
INSERT INTO public.app_settings (key, value, description) VALUES
  ('candidate_aging_days', '5', 'Flag candidate stuck in a stage for more than this many days'),
  ('opening_inactive_days', '7', 'Flag opening with no activity for more than this many days'),
  ('recruiter_weekly_target_resumes', '10', 'Minimum resumes sourced per recruiter per week'),
  ('report_overdue_days', '7', 'Flag weekly report overdue after this many days');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_team_lead()
RETURNS UUID AS $$
  SELECT team_lead_id FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS policies
-- ============================================================
CREATE POLICY "users_select" ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR current_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "users_insert" ON public.users FOR INSERT
  WITH CHECK (current_user_role() = 'admin');

CREATE POLICY "users_update" ON public.users FOR UPDATE
  USING (
    auth.uid() = id
    OR current_user_role() = 'admin'
  );

CREATE POLICY "users_delete" ON public.users FOR DELETE
  USING (current_user_role() = 'admin');

-- ============================================================
-- CLIENTS policies
-- ============================================================
CREATE POLICY "clients_select" ON public.clients FOR SELECT
  USING (
    current_user_role() IN ('admin', 'manager')
    OR account_owner_id = auth.uid()
  );

CREATE POLICY "clients_insert" ON public.clients FOR INSERT
  WITH CHECK (
    current_user_role() IN ('admin', 'manager', 'recruiter')
  );

CREATE POLICY "clients_update" ON public.clients FOR UPDATE
  USING (
    current_user_role() IN ('admin', 'manager')
    OR account_owner_id = auth.uid()
  );

CREATE POLICY "clients_delete" ON public.clients FOR DELETE
  USING (current_user_role() IN ('admin', 'manager'));

-- ============================================================
-- OPENINGS policies
-- ============================================================
CREATE POLICY "openings_select" ON public.openings FOR SELECT
  USING (
    current_user_role() IN ('admin', 'manager')
    OR assigned_recruiter_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_id AND c.account_owner_id = auth.uid()
    )
  );

CREATE POLICY "openings_insert" ON public.openings FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'manager', 'recruiter'));

CREATE POLICY "openings_update" ON public.openings FOR UPDATE
  USING (
    current_user_role() IN ('admin', 'manager')
    OR assigned_recruiter_id = auth.uid()
  );

CREATE POLICY "openings_delete" ON public.openings FOR DELETE
  USING (current_user_role() IN ('admin', 'manager'));

-- ============================================================
-- CANDIDATES policies
-- ============================================================
CREATE POLICY "candidates_select" ON public.candidates FOR SELECT
  USING (
    current_user_role() IN ('admin', 'manager')
    OR added_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.candidate_id = id AND s.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "candidates_insert" ON public.candidates FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'manager', 'recruiter'));

CREATE POLICY "candidates_update" ON public.candidates FOR UPDATE
  USING (
    current_user_role() IN ('admin', 'manager')
    OR added_by_id = auth.uid()
  );

CREATE POLICY "candidates_delete" ON public.candidates FOR DELETE
  USING (current_user_role() IN ('admin', 'manager'));

-- ============================================================
-- SUBMISSIONS policies
-- ============================================================
CREATE POLICY "submissions_select" ON public.submissions FOR SELECT
  USING (
    current_user_role() IN ('admin', 'manager')
    OR recruiter_id = auth.uid()
  );

CREATE POLICY "submissions_insert" ON public.submissions FOR INSERT
  WITH CHECK (current_user_role() IN ('admin', 'manager', 'recruiter'));

CREATE POLICY "submissions_update" ON public.submissions FOR UPDATE
  USING (
    current_user_role() IN ('admin', 'manager')
    OR recruiter_id = auth.uid()
  );

CREATE POLICY "submissions_delete" ON public.submissions FOR DELETE
  USING (current_user_role() IN ('admin', 'manager'));

-- ============================================================
-- INTERVIEWS policies
-- ============================================================
CREATE POLICY "interviews_select" ON public.interviews FOR SELECT
  USING (
    current_user_role() IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_id AND s.recruiter_id = auth.uid()
    )
  );

CREATE POLICY "interviews_all" ON public.interviews FOR ALL
  USING (current_user_role() IN ('admin', 'manager', 'recruiter'));

-- ============================================================
-- ACTIVITY LOGS policies
-- ============================================================
CREATE POLICY "activity_logs_select" ON public.activity_logs FOR SELECT
  USING (
    current_user_role() IN ('admin', 'manager')
    OR actor_id = auth.uid()
  );

CREATE POLICY "activity_logs_insert" ON public.activity_logs FOR INSERT
  WITH CHECK (actor_id = auth.uid());

-- ============================================================
-- REPORTS policies
-- ============================================================
CREATE POLICY "reports_select" ON public.reports FOR SELECT
  USING (
    current_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "reports_all" ON public.reports FOR ALL
  USING (current_user_role() IN ('admin', 'manager'));

-- ============================================================
-- DAILY LOGS policies
-- ============================================================
CREATE POLICY "daily_logs_select" ON public.daily_logs FOR SELECT
  USING (
    current_user_role() IN ('admin', 'manager')
    OR user_id = auth.uid()
  );

CREATE POLICY "daily_logs_insert" ON public.daily_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "daily_logs_update" ON public.daily_logs FOR UPDATE
  USING (user_id = auth.uid() OR current_user_role() IN ('admin', 'manager'));

-- ============================================================
-- APP SETTINGS policies
-- ============================================================
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "app_settings_update" ON public.app_settings FOR UPDATE
  USING (current_user_role() = 'admin');

-- ============================================================
-- TRIGGER: auto-create user profile after auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'recruiter')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- VIEWS for convenience
-- ============================================================
CREATE OR REPLACE VIEW public.v_submissions_with_days AS
SELECT
  s.*,
  EXTRACT(DAY FROM NOW() - s.stage_entered_at)::INT AS days_in_stage,
  c.name AS candidate_name,
  c.current_employer,
  c.scorecard_total,
  o.title AS opening_title,
  o.practice_area,
  cl.name AS client_name,
  u.name AS recruiter_name
FROM public.submissions s
JOIN public.candidates c ON c.id = s.candidate_id
JOIN public.openings o ON o.id = s.opening_id
JOIN public.clients cl ON cl.id = o.client_id
JOIN public.users u ON u.id = s.recruiter_id;
