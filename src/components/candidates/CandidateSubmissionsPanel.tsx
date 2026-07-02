'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { InterviewForm } from './InterviewForm'
import { OfferForm } from './OfferForm'
import { SubmissionRecordForm } from './SubmissionRecordForm'
import { Briefcase, ChevronDown, Clock, MessageSquare, ArrowRight } from 'lucide-react'
import { SUBMISSION_STAGES, STAGE_COLORS, daysSince, formatDate, formatDateTime } from '@/lib/utils'
import type { User, SubmissionStage } from '@/types'

interface Props {
  candidateId: string
  candidateName: string
  currentUser: User
}

export function CandidateSubmissionsPanel({ candidateId, candidateName, currentUser }: Props) {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSub, setExpandedSub] = useState<string | null>(null)
  const [noteText, setNoteText] = useState<Record<string, string>>({})
  const [savingNote, setSavingNote] = useState<string | null>(null)
  const [stageForm, setStageForm] = useState<{
    type: 'submission' | 'interview' | 'offer'
    submissionId: string
  } | null>(null)
  const supabase = createClient()
  const router = useRouter()

  async function load() {
    const { data } = await supabase
      .from('submissions')
      .select(`
        id, stage, stage_entered_at, created_at, recruiter_notes, last_action, last_action_at,
        opening:openings(id, title, client:clients(id, name)),
        recruiter:users(name),
        interviews(id, round, scheduled_at, status, feedback_outcome, mode),
        offer_details(offered_ctc, candidate_response, joining_date),
        submission_records(method, acknowledgement_status, submitted_at)
      `)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })

    setSubmissions(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [candidateId])

  async function handleStageChange(submissionId: string, newStage: SubmissionStage) {
    const sub = submissions.find(s => s.id === submissionId)
    if (!sub || sub.stage === newStage) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('submissions').update({
      stage: newStage,
      stage_entered_at: new Date().toISOString(),
      last_action: `Stage changed to ${newStage}`,
      last_action_at: new Date().toISOString(),
    }).eq('id', submissionId)

    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      entity_type: 'submission',
      entity_id: submissionId,
      action: 'stage_changed',
      notes: `${candidateName}: stage changed from "${sub.stage}" to "${newStage}"`,
    })

    // Optimistic update
    setSubmissions(prev => prev.map(s => s.id === submissionId
      ? { ...s, stage: newStage, stage_entered_at: new Date().toISOString(), last_action: `Stage changed to ${newStage}`, last_action_at: new Date().toISOString() }
      : s
    ))

    // Trigger context forms
    if (newStage === 'Submitted') setStageForm({ type: 'submission', submissionId })
    else if (newStage === 'Interview L1' || newStage === 'Interview L2') setStageForm({ type: 'interview', submissionId })
    else if (newStage === 'Offer') setStageForm({ type: 'offer', submissionId })
  }

  async function saveNote(submissionId: string) {
    setSavingNote(submissionId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const note = noteText[submissionId] || ''
    await supabase.from('submissions').update({
      recruiter_notes: note,
      last_action: note ? `Note: ${note.slice(0, 60)}${note.length > 60 ? '…' : ''}` : undefined,
      last_action_at: new Date().toISOString(),
    }).eq('id', submissionId)
    await supabase.from('activity_logs').insert({
      actor_id: user.id, entity_type: 'submission', entity_id: submissionId,
      action: 'note_added', notes: `Note on ${candidateName}: ${note}`,
    })
    setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, recruiter_notes: note } : s))
    setSavingNote(null)
  }

  const canEdit = currentUser.role !== 'viewer'
  const stagesForSelect = SUBMISSION_STAGES.filter(s => s !== 'Dropped')

  if (loading) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-[#0EA2E8]" />
          Client Submissions ({submissions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {submissions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No client submissions yet.</p>
        ) : (
          submissions.map(sub => {
            const opening = Array.isArray(sub.opening) ? sub.opening[0] : sub.opening
            const client = opening?.client ? (Array.isArray(opening.client) ? opening.client[0] : opening.client) : null
            const isExpanded = expandedSub === sub.id
            const latestIV = (sub.interviews ?? []).sort((a: any, b: any) => b.round - a.round)[0]
            const offer = Array.isArray(sub.offer_details) ? sub.offer_details[0] : sub.offer_details
            const subRecord = Array.isArray(sub.submission_records) ? sub.submission_records[0] : sub.submission_records

            return (
              <div key={sub.id} className="border border-gray-100 rounded-xl overflow-hidden">
                {/* Summary row */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpandedSub(isExpanded ? null : sub.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge style={{ backgroundColor: STAGE_COLORS[sub.stage] + '20', color: STAGE_COLORS[sub.stage], fontSize: '11px' }}>
                      {sub.stage}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E] truncate">
                        {opening?.title ?? 'Unknown Position'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{client?.name ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {daysSince(sub.stage_entered_at)}d in stage
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/30">

                    {/* Stage change */}
                    {canEdit && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-500 shrink-0">Move to:</span>
                        <Select onValueChange={v => handleStageChange(sub.id, v as SubmissionStage)}>
                          <SelectTrigger className="h-8 text-sm flex-1 max-w-[200px]">
                            <SelectValue placeholder="Change stage..." />
                          </SelectTrigger>
                          <SelectContent>
                            {stagesForSelect.filter(s => s !== sub.stage).map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Link href={`/openings/${opening?.id}`} className="text-xs text-[#0EA2E8] hover:underline flex items-center gap-1 shrink-0">
                          Open Kanban <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )}

                    {/* Submission record */}
                    {subRecord && (
                      <div className="text-xs text-gray-500 flex items-center gap-3">
                        <span>Submitted {formatDate(subRecord.submitted_at)} via {subRecord.method}</span>
                        <span className={`font-medium ${subRecord.acknowledgement_status === 'Acknowledged' ? 'text-[#82BC0D]' : subRecord.acknowledgement_status === 'No Response' ? 'text-red-500' : 'text-[#F9B710]'}`}>
                          Ack: {subRecord.acknowledgement_status}
                        </span>
                      </div>
                    )}

                    {/* Interview summary */}
                    {(sub.interviews ?? []).length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500">Interviews</p>
                        {(sub.interviews ?? []).sort((a: any, b: any) => a.round - b.round).map((iv: any) => (
                          <div key={iv.id} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-600">Round {iv.round} · {iv.mode ?? ''}</span>
                            <span className="text-gray-400">{formatDate(iv.scheduled_at)}</span>
                            <Badge variant={iv.status === 'Completed' ? 'green' : iv.status === 'Scheduled' ? 'blue' : 'red'} className="text-[10px]">
                              {iv.feedback_outcome ?? iv.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Offer */}
                    {offer && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Offer:</span> ₹{offer.offered_ctc}L ·{' '}
                        <span className={offer.candidate_response === 'Accepted' ? 'text-[#82BC0D] font-medium' : offer.candidate_response === 'Rejected' ? 'text-red-500 font-medium' : 'text-[#F9B710] font-medium'}>
                          {offer.candidate_response}
                        </span>
                        {offer.joining_date && <span className="text-gray-400"> · Join: {formatDate(offer.joining_date)}</span>}
                      </div>
                    )}

                    {/* Last action */}
                    {sub.last_action && (
                      <p className="text-xs text-gray-400 italic">Last: {sub.last_action} {sub.last_action_at ? `(${formatDate(sub.last_action_at)})` : ''}</p>
                    )}

                    {/* Note */}
                    {canEdit && (
                      <div className="space-y-2">
                        <Textarea
                          value={noteText[sub.id] ?? sub.recruiter_notes ?? ''}
                          onChange={e => setNoteText(prev => ({ ...prev, [sub.id]: e.target.value }))}
                          placeholder="Add a note on this submission..."
                          className="h-16 text-sm"
                        />
                        <Button
                          size="sm" variant="outline"
                          disabled={savingNote === sub.id}
                          onClick={() => saveNote(sub.id)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> Save Note
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Context forms */}
        {stageForm?.type === 'submission' && (
          <SubmissionRecordForm
            submissionId={stageForm.submissionId}
            candidateName={candidateName}
            onClose={() => setStageForm(null)}
            onSaved={() => { setStageForm(null); load(); router.refresh() }}
          />
        )}
        {stageForm?.type === 'interview' && (
          <InterviewForm
            submissionId={stageForm.submissionId}
            candidateName={candidateName}
            onClose={() => setStageForm(null)}
            onSaved={() => { setStageForm(null); load(); router.refresh() }}
          />
        )}
        {stageForm?.type === 'offer' && (
          <OfferForm
            submissionId={stageForm.submissionId}
            candidateName={candidateName}
            onClose={() => setStageForm(null)}
            onSaved={() => { setStageForm(null); load(); router.refresh() }}
          />
        )}
      </CardContent>
    </Card>
  )
}
