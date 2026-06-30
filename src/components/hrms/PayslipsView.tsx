'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PayslipForm } from './PayslipForm'
import { Receipt, Download, Plus, Pencil } from 'lucide-react'
import type { User } from '@/types'

interface Props { currentUser: User }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getRecentMonths(n: number) {
  const result = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ month: d.getMonth() + 1, year: d.getFullYear() })
  }
  return result
}

export function PayslipsView({ currentUser }: Props) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager'
  const [payslips, setPayslips] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterEmployee, setFilterEmployee] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editPayslip, setEditPayslip] = useState<any | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [filterEmployee])

  async function load() {
    setLoading(true)

    if (isAdmin) {
      const [{ data: ps }, { data: emp }] = await Promise.all([
        supabase.from('payslips')
          .select('*, employee:users!payslips_employee_id_fkey(id, name, email, role)')
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .eq(filterEmployee !== 'all' ? 'employee_id' : 'id', filterEmployee !== 'all' ? filterEmployee : undefined as any),
        supabase.from('users').select('id, name, email, role').order('name'),
      ])
      // fix: don't pass undefined eq filter
      const psQuery = supabase.from('payslips')
        .select('*, employee:users!payslips_employee_id_fkey(id, name, email, role)')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
      const finalPs = filterEmployee !== 'all'
        ? await psQuery.eq('employee_id', filterEmployee)
        : await psQuery
      setPayslips(finalPs.data ?? [])
      setEmployees(emp ?? [])
    } else {
      // Recruiter: only their own, last 4 months (current + 3)
      const recent = getRecentMonths(4)
      const { data } = await supabase.from('payslips')
        .select('*')
        .eq('employee_id', currentUser.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(4)
      setPayslips(data ?? [])
    }
    setLoading(false)
  }

  function downloadPayslip(p: any) {
    const empName = isAdmin ? p.employee?.name : currentUser.name
    const html = generatePayslipHTML(p, empName, isAdmin ? p.employee?.email : currentUser.email)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {isAdmin && (
          <>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="h-8 w-48"><SelectValue placeholder="All Employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="primary" size="sm" className="ml-auto" onClick={() => { setEditPayslip(null); setShowForm(true) }}>
              <Plus className="h-4 w-4" /> Generate Payslip
            </Button>
          </>
        )}
        {!isAdmin && (
          <p className="text-sm text-gray-500">Showing your payslips for the current and last 3 months.</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : payslips.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No payslips found.</p>
          {isAdmin && <Button variant="primary" size="sm" className="mt-3" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Generate First Payslip</Button>}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {isAdmin && <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Employee</th>}
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Period</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Gross Pay</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Deductions</th>
                <th className="text-right text-xs font-medium text-[#82BC0D] px-4 py-3">Net Pay</th>
                <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">LOP</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payslips.map(p => {
                const totalDeductions = (p.pf_employee || 0) + (p.professional_tax || 0) + (p.tds || 0) + (p.other_deductions || 0) + (p.lop_deduction || 0)
                return (
                  <tr key={p.id} className="hover:bg-gray-50 group">
                    {isAdmin && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#1A1A2E] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {p.employee?.name?.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1A1A2E]">{p.employee?.name}</p>
                            <p className="text-xs text-gray-400 capitalize">{p.employee?.role}</p>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-[#1A1A2E]">{MONTHS[p.month - 1]} {p.year}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm text-gray-700">₹{Number(p.gross_pay).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3.5 text-right text-sm text-red-500">₹{Number(totalDeductions).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-bold text-[#82BC0D]">₹{Number(p.net_pay).toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {p.lop_days > 0
                        ? <Badge variant="yellow">{p.lop_days}d</Badge>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <Button variant="ghost" size="icon-sm" onClick={() => { setEditPayslip(p); setShowForm(true) }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => downloadPayslip(p)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {showForm && (
        <PayslipForm
          currentUser={currentUser}
          employees={employees}
          payslip={editPayslip}
          onClose={() => { setShowForm(false); setEditPayslip(null) }}
          onSaved={() => { setShowForm(false); setEditPayslip(null); load() }}
        />
      )}
    </div>
  )
}

function generatePayslipHTML(p: any, empName: string, empEmail: string) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const totalDeductions = (p.pf_employee || 0) + (p.professional_tax || 0) + (p.tds || 0) + (p.other_deductions || 0) + (p.lop_deduction || 0)
  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${MONTHS[p.month - 1]} ${p.year}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a2e; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a1a2e; padding-bottom: 16px; margin-bottom: 24px; }
    .company { font-size: 22px; font-weight: bold; color: #1a1a2e; }
    .company small { display: block; font-size: 12px; font-weight: normal; color: #666; }
    .title { text-align: right; }
    .title h2 { margin: 0; font-size: 18px; color: #0EA2E8; }
    .title p { margin: 4px 0 0; font-size: 13px; color: #666; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8f8f8; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .info-item { font-size: 13px; } .info-item span { font-weight: 600; }
    .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .table th { background: #1a1a2e; color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
    .table td { padding: 9px 14px; font-size: 13px; border-bottom: 1px solid #eee; }
    .table tr:last-child td { border-bottom: none; }
    .totals { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .total-box { background: #f8f8f8; padding: 16px; border-radius: 8px; }
    .total-box .label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .total-box .value { font-size: 20px; font-weight: bold; }
    .net { background: #1a1a2e; color: white; }
    .net .label { color: rgba(255,255,255,0.7); }
    .footer { margin-top: 32px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 12px; text-align: center; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">BIZQUAD CONSULTANTS<small>HR Management System</small></div>
    <div class="title"><h2>PAYSLIP</h2><p>${MONTHS[p.month - 1]} ${p.year}</p></div>
  </div>

  <div class="info-grid">
    <div class="info-item">Employee Name: <span>${empName}</span></div>
    <div class="info-item">Email: <span>${empEmail}</span></div>
    <div class="info-item">Working Days: <span>${p.working_days}</span></div>
    <div class="info-item">Days Worked: <span>${p.days_worked}</span></div>
    <div class="info-item">LOP Days: <span>${p.lop_days}</span></div>
    <div class="info-item">Pay Period: <span>${MONTHS[p.month - 1]} ${p.year}</span></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    <table class="table">
      <thead><tr><th>Earnings</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Basic Salary</td><td>${fmt(p.basic_salary)}</td></tr>
        <tr><td>HRA</td><td>${fmt(p.hra)}</td></tr>
        <tr><td>Allowances</td><td>${fmt(p.allowances)}</td></tr>
        <tr style="font-weight:bold;background:#f0f0f0"><td>Gross Pay</td><td>${fmt(p.gross_pay)}</td></tr>
      </tbody>
    </table>
    <table class="table">
      <thead><tr><th>Deductions</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>PF (Employee)</td><td>${fmt(p.pf_employee)}</td></tr>
        <tr><td>Professional Tax</td><td>${fmt(p.professional_tax)}</td></tr>
        <tr><td>TDS</td><td>${fmt(p.tds)}</td></tr>
        <tr><td>Other Deductions</td><td>${fmt(p.other_deductions)}</td></tr>
        <tr><td>LOP Deduction</td><td>${fmt(p.lop_deduction)}</td></tr>
        <tr style="font-weight:bold;background:#f0f0f0"><td>Total Deductions</td><td>${fmt(totalDeductions)}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="totals">
    <div class="total-box"><div class="label">Total Deductions</div><div class="value" style="color:#ef4444">${fmt(totalDeductions)}</div></div>
    <div class="total-box net"><div class="label">Net Pay (Take Home)</div><div class="value">${fmt(p.net_pay)}</div></div>
  </div>

  ${p.notes ? `<div style="margin-top:20px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px"><strong>Notes:</strong> ${p.notes}</div>` : ''}

  <div class="footer">This is a computer-generated payslip and does not require a signature. Generated by BIZOS HRMS.</div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`
}
