'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CandidateForm } from './CandidateForm'
import { Plus, Search, Users, ExternalLink } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { User } from '@/types'

interface Props { currentUser: User }

export function CandidatesView({ currentUser }: Props) {
  const [candidates, setCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setSearch(q)
  }, [searchParams])

  async function loadCandidates() {
    let query = supabase
      .from('candidates')
      .select('*, submissions(id, stage, opening:openings(id, title))')
      .order('created_at', { ascending: false })

    if (currentUser.role === 'recruiter') {
      // Get submissions for this recruiter's candidates
      const { data: mySubmissions } = await supabase
        .from('submissions')
        .select('candidate_id')
        .eq('recruiter_id', currentUser.id)
      const candidateIds = [...new Set((mySubmissions ?? []).map(s => s.candidate_id))]
      if (candidateIds.length > 0) {
        query = query.in('id', candidateIds)
      } else {
        query = query.eq('added_by_id', currentUser.id)
      }
    }

    const { data } = await query
    setCandidates(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadCandidates() }, [])

  const filtered = candidates.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.current_employer.toLowerCase().includes(q) || c.source.toLowerCase().includes(q)
  })

  function scoreBadgeVariant(score: number) {
    if (score >= 70) return 'green'
    if (score >= 50) return 'yellow'
    return 'default'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Search candidates..." className="pl-9 h-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {currentUser.role !== 'viewer' && (
          <Button variant="primary" size="sm" className="ml-auto" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> New Candidate
          </Button>
        )}
      </div>

      <div className="text-sm text-gray-500">{filtered.length} candidate{filtered.length !== 1 ? 's' : ''}</div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No candidates found{search ? ' matching your search' : ''}.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Candidate</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Score</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Current CTC</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Expected</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Openings</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Source</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => {
                const activeSubmissions = (c.submissions ?? []).filter((s: any) => !['Joined','Dropped'].includes(s.stage))
                return (
                  <tr key={c.id} className="hover:bg-gray-50 group">
                    <td className="px-5 py-3.5">
                      <Link href={`/candidates/${c.id}`} className="font-medium text-sm text-[#1A1A2E] hover:text-[#0EA2E8]">
                        {c.name}
                      </Link>
                      <p className="text-xs text-gray-400">{c.current_employer}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={scoreBadgeVariant(c.scorecard_total)}>
                        {c.scorecard_total}/100
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">{c.ctc_current > 0 ? formatCurrency(c.ctc_current) : '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">{c.ctc_expected > 0 ? formatCurrency(c.ctc_expected) : '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        {activeSubmissions.slice(0, 2).map((s: any) => (
                          <Link key={s.id} href={`/openings/${s.opening?.id}`} className="text-xs text-[#0EA2E8] hover:underline truncate max-w-[140px]">
                            {s.opening?.title}
                          </Link>
                        ))}
                        {activeSubmissions.length > 2 && (
                          <span className="text-xs text-gray-400">+{activeSubmissions.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{c.source || '—'}</td>
                    <td className="px-4 py-3.5">
                      <Link href={`/candidates/${c.id}`}>
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
        <CandidateForm
          currentUser={currentUser}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadCandidates() }}
        />
      )}
    </div>
  )
}
