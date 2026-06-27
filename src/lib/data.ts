import { createClient } from '@/lib/supabase/server'

export async function getDashboardKPIs() {
  const supabase = await createClient()
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const [
    { count: activeClients },
    { count: openMandates },
    { count: resumesThisWeek },
    { count: resumesLastWeek },
    { count: interviewsScheduled },
    { count: interviewsCompleted },
    { count: interviewsLastWeek },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('health_status', 'green').or('health_status.eq.amber'),
    supabase.from('openings').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
    supabase.from('submissions').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
    supabase.from('submissions').select('*', { count: 'exact', head: true }).gte('created_at', lastWeekStart.toISOString()).lt('created_at', weekStart.toISOString()),
    supabase.from('interviews').select('*', { count: 'exact', head: true }).eq('status', 'Scheduled').gte('scheduled_at', weekStart.toISOString()),
    supabase.from('interviews').select('*', { count: 'exact', head: true }).eq('status', 'Completed').gte('scheduled_at', weekStart.toISOString()),
    supabase.from('interviews').select('*', { count: 'exact', head: true }).gte('scheduled_at', lastWeekStart.toISOString()).lt('scheduled_at', weekStart.toISOString()),
  ])

  // Active clients: count all (green + amber)
  const { count: totalActiveClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .in('health_status', ['green', 'amber'])

  return {
    activeClients: totalActiveClients ?? 0,
    openMandates: openMandates ?? 0,
    resumesThisWeek: resumesThisWeek ?? 0,
    resumesLastWeek: resumesLastWeek ?? 0,
    interviewsScheduled: interviewsScheduled ?? 0,
    interviewsCompleted: interviewsCompleted ?? 0,
    interviewsLastWeek: interviewsLastWeek ?? 0,
  }
}

export async function getNeedsAttention() {
  const supabase = await createClient()

  // Get thresholds
  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['candidate_aging_days', 'opening_inactive_days', 'report_overdue_days'])

  const thresholds = Object.fromEntries((settings ?? []).map(s => [s.key, parseInt(s.value)]))
  const candidateDays = thresholds.candidate_aging_days ?? 5
  const openingDays = thresholds.opening_inactive_days ?? 7

  const candidateCutoff = new Date()
  candidateCutoff.setDate(candidateCutoff.getDate() - candidateDays)

  const openingCutoff = new Date()
  openingCutoff.setDate(openingCutoff.getDate() - openingDays)

  const [stuckCandidates, inactiveOpenings] = await Promise.all([
    supabase
      .from('submissions')
      .select('id, candidate_id, opening_id, stage, stage_entered_at, candidates(name), openings(title, client_id, clients(name))')
      .lt('stage_entered_at', candidateCutoff.toISOString())
      .not('stage', 'in', '("Joined","Dropped")')
      .order('stage_entered_at', { ascending: true })
      .limit(10),
    supabase
      .from('openings')
      .select('id, title, status, client_id, clients(name)')
      .eq('status', 'Open')
      .limit(10),
  ])

  return {
    stuckCandidates: stuckCandidates.data ?? [],
    inactiveOpenings: inactiveOpenings.data ?? [],
  }
}

export async function getClients() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select(`
      *,
      account_owner:users(id, name, email),
      openings(id, status)
    `)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getClientById(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select(`*, account_owner:users(id, name, email)`)
    .eq('id', id)
    .single()
  return data
}

export async function getOpenings(filters?: {
  clientId?: string
  status?: string
  practiceArea?: string
  recruiterId?: string
}) {
  const supabase = await createClient()
  let query = supabase
    .from('openings')
    .select(`
      *,
      client:clients(id, name, health_status),
      assigned_recruiter:users(id, name)
    `)
    .order('created_at', { ascending: false })

  if (filters?.clientId) query = query.eq('client_id', filters.clientId)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.practiceArea) query = query.eq('practice_area', filters.practiceArea)
  if (filters?.recruiterId) query = query.eq('assigned_recruiter_id', filters.recruiterId)

  const { data } = await query
  return data ?? []
}

export async function getOpeningById(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('openings')
    .select(`
      *,
      client:clients(id, name, health_status),
      assigned_recruiter:users(id, name)
    `)
    .eq('id', id)
    .single()
  return data
}

export async function getSubmissionsForOpening(openingId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('submissions')
    .select(`
      *,
      candidate:candidates(id, name, current_employer, scorecard_total),
      recruiter:users(id, name)
    `)
    .eq('opening_id', openingId)
    .order('stage_entered_at', { ascending: false })
  return data ?? []
}

export async function getCandidates(searchQuery?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('candidates')
    .select(`
      *,
      submissions(
        id, stage, opening_id,
        opening:openings(id, title, client_id, clients(name))
      )
    `)
    .order('created_at', { ascending: false })

  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,current_employer.ilike.%${searchQuery}%`)
  }

  const { data } = await query
  return data ?? []
}

export async function getCandidateById(id: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('candidates')
    .select(`
      *,
      submissions(
        *,
        opening:openings(id, title, client_id, clients(name)),
        interviews(*)
      )
    `)
    .eq('id', id)
    .single()
  return data
}

export async function getActivityLogs(entityType?: string, entityId?: string, limit = 50) {
  const supabase = await createClient()
  let query = supabase
    .from('activity_logs')
    .select(`*, actor:users(id, name, role)`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (entityType) query = query.eq('entity_type', entityType)
  if (entityId) query = query.eq('entity_id', entityId)

  const { data } = await query
  return data ?? []
}

export async function logActivity(params: {
  actorId: string
  entityType: string
  entityId: string
  action: string
  notes?: string
}) {
  const supabase = await createClient()
  await supabase.from('activity_logs').insert({
    actor_id: params.actorId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    notes: params.notes ?? null,
  })
}

export async function getUsers() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('*')
    .order('name')
  return data ?? []
}

export async function getReports(clientId?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('reports')
    .select(`*, client:clients(id, name), approver:users(id, name)`)
    .order('generated_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data } = await query
  return data ?? []
}

export async function getDailyLogs(userId?: string, startDate?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('daily_logs')
    .select(`*, user:users(id, name)`)
    .order('log_date', { ascending: false })

  if (userId) query = query.eq('user_id', userId)
  if (startDate) query = query.gte('log_date', startDate)

  const { data } = await query
  return data ?? []
}

export async function getProductivityData(startDate: string, endDate: string) {
  const supabase = await createClient()

  const [submissions, interviews, dailyLogs] = await Promise.all([
    supabase
      .from('submissions')
      .select('created_at, recruiter_id, recruiter:users(name), opening_id')
      .gte('created_at', startDate)
      .lte('created_at', endDate),
    supabase
      .from('interviews')
      .select('scheduled_at, status, submission_id, submissions(recruiter_id, recruiter:users(name))')
      .gte('scheduled_at', startDate)
      .lte('scheduled_at', endDate),
    supabase
      .from('daily_logs')
      .select('*, user:users(name)')
      .gte('log_date', startDate)
      .lte('log_date', endDate)
      .order('log_date', { ascending: true }),
  ])

  return {
    submissions: submissions.data ?? [],
    interviews: interviews.data ?? [],
    dailyLogs: dailyLogs.data ?? [],
  }
}
