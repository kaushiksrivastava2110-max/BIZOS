'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart3, Download, TrendingUp, Users, CheckCircle, XCircle } from 'lucide-react'
import { HEALTH_COLORS } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

interface ClientStat {
  id: string
  name: string
  health_status: string
  open_positions: number
  total_submissions: number
  active_pipeline: number
  interview_stage: number
  joined: number
  rejected: number
  dropped: number
  conversion_rate: number
}

const PERIOD_OPTIONS = [
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 3 Months', value: 'quarter' },
  { label: 'All Time', value: 'all' },
]

function getPeriodDates(period: string): { from: string | null; to: string | null } {
  const now = new Date()
  if (period === 'all') return { from: null, to: null }

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

  if (period === 'week') {
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    return { from: startOfDay(monday).toISOString(), to: now.toISOString() }
  }
  if (period === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: now.toISOString() }
  }
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  if (period === 'quarter') {
    const start = new Date(now)
    start.setMonth(start.getMonth() - 3)
    return { from: start.toISOString(), to: now.toISOString() }
  }
  return { from: null, to: null }
}

export function ClientPerformanceView({ currentUser }: Props) {
  const [stats, setStats] = useState<ClientStat[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [sortBy, setSortBy] = useState<'name' | 'open' | 'submissions' | 'joined'>('open')
  const supabase = createClient()

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    const { from, to } = getPeriodDates(period)

    // Load all clients with openings and submissions
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, health_status')
      .order('name')

    if (!clients) { setLoading(false); return }

    // Load all openings
    const { data: openings } = await supabase
      .from('openings')
      .select('id, client_id, status')

    // Build submissions query
    let subQuery = supabase
      .from('submissions')
      .select('id, stage, opening_id, created_at, openings!inner(client_id)')

    if (from) subQuery = subQuery.gte('created_at', from)
    if (to) subQuery = subQuery.lte('created_at', to)

    const { data: submissions } = await subQuery

    const clientStats: ClientStat[] = clients.map(c => {
      const clientOpenings = (openings ?? []).filter((o: any) => o.client_id === c.id)
      const openPositions = clientOpenings.filter((o: any) => o.status === 'Open').length

      const clientSubmissions = (submissions ?? []).filter((s: any) => (s.openings as any)?.client_id === c.id)

      const totalSubmissions = clientSubmissions.length
      const joined = clientSubmissions.filter((s: any) => s.stage === 'Joined').length
      const rejected = clientSubmissions.filter((s: any) => s.stage === 'Rejected').length
      const dropped = clientSubmissions.filter((s: any) => s.stage === 'Dropped').length
      const interviewStage = clientSubmissions.filter((s: any) =>
        ['L1 Interview', 'L2 Interview', 'L3 Interview', 'Client Interview', 'Final Round'].includes(s.stage)
      ).length
      const activePipeline = clientSubmissions.filter((s: any) =>
        !['Joined', 'Rejected', 'Dropped'].includes(s.stage)
      ).length

      const conversionRate = totalSubmissions > 0 ? Math.round((joined / totalSubmissions) * 100) : 0

      return {
        id: c.id,
        name: c.name,
        health_status: c.health_status,
        open_positions: openPositions,
        total_submissions: totalSubmissions,
        active_pipeline: activePipeline,
        interview_stage: interviewStage,
        joined,
        rejected,
        dropped,
        conversion_rate: conversionRate,
      }
    })

    const sorted = [...clientStats].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'open') return b.open_positions - a.open_positions
      if (sortBy === 'submissions') return b.total_submissions - a.total_submissions
      if (sortBy === 'joined') return b.joined - a.joined
      return 0
    })

    setStats(sorted)
    setLoading(false)
  }

  useEffect(() => {
    setStats(prev => [...prev].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'open') return b.open_positions - a.open_positions
      if (sortBy === 'submissions') return b.total_submissions - a.total_submissions
      if (sortBy === 'joined') return b.joined - a.joined
      return 0
    }))
  }, [sortBy])

  // Summary totals
  const totals = stats.reduce((acc, s) => ({
    open: acc.open + s.open_positions,
    submissions: acc.submissions + s.total_submissions,
    joined: acc.joined + s.joined,
    rejected: acc.rejected + s.rejected,
  }), { open: 0, submissions: 0, joined: 0, rejected: 0 })

  function exportCSV() {
    const header = ['Client', 'Health', 'Open Positions', 'Total Submissions', 'Active Pipeline', 'In Interview', 'Joined', 'Rejected', 'Dropped', 'Conversion %']
    const rows = stats.map(s => [
      s.name, s.health_status, s.open_positions, s.total_submissions,
      s.active_pipeline, s.interview_stage, s.joined, s.rejected, s.dropped, s.conversion_rate
    ])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `client-performance-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const HEALTH_LABELS: Record<string, string> = { green: 'Healthy', amber: 'Monitor', red: 'At Risk' }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Sort: Open Positions</SelectItem>
            <SelectItem value="submissions">Sort: Submissions</SelectItem>
            <SelectItem value="joined">Sort: Joined</SelectItem>
            <SelectItem value="name">Sort: Client Name</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Open Positions', value: totals.open, icon: BarChart3, color: 'text-[#0EA2E8]' },
          { label: 'Submissions', value: totals.submissions, icon: Users, color: 'text-purple-600' },
          { label: 'Joined', value: totals.joined, icon: CheckCircle, color: 'text-[#82BC0D]' },
          { label: 'Rejected', value: totals.rejected, icon: XCircle, color: 'text-red-500' },
        ].map(card => (
          <Card key={card.label} className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs text-gray-500">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E]">{card.value}</p>
          </Card>
        ))}
      </div>

      {/* Client table */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : stats.length === 0 ? (
        <Card className="p-12 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No clients found.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Client</th>
                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Open Positions</th>
                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Submissions</th>
                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Pipeline</th>
                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">In Interview</th>
                <th className="text-center text-xs font-medium text-[#82BC0D] px-3 py-3">Joined</th>
                <th className="text-center text-xs font-medium text-red-500 px-3 py-3">Rejected</th>
                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Dropped</th>
                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">Conv. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: HEALTH_COLORS[s.health_status as keyof typeof HEALTH_COLORS] ?? '#ccc' }} />
                      <span className="font-medium text-[#1A1A2E]">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-semibold ${s.open_positions > 0 ? 'text-[#0EA2E8]' : 'text-gray-400'}`}>
                      {s.open_positions}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">{s.total_submissions || '—'}</td>
                  <td className="px-3 py-3 text-center text-gray-700">{s.active_pipeline || '—'}</td>
                  <td className="px-3 py-3 text-center text-purple-600 font-medium">{s.interview_stage || '—'}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`font-semibold ${s.joined > 0 ? 'text-[#82BC0D]' : 'text-gray-400'}`}>
                      {s.joined || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`${s.rejected > 0 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                      {s.rejected || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-400">{s.dropped || '—'}</td>
                  <td className="px-3 py-3 text-center">
                    {s.total_submissions > 0 ? (
                      <Badge variant={s.conversion_rate >= 20 ? 'green' : s.conversion_rate >= 10 ? 'yellow' : 'default'}>
                        {s.conversion_rate}%
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-medium">
                <td className="px-5 py-3 text-xs text-gray-500 uppercase tracking-wide">Total ({stats.length} clients)</td>
                <td className="px-3 py-3 text-center text-[#0EA2E8] font-bold">{totals.open}</td>
                <td className="px-3 py-3 text-center text-gray-700 font-bold">{totals.submissions}</td>
                <td className="px-3 py-3 text-center text-gray-400">—</td>
                <td className="px-3 py-3 text-center text-gray-400">—</td>
                <td className="px-3 py-3 text-center text-[#82BC0D] font-bold">{totals.joined}</td>
                <td className="px-3 py-3 text-center text-red-500 font-bold">{totals.rejected}</td>
                <td className="px-3 py-3 text-center text-gray-400">—</td>
                <td className="px-3 py-3 text-center">
                  {totals.submissions > 0 && (
                    <Badge variant={Math.round((totals.joined / totals.submissions) * 100) >= 15 ? 'green' : 'yellow'}>
                      {Math.round((totals.joined / totals.submissions) * 100)}%
                    </Badge>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </div>
  )
}
