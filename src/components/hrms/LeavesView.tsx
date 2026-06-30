'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LeaveRequestForm } from './LeaveRequestForm'
import { CalendarDays, Plus, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

const STATUS_BADGE: Record<string, 'green' | 'red' | 'yellow'> = {
  Approved: 'green', Rejected: 'red', Pending: 'yellow',
}

export function LeavesView({ currentUser }: Props) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager'
  const [requests, setRequests] = useState<any[]>([])
  const [balances, setBalances] = useState<any>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterEmployee, setFilterEmployee] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const supabase = createClient()
  const year = new Date().getFullYear()

  useEffect(() => { load() }, [filterStatus, filterEmployee])

  async function load() {
    setLoading(true)

    // Ensure balance row exists for current user
    await supabase.rpc('ensure_leave_balance', { p_employee_id: currentUser.id, p_year: year })

    if (isAdmin) {
      let q = supabase.from('leave_requests')
        .select('*, employee:users!leave_requests_employee_id_fkey(id, name, role), approver:users!leave_requests_approved_by_fkey(id, name)')
        .order('created_at', { ascending: false })
      if (filterStatus !== 'all') q = q.eq('status', filterStatus)
      if (filterEmployee !== 'all') q = q.eq('employee_id', filterEmployee)

      const [{ data: reqs }, { data: emp }] = await Promise.all([
        q,
        supabase.from('users').select('id, name, role').order('name'),
      ])
      setRequests(reqs ?? [])
      setEmployees(emp ?? [])
    } else {
      let q = supabase.from('leave_requests')
        .select('*')
        .eq('employee_id', currentUser.id)
        .order('created_at', { ascending: false })
      if (filterStatus !== 'all') q = q.eq('status', filterStatus)

      const [{ data: reqs }, { data: bal }] = await Promise.all([
        q,
        supabase.from('leave_balances').select('*').eq('employee_id', currentUser.id).eq('year', year).single(),
      ])
      setRequests(reqs ?? [])
      setBalances(bal)
    }
    setLoading(false)
  }

  async function handleApprove(id: string) {
    await supabase.from('leave_requests').update({
      status: 'Approved',
      approved_by: currentUser.id,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    load()
  }

  async function handleReject(id: string) {
    const reason = prompt('Reason for rejection (optional):') ?? ''
    await supabase.from('leave_requests').update({
      status: 'Rejected',
      approved_by: currentUser.id,
      approved_at: new Date().toISOString(),
      rejection_reason: reason || null,
    }).eq('id', id)
    load()
  }

  return (
    <div className="space-y-5">
      {/* Balance cards for recruiter */}
      {!isAdmin && balances && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Casual Leave', used: balances.casual_used, total: balances.casual_total, color: '#0EA2E8' },
            { label: 'Sick Leave', used: balances.sick_used, total: balances.sick_total, color: '#F9B710' },
            { label: 'Earned Leave', used: balances.earned_used, total: balances.earned_total, color: '#82BC0D' },
          ].map(b => (
            <Card key={b.label} className="p-4">
              <p className="text-xs text-gray-500 mb-1">{b.label}</p>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold" style={{ color: b.color }}>{b.total - b.used}</span>
                <span className="text-xs text-gray-400 mb-1">/ {b.total} remaining</span>
              </div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ backgroundColor: b.color, width: `${Math.max(0, ((b.total - b.used) / b.total) * 100)}%` }} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        {!isAdmin && (
          <Button variant="primary" size="sm" className="ml-auto" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Request Leave
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : requests.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarDays className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No leave requests found.</p>
          {!isAdmin && (
            <Button variant="primary" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Request Leave
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {isAdmin && <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Employee</th>}
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Leave Type</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Period</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Days</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Reason</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 group">
                  {isAdmin && (
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-[#1A1A2E]">{r.employee?.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{r.employee?.role}</p>
                    </td>
                  )}
                  <td className="px-5 py-3.5">
                    <Badge variant={r.leave_type === 'Sick' ? 'yellow' : r.leave_type === 'Earned' ? 'green' : 'blue'}>
                      {r.leave_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    {formatDate(r.from_date)} – {formatDate(r.to_date)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-sm font-semibold text-[#1A1A2E]">{r.days}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-500 max-w-[200px] truncate">{r.reason || '—'}</td>
                  <td className="px-4 py-3.5 text-center">
                    <Badge variant={STATUS_BADGE[r.status] ?? 'default'}>{r.status}</Badge>
                    {r.status === 'Rejected' && r.rejection_reason && (
                      <p className="text-xs text-red-400 mt-0.5 truncate max-w-[120px]">{r.rejection_reason}</p>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3.5">
                      {r.status === 'Pending' && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon-sm" onClick={() => handleApprove(r.id)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleReject(r.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {r.status !== 'Pending' && (
                        <span className="text-xs text-gray-400">{r.approver?.name ?? ''}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showForm && (
        <LeaveRequestForm
          currentUser={currentUser}
          balances={balances}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}
