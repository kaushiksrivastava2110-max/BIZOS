'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Gift } from 'lucide-react'

interface Props {
  submissionId: string
  candidateName: string
  onClose: () => void
  onSaved: () => void
}

export function OfferForm({ submissionId, candidateName, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    offered_ctc: '',
    designation: '',
    joining_date: '',
    offer_letter_issued: false,
    candidate_response: 'Pending',
    rejection_reason: '',
    counter_offer_received: false,
    counter_offer_ctc: '',
    counter_offer_outcome: '',
    notes: '',
  })
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Upsert offer details
    const { data: existing } = await supabase
      .from('offer_details')
      .select('id')
      .eq('submission_id', submissionId)
      .single()

    const payload = {
      submission_id: submissionId,
      offered_ctc: form.offered_ctc ? parseFloat(form.offered_ctc) : null,
      designation: form.designation || null,
      joining_date: form.joining_date || null,
      offer_letter_issued: form.offer_letter_issued,
      candidate_response: form.candidate_response,
      rejection_reason: form.rejection_reason || null,
      counter_offer_received: form.counter_offer_received,
      counter_offer_ctc: form.counter_offer_ctc ? parseFloat(form.counter_offer_ctc) : null,
      counter_offer_outcome: form.counter_offer_outcome || null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await supabase.from('offer_details').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('offer_details').insert(payload)
    }

    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      entity_type: 'submission',
      entity_id: submissionId,
      action: 'offer_logged',
      notes: `Offer logged for ${candidateName} — ₹${form.offered_ctc || '?'} LPA. Response: ${form.candidate_response}`,
    })

    setLoading(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-[#82BC0D]" />
            Offer Details — {candidateName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Offer basics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Offered CTC (LPA)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.offered_ctc}
                onChange={e => setForm(f => ({ ...f, offered_ctc: e.target.value }))}
                placeholder="e.g. 18.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Designation</Label>
              <Input
                value={form.designation}
                onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                placeholder="Job title offered"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Expected Joining Date</Label>
              <Input
                type="date"
                value={form.joining_date}
                onChange={e => setForm(f => ({ ...f, joining_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Offer Letter Issued?</Label>
              <Select
                value={form.offer_letter_issued ? 'yes' : 'no'}
                onValueChange={v => setForm(f => ({ ...f, offer_letter_issued: v === 'yes' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Candidate response */}
          <div className="space-y-1.5">
            <Label>Candidate Response</Label>
            <Select value={form.candidate_response} onValueChange={v => setForm(f => ({ ...f, candidate_response: v, rejection_reason: '' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Pending', 'Accepted', 'Negotiating', 'Rejected'].map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.candidate_response === 'Rejected' && (
            <div className="space-y-1.5">
              <Label>Rejection Reason</Label>
              <Select value={form.rejection_reason} onValueChange={v => setForm(f => ({ ...f, rejection_reason: v }))}>
                <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                <SelectContent>
                  {['Counter-offer', 'Better offer elsewhere', 'Personal reasons', 'Relocation', 'Other'].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Counter-offer module */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.counter_offer_received}
                onChange={e => setForm(f => ({ ...f, counter_offer_received: e.target.checked }))}
                className="rounded border-gray-300 text-[#F9B710] focus:ring-[#F9B710]"
              />
              <span className="text-sm font-medium text-gray-700">Counter-offer received from candidate</span>
            </label>
            {form.counter_offer_received && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label>Counter-offer CTC (LPA)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.counter_offer_ctc}
                    onChange={e => setForm(f => ({ ...f, counter_offer_ctc: e.target.value }))}
                    placeholder="Candidate's ask"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Counter-offer Outcome</Label>
                  <Select value={form.counter_offer_outcome} onValueChange={v => setForm(f => ({ ...f, counter_offer_outcome: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {['Accepted', 'Rejected', 'Pending'].map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional context..."
              className="h-16"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Skip</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Offer Details'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
