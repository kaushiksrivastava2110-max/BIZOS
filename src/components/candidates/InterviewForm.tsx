'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Calendar } from 'lucide-react'

interface Props {
  submissionId: string
  candidateName?: string
  onClose: () => void
  onSaved: () => void
}

export function InterviewForm({ submissionId, candidateName, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    round: '1',
    scheduled_at: new Date().toISOString().slice(0, 16),
    status: 'Scheduled',
    mode: 'Video',
    interviewer_name: '',
    interviewer_email: '',
    meeting_link: '',
    candidate_briefed: false,
    resume_reshared: false,
    jd_reshared: false,
    confirmation_status: 'Confirmed',
    candidate_prep_notes: '',
    feedback_outcome: '',
    rejection_reason: '',
    feedback_text: '',
    feedback_score: '',
  })
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: iv, error: err } = await supabase.from('interviews').insert({
      submission_id: submissionId,
      round: parseInt(form.round),
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      status: form.status,
      mode: form.mode || null,
      interviewer_name: form.interviewer_name || null,
      interviewer_email: form.interviewer_email || null,
      meeting_link: form.meeting_link || null,
      candidate_briefed: form.candidate_briefed,
      resume_reshared: form.resume_reshared,
      jd_reshared: form.jd_reshared,
      confirmation_status: form.confirmation_status,
      candidate_prep_notes: form.candidate_prep_notes || null,
      feedback_outcome: form.feedback_outcome || null,
      rejection_reason: form.rejection_reason || null,
      feedback_text: form.feedback_text || null,
      feedback_score: form.feedback_score ? parseInt(form.feedback_score) : null,
    }).select().single()

    if (err) { setError(err.message); setLoading(false); return }

    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      entity_type: 'interview',
      entity_id: iv.id,
      action: 'interview_scheduled',
      notes: `Interview Round ${form.round} scheduled (${form.mode}) with ${form.interviewer_name || 'TBD'}. Status: ${form.status}${form.feedback_outcome ? ` | Outcome: ${form.feedback_outcome}` : ''}`,
    })

    setLoading(false)
    onSaved()
  }

  const showFeedback = form.status === 'Completed' || form.status === 'No-show'

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#0EA2E8]" />
            {candidateName ? `Interview — ${candidateName}` : 'Schedule Interview'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Basic scheduling */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Round</Label>
              <Select value={form.round} onValueChange={v => setForm(f => ({ ...f, round: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map(n => <SelectItem key={n} value={n.toString()}>Round {n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={form.mode} onValueChange={v => setForm(f => ({ ...f, mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Video', 'In-Person', 'Phone'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Scheduled At</Label>
            <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
          </div>

          {/* Interviewer details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Interviewer Name</Label>
              <Input value={form.interviewer_name} onChange={e => setForm(f => ({ ...f, interviewer_name: e.target.value }))} placeholder="Client interviewer" />
            </div>
            <div className="space-y-1.5">
              <Label>Interviewer Email</Label>
              <Input type="email" value={form.interviewer_email} onChange={e => setForm(f => ({ ...f, interviewer_email: e.target.value }))} placeholder="Optional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Meeting Link / Location</Label>
              <Input value={form.meeting_link} onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))} placeholder="Zoom / address" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmation Status</Label>
              <Select value={form.confirmation_status} onValueChange={v => setForm(f => ({ ...f, confirmation_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Confirmed', 'Tentative', 'Reschedule Requested', 'Cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pre-interview checklist */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pre-interview Checklist</p>
            {[
              { key: 'candidate_briefed', label: 'Candidate briefed on role & process' },
              { key: 'resume_reshared', label: 'Resume re-shared with client' },
              { key: 'jd_reshared', label: 'JD re-shared with candidate' },
            ].map(item => (
              <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[item.key as keyof typeof form] as boolean}
                  onChange={e => setForm(f => ({ ...f, [item.key]: e.target.checked }))}
                  className="rounded border-gray-300 text-[#82BC0D] focus:ring-[#82BC0D]"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Candidate Prep Notes</Label>
            <Textarea
              value={form.candidate_prep_notes}
              onChange={e => setForm(f => ({ ...f, candidate_prep_notes: e.target.value }))}
              placeholder="What to tell the candidate to prepare..."
              className="h-16"
            />
          </div>

          {/* Status + Feedback */}
          <div className="space-y-1.5">
            <Label>Interview Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Scheduled', 'Completed', 'No-show', 'Cancelled'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showFeedback && (
            <div className="space-y-3 rounded-lg border border-[#0EA2E8]/20 bg-[#0EA2E8]/5 p-4">
              <p className="text-xs font-semibold text-[#0EA2E8] uppercase tracking-wide">Feedback</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Outcome</Label>
                  <Select value={form.feedback_outcome} onValueChange={v => setForm(f => ({ ...f, feedback_outcome: v, rejection_reason: '' }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {['Shortlisted', 'Rejected', 'On Hold'].map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.feedback_outcome === 'Rejected' && (
                  <div className="space-y-1.5">
                    <Label>Rejection Reason</Label>
                    <Select value={form.rejection_reason} onValueChange={v => setForm(f => ({ ...f, rejection_reason: v }))}>
                      <SelectTrigger><SelectValue placeholder="Reason..." /></SelectTrigger>
                      <SelectContent>
                        {['Technical Gap', 'Cultural Fit', 'Salary Mismatch', 'Overqualified', 'No-show', 'Other'].map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Feedback Score (1–10)</Label>
                  <Input type="number" min="1" max="10" value={form.feedback_score} onChange={e => setForm(f => ({ ...f, feedback_score: e.target.value }))} placeholder="Optional" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Feedback Notes</Label>
                <Textarea value={form.feedback_text} onChange={e => setForm(f => ({ ...f, feedback_text: e.target.value }))} placeholder="Detailed interview feedback..." className="h-20" />
              </div>
            </div>
          )}

          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Interview'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
