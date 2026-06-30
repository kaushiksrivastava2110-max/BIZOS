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

function numToWords(num: number): string {
  if (!num || num <= 0) return 'Zero Rupees'
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  const two = (n: number): string => n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '')
  const three = (n: number): string => n >= 100 ? ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + two(n%100) : '') : two(n)
  let n = Math.round(num), r = ''
  if (n >= 10000000) { r += three(Math.floor(n/10000000)) + ' Crore '; n %= 10000000 }
  if (n >= 100000)   { r += three(Math.floor(n/100000)) + ' Lakh '; n %= 100000 }
  if (n >= 1000)     { r += three(Math.floor(n/1000)) + ' Thousand '; n %= 1000 }
  if (n > 0) r += three(n)
  return 'Rupees ' + r.trim() + ' Only'
}

function generatePayslipHTML(p: any, empName: string, empEmail: string) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const totalDeductions = (p.pf_employee || 0) + (p.professional_tax || 0) + (p.tds || 0) + (p.other_deductions || 0) + (p.lop_deduction || 0)
  const fmt = (n: number) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })
  const initials = empName.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0,2).join('').toUpperCase() || 'BQ'
  const genDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  // Build earnings rows
  const earns: { l: string; a: number }[] = [
    { l: 'Basic Salary', a: p.basic_salary || 0 },
    { l: 'HRA', a: p.hra || 0 },
  ]
  if (p.allowances > 0) earns.push({ l: 'Special Allowance', a: p.allowances })

  // Build deductions rows
  const deds: { l: string; a: number }[] = []
  if (p.pf_employee > 0)      deds.push({ l: 'PF (Employee)', a: p.pf_employee })
  if (p.professional_tax > 0) deds.push({ l: 'Professional Tax', a: p.professional_tax })
  if (p.tds > 0)               deds.push({ l: 'TDS / Income Tax', a: p.tds })
  if (p.other_deductions > 0)  deds.push({ l: 'Other Deductions', a: p.other_deductions })
  if (p.lop_deduction > 0)     deds.push({ l: 'LOP Deduction', a: p.lop_deduction })

  const rowCount = Math.max(earns.length, deds.length)
  let salRows = ''
  for (let i = 0; i < rowCount; i++) {
    const e = earns[i] || { l: '', a: null as unknown as number }
    const d = deds[i]  || { l: '', a: null as unknown as number }
    const even = i % 2 === 1 ? 'background:#fafbfc' : ''
    salRows += `<div style="display:grid;grid-template-columns:1fr 100px 1fr 100px;border-bottom:1px solid #f0f4f8;${even}">
      <div style="padding:5px 10px;font-size:12.5px">${e.l}</div>
      <div style="padding:5px 10px;font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums">${e.a != null && e.l ? fmt(e.a) : ''}</div>
      <div style="padding:5px 10px;font-size:12.5px;border-left:1px solid #dde3ec">${d.l}</div>
      <div style="padding:5px 10px;font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums">${d.a != null && d.l ? fmt(d.a) : ''}</div>
    </div>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payslip – ${MONTHS[p.month - 1]} ${p.year}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;color:#0f172a;line-height:1.5}
#slip{background:#fff;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.13);overflow:hidden;max-width:800px;margin:30px auto;font-size:12.5px}
.slip-head{background:#1e3a5f;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:14px}
.slip-logo{width:52px;height:52px;background:rgba(255,255,255,.18);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;flex-shrink:0}
.slip-co h2{font-size:19px;font-weight:700;letter-spacing:-.02em}
.slip-co p{font-size:11.5px;opacity:.75;margin-top:2px}
.slip-band{background:#162e4d;padding:7px 24px;display:flex;justify-content:space-between;align-items:center}
.slip-band h3{color:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em}
.slip-band span{color:#93c5fd;font-size:12px;font-weight:600}
.slip-body{padding:18px 24px}
.emp-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dde3ec;border-radius:6px;overflow:hidden;margin-bottom:16px;font-size:12px}
.eg-lbl{background:#f7f9fc;font-weight:700;color:#64748b;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;padding:6px 10px;border-bottom:1px solid #dde3ec;border-right:1px solid #dde3ec}
.eg-val{font-weight:500;color:#0f172a;padding:6px 10px;border-bottom:1px solid #dde3ec}
.eg-lbl:nth-last-child(2),.eg-val:last-child{border-bottom:none}
.sal-table{border:1px solid #dde3ec;border-radius:6px;overflow:hidden;margin-bottom:16px}
.sal-head{display:grid;grid-template-columns:1fr 100px 1fr 100px;background:#1e3a5f;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em}
.sal-head>div{padding:8px 10px}
.sal-head>div:nth-child(2),.sal-head>div:nth-child(4){text-align:right}
.sal-head>div:nth-child(3){border-left:1px solid rgba(255,255,255,.2)}
.sal-total{display:grid;grid-template-columns:1fr 100px 1fr 100px;background:#eef2f7;font-weight:800;font-size:12.5px}
.sal-total>div{padding:8px 10px}
.sal-total>div:nth-child(2),.sal-total>div:nth-child(4){text-align:right;font-variant-numeric:tabular-nums}
.sal-total>div:nth-child(3){border-left:1px solid #dde3ec}
.net-pay{background:linear-gradient(135deg,#1e3a5f,#2d5282);color:#fff;padding:14px 18px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.slip-footer{border-top:1px solid #dde3ec;padding:14px 24px;display:flex;justify-content:space-between;align-items:flex-end}
.sig-block{text-align:center;font-size:11px;color:#64748b}
.sig-line{border-top:1px solid #cbd5e1;padding-top:5px;min-width:120px;margin-top:28px}
.slip-note{font-size:10px;color:#94a3b8;text-align:center;padding:6px 24px 10px;border-top:1px solid #f0f4f8}
@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{background:#fff}
  #slip{box-shadow:none;border-radius:0;margin:.3in}
  @page{size:A4;margin:0}
}
</style>
</head>
<body>
<div id="slip">
  <div class="slip-head">
    <div class="slip-logo">${initials}</div>
    <div class="slip-co">
      <h2>BIZQUAD CONSULTANTS PRIVATE LIMITED</h2>
      <p>HR Management System</p>
    </div>
  </div>
  <div class="slip-band">
    <h3>Salary Slip</h3>
    <span>${MONTHS[p.month - 1]} ${p.year}</span>
  </div>
  <div class="slip-body">
    <div class="emp-grid">
      <div class="eg-lbl">Employee Name</div><div class="eg-val">${empName}</div>
      <div class="eg-lbl">Email</div><div class="eg-val">${empEmail}</div>
      <div class="eg-lbl">Pay Period</div><div class="eg-val">${MONTHS[p.month - 1]} ${p.year}</div>
      <div class="eg-lbl">Working Days</div><div class="eg-val">${p.working_days}</div>
      <div class="eg-lbl">Days Worked</div><div class="eg-val">${p.days_worked}</div>
      <div class="eg-lbl">LOP Days</div><div class="eg-val">${p.lop_days || 0}</div>
    </div>

    <div class="sal-table">
      <div class="sal-head">
        <div>Earnings</div><div>Amount (₹)</div><div>Deductions</div><div>Amount (₹)</div>
      </div>
      ${salRows}
      <div class="sal-total">
        <div>Gross Earnings</div><div>₹ ${fmt(p.gross_pay)}</div>
        <div>Total Deductions</div><div>₹ ${fmt(totalDeductions)}</div>
      </div>
    </div>

    <div class="net-pay">
      <div>
        <div style="font-size:11px;opacity:.75;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Net Take-Home Pay</div>
        <div style="font-size:22px;font-weight:800;font-variant-numeric:tabular-nums">₹ ${fmt(p.net_pay)}</div>
      </div>
      <div style="text-align:right;max-width:260px">
        <div style="font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Amount in Words</div>
        <div style="font-size:11.5px;opacity:.82">${numToWords(Math.round(p.net_pay || 0))}</div>
      </div>
    </div>

    ${p.notes ? `<div style="margin-bottom:14px;padding:10px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:12.5px"><strong>Notes:</strong> ${p.notes}</div>` : ''}
  </div>

  <div class="slip-footer">
    <div class="sig-block">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:20px">Generated: ${genDate}</div>
      <div class="sig-line">Employee Signature</div>
    </div>
    <div class="sig-block">
      <div class="sig-line" style="margin-left:auto">Authorized Signatory</div>
    </div>
  </div>
  <div class="slip-note">This is a computer-generated payslip and does not require a physical signature.</div>
</div>
<script>window.onload = () => window.print()</script>
</body>
</html>`
}
