'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ClientForm } from './ClientForm'
import { Plus, Search, Building2, ExternalLink, Briefcase, Calendar } from 'lucide-react'
import { HEALTH_COLORS, formatDate, timeAgo } from '@/lib/utils'
import type { User } from '@/types'

const HEALTH_LABELS = { green: 'Healthy', amber: 'Monitor', red: 'At Risk' }

interface Props { currentUser: User }

export function ClientsView({ currentUser }: Props) {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function loadClients() {
    let query = supabase
      .from('clients')
      .select('*, account_owner:users(id, name), openings(id, status)')
      .order('created_at', { ascending: false })

    const { data } = await query
    setClients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadClients() }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase())
  )

  const openMandatesFor = (c: any) =>
    (c.openings ?? []).filter((o: any) => o.status === 'Open').length

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Search clients..."
            className="pl-9 h-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            New Client
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>{filtered.length} client{filtered.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span className="text-[#82BC0D]">{clients.filter(c => c.health_status === 'green').length} healthy</span>
        <span>·</span>
        <span className="text-[#F9B710]">{clients.filter(c => c.health_status === 'amber').length} monitor</span>
        <span>·</span>
        <span className="text-red-500">{clients.filter(c => c.health_status === 'red').length} at risk</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No clients found{search ? ' matching your search' : ''}.</p>
          {!search && currentUser.role !== 'viewer' && (
            <Button variant="primary" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Add First Client
            </Button>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Client</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Health</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Open Mandates</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Owner</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(client => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div>
                      <Link href={`/clients/${client.id}`} className="font-medium text-sm text-[#1A1A2E] hover:text-[#0EA2E8] transition-colors">
                        {client.name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">{client.industry} · {client.source_vendor}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: HEALTH_COLORS[client.health_status as keyof typeof HEALTH_COLORS] }} />
                      <span className="text-xs text-gray-600">{HEALTH_LABELS[client.health_status as keyof typeof HEALTH_LABELS]}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm text-gray-700">{openMandatesFor(client)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-gray-600">{client.account_owner?.name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-gray-400">{formatDate(client.created_at)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/clients/${client.id}`}>
                      <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-[#0EA2E8] transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showForm && (
        <ClientForm
          currentUser={currentUser}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadClients() }}
        />
      )}
    </div>
  )
}
