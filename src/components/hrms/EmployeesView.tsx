'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, CalendarDays, Receipt } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

const ROLE_BADGE: Record<string, 'green' | 'blue' | 'yellow' | 'default'> = {
  admin: 'green', manager: 'blue', recruiter: 'yellow', viewer: 'default',
}

export function EmployeesView({ currentUser }: Props) {
  const [employees, setEmployees] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [history, setHistory] = useState<{ leaves: any[]; payslips: any[]; balances: any }>({ leaves: [], payslips: [], balances: null })
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const supabase = createClient()
  const year = new Date().getFullYear()

  useEffect(() => { loadEmployees() }, [])

  async function loadEmployees() {
    const { data } = await supabase.from('users').select('*').order('name')
    setEmployees(data ?? [])
    setLoading(false)
  }

  async function selectEmployee(emp: any) {
    setSelected(emp)
    setLoadingHistory(true)
    const [{ data: leaves }, { data: payslips }, { data: bal }] = await Promise.all([
      supabase.from('leave_requests').select('*').eq('employee_id', emp.id).order('created_at', { ascending: false }),
      supabase.from('payslips').select('*').eq('employee_id', emp.id).order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('leave_balances').select('*').eq('employee_id', emp.id).eq('year', year).single(),
    ])
    setHistory({ leaves: leaves ?? [], payslips: payslips ?? [], balances: bal })
    setLoadingHistory(false)
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  if (loading) return <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse"/>)}</div>

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* Employee list */}
      <div className="col-span-1 space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">{employees.length} Employees</p>
        {employees.map(emp => (
          <button
            key={emp.id}
            onClick={() => selectEmployee(emp)}
            className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all ${selected?.id === emp.id ? 'border-[#0EA2E8] bg-blue-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
          >
            <div className="w-9 h-9 rounded-full bg-[#1A1A2E] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {emp.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1A2E] truncate">{emp.name}</p>
              <p className="text-xs text-gray-400 truncate">{emp.email}</p>
            </div>
            <Badge variant={ROLE_BADGE[emp.role] ?? 'default'} className="shrink-0 text-[10px]">
              {emp.role}
            </Badge>
          </button>
        ))}
      </div>

      {/* Employee detail */}
      <div className="col-span-2">
        {!selected ? (
          <Card className="p-12 text-center h-full flex flex-col items-center justify-center">
            <Users className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">Select an employee to view their history</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Profile card */}
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#1A1A2E] flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {selected.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#1A1A2E]">{selected.name}</h2>
                  <p className="text-sm text-gray-500">{selected.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={ROLE_BADGE[selected.role] ?? 'default'}>{selected.role}</Badge>
                    <span className="text-xs text-gray-400">Joined {formatDate(selected.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Leave balance */}
              {history.balances && (
                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                  {[
                    { label: 'Casual', used: history.balances.casual_used, total: history.balances.casual_total },
                    { label: 'Sick', used: history.balances.sick_used, total: history.balances.sick_total },
                    { label: 'Earned', used: history.balances.earned_used, total: history.balances.earned_total },
                  ].map(b => (
                    <div key={b.label} className="text-center">
                      <p className="text-xs text-gray-400">{b.label} Leave</p>
                      <p className="text-lg font-bold text-[#1A1A2E]">{b.total - b.used}<span className="text-xs text-gray-400 font-normal">/{b.total}</span></p>
                      <p className="text-xs text-gray-400">{b.used} used</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {loadingHistory ? (
              <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse"/>)}</div>
            ) : (
              <>
                {/* Leave history */}
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <CalendarDays className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-[#1A1A2E]">Leave History</span>
                    <span className="text-xs text-gray-400 ml-auto">{history.leaves.length} requests</span>
                  </div>
                  {history.leaves.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-6">No leave requests yet.</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-50">
                          <th className="text-left text-xs font-medium text-gray-400 px-4 py-2">Type</th>
                          <th className="text-left text-xs font-medium text-gray-400 px-4 py-2">Period</th>
                          <th className="text-center text-xs font-medium text-gray-400 px-4 py-2">Days</th>
                          <th className="text-center text-xs font-medium text-gray-400 px-4 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {history.leaves.map(l => (
                          <tr key={l.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <Badge variant={l.leave_type === 'Sick' ? 'yellow' : l.leave_type === 'Earned' ? 'green' : 'blue'} className="text-[10px]">
                                {l.leave_type}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{formatDate(l.from_date)} – {formatDate(l.to_date)}</td>
                            <td className="px-4 py-2.5 text-center text-xs font-medium">{l.days}</td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge variant={{ Approved: 'green', Rejected: 'red', Pending: 'yellow' }[l.status as string] as any ?? 'default'} className="text-[10px]">
                                {l.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>

                {/* Payslip history */}
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <Receipt className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-[#1A1A2E]">Payslip History</span>
                    <span className="text-xs text-gray-400 ml-auto">{history.payslips.length} payslips</span>
                  </div>
                  {history.payslips.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-6">No payslips generated yet.</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-50">
                          <th className="text-left text-xs font-medium text-gray-400 px-4 py-2">Period</th>
                          <th className="text-right text-xs font-medium text-gray-400 px-4 py-2">Gross</th>
                          <th className="text-right text-xs font-medium text-gray-400 px-4 py-2">Net Pay</th>
                          <th className="text-center text-xs font-medium text-gray-400 px-4 py-2">LOP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {history.payslips.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-sm font-medium text-[#1A1A2E]">{MONTHS[p.month - 1]} {p.year}</td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-600">₹{Number(p.gross_pay).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-bold text-[#82BC0D]">₹{Number(p.net_pay).toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2.5 text-center">
                              {p.lop_days > 0 ? <Badge variant="yellow" className="text-[10px]">{p.lop_days}d</Badge> : <span className="text-xs text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
