'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Building2, Briefcase, FileText, Video, TrendingUp, TrendingDown, Minus, Gift, Users2, CalendarRange } from 'lucide-react'
import { format, subDays, startOfWeek, startOfMonth, subMonths } from 'date-fns'

type DateRange = 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom'

interface Props { userId?: string }

function getDateBounds(range: DateRange, customFrom: string, customTo: string) {
  const now = new Date()
  switch (range) {
    case 'today':
      return { from: format(now, 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'this_week':
      return { from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'this_month':
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
    case 'last_month': {
      const lm = subMonths(now, 1)
      return { from: format(startOfMonth(lm), 'yyyy-MM-dd'), to: format(new Date(lm.getFullYear(), lm.getMonth() + 1, 0), 'yyyy-MM-dd') }
    }
    case 'custom':
      return { from: customFrom, to: customTo }
  }
}

export function DashboardKPIs({ userId }: Props) {
  const [dateRange, setDateRange] = useState<DateRange>('this_week')
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [kpis, setKpis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { from, to } = getDateBounds(dateRange, customFrom, customTo)
      const fromISO = from + 'T00:00:00.000Z'
      const toISO = to + 'T23:59:59.999Z'

      // Previous period (same duration, shifted back)
      const fromDate = new Date(fromISO)
      const toDate = new Date(toISO)
      const duration = toDate.getTime() - fromDate.getTime()
      const prevFromISO = new Date(fromDate.getTime() - duration).toISOString()
      const prevToISO = fromISO

      let subsQ = supabase.from('submissions').select('*', { count: 'exact', head: true }).gte('created_at', fromISO).lte('created_at', toISO)
      let subsPrevQ = supabase.from('submissions').select('*', { count: 'exact', head: true }).gte('created_at', prevFromISO).lte('created_at', prevToISO)
      let ivsQ = supabase.from('interviews').select('*', { count: 'exact', head: true }).gte('scheduled_at', fromISO).lte('scheduled_at', toISO).in('status', ['Scheduled', 'Completed'])
      let ivsPrevQ = supabase.from('interviews').select('*', { count: 'exact', head: true }).gte('scheduled_at', prevFromISO).lte('scheduled_at', prevToISO)
      let ivsDoneQ = supabase.from('interviews').select('*', { count: 'exact', head: true }).gte('scheduled_at', fromISO).lte('scheduled_at', toISO).eq('status', 'Completed')
      let offersQ = supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('stage', 'Offer').gte('stage_entered_at', fromISO).lte('stage_entered_at', toISO)
      let joinedQ = supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('stage', 'Joined').gte('stage_entered_at', fromISO).lte('stage_entered_at', toISO)

      if (userId) {
        subsQ = subsQ.eq('recruiter_id', userId)
        subsPrevQ = subsPrevQ.eq('recruiter_id', userId)
        ivsQ = ivsQ.eq('submission.recruiter_id', userId)
        offersQ = offersQ.eq('recruiter_id', userId)
        joinedQ = joinedQ.eq('recruiter_id', userId)
      }

      const [
        { count: activeCl },
        { count: openMand },
        { count: subsCount },
        { count: subsPrev },
        { count: ivsCount },
        { count: ivsPrev },
        { count: ivsDone },
        { count: offersCount },
        { count: joinedCount },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).in('health_status', ['green', 'amber']),
        supabase.from('openings').select('*', { count: 'exact', head: true }).eq('status', 'Open'),
        subsQ, subsPrevQ, ivsQ, ivsPrevQ, ivsDoneQ, offersQ, joinedQ,
      ])

      setKpis([
        { label: 'Active Clients', value: activeCl ?? 0, prev: activeCl ?? 0, icon: Building2, color: '#82BC0D', href: '/clients', static: true },
        { label: 'Open Mandates', value: openMand ?? 0, prev: openMand ?? 0, icon: Briefcase, color: '#0EA2E8', href: '/openings', static: true },
        { label: 'Submissions', value: subsCount ?? 0, prev: subsPrev ?? 0, icon: FileText, color: '#F9B710', href: '/candidates' },
        { label: 'Interviews', value: ivsCount ?? 0, prev: ivsPrev ?? 0, icon: Video, color: '#8b5cf6', href: '/pipeline?stage=Interview' },
        { label: 'IVs Done', value: ivsDone ?? 0, prev: 0, icon: Users2, color: '#6366f1', href: '/pipeline?stage=Interview' },
        { label: 'Offers', value: offersCount ?? 0, prev: 0, icon: Gift, color: '#f97316', href: '/pipeline?stage=Offer' },
        { label: 'Joinings', value: joinedCount ?? 0, prev: 0, icon: Users2, color: '#22c55e', href: '/pipeline?stage=Joined' },
      ])
      setLoading(false)
    }
    load()
  }, [userId, dateRange, customFrom, customTo])

  return (
    <div className="space-y-4">
      {/* Date filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Period:</span>
        </div>
        <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        {dateRange === 'custom' && (
          <>
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-8 w-36" />
            <span className="text-gray-400 text-sm">to</span>
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-8 w-36" />
          </>
        )}
      </div>

      {/* KPI tiles */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[...Array(7)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {kpis.map(kpi => {
            const Icon = kpi.icon
            const diff = kpi.value - kpi.prev
            const pct = kpi.prev > 0 ? Math.round((diff / kpi.prev) * 100) : 0
            return (
              <button
                key={kpi.label}
                onClick={() => router.push(kpi.href)}
                className="text-left"
              >
                <Card className="p-4 hover:shadow-md transition-all cursor-pointer group hover:border-gray-300 h-full">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.color + '15' }}>
                      <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                    </div>
                    {!kpi.static && diff !== 0 && (
                      <span className={`text-[10px] font-bold flex items-center gap-0.5 ${diff > 0 ? 'text-[#82BC0D]' : 'text-red-500'}`}>
                        {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(pct)}%
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-[#1A1A2E] tabular-nums">{kpi.value}</div>
                  <div className="text-xs text-gray-500 font-medium mt-0.5 leading-tight">{kpi.label}</div>
                </Card>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
