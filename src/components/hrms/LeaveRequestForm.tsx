'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { User } from '@/types'

interface Props {
  currentUser: User
  balances: any
  onClose: () => void
  onSaved: () => void
}

export function LeaveRequestForm({ currentUser, balances, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    leave_type: 'Casual',
    from_date: '',
    to_date: '',
    reason: '',
  })

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  function calcDays() {
    if (!form.from_date || !form.to_date) return 0
    const from = new Date(form.from_date)
    const to = new Date(form.to_date)
    if (to < from) return 0
    let days = 0
    const cur = new Date(from)
    while (cur <= to) {
      const dow = cur.getDay()
      if (dow !== 0 && dow !== 6) days++
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }

  function getBalance(type: string) {
    if (!balances) return null
    if (type === 'Casual') return balances.casual_total - balances.casual_used
    if (type === 'Sick') return balances.sick_total - balances.sick_used
    if (type === 'Earned') return balances.earned_total - balances.earned_used
    return null
  }

  const days = calcDays()
  const available = getBalance(form.leave_type)

  async function handleSubmit() {
    setError(null)
    if (!form.from_date || !form.to_date) { setError('Please select dates.'); return }
    if (days <= 0) { setError('To date must be after from date.'); return }
    if (form.leave_type !== 'Unpaid' && available !== null && days > available) {
      setError(`Insufficient ${form.leave_type} leave balance. Available: ${available} days.`)
      return
    }

    setSaving(true)
    const { error: err } = await supabase.from('leave_requests').insert({
      employee_id: currentUser.id,
      leave_type: form.leave_type,
      from_date: form.from_date,
      to_date: form.to_date,
      days,
      reason: form.reason || null,
      status: 'Pending',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Leave Type</Label>
            <Select value={form.leave_type} onValueChange={v => f('leave_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Casual">Casual Leave {balances ? `(${balances.casual_total - balances.casual_used} left)` : ''}</SelectItem>
                <SelectItem value="Sick">Sick Leave {balances ? `(${balances.sick_total - balances.sick_used} left)` : ''}</SelectItem>
                <SelectItem value="Earned">Earned Leave {balances ? `(${balances.earned_total - balances.earned_used} left)` : ''}</SelectItem>
                <SelectItem value="Unpaid">Unpaid Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From Date</Label>
              <Input type="date" value={form.from_date} onChange={e => f('from_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To Date</Label>
              <Input type="date" value={form.to_date} min={form.from_date} onChange={e => f('to_date', e.target.value)} />
            </div>
          </div>

          {days > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-md px-3 py-2 text-sm text-blue-700">
              <strong>{days} working day{days !== 1 ? 's' : ''}</strong> selected
              {available !== null && form.leave_type !== 'Unpaid' && (
                <span className="ml-2 text-blue-500">({available} available)</span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Reason <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Input
              value={form.reason}
              onChange={e => f('reason', e.target.value)}
              placeholder="Brief reason for leave..."
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || days <= 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
