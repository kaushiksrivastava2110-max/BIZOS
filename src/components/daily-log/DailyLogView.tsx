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
import { Loader2, CheckCircle2, ClipboardList, ChevronDown, ChevronUp, Plus, CheckSquare, Square, Briefcase, Target } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

const TODAY = new Date().toISOString().split('T')[0]

const FIELDS = [
  { key: 'resumes_sourced', label: 'Resumes Sourced', color: '#82BC0D', description: 'Total profiles reviewed/sourced today' },
  { key: 'calls_made', label: 'Calls Made', color: '#0EA2E8', description: 'Candidate / client calls' },
  { key: 'submissions_done', label: 'Submissions', color: '#F9B710', description: 'Profiles submitted to clients' },
  { key: 'interviews_arranged', label: 'Interviews Arranged', color: '#8b5cf6', description: 'Interview slots confirmed' },
  { key: 'offers_made', label: 'Offers', color: '#22c55e', description: 'Offer letters rolled out' },
]

export function DailyLogView({ currentUser }: Props) {
  const [todayLog, setTodayLog] = useState<any | null>(null)
  const [pastLogs, setPastLogs] = useState<any[]>([])
  const [teamLogs, setTeamLogs] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [openPositions, setOpenPositions] = useState(0)
  const [todaySubmissions, setTodaySubmissions] = useState(0)
  const [recruiters, setRecruiters] = useState<User[]>([])
  const [openings, setOpenings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandHistory, setExpandHistory] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({ assigned_to: '', title: '', description: '', due_date: '', opening_id: '' })
  const [taskSaving, setTaskSaving] = useState(false)
  const [form, setForm] = useState({
    resumes_sourced: 0, calls_made: 0, submissions_done: 0,
    interviews_arranged: 0, offers_made: 0, notes: '', blockers: '',
  })
  const supabase = createClient()

  async function load() {
    const [todayRes, pastRes, tasksRes, openPosRes, subTodayRes] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('user_id', currentUser.id).eq('log_date', TODAY).single(),
      supabase.from('daily_logs').select('*, user:users(name)').eq('user_id', currentUser.id).lt('log_date', TODAY).order('log_date', { ascending: false }).limit(14),
      supabase.from('recruiter_tasks').select('*, assigned_to:users!recruiter_tasks_assigned_to_fkey(name), opening:openings(title)').or(`assigned_to.eq.${currentUser.id},assigned_by.eq.${currentUser.id}`).order('created_at', { ascending: false }),
      supabase.from('openings').select('id', { count: 'exact', head: true }).eq('status', 'Open'),
      supabase.from('submissions').select('id', { count: 'exact', head: true }).gte('created_at', TODAY),
    ])

    if (todayRes.data) {
      setTodayLog(todayRes.data)
      const t = todayRes.data
      setForm({ resumes_sourced: t.resumes_sourced, calls_made: t.calls_made, submissions_done: t.submissions_done, interviews_arranged: t.interviews_arranged, offers_made: t.offers_made, notes: t.notes ?? '', blockers: t.blockers ?? '' })
    }
    setPastLogs(pastRes.data ?? [])
    setTasks(tasksRes.data ?? [])
    setOpenPositions(openPosRes.count ?? 0)
    setTodaySubmissions(subTodayRes.count ?? 0)

    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
      const [teamRes, recruitersRes, openingsRes] = await Promise.all([
        supabase.from('daily_logs').select('*, user:users(id, name)').eq('log_date', TODAY).order('created_at', { ascending: false }),
        supabase.from('users').select('*').in('role', ['recruiter', 'manager']).order('name'),
        supabase.from('openings').select('id, title, client:clients(name)').eq('status', 'Open').order('created_at', { ascending: false }),
      ])
      setTeamLogs(teamRes.data ?? [])
      setRecruiters((recruitersRes.data as User[]) ?? [])
      setOpenings(openingsRes.data ?? [])
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
      assigned_by: user.id,
      assigned_to: taskForm.assigned_to,
      title: taskForm.title,
      description: taskForm.description || null,
      due_date: taskForm.due_date || null,
      opening_id: taskForm.opening_id || null,
    })
    setTaskForm({ assigned_to: '', title: '', description: '', due_date: '', opening_id: '' })
    setShowTaskForm(false)
    setTaskSaving(false)
    load()
  }

  async function toggleTask(task: any) {
    const isDone = !task.is_done
    await supabase.from('recruiter_tasks').update({ is_done: isDone, done_at: isDone ? new Date().toISOString() : null }).eq('id', task.id)
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, is_done: isDone } : t))
  }

  const pendingTasks = tasks.filter(t => !t.is_done)
  const doneTasks = tasks.filter(t => t.is_done)

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Priority snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="h-4 w-4 text-[#0EA2E8]" />
            <span className="text-xs text-gray-500">Open Positions</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A2E]">{openPositions}</p>
          <p className="text-xs text-gray-400 mt-0.5">Active mandates today</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-[#F9B710]" />
            <span className="text-xs text-gray-500">Submitted Today</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A2E]">{todaySubmissions}</p>
          <p className="text-xs text-gray-400 mt-0.5">vs {openPositions} open</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="h-4 w-4 text-[#82BC0D]" />
            <span className="text-xs text-gray-500">Tasks Pending</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A2E]">{pendingTasks.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{doneTasks.length} done</p>
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
              <CheckSquare className="h-4 w-4 text-[#82BC0D]" />
              Tasks
            </CardTitle>
            {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
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
                    <p className="text-sm font-medium text-[#1A1A2E]">{task.title}</p>
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

      {/* Today's log form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-[#82BC0D]" />
              Today's Activity Log
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={todayLog ? 'green' : 'default'}>{todayLog ? 'Logged' : 'Not yet logged'}</Badge>
              <span className="text-xs text-gray-400">{formatDate(TODAY)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {FIELDS.map(field => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-gray-500">{field.label}</Label>
                  <div className="flex items-center gap-2">
                    <button type="button" className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg font-medium"
                      onClick={() => setForm(f => ({ ...f, [field.key]: Math.max(0, (f[field.key as keyof typeof f] as number) - 1) }))}>−</button>
                    <div className="flex-1 text-center">
                      <span className="text-2xl font-bold tabular-nums" style={{ color: field.color }}>
                        {form[field.key as keyof typeof form] as number}
                      </span>
                    </div>
                    <button type="button" className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg font-medium"
                      onClick={() => setForm(f => ({ ...f, [field.key]: (f[field.key as keyof typeof f] as number) + 1 }))}>+</button>
                  </div>
                  <p className="text-[10px] text-gray-400">{field.description}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Notes / Highlights</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Key wins, progress, pipeline updates..." className="h-24" />
              </div>
              <div className="space-y-1.5">
                <Label>Blockers</Label>
                <Textarea value={form.blockers} onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))} placeholder="What's slowing you down today?" className="h-24" />
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

      {/* Team logs */}
      {(currentUser.role === 'admin' || currentUser.role === 'manager') && teamLogs.length > 0 && (
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
              <div className="space-y-1.5">
                <Label>Assign To *</Label>
                <Select value={taskForm.assigned_to} onValueChange={v => setTaskForm(f => ({ ...f, assigned_to: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select recruiter..." /></SelectTrigger>
                  <SelectContent>
                    {recruiters.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.role})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Task Title *</Label>
                <Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Source 5 SAP profiles for TechCo" required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Additional context..." className="h-20" />
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
