'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { format, subDays } from 'date-fns'
import type { User } from '@/types'

interface Props {
  clients: any[]
  currentUser: User
  onClose: () => void
  onSaved: () => void
}

export function GenerateReportModal({ clients, currentUser, onClose, onSaved }: Props) {
  const [clientId, setClientId] = useState('')
  const [periodStart, setPeriodStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [periodEnd, setPeriodEnd] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  async function handleGenerate() {
    if (!clientId) { setError('Please select a client'); return }
    setLoading(true)
    setError(null)

    // Fetch activity logs for this client in the period
    const { data: activityLogs } = await supabase
      .from('activity_logs')
      .select('*, actor:users(name)')
      .eq('entity_type', 'client')
      .eq('entity_id', clientId)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd + 'T23:59:59')
      .order('created_at', { ascending: false })

    // Fetch submissions for openings of this client
    const { data: openings } = await supabase
      .from('openings')
      .select('id, title')
      .eq('client_id', clientId)

    const openingIds = (openings ?? []).map(o => o.id)
    let submissions: any[] = []
    if (openingIds.length > 0) {
      const { data: subs } = await supabase
        .from('submissions')
        .select('*, candidate:candidates(name), opening:openings(title), recruiter:users(name)')
        .in('opening_id', openingIds)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd + 'T23:59:59')
      submissions = subs ?? []
    }

    const { data: interviews } = openingIds.length > 0
      ? await supabase
          .from('interviews')
          .select('*, submission:submissions(opening:openings(title), candidate:candidates(name))')
          .gte('scheduled_at', periodStart)
          .lte('scheduled_at', periodEnd + 'T23:59:59')
          .in('submission_id', submissions.map(s => s.id))
      : { data: [] }

    // Build report content
    const clientName = clients.find(c => c.id === clientId)?.name ?? 'Client'
    const content = buildReportContent(clientName, periodStart, periodEnd, submissions, interviews ?? [], activityLogs ?? [])

    const { data: { user } } = await supabase.auth.getUser()
    const { data: report, error: err } = await supabase.from('reports').insert({
      client_id: clientId,
      period_start: periodStart,
      period_end: periodEnd,
      content,
      status: 'Draft',
    }).select().single()

    if (err) { setError(err.message); setLoading(false); return }

    if (user) {
      await supabase.from('activity_logs').insert({
        actor_id: user.id,
        entity_type: 'report',
        entity_id: report.id,
        action: 'report_generated',
        notes: `Generated weekly report for ${clientName}`,
      })
    }

    setLoading(false)
    onSaved()
    router.push(`/reports/${report.id}`)
  }

  function buildReportContent(
    clientName: string,
    start: string,
    end: string,
    submissions: any[],
    interviews: any[],
    logs: any[],
  ) {
    const submittedCount = submissions.filter(s => s.stage !== 'Sourced').length
    const interviewCount = interviews.filter(i => i.status === 'Completed').length
    const offerCount = submissions.filter(s => s.stage === 'Offer' || s.stage === 'Joined').length

    return `# Weekly Report — ${clientName}
Period: ${format(new Date(start), 'dd MMM yyyy')} to ${format(new Date(end), 'dd MMM yyyy')}

## Executive Summary
During this period, our team sourced ${submissions.length} candidate profiles and submitted ${submittedCount} for your review. ${interviewCount} interviews were completed, with ${offerCount} candidate(s) reaching the offer stage.

## Mandates Worked
${submissions.length > 0 ? submissions.map(s => `- **${s.candidate?.name ?? 'Candidate'}** → ${s.opening?.title ?? 'Opening'} (${s.stage})`).join('\n') : 'No submissions during this period.'}

## Interviews
${interviews.length > 0 ? interviews.map(i => `- ${i.submission?.candidate?.name ?? 'Candidate'} — Round ${i.round} — ${i.status}${i.feedback_score ? ` (Score: ${i.feedback_score}/10)` : ''}`).join('\n') : 'No interviews during this period.'}

## Pipeline Summary
- Submissions: ${submittedCount}
- Interviews Completed: ${interviewCount}
- At Offer Stage: ${offerCount}

## Next Steps
- [Edit this section to add planned actions, upcoming interviews, and follow-ups]

---
*Generated by BIZOS — Bizquad Consultants*`
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Client Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Period Start</Label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA2E8]" />
            </div>
            <div className="space-y-1.5">
              <Label>Period End</Label>
              <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA2E8]" />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            This will pull all activity logs, submissions, and interview data for the selected period and draft a structured report for your review.
          </p>
          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleGenerate} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : 'Generate Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
