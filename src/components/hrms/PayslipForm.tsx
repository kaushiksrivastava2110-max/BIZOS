'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { User } from '@/types'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const currentYear = new Date().getFullYear()
const YEARS = [currentYear - 1, currentYear, currentYear + 1]

interface Props {
  currentUser: User
  employees: any[]
  payslip?: any
  onClose: () => void
  onSaved: () => void
}

export function PayslipForm({ currentUser, employees, payslip, onClose, onSaved }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    employee_id: payslip?.employee_id ?? '',
    month: payslip?.month?.toString() ?? (new Date().getMonth() + 1).toString(),
    year: payslip?.year?.toString() ?? currentYear.toString(),
    basic_salary: payslip?.basic_salary?.toString() ?? '0',
    hra: payslip?.hra?.toString() ?? '0',
    allowances: payslip?.allowances?.toString() ?? '0',
    pf_employee: payslip?.pf_employee?.toString() ?? '0',
    professional_tax: payslip?.professional_tax?.toString() ?? '200',
    tds: payslip?.tds?.toString() ?? '0',
    other_deductions: payslip?.other_deductions?.toString() ?? '0',
    working_days: payslip?.working_days?.toString() ?? '26',
    days_worked: payslip?.days_worked?.toString() ?? '26',
    lop_days: payslip?.lop_days?.toString() ?? '0',
    notes: payslip?.notes ?? '',
  })

  const n = (v: string) => parseFloat(v) || 0

  const gross = n(form.basic_salary) + n(form.hra) + n(form.allowances)
  const lopDeduction = form.working_days !== '0'
    ? (gross / n(form.working_days)) * n(form.lop_days)
    : 0
  const totalDeductions = n(form.pf_employee) + n(form.professional_tax) + n(form.tds) + n(form.other_deductions) + lopDeduction
  const netPay = gross - totalDeductions

  const f = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSave() {
    if (!form.employee_id) { setError('Please select an employee.'); return }
    setSaving(true)
    setError(null)

    const payload = {
      employee_id: form.employee_id,
      month: parseInt(form.month),
      year: parseInt(form.year),
      basic_salary: n(form.basic_salary),
      hra: n(form.hra),
      allowances: n(form.allowances),
      gross_pay: gross,
      pf_employee: n(form.pf_employee),
      professional_tax: n(form.professional_tax),
      tds: n(form.tds),
      other_deductions: n(form.other_deductions),
      working_days: n(form.working_days),
      days_worked: n(form.days_worked),
      lop_days: n(form.lop_days),
      lop_deduction: lopDeduction,
      net_pay: netPay,
      notes: form.notes || null,
      generated_by: currentUser.id,
      updated_at: new Date().toISOString(),
    }

    let error
    if (payslip?.id) {
      const res = await supabase.from('payslips').update(payload).eq('id', payslip.id)
      error = res.error
    } else {
      const res = await supabase.from('payslips').insert(payload)
      error = res.error
    }

    setSaving(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  const Row = ({ label, k, readOnly }: { label: string; k: keyof typeof form; readOnly?: boolean }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={k === 'notes' ? 'text' : 'number'}
        value={form[k]}
        onChange={e => f(k, e.target.value)}
        readOnly={readOnly}
        className={readOnly ? 'bg-gray-50 text-gray-500' : ''}
        min="0"
        step="0.01"
      />
    </div>
  )

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{payslip ? 'Edit Payslip' : 'Generate Payslip'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Employee & Period */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-3 sm:col-span-1">
              <Label className="text-xs">Employee</Label>
              <Select value={form.employee_id} onValueChange={v => f('employee_id', v)} disabled={!!payslip}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <Select value={form.month} onValueChange={v => f('month', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Select value={form.year} onValueChange={v => f('year', v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Earnings */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Earnings</p>
            <div className="grid grid-cols-3 gap-3">
              <Row label="Basic Salary (₹)" k="basic_salary" />
              <Row label="HRA (₹)" k="hra" />
              <Row label="Allowances (₹)" k="allowances" />
            </div>
            <div className="mt-2 bg-[#82BC0D]/10 rounded-md px-3 py-2 flex justify-between text-sm">
              <span className="text-gray-600">Gross Pay</span>
              <span className="font-bold text-[#82BC0D]">₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deductions</p>
            <div className="grid grid-cols-3 gap-3">
              <Row label="PF Employee (₹)" k="pf_employee" />
              <Row label="Professional Tax (₹)" k="professional_tax" />
              <Row label="TDS (₹)" k="tds" />
              <Row label="Other Deductions (₹)" k="other_deductions" />
            </div>
          </div>

          {/* Attendance */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attendance</p>
            <div className="grid grid-cols-3 gap-3">
              <Row label="Working Days" k="working_days" />
              <Row label="Days Worked" k="days_worked" />
              <Row label="LOP Days" k="lop_days" />
            </div>
            {n(form.lop_days) > 0 && (
              <p className="text-xs text-red-500 mt-1">LOP deduction: ₹{lopDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            )}
          </div>

          {/* Net Pay */}
          <div className="bg-[#1A1A2E] rounded-lg px-4 py-3 flex justify-between items-center">
            <div>
              <p className="text-white/60 text-xs">Net Pay (Take Home)</p>
              <p className="text-white text-2xl font-bold">₹{netPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right text-xs text-white/50">
              <p>Gross: ₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              <p>Deductions: ₹{totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Input value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Any remarks for this payslip..." />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {payslip ? 'Save Changes' : 'Generate Payslip'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
