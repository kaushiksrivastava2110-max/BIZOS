'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Loader2, CheckCircle2, ClipboardList, ChevronDown, ChevronUp, Plus, CheckSquare,
  Square, Briefcase, Target, Phone, Trash2, BarChart2, AlertCircle, Video,
  TrendingUp, TrendingDown, Minus, Gift, Users,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

const TODAY = new Date().toISOString().split('T')[0]
const YESTERDAY = (() => {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]
})()

interface OpsMetrics {
  openPositions: number
  submittedToday: number
  ivsArranged: number
  ivsDone: number
  ivsPending: number
  offersToday: number
  joiningsToday: number
  prevSubmitted: number
  prevIvsArranged: number
  prevIvsDone: number
}

export function DailyLogView({ currentUser }: Props) {
  const [todayLog, setTodayLog] = useState<any | null>(null)
  const [pastLogs, setPastLogs] = useState<any[]>([])
  const [teamLogs, setTeamLogs] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [opsMetrics, setOpsMetrics] = useState<OpsMetrics>({
    openPositions: 0, submittedToday: 0, ivsArranged: 0, ivsDone: 0, ivsPending: 0,
    offersToday: 0, joiningsToday: 0, prevSubmitted: 0, prevIvsArranged: 0, prevIvsDone: 0,
  })
  const [recruiterMetrics, setRecruiterMetrics] = useState<any[]>([])
  const [recruiters, setRecruiters] = useState<User[]>([])
  const [openings, setOpenings] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandHistory, setExpandHistory] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [callLogs, setCallLogs] = useState<any[]>([])
  const [showCallForm, setShowCallForm] = useState(false)
  const [callForm, setCallForm] = useState({
    contact_name: '', contact_type: 'Candidate', call_type: 'Sourcing',
    outcome: 'Interested', follow_up_required: false, notes: '',
  })
  const [callSaving, setCallSaving] = useState(false)
  const [todayPipelineSubmissions, setTodayPipelineSubmissions] = useState<any[]>([])
  const [taskForm, setTaskForm] = useState({
    assigned_to: '', title: '', description: '', due_date: '', opening_id: '',
    task_type: 'Other', priority: 'Medium', candidate_id: '', client_id: '',
  })
  const [taskSaving, setTaskSaving] = useState(false)
  const [form, setForm] = useState({
    resumes_sourced: 0, calls_made: 0, submissions_done: 0,
    interviews_arranged: 0, offers_made: 0, notes: '', blockers: '',
  })
  const supabase = createClient()

  async function load() {
    const NOW = new Date().toISOString()
    const isAdmin = ['admin', 'manager', 'super_admin'].includes(currentUser.role)

    const [
      todayRes, pastRes, tasksRes,
      openPosRes, subTodayRes,
      ivsArrangedRes, ivsDoneRes, ivsPendingRes,
      offersTodayRes, joiningsTodayRes,
      prevSubRes, prevIvsArrangedRes, prevIvsDoneRes,
      callLogsRes, pipelineSubsRes,
    ] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('user_id', currentUser.id).eq('log_date', TODAY).single(),
      supabase.from('daily_logs').select('*, user:users(name)').eq('user_id', currentUser.id).lt('log_date', TODAY).order('log_date', { ascending: false }).limit(14),
      supabase.from('recruiter_tasks').select('*, assigned_to:users!recruiter_tasks_assigned_to_fkey(name), opening:openings(title)').or(`assigned_to.eq.${currentUser.id},assigned_by.eq.${currentUser.id}`).order('created_at', { ascending: false }),
      // Today ops metrics
      supabase.from('openings').select('id', { count: 'exact', head: true }).eq('status', 'Open'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).gte('created_at', TODAY + 'T00:00:00').lte('created_at', TODAY + 'T23:59:59'),
      supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('status', 'Scheduled').gte('scheduled_at', TODAY + 'T00:00:00').lte('scheduled_at', TODAY + 'T23:59:59'),
      supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('status', 'Completed').gte('scheduled_at', TODAY + 'T00:00:00').lte('scheduled_at', TODAY + 'T23:59:59'),
      supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('status', 'Scheduled').lt('scheduled_at', NOW),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('stage', 'Offer').gte('stage_entered_at', TODAY + 'T00:00:00'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('stage', 'Joined').gte('stage_entered_at', TODAY + 'T00:00:00'),
      // Yesterday (for delta)
      supabase.from('submissions').select('id', { count: 'exact', head: true }).gte('created_at', YESTERDAY + 'T00:00:00').lte('created_at', YESTERDAY + 'T23:59:59'),
      supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('status', 'Scheduled').gte('scheduled_at', YESTERDAY + 'T00:00:00').lte('scheduled_at', YESTERDAY + 'T23:59:59'),
      supabase.from('interviews').select('id', { count: 'exact', head: true }).eq('status', 'Completed').gte('scheduled_at', YESTERDAY + 'T00:00:00').lte('scheduled_at', YESTERDAY + 'T23:59:59'),
      // Call log + pipeline subs (scoped to current user)
      supabase.from('call_logs').select('*').eq('user_id', currentUser.id).eq('log_date', TODAY).order('created_at', { ascending: false }),
      supabase.from('submissions').select('id, stage, candidate:candidates(name), opening:openings(title)').eq('recruiter_id', currentUser.id).gte('created_at', TODAY + 'T00:00:00').lte('created_at', TODAY + 'T23:59:59'),
    ])

    if (todayRes.data) {
      setTodayLog(todayRes.data)
      const t = todayRes.data
      setForm({ resumes_sourced: t.resumes_sourced, calls_made: t.calls_made, submissions_done: t.submissions_done, interviews_arranged: t.interviews_arranged, offers_made: t.offers_made, notes: t.notes ?? '', blockers: t.blockers ?? '' })
    }
    setPastLogs(pastRes.data ?? [])
    setTasks(tasksRes.data ?? [])
    setCallLogs(callLogsRes.data ?? [])
    setTodayPipelineSubmissions(pipelineSubsRes.data ?? [])
    setOpsMetrics({
      openPositions: openPosRes.count ?? 0,
      submittedToday: subTodayRes.count ?? 0,
      ivsArranged: ivsArrangedRes.count ?? 0,
      ivsDone: ivsDoneRes.count ?? 0,
      ivsPending: ivsPendingRes.count ?? 0,
      offersToday: offersTodayRes.count ?? 0,
      joiningsToday: joiningsTodayRes.count ?? 0,
      prevSubmitted: prevSubRes.count ?? 0,
      prevIvsArranged: prevIvsArrangedRes.count ?? 0,
      prevIvsDone: prevIvsDoneRes.count ?? 0,
    })

    if (isAdmin) {
      const [teamRes, recruitersRes, openingsRes, candidatesRes, clientsRes, allSubsTodayRes, allIvsTodayRes] = await Promise.all([
        supabase.from('daily_logs').select('*, user:users(id, name)').eq('log_date', TODAY).order('created_at', { ascending: false }),
        supabase.from('users').select('*').in('role', ['recruiter', 'manager']).order('name'),
        supabase.from('openings').select('id, title, client:clients(name)').eq('status', 'Open').order('created_at', { ascending: false }),
        supabase.from('candidates').select('id, name, current_employer').order('name').limit(200),
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('submissions').select('recruiter_id, recruiter:users(name)').gte('created_at', TODAY + 'T00:00:00').lte('created_at', TODAY + 'T23:59:59'),
        supabase.from('interviews').select('status, submission:submissions(recruiter_id, recruiter:users(name))').gte('scheduled_at', TODAY + 'T00:00:00').lte('scheduled_at', TODAY + 'T23:59:59'),
      ])
      setTeamLogs(teamRes.data ?? [])
      setRecruiters((recruitersRes.data as User[]) ?? [])
      setOpenings(openingsRes.data ?? [])
      setCandidates(candidatesRes.data ?? [])
      setClients(clientsRes.data ?? [])

      // Aggregate per-recruiter breakdown
      const byRecruiter: Record<string, { name: string; submitted: number; ivsArranged: number; ivsDone: number }> = {}
      for (const sub of (allSubsTodayRes.data ?? [])) {
        const rid = sub.recruiter_id
        const rname = Array.isArray(sub.recruiter) ? sub.recruiter[0]?.name : (sub.recruiter as any)?.name
        if (rid) {
          if (!byRecruiter[rid]) byRecruiter[rid] = { name: rname ?? rid, submitted: 0, ivsArranged: 0, ivsDone: 0 }
          byRecruiter[rid].submitted++
        }
      }
      for (const iv of (allIvsTodayRes.data ?? [])) {
        const sub = Array.isArray(iv.submission) ? iv.submission[0] : iv.submission as any
        const rid = sub?.recruiter_id
        const rname = Array.isArray(sub?.recruiter) ? sub.recruiter[0]?.name : sub?.recruiter?.name
        if (rid) {
          if (!byRecruiter[rid]) byRecruiter[rid] = { name: rname ?? rid, submitted: 0, ivsArranged: 0, ivsDone: 0 }
          if (iv.status === 'Scheduled') byRecruiter[rid].ivsArranged++
          if (iv.status === 'Completed') byRecruiter[rid].ivsDone++
        }
      }
      setRecruiterMetrics(Object.entries(byRecruiter).map(([id, m]) => ({ id, ...m })))
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, user_id: currentUser.id, log_date: TODAY }
    if (todayLog) {
      await supabase.from('daily_logs').update(payload).eq('id', todayLog.id)
    } else {
      const { data } = await supabase.from('daily_logs').insert(payload).select().single()
      setTodayLog(data)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('activity_logs').insert({
          actor_id: user.id, entity_type: 'daily_log', entity_id: data?.id ?? user.id,
          action: 'daily_log_submitted',
          notes: `Daily log: ${form.resumes_sourced} resumes, ${form.submissions_done} submissions`,
        })
      }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    setTaskSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('recruiter_tasks').insert({
      assigned_by: user.id, assigned_to: taskForm.assigned_to, title: taskForm.title,
      description: taskForm.description || null, due_date: taskForm.due_date || null,
      opening_id: taskForm.opening_id || null, task_type: taskForm.task_type,
      priority: taskForm.priority, candidate_id: taskForm.candidate_id || null,
      client_id: taskForm.client_id || null,
    })
    setTaskForm({ assigned_to: '', title: '', description: '', due_date: '', opening_id: '', task_type: 'Other', priority: 'Medium', candidate_id: '', client_id: '' })
    setShowTaskForm(false)
    setTaskSaving(false)
    load()
  }

  async function handleAddCall(e: React.FormEvent) {
    e.preventDefault()
    setCallSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('call_logs').insert({
      user_id: user.id, log_date: TODAY, contact_name: callForm.contact_name,
      contact_type: callForm.contact_type, call_type: callForm.call_type,
      outcome: callForm.outcome, follow_up_required: callForm.follow_up_required,
      notes: callForm.notes || null,
    }).select().single()
    setCallLogs(prev => [data, ...prev])
    setCallForm({ contact_name: '', contact_type: 'Candidate', call_type: 'Sourcing', outcome: 'Interested', follow_up_required: false, notes: '' })
    setShowCallForm(false)
    setCallSaving(false)
  }

  async function deleteCallLog(id: string) {
    await supabase.from('call_logs').delete().eq('id', id)
    setCallLogs(prev => prev.filter(c => c.id !== id))
  }

  async function toggleTask(task: any) {
    const isDone = !task.is_done
    await supabase.from('recruiter_tasks').update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null }).eq('id', task.id)
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, is_done: isDone } : t))
  }

  const pendingTasks = tasks.filter(t => !t.is_done)
  const doneTasks = tasks.filter(t => t.is_done)
  const isAdmin = ['admin', 'manager', 'super_admin'].includes(currentUser.role)

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  const metricTiles = [
    { label: 'Open Mandates', value: opsMetrics.openPositions, prev: null, icon: Briefcase, color: '#0EA2E8', desc: 'Positions to work on' },
    { label: 'Submitted Today', value: opsMetrics.submittedToday, prev: opsMetrics.prevSubmitted, icon: Target, color: '#F9B710', desc: 'Resumes sent to clients' },
    { label: 'IVs Arranged', value: opsMetrics.ivsArranged, prev: opsMetrics.prevIvsArranged, icon: Video, color: '#8b5cf6', desc: 'Interviews scheduled today' },
    { label: 'IVs Done', value: opsMetrics.ivsDone, prev: opsMetrics.prevIvsDone, icon: CheckCircle2, color: '#82BC0D', desc: 'Interviews completed today' },
    { label: 'Offers Made', value: opsMetrics.offersToday, prev: null, icon: Gift, color: '#f97316', desc: 'Moved to Offer today' },
    { label: 'Joinings', value: opsMetrics.joiningsToday, prev: null, icon: Users, color: '#22c55e', desc: 'Confirmed joins today' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Live Pipeline Metrics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#0EA2E8]" />
            <h2 className="text-sm font-semibold text-[#1A1A2E]">Live Pipeline Metrics — {formatDate(TODAY)}</h2>
          </div>
          <span className="text-xs text-gray-400">Auto-populated · arrows vs yesterday</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {metricTiles.map(tile => {
            const Icon = tile.icon
            const diff = tile.prev !== null ? tile.value - tile.prev : null
            return (
              <div key={tile.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: tile.color + '18' }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: tile.color }} />
                  </div>
                  {diff !== null && diff !== 0 && (
                    <span className={`text-[10px] font-bold flex items-center gap-0.5 ${diff > 0 ? 'text-[#82BC0D]' : 'text-red-500'}`}>
                      {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {diff > 0 ? '+' : ''}{diff}
                    </span>
                  )}
                  {diff === 0 && tile.prev !== null && <Minus className="h-3 w-3 text-gray-300" />}
                </div>
                <p className="text-2xl font-bold text-[#1A1A2E] tabular-nums">{tile.value}</p>
                <p className="text-[11px] text-gray-600 font-medium mt-0.5 leading-tight">{tile.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{tile.desc}</p>
              </div>
            )
          })}
        </div>

        {/* Overdue interviews alert */}
        {opsMetrics.ivsPending > 0 && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-100">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-700 font-medium">
              {opsMetrics.ivsPending} interview{opsMetrics.ivsPending > 1 ? 's' : ''} past scheduled time without completion — follow up needed.
            </span>
          </div>
        )}
      </div>

      {/* Per-recruiter metrics (admin/manager) */}
      {isAdmin && recruiterMetrics.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-[#82BC0D]" /> Recruiter Breakdown — Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Recruiter', 'Submitted', 'IVs Arranged', 'IVs Done'].map(h => (
                    <th key={h} className={`text-xs font-medium text-gray-500 pb-2 ${h === 'Recruiter' ? 'text-left' : 'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recruiterMetrics.map(r => (
                  <tr key={r.id}>
                    <td className="py-2.5 text-sm font-medium text-[#1A1A2E]">{r.name}</td>
                    <td className="py-2.5 text-center text-sm font-bold" style={{ color: '#F9B710' }}>{r.submitted}</td>
                    <td className="py-2.5 text-center text-sm font-bold" style={{ color: '#8b5cf6' }}>{r.ivsArranged}</td>
                    <td className="py-2.5 text-center text-sm font-bold" style={{ color: '#82BC0D' }}>{r.ivsDone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Log status + tasks pending quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="h-4 w-4 text-[#82BC0D]" />
            <span className="text-xs text-gray-500">Tasks Pending</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A2E]">{pendingTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{doneTasks.length} completed</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500">Log Status</span>
          </div>
          <p className="text-sm font-bold mt-1" style={{ color: todayLog ? '#82BC0D' : '#F9B710' }}>
            {todayLog ? '✓ Logged' : 'Not Yet'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(TODAY)}</p>
        </div>
      </div>

      {/* Tasks panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4 text-[#82BC0D]" /> Tasks
            </CardTitle>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setShowTaskForm(true)}>
                <Plus className="h-3.5 w-3.5" /> Assign Task
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No tasks assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map(task => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                  <button onClick={() => toggleTask(task)} className="mt-0.5 shrink-0 text-gray-300 hover:text-[#82BC0D] transition-colors">
                    <Square className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[#1A1A2E]">{task.title}</p>
                      {task.priority && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          task.priority === 'High' ? 'bg-red-100 text-red-600' :
                          task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{task.priority}</span>
                      )}
                      {task.task_type && task.task_type !== 'Other' && (
                        <span className="text-[10px] bg-[#0EA2E8]/10 text-[#0EA2E8] px-1.5 py-0.5 rounded">{task.task_type}</span>
                      )}
                    </div>
                    {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {task.assigned_to?.name && <span className="text-xs text-[#0EA2E8]">→ {task.assigned_to.name}</span>}
                      {task.opening?.title && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{task.opening.title}</span>}
                      {task.due_date && <span className={`text-xs ${task.due_date < TODAY ? 'text-red-500 font-medium' : 'text-gray-400'}`}>Due {formatDate(task.due_date)}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {doneTasks.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">{doneTasks.length} completed</p>
                  {doneTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-2.5 opacity-50">
                      <button onClick={() => toggleTask(task)} className="mt-0.5 shrink-0 text-[#82BC0D]">
                        <CheckSquare className="h-4 w-4" />
                      </button>
                      <p className="text-sm line-through text-gray-500">{task.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline submissions today */}
      {todayPipelineSubmissions.length > 0 && (
        <div className="rounded-xl border border-[#F9B710]/20 bg-[#F9B710]/5 px-4 py-3">
          <p className="text-xs font-semibold text-[#b8890a] mb-2">Today's Pipeline Submissions (auto-detected)</p>
          <div className="space-y-1">
            {todayPipelineSubmissions.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="text-[#82BC0D]">✓</span>
                <span className="font-medium">{s.candidate?.name}</span>
                <span className="text-gray-400">→ {s.opening?.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-[#0EA2E8]" /> Call Log — Today
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowCallForm(v => !v)}>
              <Plus className="h-3.5 w-3.5" /> Log Call
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showCallForm && (
            <form onSubmit={handleAddCall} className="mb-4 p-4 border border-gray-100 rounded-lg bg-gray-50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Contact Name *</Label>
                  <Input value={callForm.contact_name} onChange={e => setCallForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Candidate / client name" required className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contact Type</Label>
                  <Select value={callForm.contact_type} onValueChange={v => setCallForm(f => ({ ...f, contact_type: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{['Candidate', 'Client'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Call Type</Label>
                  <Select value={callForm.call_type} onValueChange={v => setCallForm(f => ({ ...f, call_type: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{['Sourcing', 'Screening', 'Offer', 'Feedback', 'General'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Outcome</Label>
                  <Select value={callForm.outcome} onValueChange={v => setCallForm(f => ({ ...f, outcome: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{['Interested', 'Not Interested', 'Callback Required', 'Accepted', 'Rejected', 'Other'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                  <input type="checkbox" checked={callForm.follow_up_required} onChange={e => setCallForm(f => ({ ...f, follow_up_required: e.target.checked }))} className="rounded border-gray-300 text-[#0EA2E8]" />
                  Follow-up required
                </label>
              </div>
              <Input value={callForm.notes} onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="h-8 text-sm" />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCallForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" size="sm" disabled={callSaving || !callForm.contact_name}>
                  {callSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Call'}
                </Button>
              </div>
            </form>
          )}
          {callLogs.length === 0 && !showCallForm ? (
            <p className="text-sm text-gray-400 text-center py-4">No calls logged today.</p>
          ) : (
            <div className="space-y-2">
              {callLogs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#1A1A2E]">{log.contact_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${log.contact_type === 'Candidate' ? 'bg-[#0EA2E8]/10 text-[#0EA2E8]' : 'bg-purple-100 text-purple-600'}`}>
                        {log.contact_type}
                      </span>
                      <span className="text-xs text-gray-400">{log.call_type}</span>
                      <span className={`text-xs font-medium ${log.outcome === 'Interested' || log.outcome === 'Accepted' ? 'text-[#82BC0D]' : log.outcome === 'Not Interested' || log.outcome === 'Rejected' ? 'text-red-500' : 'text-[#F9B710]'}`}>
                        {log.outcome}
                      </span>
                      {log.follow_up_required && <span className="text-[10px] bg-[#F9B710]/20 text-[#b8890a] px-1.5 py-0.5 rounded">Follow-up ⚡</span>}
                    </div>
                    {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                  </div>
                  <button onClick={() => deleteCallLog(log.id)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's activity log (manual notes + blockers) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-[#82BC0D]" /> Notes & Blockers
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={todayLog ? 'green' : 'default'}>{todayLog ? 'Logged' : 'Not yet logged'}</Badge>
              <span className="text-xs text-gray-400">{formatDate(TODAY)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Notes / Highlights</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Key wins, progress, pipeline updates..." className="h-28" />
              </div>
              <div className="space-y-1.5">
                <Label>Blockers</Label>
                <Textarea value={form.blockers} onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))} placeholder="What's slowing you down today?" className="h-28" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{todayLog ? 'Log already submitted — updates will overwrite.' : 'Not yet saved today'}</span>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                  : saved ? <><CheckCircle2 className="h-4 w-4" />Saved!</>
                  : todayLog ? 'Update Log' : 'Submit Log'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Team logs (admin) */}
      {isAdmin && teamLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Team Activity Today</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Recruiter', 'Resumes', 'Calls', 'Submissions', 'Interviews', 'Offers'].map(h => (
                    <th key={h} className={`text-xs font-medium text-gray-500 py-2 ${h === 'Recruiter' ? 'text-left' : 'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {teamLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="py-2.5 text-sm font-medium text-[#1A1A2E]">{log.user?.name}</td>
                    <td className="py-2.5 text-center text-sm font-bold" style={{ color: '#82BC0D' }}>{log.resumes_sourced}</td>
                    <td className="py-2.5 text-center text-sm" style={{ color: '#0EA2E8' }}>{log.calls_made}</td>
                    <td className="py-2.5 text-center text-sm" style={{ color: '#F9B710' }}>{log.submissions_done}</td>
                    <td className="py-2.5 text-center text-sm" style={{ color: '#8b5cf6' }}>{log.interviews_arranged}</td>
                    <td className="py-2.5 text-center text-sm" style={{ color: '#22c55e' }}>{log.offers_made}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {pastLogs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandHistory(h => !h)}>
              <CardTitle className="text-sm">Recent History</CardTitle>
              {expandHistory ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </div>
          </CardHeader>
          {expandHistory && (
            <CardContent>
              <div className="space-y-2">
                {pastLogs.map(log => (
                  <div key={log.id} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500 w-24 shrink-0">{formatDate(log.log_date)}</span>
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      <span className="text-[#82BC0D] font-medium">{log.resumes_sourced} resumes</span>
                      <span className="text-[#0EA2E8]">{log.calls_made} calls</span>
                      <span className="text-[#F9B710]">{log.submissions_done} submissions</span>
                      <span className="text-purple-500">{log.interviews_arranged} interviews</span>
                    </div>
                    {log.blockers && <span className="text-xs text-red-400 truncate max-w-[150px]" title={log.blockers}>⚠ {log.blockers}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Assign Task Modal */}
      {showTaskForm && (
        <Dialog open onOpenChange={() => setShowTaskForm(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Assign Task to Recruiter</DialogTitle></DialogHeader>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Assign To *</Label>
                  <Select value={taskForm.assigned_to} onValueChange={v => setTaskForm(f => ({ ...f, assigned_to: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select recruiter..." /></SelectTrigger>
                    <SelectContent>{recruiters.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.role})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={taskForm.priority} onValueChange={v => setTaskForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{['High', 'Medium', 'Low'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Task Type</Label>
                <Select value={taskForm.task_type} onValueChange={v => setTaskForm(f => ({ ...f, task_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Follow up with candidate', 'Follow up with client', 'Schedule interview', 'Send submission', 'Collect documents', 'Get feedback', 'Other'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Task Title *</Label>
                <Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Source 5 SAP profiles for TechCo" required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Additional context..." className="h-16" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Link to Candidate</Label>
                  <Select value={taskForm.candidate_id} onValueChange={v => setTaskForm(f => ({ ...f, candidate_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {candidates.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Link to Client</Label>
                  <Select value={taskForm.client_id} onValueChange={v => setTaskForm(f => ({ ...f, client_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Link to Opening</Label>
                  <Select value={taskForm.opening_id} onValueChange={v => setTaskForm(f => ({ ...f, opening_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {openings.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.title} — {o.client?.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due Date</Label>
                  <Input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} min={TODAY} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={taskSaving || !taskForm.assigned_to || !taskForm.title}>
                  {taskSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Assign Task'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
