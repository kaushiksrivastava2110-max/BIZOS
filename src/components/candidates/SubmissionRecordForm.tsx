'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Send } from 'lucide-react'

interface Props {
  submissionId: string
  candidateName: string
  onClose: () => void
  onSaved: () => void
}

export function SubmissionRecordForm({ submissionId, candidateName, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    method: 'Email',
    cover_note: '',
    profile_version: '',
    sla_days: '3',
  })
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    await supabase.from('submission_records').insert({
      submission_id: submissionId,
      submitted_by: user.id,
      method: form.method,
      cover_note: form.cover_note || null,
      profile_version: form.profile_version || null,
      sla_days: parseInt(form.sla_days),
      acknowledgement_status: 'Pending',
    })

    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      entity_type: 'submission',
      entity_id: submissionId,
      action: 'profile_submitted',
      notes: `Submitted ${candidateName}'s profile via ${form.method}. SLA: ${form.sla_days} days.`,
    })

    setLoading(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[#F9B710]" />
            Log Submission — {candidateName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-[#F9B710]/10 border border-[#F9B710]/20 px-4 py-3 text-sm text-[#1A1A2E]">
            Recording this submission will start the <strong>client acknowledgement SLA timer</strong>.
          </div>

          <div className="space-y-1.5">
            <Label>Submission Method *</Label>
            <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Email', 'WhatsApp', 'Portal', 'Other'].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cover Note / Pitch</Label>
            <Textarea
              value={form.cover_note}
              onChange={e => setForm(f => ({ ...f, cover_note: e.target.value }))}
              placeholder="Key highlights you shared with the client..."
              className="h-24"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Profile Version / Filename</Label>
              <Input
                value={form.profile_version}
                onChange={e => setForm(f => ({ ...f, profile_version: e.target.value }))}
                placeholder="e.g. v2_resume.pdf"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ack. SLA (days)</Label>
              <Select value={form.sla_days} onValueChange={v => setForm(f => ({ ...f, sla_days: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['1', '2', '3', '5', '7'].map(d => (
                    <SelectItem key={d} value={d}>{d} days</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Skip</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Record Submission'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
