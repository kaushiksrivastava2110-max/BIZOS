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
import type { User, Client } from '@/types'

const RUBRIC = [
  { key: 'mandate_clarity', label: 'Mandate Clarity', desc: 'How clearly defined is the role?' },
  { key: 'commercial_terms', label: 'Commercial Terms Risk', desc: 'Is the fee/payment terms acceptable?' },
  { key: 'seniority_fit', label: 'Seniority / Niche Fit', desc: 'Do we have talent in this segment?' },
  { key: 'responsiveness', label: 'Client Responsiveness', desc: 'How responsive are they likely to be?' },
]

const HEALTH_FROM_SCORE = (score: number) => {
  if (score >= 16) return 'green'
  if (score >= 10) return 'amber'
  return 'red'
}

interface Props {
  currentUser: User
  client?: Client
  onClose: () => void
  onSaved: () => void
}

export function ClientForm({ currentUser, client, onClose, onSaved }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState({
    name: client?.name ?? '',
    industry: client?.industry ?? '',
    source_vendor: client?.source_vendor ?? 'direct',
    fee_percentage: client?.fee_percentage?.toString() ?? '8.33',
    payment_terms: client?.payment_terms ?? 'Net 30',
    account_owner_id: client?.account_owner_id ?? currentUser.id,
    intake_rationale: (client as any)?.intake_rationale ?? '',
  })
  const [scores, setScores] = useState({
    mandate_clarity: 3,
    commercial_terms: 3,
    seniority_fit: 3,
    responsiveness: 3,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('users').select('*').order('name').then(({ data }) => setUsers((data as User[]) ?? []))
  }, [])

  const intakeScore = Object.values(scores).reduce((a, b) => a + b, 0)
  const suggestedHealth = HEALTH_FROM_SCORE(intakeScore)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      name: form.name,
      industry: form.industry,
      source_vendor: form.source_vendor,
      fee_percentage: parseFloat(form.fee_percentage),
      payment_terms: form.payment_terms,
      account_owner_id: form.account_owner_id,
      intake_score: intakeScore,
      health_status: suggestedHealth,
      intake_rationale: form.intake_rationale,
    }

    if (client) {
      const { error: err } = await supabase.from('clients').update(payload).eq('id', client.id)
      if (err) { setError(err.message); setLoading(false); return }
      // Log activity
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('activity_logs').insert({
          actor_id: user.id, entity_type: 'client', entity_id: client.id,
          action: 'updated_client', notes: `Updated client: ${payload.name}`,
        })
      }
    } else {
      const { data: newClient, error: err } = await supabase.from('clients').insert(payload).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (user && newClient) {
        await supabase.from('activity_logs').insert({
          actor_id: user.id, entity_type: 'client', entity_id: newClient.id,
          action: 'created_client', notes: `Added new client: ${payload.name}`,
        })
      }
    }

    setLoading(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit Client' : 'New Client'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Client Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Acme Corporation"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Input
                value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                placeholder="BFSI, Technology..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source Vendor</Label>
              <Input
                value={form.source_vendor}
                onChange={e => setForm(f => ({ ...f, source_vendor: e.target.value }))}
                placeholder="direct, Qrewz, Winx..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fee %</Label>
              <Input
                type="number"
                step="0.01"
                value={form.fee_percentage}
                onChange={e => setForm(f => ({ ...f, fee_percentage: e.target.value }))}
                placeholder="8.33"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Input
                value={form.payment_terms}
                onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}
                placeholder="Net 30, Net 45..."
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Account Owner</Label>
              <Select
                value={form.account_owner_id}
                onValueChange={v => setForm(f => ({ ...f, account_owner_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Intake scoring rubric */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1A1A2E]">Intake Scoring Rubric</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#1A1A2E]">{intakeScore}/20</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  suggestedHealth === 'green' ? 'bg-[#82BC0D]/10 text-[#5a8409]' :
                  suggestedHealth === 'amber' ? 'bg-[#F9B710]/10 text-[#b8890a]' :
                  'bg-red-50 text-red-700'
                }`}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: suggestedHealth === 'green' ? '#82BC0D' : suggestedHealth === 'amber' ? '#F9B710' : '#ef4444' }} />
                  Suggested: {suggestedHealth}
                </span>
              </div>
            </div>
            {RUBRIC.map(item => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <span className="text-sm font-bold text-[#1A1A2E] w-6 text-right">
                    {scores[item.key as keyof typeof scores]}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={scores[item.key as keyof typeof scores]}
                  onChange={e => setScores(s => ({ ...s, [item.key]: parseInt(e.target.value) }))}
                  className="w-full h-2 accent-[#82BC0D] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Low (1)</span>
                  <span>High (5)</span>
                </div>
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Rationale / Notes</Label>
              <Textarea
                value={form.intake_rationale}
                onChange={e => setForm(f => ({ ...f, intake_rationale: e.target.value }))}
                placeholder="Notes on intake assessment..."
                className="h-20"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : client ? 'Update Client' : 'Add Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
