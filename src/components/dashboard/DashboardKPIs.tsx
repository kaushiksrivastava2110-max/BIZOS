'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Building2, Briefcase, FileText, Video, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPI {
  label: string
  value: number
  prevValue: number
  href: string
  icon: React.ElementType
  color: string
  suffix?: string
}

interface Props { userId?: string }

export function DashboardKPIs({ userId }: Props) {
  const [kpis, setKpis] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const lastWeekStart = new Date(weekStart)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)

      const isoWeekStart = weekStart.toISOString()
      const isoLastWeekStart = lastWeekStart.toISOString()

      let clientsQ = supabase.from('clients').select('*', { count: 'exact', head: true }).in('health_status', ['green', 'amber'])
      let openingsQ = supabase.from('openings').select('*', { count: 'exact', head: true }).eq('status', 'Open')
      let resumesQ = supabase.from('submissions').select('*', { count: 'exact', head: true }).gte('created_at', isoWeekStart)
      let resumesPrevQ = supabase.from('submissions').select('*', { count: 'exact', head: true }).gte('created_at', isoLastWeekStart).lt('created_at', isoWeekStart)
      let interviewsQ = supabase.from('interviews').select('*', { count: 'exact', head: true }).in('status', ['Scheduled', 'Completed']).gte('scheduled_at', isoWeekStart)
      let interviewsPrevQ = supabase.from('interviews').select('*', { count: 'exact', head: true }).gte('scheduled_at', isoLastWeekStart).lt('scheduled_at', isoWeekStart)

      if (userId) {
        resumesQ = resumesQ.eq('recruiter_id', userId)
        resumesPrevQ = resumesPrevQ.eq('recruiter_id', userId)
      }

      const [
        { count: activeClients },
        { count: openMandates },
        { count: resumesThisWeek },
        { count: resumesPrevWeek },
        { count: interviewsThisWeek },
        { count: interviewsPrevWeek },
      ] = await Promise.all([clientsQ, openingsQ, resumesQ, resumesPrevQ, interviewsQ, interviewsPrevQ])

      setKpis([
        { label: 'Active Clients', value: activeClients ?? 0, prevValue: activeClients ?? 0, href: '/clients', icon: Building2, color: '#82BC0D' },
        { label: 'Open Mandates', value: openMandates ?? 0, prevValue: openMandates ?? 0, href: '/openings?status=Open', icon: Briefcase, color: '#0EA2E8' },
        { label: 'Resumes Sourced', value: resumesThisWeek ?? 0, prevValue: resumesPrevWeek ?? 0, href: '/candidates', icon: FileText, color: '#F9B710', suffix: 'this week' },
        { label: 'Interviews', value: interviewsThisWeek ?? 0, prevValue: interviewsPrevWeek ?? 0, href: '/candidates', icon: Video, color: '#1A1A2E', suffix: 'this week' },
      ])
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map(kpi => {
        const Icon = kpi.icon
        const diff = kpi.value - kpi.prevValue
        const pct = kpi.prevValue > 0 ? Math.round((diff / kpi.prevValue) * 100) : 0
        return (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: kpi.color + '15' }}
                >
                  <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
                {kpi.suffix && (
                  <span className="text-[10px] text-gray-400 font-medium">{kpi.suffix}</span>
                )}
              </div>
              <div className="text-3xl font-bold text-[#1A1A2E] tabular-nums">{kpi.value}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-500 font-medium">{kpi.label}</span>
                {kpi.suffix && (
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${diff > 0 ? 'text-[#82BC0D]' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {diff !== 0 ? `${Math.abs(pct)}%` : 'flat'}
                  </span>
                )}
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
