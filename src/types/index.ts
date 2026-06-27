export type UserRole = 'admin' | 'manager' | 'recruiter' | 'viewer'

export type HealthStatus = 'green' | 'amber' | 'red'
export type EngagementType = 'Permanent' | 'Contract' | 'C2H' | 'C2C'
export type OpeningStatus = 'Open' | 'On Hold' | 'Closed'
export type SubmissionStage =
  | 'Sourced'
  | 'Screened'
  | 'Submitted'
  | 'Client Review'
  | 'Interview L1'
  | 'Interview L2'
  | 'Offer'
  | 'Joined'
  | 'Dropped'
export type InterviewStatus = 'Scheduled' | 'Completed' | 'No-show' | 'Cancelled'
export type ReportStatus = 'Draft' | 'Approved' | 'Sent'
export type PracticeArea =
  | 'SAP'
  | 'Cloud'
  | 'Full Stack'
  | 'Data/AI'
  | 'GenAI'
  | 'Salesforce'
  | 'ServiceNow'
  | 'DevOps'
  | 'Other'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  team_lead_id: string | null
  created_at: string
  avatar_url?: string
}

export interface Client {
  id: string
  name: string
  industry: string
  source_vendor: string
  fee_percentage: number
  payment_terms: string
  intake_score: number
  health_status: HealthStatus
  account_owner_id: string
  account_owner?: User
  created_at: string
  open_mandates_count?: number
  last_activity_at?: string
}

export interface Opening {
  id: string
  client_id: string
  client?: Client
  title: string
  practice_area: PracticeArea
  seniority: string
  ctc_band: string
  engagement_type: EngagementType
  status: OpeningStatus
  assigned_recruiter_id: string
  assigned_recruiter?: User
  created_at: string
  submissions_count?: number
}

export interface Candidate {
  id: string
  name: string
  current_employer: string
  ctc_current: number
  ctc_expected: number
  source: string
  scorecard_total: number
  market_fit_score: number
  resume_url: string | null
  created_at: string
  submissions?: Submission[]
}

export interface Submission {
  id: string
  candidate_id: string
  candidate?: Candidate
  opening_id: string
  opening?: Opening
  stage: SubmissionStage
  stage_entered_at: string
  recruiter_id: string
  recruiter?: User
  created_at: string
  days_in_stage?: number
}

export interface Interview {
  id: string
  submission_id: string
  submission?: Submission
  round: number
  scheduled_at: string
  status: InterviewStatus
  feedback_text: string | null
  feedback_score: number | null
  created_at: string
}

export interface ActivityLog {
  id: string
  actor_id: string
  actor?: User
  entity_type: string
  entity_id: string
  action: string
  notes: string | null
  created_at: string
}

export interface Report {
  id: string
  client_id: string
  client?: Client
  period_start: string
  period_end: string
  generated_at: string
  approved_by: string | null
  approver?: User
  sent_at: string | null
  pdf_url: string | null
  status: ReportStatus
  content?: string
}

export interface DailyLog {
  id: string
  user_id: string
  user?: User
  log_date: string
  resumes_sourced: number
  calls_made: number
  submissions_done: number
  interviews_arranged: number
  offers_made: number
  notes: string | null
  blockers: string | null
  created_at: string
}

export interface AppSettings {
  id: string
  key: string
  value: string
  description: string | null
}

export interface ScorecardBreakdown {
  skills_match: number
  experience_relevance: number
  communication: number
  stability: number
  compensation_fit: number
}
