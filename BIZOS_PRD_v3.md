# BIZOS — Product Requirements Document v3
## Recruiter Accountability + End-to-End Tracking

**Author:** Senior PM — BIZOS  
**Date:** July 2026  
**Status:** Approved for Build  
**Scope:** 7 requirements derived from operational review

---

## Context & Goal

BIZOS is used exclusively *after* a candidate resume has been submitted to a client. The primary stakeholders are:
- **Kaushik (Owner / Super Admin)** — wants full visibility into recruiter performance and client pipeline health
- **Managers / Admins** — want to track team activity and hold recruiters accountable
- **Recruiters** — want a simple way to log what happened with each candidate

The goal of v3 is to make it **impossible to not know what is happening** — with a recruiter's workload, with a client's pipeline, and with each candidate's journey.

---

## Requirement 1 — Dashboard Date Filter

### Problem
Dashboard KPI tiles (Active Clients, Open Mandates, Resumes Sourced, Interviews, etc.) show all-time or ambiguous counts. There is no way to answer "what happened this week?" or "how did we perform in June?"

### Requirements
- **Date range picker** on the dashboard header: Today / This Week / This Month / Last Month / Custom Range
- All KPI tiles recalculate based on the selected range
- Needs Attention panel respects date context (aging is relative, not filtered)
- Default view: **This Week** (Mon–today)
- The selected range persists per session (not per reload)

### Success Metric
Manager can answer "how many submissions did the team make this week?" in under 5 seconds.

---

## Requirement 2 — Super Admin Role

### Problem
Currently "admin" is the highest role. The business owner needs a role that:
- Cannot be demoted by any admin
- Sees all data across all teams
- Can promote/demote admins
- Can override any setting

### Requirements
- New role: `super_admin` — sits above `admin` in the hierarchy
- Super Admin can:
  - See all users including admins
  - Promote any user to any role including admin
  - Demote admins (admins cannot demote admins)
  - View all recruiter logs, all client data, all pipeline data regardless of team assignment
  - Access a "System" section in Settings showing platform-level config
- Super Admin cannot be modified by anyone except another super_admin
- Role hierarchy: `super_admin > admin > manager > recruiter > viewer`
- Only one super_admin initially (er.kaushiksrivastava@gmail.com)

### Success Metric
Owner logs in and sees everything — no data hidden, no role restriction.

---

## Requirement 3 — Pipeline Starts from "Submitted"

### Problem
Current pipeline starts with Sourced → Screened → Submitted. BIZOS is only used when a resume has already been submitted to a client. The Sourced and Screened stages create noise and confusion.

### Requirements
- Default pipeline stages (in order): **Submitted → Client Review → Interview L1 → Interview L2 → Offer → Joined → Dropped**
- Sourced and Screened stages are **removed from the default Kanban flow**
- Existing submissions in Sourced/Screened stage are migrated to "Submitted"
- All stage references (charts, filters, PRD command view) updated accordingly
- The `SubmissionStage` type is updated in code

### Success Metric
A recruiter adding a new candidate immediately sees "Submitted" as the starting stage.

---

## Requirement 4 — Candidate Status Updated from Candidate Profile

### Problem
Stage changes happen only on the Kanban board (per opening). Recruiters cannot see or update a candidate's full cross-client status from the candidate's own profile page.

### Requirements
- On the Candidate Detail page: a **"Client Submissions" panel** showing:
  - Each client/opening this candidate was submitted to
  - Current stage with colour-coded badge
  - Days in current stage
  - Last action logged
- From this panel, recruiter can:
  - **Change stage** via dropdown (with confirmation)
  - **Log an action** (Interview scheduled / Feedback received / Offer made / etc.)
  - **Add a note** per submission
- Stage change from here triggers the same forms as Kanban (SubmissionRecordForm / InterviewForm / OfferForm)
- Changes reflected immediately in Kanban and Pipeline Command View

### Success Metric
Recruiter can update candidate journey without navigating to the Kanban board.

---

## Requirement 5 — Dashboard KPI Tiles → Drill-Down Navigation

### Problem
Clicking a KPI tile on the dashboard does nothing. There is no way to go from "8 Interviews" to actually seeing which interviews those are.

### Requirements
- Each KPI tile is **clickable and navigates to a filtered view**:
  - "Interviews" → `/pipeline?stage=Interview+L1,Interview+L2` (filtered Pipeline Command View)
  - "Resumes Sourced / Submissions" → `/candidates?date=thisweek`
  - "Active Clients" → `/clients`
  - "Open Mandates" → `/openings?status=Open`
  - "Offers" → `/pipeline?stage=Offer`
  - "Joinings" → `/pipeline?stage=Joined`
- Filters apply the current dashboard date range
- Clicking "Needs Attention" items already navigates — no change needed there

### Success Metric
From dashboard, clicking "Interviews" shows the exact 8 interviews in the Pipeline Command View.

---

## Requirement 6 — Replace "Current Employer" with "Client Submitted To"

### Problem
The candidate form asks for "Current Employer" (the company where the candidate currently works). While useful context, it's not the primary operational field. What matters most is **which client this resume was submitted to** — that's what drives pipeline tracking.

### Requirements
- In **CandidateForm** and **CandidateDetail**:
  - Field label changes from "Current Employer" to **"Current Company"** (still kept for context — e.g. "works at Infosys")
  - A new required field: **"Submitted To (Client)"** — dropdown of active clients
  - On save, automatically create a Submission record linking this candidate to the selected client's first Open mandate (or allow recruiter to choose from a list of open mandates for that client)
- This means adding a candidate automatically creates their first pipeline entry — no separate step
- Column in candidate list view shows "Submitted To" instead of or alongside current employer

### Success Metric
Adding a candidate auto-places them in the pipeline without a separate "Add to Opening" step.

---

## Requirement 7 — Daily Log: Operational Metrics

### Problem
Current daily log shows arbitrary manual counters (resumes sourced, calls made, etc.) with no link to actual pipeline data. The owner cannot tell if a recruiter is lying about their numbers.

### Requirements
The daily log is rebuilt around **verifiable, pipeline-linked metrics**:

| Metric | Source | Manual Override |
|---|---|---|
| Positions being worked on | Count of Open mandates assigned to this recruiter | No (auto) |
| Total resumes submitted (today/week) | Count of Submission stage entries created by recruiter | No (auto) |
| Interviews arranged (scheduled) | Count of Interviews with status=Scheduled created today | No (auto) |
| Interviews done (completed) | Count of Interviews with status=Completed today | No (auto) |
| Interviews pending | Interviews Scheduled but date has passed | Auto-flagged |
| Offers made | Count of Offer stage entries | No (auto) |
| Joinings confirmed | Count of Joined stage entries | No (auto) |
| Calls logged | Count of call_logs entries today | Via Call Log section |
| Notes / Blockers | Free text | Yes |

- Numbers are **auto-populated from pipeline** — recruiter cannot manually inflate them
- A **"vs. yesterday"** delta shows trend per metric
- **Weekly summary** at bottom: same metrics aggregated Mon–today
- For Admin/Manager: same view but shows **per-recruiter breakdown** as a table
- Overdue tasks (tasks with due_date < today) are surfaced prominently

### Success Metric
Owner can open Daily Log and immediately see: "Recruiter A submitted 3 resumes today, arranged 2 interviews, logged 5 calls. 1 interview is overdue (not marked done)."

---

## Out of Scope (v3)

- Client Transparency Portal (v2 P1)
- Candidate Transparency Portal (v2 P2)
- WhatsApp API integration
- Resume parsing

---

## Priority Matrix v3

| Priority | Requirement | Effort |
|---|---|---|
| P0 | Pipeline starts from Submitted (Req 3) | Low |
| P0 | Daily Log: auto-populated metrics (Req 7) | Medium |
| P0 | Candidate status from profile (Req 4) | Medium |
| P1 | Dashboard date filter (Req 1) | Medium |
| P1 | KPI tile drill-down navigation (Req 5) | Low |
| P1 | Super Admin role (Req 2) | Low |
| P1 | Current Employer → Client Submitted To (Req 6) | Medium |

---

## Role Hierarchy (updated)

```
super_admin  ← owner, full access, cannot be demoted by admins
  └── admin  ← can manage recruiters, see all team data
        └── manager  ← can approve leaves, see team pipeline
              └── recruiter  ← can manage their own candidates
                    └── viewer  ← read-only
```

---

*BIZOS v3 — built by Claude (Anthropic) for Bizquad Consultants*
