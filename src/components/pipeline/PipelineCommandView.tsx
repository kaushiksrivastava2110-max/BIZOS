'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Loader2, Activity, AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react'
import { formatDate, daysSince, STAGE_COLORS } from '@/lib/utils'
import Link from 'next/link'
import type { User } from '@/types'

interface Props { currentUser: User }

function RagDot({ days, sla = 3 }: { days: number; sla?: number }) {
  const color = days === 0 ? '#82BC0D' : days < sla ? '#82BC0D' : days < sla * 2 ? '#F9B710' : '#ef4444'
  const label = days === 0 ? 'On track' : days < sla ? 'On track' : days < sla * 2 ? 'Approaching SLA' : 'SLA Breached'
  return (
    <span title={label} className="inline-flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
    </span>
  )
}

export function PipelineCommandView({ currentUser }: Props) {
  const [openings, setOpenings] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [submissionRecords, setSubmissionRecords] = useState<any[]>([])
  const [offerDetails, setOfferDetails] = useState<any[]>([])
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOpening, setFilterOpening] = useState('all')
  const [filterStage, setFilterStage] = useState('all')
  const [search, setSearch] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [openingsRes, subsRes, subRecordsRes, offersRes, logsRes] = await Promise.all([
        supabase
          .from('openings')
          .select('id, title, status, client:clients(id, name), assigned_recruiter:users(name)')
          .eq('status', 'Open')
          .order('created_at', { ascending: false }),
        supabase
          .from('submissions')
          .select(`
            id, stage, stage_entered_at, created_at, opening_id,
            candidate:candidates(id, name, current_employer, ctc_expected, ctc_current),
            recruiter:users(name),
            interviews(id, round, scheduled_at, status, feedback_outcome, confirmation_status)
          `)
          .not('stage', 'in', '("Dropped")')
          .order('stage_entered_at', { ascending: false }),
        supabase
          .from('submission_records')
          .select('submission_id, method, acknowledgement_status, submitted_at, sla_days'),
        supabase
          .from('offer_details')
          .select('submission_id, offered_ctc, joining_date, candidate_response, counter_offer_received'),
        supabase
          .from('activity_logs')
          .select('entity_id, entity_type, action, notes, created_at, actor:users(name)')
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      setOpenings(openingsRes.data ?? [])
      setSubmissions(subsRes.data ?? [])
      setSubmissionRecords(subRecordsRes.data ?? [])
      setOfferDetails(offersRes.data ?? [])
      setActivityLogs(logsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const subRecordMap = Object.fromEntries(
    (submissionRecords ?? []).map((r: any) => [r.submission_id, r])
  )
  const offerMap = Object.fromEntries(
    (offerDetails ?? []).map((o: any) => [o.submission_id, o])
  )

  // Filter submissions
  let filtered = submissions
  if (filterOpening !== 'all') filtered = filtered.filter(s => s.opening_id === filterOpening)
  if (filterStage !== 'all') filtered = filtered.filter(s => s.stage === filterStage)
  if (search) filtered = filtered.filter(s => s.candidate?.name?.toLowerCase().includes(search.toLowerCase()))

  // Group by opening
  const byOpening = openings
    .filter(o => filterOpening === 'all' || o.id === filterOpening)
    .map(opening => ({
      opening,
      subs: filtered.filter(s => s.opening_id === opening.id),
    }))
    .filter(g => g.subs.length > 0)

  // Summary counts
  const totalActive = submissions.length
  const slaBreached = submissions.filter(s => {
    const rec = subRecordMap[s.id]
    if (!rec || rec.acknowledgement_status === 'Acknowledged') return false
    const days = daysSince(rec.submitted_at)
    return days > (rec.sla_days || 3)
  }).length
  const pendingAck = submissions.filter(s => subRecordMap[s.id]?.acknowledgement_status === 'Pending').length
  const offersOut = submissions.filter(s => s.stage === 'Offer').length

  const STAGES = ['Sourced', 'Screened', 'Submitted', 'Client Review', 'Interview L1', 'Interview L2', 'Offer', 'Joined']

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-[#0EA2E8]" />
            <span className="text-xs text-gray-500">Active Submissions</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A2E]">{totalActive}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-red-600">SLA Breached</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{slaBreached}</p>
        </div>
        <div className="rounded-xl border border-[#F9B710]/20 bg-[#F9B710]/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-[#F9B710]" />
            <span className="text-xs text-amber-700">Pending Ack.</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A2E]">{pendingAck}</p>
        </div>
        <div className="rounded-xl border border-[#82BC0D]/20 bg-[#82BC0D]/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-[#82BC0D]" />
            <span className="text-xs text-green-700">Offers Out</span>
          </div>
          <p className="text-3xl font-bold text-[#1A1A2E]">{offersOut}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search candidate..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 w-48"
        />
        <Select value={filterOpening} onValueChange={setFilterOpening}>
          <SelectTrigger className="h-8 w-56">
            <SelectValue placeholder="All mandates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Mandates</SelectItem>
            {openings.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.title} — {o.client?.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Per-mandate tables */}
      {byOpening.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No active submissions match your filters.</p>
        </div>
      ) : (
        byOpening.map(({ opening, subs }) => (
          <Card key={opening.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm">
                    <Link href={`/openings/${opening.id}`} className="hover:text-[#0EA2E8] transition-colors">
                      {opening.title}
                    </Link>
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {opening.client?.name} · Recruiter: {opening.assigned_recruiter?.name}
                  </p>
                </div>
                <Badge variant={opening.status === 'Open' ? 'green' : 'default'}>{opening.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-2.5">Candidate</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Stage</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Submitted</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Ack. Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Interview</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">Offer</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-2.5">Days/SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subs.map((sub: any) => {
                      const rec = subRecordMap[sub.id]
                      const offer = offerMap[sub.id]
                      const daysInStage = daysSince(sub.stage_entered_at)
                      const slaBreachedRow = rec && rec.acknowledgement_status === 'Pending' && daysSince(rec.submitted_at) > (rec.sla_days || 3)
                      const latestInterview = sub.interviews?.slice().sort((a: any, b: any) => b.round - a.round)[0]

                      return (
                        <tr key={sub.id} className={slaBreachedRow ? 'bg-red-50/40' : 'hover:bg-gray-50/50'}>
                          <td className="px-4 py-3">
                            <Link href={`/candidates/${sub.candidate?.id}`} className="font-medium text-[#1A1A2E] hover:text-[#0EA2E8] transition-colors">
                              {sub.candidate?.name}
                            </Link>
                            <p className="text-xs text-gray-400">{sub.candidate?.current_employer}</p>
                          </td>
                          <td className="px-3 py-3">
                            <Badge style={{ backgroundColor: STAGE_COLORS[sub.stage] + '20', color: STAGE_COLORS[sub.stage], fontSize: '11px' }}>
                              {sub.stage}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">
                            {rec ? (
                              <span>{formatDate(rec.submitted_at)}<br /><span className="text-gray-400">via {rec.method}</span></span>
                            ) : (
                              <span className="text-gray-300">Not recorded</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {rec ? (
                              <span className={`text-xs font-medium ${
                                rec.acknowledgement_status === 'Acknowledged' ? 'text-[#82BC0D]' :
                                rec.acknowledgement_status === 'No Response' ? 'text-red-500' : 'text-[#F9B710]'
                              }`}>
                                {rec.acknowledgement_status}
                              </span>
                            ) : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {latestInterview ? (
                              <div>
                                <span className="text-gray-600">R{latestInterview.round} · {formatDate(latestInterview.scheduled_at)}</span>
                                <br />
                                <Badge
                                  variant={latestInterview.status === 'Completed' ? 'green' : latestInterview.status === 'Scheduled' ? 'blue' : 'red'}
                                  className="text-[10px] mt-0.5"
                                >
                                  {latestInterview.feedback_outcome || latestInterview.status}
                                </Badge>
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-3 text-xs">
                            {offer ? (
                              <div>
                                {offer.offered_ctc && <span className="font-medium text-[#1A1A2E]">₹{offer.offered_ctc}L</span>}
                                {offer.joining_date && <span className="text-gray-400 ml-1">· {formatDate(offer.joining_date)}</span>}
                                <br />
                                <span className={`font-medium ${
                                  offer.candidate_response === 'Accepted' ? 'text-[#82BC0D]' :
                                  offer.candidate_response === 'Rejected' ? 'text-red-500' :
                                  offer.candidate_response === 'Negotiating' ? 'text-[#F9B710]' : 'text-gray-400'
                                }`}>
                                  {offer.candidate_response}
                                </span>
                              </div>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <RagDot days={daysInStage} sla={3} />
                              <span className={`text-xs font-medium ${daysInStage > 6 ? 'text-red-500' : daysInStage > 3 ? 'text-[#F9B710]' : 'text-gray-500'}`}>
                                {daysInStage}d
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#0EA2E8]" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {activityLogs.slice(0, 15).map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-gray-400 shrink-0 w-28">{new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-gray-600 font-medium shrink-0">{log.actor?.name}</span>
              <span className="text-gray-500">{log.notes}</span>
            </div>
          ))}
          {activityLogs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No activity yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
