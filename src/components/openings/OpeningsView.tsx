'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { OpeningForm } from './OpeningForm'
import { Plus, Search, Briefcase, ExternalLink } from 'lucide-react'
import { formatDate, PRACTICE_AREAS } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

export function OpeningsView({ currentUser }: Props) {
  const [openings, setOpenings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPractice, setFilterPractice] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true)
  }, [searchParams])

  async function loadOpenings() {
    let query = supabase
      .from('openings')
      .select('*, client:clients(id, name, health_status), assigned_recruiter:users(id, name), submissions(id, stage)')
      .order('created_at', { ascending: false })

    if (currentUser.role === 'recruiter') {
      query = query.eq('assigned_recruiter_id', currentUser.id)
    }

    const { data } = await query
    setOpenings(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadOpenings() }, [])

  const filtered = openings.filter(o => {
    const matchesSearch = o.title.toLowerCase().includes(search.toLowerCase()) ||
      o.client?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus
    const matchesPractice = filterPractice === 'all' || o.practice_area === filterPractice
    return matchesSearch && matchesStatus && matchesPractice
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Search openings..." className="pl-9 h-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Open">Open</SelectItem>
            <SelectItem value="On Hold">On Hold</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPractice} onValueChange={setFilterPractice}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Practices</SelectItem>
            {PRACTICE_AREAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          {currentUser.role !== 'viewer' && (
            <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> New Opening
            </Button>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-500">
        {filtered.length} opening{filtered.length !== 1 ? 's' : ''} ·{' '}
        <span className="text-[#82BC0D]">{openings.filter(o => o.status === 'Open').length} open</span> ·{' '}
        <span className="text-[#F9B710]">{openings.filter(o => o.status === 'On Hold').length} on hold</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No openings found.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Opening</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Practice</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Recruiter</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Pipeline</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(o => {
                const activeSubmissions = (o.submissions ?? []).filter((s: any) => !['Joined', 'Dropped'].includes(s.stage)).length
                return (
                  <tr key={o.id} className="hover:bg-gray-50 group">
                    <td className="px-5 py-3.5">
                      <Link href={`/openings/${o.id}`} className="font-medium text-sm text-[#1A1A2E] hover:text-[#0EA2E8]">
                        {o.title}
                      </Link>
                      <p className="text-xs text-gray-400">{o.client?.name} · {o.seniority} · {o.engagement_type}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="blue">{o.practice_area}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={o.status === 'Open' ? 'green' : o.status === 'On Hold' ? 'yellow' : 'default'}>
                        {o.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">{o.assigned_recruiter?.name ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-medium text-[#1A1A2E]">{activeSubmissions}</span>
                      <span className="text-xs text-gray-400"> active</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-400">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <Link href={`/openings/${o.id}`}>
                        <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-[#0EA2E8]" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {showForm && (
        <OpeningForm
          currentUser={currentUser}
          defaultClientId={searchParams.get('client') ?? undefined}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadOpenings() }}
        />
      )}
    </div>
  )
}
