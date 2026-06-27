'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Search } from 'lucide-react'
import type { User } from '@/types'

interface Props {
  opening: any
  currentUser: User
  onClose: () => void
  onSaved: () => void
}

export function AddCandidateToOpeningForm({ opening, currentUser, onClose, onSaved }: Props) {
  const [candidates, setCandidates] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const [stage, setStage] = useState('Sourced')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadCandidates() {
      let q = supabase.from('candidates').select('id, name, current_employer, scorecard_total').order('name')
      if (search) q = q.or(`name.ilike.%${search}%,current_employer.ilike.%${search}%`)
      const { data } = await q.limit(20)
      setCandidates(data ?? [])
    }
    loadCandidates()
  }, [search])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCandidateId) { setError('Please select a candidate'); return }
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: newSub, error: err } = await supabase.from('submissions').insert({
      candidate_id: selectedCandidateId,
      opening_id: opening.id,
      stage,
      stage_entered_at: new Date().toISOString(),
      recruiter_id: currentUser.id,
    }).select().single()

    if (err) { setError(err.message); setLoading(false); return }

    const candidate = candidates.find(c => c.id === selectedCandidateId)
    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      entity_type: 'submission',
      entity_id: newSub.id,
      action: 'candidate_added_to_opening',
      notes: `Added ${candidate?.name} to ${opening.title} as ${stage}`,
    })

    setLoading(false)
    onSaved()
  }

  const STAGES = ['Sourced', 'Screened', 'Submitted', 'Client Review', 'Interview L1', 'Interview L2', 'Offer']

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Candidate to Opening</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 -mt-1">Submitting to: <strong>{opening.title}</strong></p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Search Candidate</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Name or employer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Select Candidate *</Label>
            <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose candidate..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.current_employer} (Score: {c.scorecard_total})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Initial Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Adding...</> : 'Add to Pipeline'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
