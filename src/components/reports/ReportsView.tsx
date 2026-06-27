'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GenerateReportModal } from './GenerateReportModal'
import { Plus, FileText, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

export function ReportsView({ currentUser }: Props) {
  const [reports, setReports] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [filterClient, setFilterClient] = useState('all')
  const [loading, setLoading] = useState(true)
  const [showGenerate, setShowGenerate] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const clientId = searchParams.get('client')
    if (clientId) setFilterClient(clientId)
    if (searchParams.get('new') === '1') setShowGenerate(true)
  }, [searchParams])

  async function load() {
    let q = supabase
      .from('reports')
      .select('*, client:clients(id, name), approver:users(id, name)')
      .order('generated_at', { ascending: false })

    if (filterClient !== 'all') q = q.eq('client_id', filterClient)

    const [{ data: reps }, { data: cls }] = await Promise.all([
      q,
      supabase.from('clients').select('id, name').order('name'),
    ])
    setReports(reps ?? [])
    setClients(cls ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterClient])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-8 w-48"><SelectValue placeholder="All Clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="primary" size="sm" className="ml-auto" onClick={() => setShowGenerate(true)}>
          <Plus className="h-4 w-4" /> Generate Report
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : reports.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No reports yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Client</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Period</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Generated</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Approved By</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50 group">
                  <td className="px-5 py-3.5 text-sm font-medium text-[#1A1A2E]">{r.client?.name}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    {formatDate(r.period_start)} – {formatDate(r.period_end)}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={r.status === 'Sent' ? 'green' : r.status === 'Approved' ? 'blue' : 'default'}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{formatDate(r.generated_at)}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">{r.approver?.name ?? '—'}</td>
                  <td className="px-4 py-3.5">
                    <Link href={`/reports/${r.id}`}>
                      <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-[#0EA2E8]" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showGenerate && (
        <GenerateReportModal
          clients={clients}
          currentUser={currentUser}
          onClose={() => setShowGenerate(false)}
          onSaved={() => { setShowGenerate(false); load() }}
        />
      )}
    </div>
  )
}
