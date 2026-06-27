'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { PRACTICE_AREAS } from '@/lib/utils'
import type { User } from '@/types'

interface Props {
  currentUser: User
  opening?: any
  defaultClientId?: string
  onClose: () => void
  onSaved: () => void
}

export function OpeningForm({ currentUser, opening, defaultClientId, onClose, onSaved }: Props) {
  const [clients, setClients] = useState<any[]>([])
  const [recruiters, setRecruiters] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    client_id: opening?.client_id ?? defaultClientId ?? '',
    title: opening?.title ?? '',
    practice_area: opening?.practice_area ?? 'Other',
    seniority: opening?.seniority ?? '',
    ctc_band: opening?.ctc_band ?? '',
    engagement_type: opening?.engagement_type ?? 'Permanent',
    status: opening?.status ?? 'Open',
    assigned_recruiter_id: opening?.assigned_recruiter_id ?? currentUser.id,
  })
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('users').select('*').in('role', ['admin', 'manager', 'recruiter']).order('name'),
    ]).then(([{ data: c }, { data: u }]) => {
      setClients(c ?? [])
      setRecruiters((u as User[]) ?? [])
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (opening) {
      const { error: err } = await supabase.from('openings').update(form).eq('id', opening.id)
      if (err) { setError(err.message); setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('activity_logs').insert({
          actor_id: user.id, entity_type: 'opening', entity_id: opening.id,
          action: 'updated_opening', notes: `Updated opening: ${form.title}`,
        })
      }
    } else {
      const { data: newOpening, error: err } = await supabase.from('openings').insert(form).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (user && newOpening) {
        await supabase.from('activity_logs').insert({
          actor_id: user.id, entity_type: 'opening', entity_id: newOpening.id,
          action: 'created_opening', notes: `Created opening: ${form.title} at client`,
        })
      }
    }

    setLoading(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{opening ? 'Edit Opening' : 'New Opening'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Client *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Job Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="SAP FICO Consultant" required />
            </div>
            <div className="space-y-1.5">
              <Label>Practice Area</Label>
              <Select value={form.practice_area} onValueChange={v => setForm(f => ({ ...f, practice_area: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRACTICE_AREAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Engagement Type</Label>
              <Select value={form.engagement_type} onValueChange={v => setForm(f => ({ ...f, engagement_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Permanent', 'Contract', 'C2H', 'C2C'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Seniority</Label>
              <Input value={form.seniority} onChange={e => setForm(f => ({ ...f, seniority: e.target.value }))} placeholder="Senior, Lead, Manager..." />
            </div>
            <div className="space-y-1.5">
              <Label>CTC Band</Label>
              <Input value={form.ctc_band} onChange={e => setForm(f => ({ ...f, ctc_band: e.target.value }))} placeholder="20-25 LPA" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Open', 'On Hold', 'Closed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned Recruiter</Label>
              <Select value={form.assigned_recruiter_id} onValueChange={v => setForm(f => ({ ...f, assigned_recruiter_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {recruiters.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : opening ? 'Update' : 'Create Opening'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
