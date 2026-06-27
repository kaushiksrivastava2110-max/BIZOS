'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CandidateForm } from './CandidateForm'
import { InterviewForm } from './InterviewForm'
import { Pencil, Trash2, FileText, ExternalLink, Star, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDate, timeAgo, STAGE_COLORS } from '@/lib/utils'
import type { User } from '@/types'

const SCORECARD_FIELDS = [
  { key: 'sc_skills_match', label: 'Skills Match', max: 20 },
  { key: 'sc_experience_relevance', label: 'Experience Relevance', max: 20 },
  { key: 'sc_communication', label: 'Communication', max: 20 },
  { key: 'sc_stability', label: 'Stability', max: 20 },
  { key: 'sc_compensation_fit', label: 'Compensation Fit', max: 20 },
]

interface Props {
  candidate: any
  currentUser: User
}

export function CandidateDetail({ candidate, currentUser }: Props) {
  const [showEditForm, setShowEditForm] = useState(false)
  const [showInterviewForm, setShowInterviewForm] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const canEdit = currentUser.role !== 'viewer'
  const canDelete = currentUser.role === 'admin' || currentUser.role === 'manager'

  async function handleDelete() {
    await supabase.from('candidates').delete().eq('id', candidate.id)
    router.push('/candidates')
  }

  const scoreTotal = candidate.scorecard_total ?? 0

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0EA2E8] flex items-center justify-center text-white text-lg font-bold">
              {candidate.name[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1A1A2E]">{candidate.name}</h1>
              <p className="text-sm text-gray-500">{candidate.current_employer}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
          {canDelete && <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>}
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Scorecard</p>
          <p className={`text-2xl font-bold ${scoreTotal >= 70 ? 'text-[#82BC0D]' : scoreTotal >= 50 ? 'text-[#F9B710]' : 'text-gray-500'}`}>{scoreTotal}<span className="text-sm text-gray-400">/100</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Market Fit</p>
          <p className="text-2xl font-bold text-[#0EA2E8]">{candidate.market_fit_score}<span className="text-sm text-gray-400">/100</span></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Current CTC</p>
          <p className="text-xl font-bold text-[#1A1A2E]">{candidate.ctc_current > 0 ? formatCurrency(candidate.ctc_current) : '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Expected CTC</p>
          <p className="text-xl font-bold text-[#1A1A2E]">{candidate.ctc_expected > 0 ? formatCurrency(candidate.ctc_expected) : '—'}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Scorecard breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-[#F9B710]" /> Scorecard Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {SCORECARD_FIELDS.map(field => {
              const val = candidate[field.key] ?? 0
              const pct = (val / field.max) * 100
              return (
                <div key={field.key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{field.label}</span>
                    <span className="font-medium text-[#1A1A2E]">{val}/{field.max}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: pct >= 70 ? '#82BC0D' : pct >= 50 ? '#F9B710' : '#e5e7eb'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Market fit + info */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#0EA2E8]" /> Market Fit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-[#0EA2E8] rounded-full" style={{ width: `${candidate.market_fit_score}%` }} />
              </div>
              {candidate.market_fit_notes && (
                <p className="text-xs text-gray-600 mt-2">{candidate.market_fit_notes}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Source</span>
                <span className="font-medium text-[#1A1A2E]">{candidate.source || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Added</span>
                <span className="font-medium text-[#1A1A2E]">{formatDate(candidate.created_at)}</span>
              </div>
              {candidate.resume_url && (
                <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-[#0EA2E8] hover:underline mt-2">
                  <FileText className="h-4 w-4" /> View Resume
                </a>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submissions & Interview timeline */}
      {(candidate.submissions ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Pipeline & Interviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(candidate.submissions ?? []).map((sub: any) => (
              <div key={sub.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <Link href={`/openings/${sub.opening?.id}`} className="text-sm font-medium text-[#0EA2E8] hover:underline">
                      {sub.opening?.title}
                    </Link>
                    <p className="text-xs text-gray-500">{sub.opening?.clients?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge style={{ backgroundColor: STAGE_COLORS[sub.stage] + '20', color: STAGE_COLORS[sub.stage] }}>
                      {sub.stage}
                    </Badge>
                    {canEdit && (
                      <Button variant="outline" size="icon-sm" onClick={() => setShowInterviewForm(sub.id)}>
                        <span className="text-xs">+Interview</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Interviews */}
                {(sub.interviews ?? []).length > 0 && (
                  <div className="space-y-2 border-t border-gray-50 pt-3">
                    {(sub.interviews ?? []).map((iv: any) => (
                      <div key={iv.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Round {iv.round} · {formatDate(iv.scheduled_at)}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={iv.status === 'Completed' ? 'green' : iv.status === 'Scheduled' ? 'blue' : 'red'}>
                            {iv.status}
                          </Badge>
                          {iv.feedback_score && (
                            <span className="text-gray-500 font-medium">{iv.feedback_score}/10</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full p-6">
            <h3 className="font-semibold text-[#1A1A2E] mb-2">Delete Candidate?</h3>
            <p className="text-sm text-gray-600 mb-4">This will delete <strong>{candidate.name}</strong> and all submissions. Cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
            </div>
          </Card>
        </div>
      )}

      {showEditForm && (
        <CandidateForm
          currentUser={currentUser}
          candidate={candidate}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); router.refresh() }}
        />
      )}

      {showInterviewForm && (
        <InterviewForm
          submissionId={showInterviewForm}
          onClose={() => setShowInterviewForm(null)}
          onSaved={() => { setShowInterviewForm(null); router.refresh() }}
        />
      )}
    </div>
  )
}
