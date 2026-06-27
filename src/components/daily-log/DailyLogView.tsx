'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

const TODAY = new Date().toISOString().split('T')[0]

export function DailyLogView({ currentUser }: Props) {
  const [todayLog, setTodayLog] = useState<any | null>(null)
  const [pastLogs, setPastLogs] = useState<any[]>([])
  const [teamLogs, setTeamLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandHistory, setExpandHistory] = useState(false)
  const [form, setForm] = useState({
    resumes_sourced: 0,
    calls_made: 0,
    submissions_done: 0,
    interviews_arranged: 0,
    offers_made: 0,
    notes: '',
    blockers: '',
  })
  const supabase = createClient()

  async function load() {
    const [{ data: today }, { data: past }] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('user_id', currentUser.id).eq('log_date', TODAY).single(),
      supabase.from('daily_logs').select('*, user:users(name)').eq('user_id', currentUser.id).lt('log_date', TODAY).order('log_date', { ascending: false }).limit(14),
    ])

    if (today) {
      setTodayLog(today)
      setForm({
        resumes_sourced: today.resumes_sourced,
        calls_made: today.calls_made,
        submissions_done: today.submissions_done,
        interviews_arranged: today.interviews_arranged,
        offers_made: today.offers_made,
        notes: today.notes ?? '',
        blockers: today.blockers ?? '',
      })
    }
    setPastLogs(past ?? [])

    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
      const { data: team } = await supabase
        .from('daily_logs')
        .select('*, user:users(id, name)')
        .eq('log_date', TODAY)
        .order('created_at', { ascending: false })
      setTeamLogs(team ?? [])
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
      // Log activity
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('activity_logs').insert({
          actor_id: user.id,
          entity_type: 'daily_log',
          entity_id: data?.id ?? user.id,
          action: 'daily_log_submitted',
          notes: `Daily log: ${form.resumes_sourced} resumes, ${form.submissions_done} submissions, ${form.interviews_arranged} interviews`,
        })
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const FIELDS = [
    { key: 'resumes_sourced', label: 'Resumes Sourced', color: '#82BC0D', description: 'Total profiles reviewed/sourced today' },
    { key: 'calls_made', label: 'Calls Made', color: '#0EA2E8', description: 'Candidate / client calls' },
    { key: 'submissions_done', label: 'Submissions', color: '#F9B710', description: 'Profiles submitted to clients' },
    { key: 'interviews_arranged', label: 'Interviews Arranged', color: '#8b5cf6', description: 'Interview slots confirmed' },
    { key: 'offers_made', label: 'Offers', color: '#22c55e', description: 'Offer letters rolled out' },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Today's log form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-[#82BC0D]" />
              Today's Activity Log
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={todayLog ? 'green' : 'default'}>
                {todayLog ? 'Logged' : 'Not yet logged'}
              </Badge>
              <span className="text-xs text-gray-400">{formatDate(TODAY)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Activity counters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {FIELDS.map(field => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-xs text-gray-500">{field.label}</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg font-medium"
                      onClick={() => setForm(f => ({ ...f, [field.key]: Math.max(0, (f[field.key as keyof typeof f] as number) - 1) }))}
                    >−</button>
                    <div className="flex-1 text-center">
                      <span
                        className="text-2xl font-bold tabular-nums"
                        style={{ color: field.color }}
                      >
                        {form[field.key as keyof typeof form] as number}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-lg font-medium"
                      onClick={() => setForm(f => ({ ...f, [field.key]: (f[field.key as keyof typeof f] as number) + 1 }))}
                    >+</button>
                  </div>
                  <p className="text-[10px] text-gray-400">{field.description}</p>
                </div>
              ))}
            </div>

            {/* Notes & blockers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Notes / Highlights</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Key wins, progress, pipeline updates..."
                  className="h-24"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Blockers</Label>
                <Textarea
                  value={form.blockers}
                  onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))}
                  placeholder="What's slowing you down today?"
                  className="h-24"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {todayLog ? `Last saved: ${new Date().toLocaleTimeString()}` : 'Not yet saved today'}
              </span>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                  : saved ? <><CheckCircle2 className="h-4 w-4" />Saved!</>
                  : todayLog ? 'Update Log' : 'Submit Log'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Team logs (Admin/Manager) */}
      {(currentUser.role === 'admin' || currentUser.role === 'manager') && teamLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Team Activity Today</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 py-2">Recruiter</th>
                  <th className="text-center text-xs font-medium text-gray-500 py-2">Resumes</th>
                  <th className="text-center text-xs font-medium text-gray-500 py-2">Calls</th>
                  <th className="text-center text-xs font-medium text-gray-500 py-2">Submissions</th>
                  <th className="text-center text-xs font-medium text-gray-500 py-2">Interviews</th>
                  <th className="text-center text-xs font-medium text-gray-500 py-2">Offers</th>
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
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandHistory(h => !h)}
            >
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
                    {log.blockers && (
                      <span className="text-xs text-red-400 truncate max-w-[150px]" title={log.blockers}>⚠ {log.blockers}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
