'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface Props {
  submissionId: string
  onClose: () => void
  onSaved: () => void
}

export function InterviewForm({ submissionId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    round: '1',
    scheduled_at: new Date().toISOString().slice(0, 16),
    status: 'Scheduled',
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
      feedback_text: form.feedback_text || null,
      feedback_score: form.feedback_score ? parseInt(form.feedback_score) : null,
    }).select().single()

    if (err) { setError(err.message); setLoading(false); return }

    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      entity_type: 'interview',
      entity_id: iv.id,
      action: 'interview_scheduled',
      notes: `Interview Round ${form.round} scheduled, status: ${form.status}`,
    })

    setLoading(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Interview</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Scheduled','Completed','No-show','Cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Scheduled At</Label>
            <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label>Feedback Score (1-10)</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={form.feedback_score}
              onChange={e => setForm(f => ({ ...f, feedback_score: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Feedback Notes</Label>
            <Textarea
              value={form.feedback_text}
              onChange={e => setForm(f => ({ ...f, feedback_text: e.target.value }))}
              placeholder="Interview feedback..."
              className="h-20"
            />
          </div>

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
