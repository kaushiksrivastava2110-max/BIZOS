'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, FileWarning, Bell } from 'lucide-react'
import { daysSince } from '@/lib/utils'

interface AttentionItem {
  id: string
  type: 'stuck_candidate' | 'inactive_opening' | 'sla_breach'
  title: string
  subtitle: string
  daysAgo: number
  href: string
  severity: 'high' | 'medium'
}

interface Props { userId?: string }

export function NeedsAttention({ userId }: Props) {
  const [items, setItems] = useState<AttentionItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['candidate_aging_days', 'opening_inactive_days'])

      const thresholds = Object.fromEntries((settings ?? []).map(s => [s.key, parseInt(s.value)]))
      const candidateDays = thresholds.candidate_aging_days ?? 5
      const openingDays = thresholds.opening_inactive_days ?? 7

      const candidateCutoff = new Date()
      candidateCutoff.setDate(candidateCutoff.getDate() - candidateDays)
      const openingCutoff = new Date()
      openingCutoff.setDate(openingCutoff.getDate() - openingDays)

      let submQ = supabase
        .from('submissions')
        .select('id, stage, stage_entered_at, opening_id, candidate:candidates(name), opening:openings(id, title, client_id, clients(name))')
        .lt('stage_entered_at', candidateCutoff.toISOString())
        .not('stage', 'in', '("Joined","Dropped")')
        .order('stage_entered_at', { ascending: true })
        .limit(8)

      if (userId) submQ = submQ.eq('recruiter_id', userId)

      let openQ = supabase
        .from('openings')
        .select('id, title, created_at, clients(name)')
        .eq('status', 'Open')
        .lt('created_at', openingCutoff.toISOString())
        .limit(5)

      if (userId) openQ = openQ.eq('assigned_recruiter_id', userId)

      const [{ data: stuckSubs }, { data: inactiveOpenings }, { data: slaRecords }] = await Promise.all([
        submQ, openQ,
        supabase
          .from('submission_records')
          .select('submission_id, submitted_at, sla_days, submission:submissions(id, opening_id, candidate:candidates(name), opening:openings(title, clients(name)))')
          .eq('acknowledgement_status', 'Pending')
          .limit(5),
      ])

      const attentionItems: AttentionItem[] = []

      for (const s of stuckSubs ?? []) {
        const candidate = (Array.isArray(s.candidate) ? s.candidate[0] : s.candidate) as { name: string } | null
        const opening = (Array.isArray(s.opening) ? s.opening[0] : s.opening) as unknown as { id: string; title: string; clients: { name: string } | null } | null
        attentionItems.push({
          id: s.id,
          type: 'stuck_candidate',
          title: candidate?.name ?? 'Unknown Candidate',
          subtitle: `Stuck in "${s.stage}" — ${opening?.title ?? ''} @ ${opening?.clients?.name ?? ''}`,
          daysAgo: daysSince(s.stage_entered_at),
          href: `/openings/${s.opening_id}`,
          severity: daysSince(s.stage_entered_at) > 10 ? 'high' : 'medium',
        })
      }

      // SLA breach items
      for (const rec of slaRecords ?? []) {
        const daysSinceSubmitted = daysSince(rec.submitted_at)
        if (daysSinceSubmitted > (rec.sla_days || 3)) {
          const sub = Array.isArray(rec.submission) ? rec.submission[0] : rec.submission
          const candidate = Array.isArray(sub?.candidate) ? sub.candidate[0] : sub?.candidate
          const opening = Array.isArray(sub?.opening) ? sub.opening[0] : sub?.opening
          const client = Array.isArray(opening?.clients) ? opening.clients[0] : opening?.clients
          attentionItems.push({
            id: rec.submission_id,
            type: 'sla_breach',
            title: `${candidate?.name ?? 'Candidate'} — No client acknowledgement`,
            subtitle: `Submitted ${daysSinceSubmitted}d ago to ${opening?.title ?? ''} @ ${client?.name ?? ''}`,
            daysAgo: daysSinceSubmitted,
            href: `/openings/${sub?.opening_id ?? ''}`,
            severity: 'high',
          })
        }
      }

      for (const o of inactiveOpenings ?? []) {
        const client = (Array.isArray(o.clients) ? o.clients[0] : o.clients) as { name: string } | null
        attentionItems.push({
          id: o.id,
          type: 'inactive_opening',
          title: o.title,
          subtitle: `No activity — ${client?.name ?? ''}`,
          daysAgo: daysSince(o.created_at),
          href: `/openings/${o.id}`,
          severity: 'medium',
        })
      }

      setItems(attentionItems.sort((a, b) => b.daysAgo - a.daysAgo))
      setLoading(false)
    }
    load()
  }, [userId])

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-[#F9B710]" />
          Needs Attention
        </CardTitle>
        <span className="text-xs text-gray-400">{items.length} items</span>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-[#82BC0D]/10 flex items-center justify-center mx-auto mb-2">
              <Clock className="w-5 h-5 text-[#82BC0D]" />
            </div>
            <p className="text-sm text-gray-500">All caught up — nothing needs attention right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map(item => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-4 py-3 hover:bg-gray-50 -mx-5 px-5 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.severity === 'high' ? 'bg-red-50' : 'bg-amber-50'}`}>
                  {item.type === 'sla_breach'
                    ? <Bell className="w-4 h-4 text-red-500" />
                    : item.type === 'stuck_candidate'
                    ? <Clock className={`w-4 h-4 ${item.severity === 'high' ? 'text-red-500' : 'text-amber-500'}`} />
                    : <FileWarning className="w-4 h-4 text-amber-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E] truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                </div>
                <Badge variant={item.daysAgo > 10 ? 'red' : 'amber'} className="shrink-0">
                  {item.daysAgo}d
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
