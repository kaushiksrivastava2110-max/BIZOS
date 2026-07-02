'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { User } from '@/types'

const SCORECARD_FIELDS = [
  { key: 'sc_skills_match', label: 'Skills Match', max: 20 },
  { key: 'sc_experience_relevance', label: 'Experience Relevance', max: 20 },
  { key: 'sc_communication', label: 'Communication', max: 20 },
  { key: 'sc_stability', label: 'Stability', max: 20 },
  { key: 'sc_compensation_fit', label: 'Compensation Fit', max: 20 },
]

interface Props {
  currentUser: User
  candidate?: any
  onClose: () => void
  onSaved: () => void
}

export function CandidateForm({ currentUser, candidate, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<any[]>([])
  const [openings, setOpenings] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState(candidate?.client_submitted_to ?? '')
  const [form, setForm] = useState({
    name: candidate?.name ?? '',
    current_company: candidate?.current_company ?? candidate?.current_employer ?? '',
    notice_period: candidate?.notice_period ?? '',
    ctc_current: candidate?.ctc_current?.toString() ?? '',
    ctc_expected: candidate?.ctc_expected?.toString() ?? '',
    source: candidate?.source ?? '',
    market_fit_score: candidate?.market_fit_score?.toString() ?? '50',
    market_fit_notes: candidate?.market_fit_notes ?? '',
    resume_url: candidate?.resume_url ?? '',
    opening_submitted_to: candidate?.opening_submitted_to ?? '',
  })
  const [scores, setScores] = useState({
    sc_skills_match: candidate?.sc_skills_match ?? 10,
    sc_experience_relevance: candidate?.sc_experience_relevance ?? 10,
    sc_communication: candidate?.sc_communication ?? 10,
    sc_stability: candidate?.sc_stability ?? 10,
    sc_compensation_fit: candidate?.sc_compensation_fit ?? 10,
  })
  const supabase = createClient()

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => setClients(data ?? []))
  }, [])

  useEffect(() => {
    if (!selectedClient) { setOpenings([]); return }
    supabase.from('openings').select('id, title').eq('client_id', selectedClient).eq('status', 'Open').order('created_at', { ascending: false })
      .then(({ data }) => setOpenings(data ?? []))
  }, [selectedClient])

  const scorecard_total = Object.values(scores).reduce((a, b) => a + b, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const payload = {
      ...form,
      current_employer: form.current_company, // keep backward compat
      ctc_current: parseFloat(form.ctc_current) || 0,
      ctc_expected: parseFloat(form.ctc_expected) || 0,
      market_fit_score: parseInt(form.market_fit_score) || 0,
      scorecard_total,
      ...scores,
      client_submitted_to: selectedClient || null,
      opening_submitted_to: form.opening_submitted_to || null,
      added_by_id: candidate ? candidate.added_by_id : user.id,
    }

    if (candidate) {
      const { error: err } = await supabase.from('candidates').update(payload).eq('id', candidate.id)
      if (err) { setError(err.message); setLoading(false); return }
      await supabase.from('activity_logs').insert({
        actor_id: user.id, entity_type: 'candidate', entity_id: candidate.id,
        action: 'updated_candidate', notes: `Updated candidate profile: ${form.name}`,
      })
    } else {
      const { data: newC, error: err } = await supabase.from('candidates').insert(payload).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      if (newC) {
        await supabase.from('activity_logs').insert({
          actor_id: user.id, entity_type: 'candidate', entity_id: newC.id,
          action: 'created_candidate', notes: `Added candidate: ${form.name}`,
        })

        // Auto-create Submission if an opening was selected
        if (form.opening_submitted_to) {
          await supabase.from('submissions').insert({
            candidate_id: newC.id,
            opening_id: form.opening_submitted_to,
            stage: 'Submitted',
            stage_entered_at: new Date().toISOString(),
            recruiter_id: user.id,
          })
          await supabase.from('activity_logs').insert({
            actor_id: user.id, entity_type: 'submission', entity_id: newC.id,
            action: 'auto_submitted',
            notes: `${form.name} auto-placed in Submitted stage for selected opening`,
          })
        }
      }
    }

    setLoading(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{candidate ? 'Edit Candidate' : 'New Candidate'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Core details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" required />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Current Company</Label>
              <Input value={form.current_company} onChange={e => setForm(f => ({ ...f, current_company: e.target.value }))} placeholder="Infosys, TCS, Wipro..." />
            </div>
            <div className="space-y-1.5">
              <Label>Notice Period</Label>
              <Select value={form.notice_period} onValueChange={v => setForm(f => ({ ...f, notice_period: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {['Immediate', '15 days', '30 days', '45 days', '60 days', '90 days', 'Serving notice'].map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Naukri, LinkedIn, Referral..." />
            </div>
            <div className="space-y-1.5">
              <Label>Current CTC (₹)</Label>
              <Input type="number" value={form.ctc_current} onChange={e => setForm(f => ({ ...f, ctc_current: e.target.value }))} placeholder="1500000" />
            </div>
            <div className="space-y-1.5">
              <Label>Expected CTC (₹)</Label>
              <Input type="number" value={form.ctc_expected} onChange={e => setForm(f => ({ ...f, ctc_expected: e.target.value }))} placeholder="2000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Resume URL</Label>
              <Input value={form.resume_url} onChange={e => setForm(f => ({ ...f, resume_url: e.target.value }))} placeholder="https://..." />
            </div>
          </div>

          {/* Client submission */}
          {!candidate && (
            <div className="rounded-lg border border-[#0EA2E8]/20 bg-[#0EA2E8]/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-[#0EA2E8] uppercase tracking-wide">Submitted To</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Client *</Label>
                  <Select value={selectedClient} onValueChange={v => { setSelectedClient(v); setForm(f => ({ ...f, opening_submitted_to: '' })) }}>
                    <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Opening / Position</Label>
                  <Select value={form.opening_submitted_to} onValueChange={v => setForm(f => ({ ...f, opening_submitted_to: v }))} disabled={!selectedClient || openings.length === 0}>
                    <SelectTrigger><SelectValue placeholder={!selectedClient ? 'Select client first' : openings.length === 0 ? 'No open positions' : 'Select opening...'} /></SelectTrigger>
                    <SelectContent>
                      {openings.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-gray-500">Selecting an opening auto-places this candidate in the pipeline at "Submitted" stage.</p>
            </div>
          )}

          {/* Scorecard */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1A1A2E]">Scorecard (100pt)</h3>
              <div className={`px-2 py-1 rounded-full text-sm font-bold ${
                scorecard_total >= 70 ? 'bg-[#82BC0D]/10 text-[#5a8409]' :
                scorecard_total >= 50 ? 'bg-[#F9B710]/10 text-[#b8890a]' :
                'bg-gray-100 text-gray-500'
              }`}>
                {scorecard_total}/100
              </div>
            </div>
            {SCORECARD_FIELDS.map(field => (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{field.label}</Label>
                  <span className="text-sm font-bold text-[#1A1A2E]">
                    {scores[field.key as keyof typeof scores]}/{field.max}
                  </span>
                </div>
                <input
                  type="range" min="0" max={field.max}
                  value={scores[field.key as keyof typeof scores]}
                  onChange={e => setScores(s => ({ ...s, [field.key]: parseInt(e.target.value) }))}
                  className="w-full h-2 accent-[#82BC0D] cursor-pointer"
                />
              </div>
            ))}
          </div>

          {/* Market fit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Market Fit Score (0–100)</Label>
              <span className="text-sm font-bold text-[#1A1A2E]">{form.market_fit_score}</span>
            </div>
            <input
              type="range" min="0" max="100"
              value={form.market_fit_score}
              onChange={e => setForm(f => ({ ...f, market_fit_score: e.target.value }))}
              className="w-full h-2 accent-[#0EA2E8] cursor-pointer"
            />
            <Textarea
              placeholder="Notes on market standard alignment..."
              value={form.market_fit_notes}
              onChange={e => setForm(f => ({ ...f, market_fit_notes: e.target.value }))}
              className="h-16"
            />
          </div>

          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : candidate ? 'Update Candidate' : 'Add Candidate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
