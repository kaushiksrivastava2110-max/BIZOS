'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors, DragOverlay, closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OpeningForm } from './OpeningForm'
import { AddCandidateToOpeningForm } from './AddCandidateToOpeningForm'
import { SubmissionRecordForm } from '@/components/candidates/SubmissionRecordForm'
import { InterviewForm } from '@/components/candidates/InterviewForm'
import { OfferForm } from '@/components/candidates/OfferForm'
import { Pencil, Plus, User as UserIcon, Clock, AlertTriangle } from 'lucide-react'
import { SUBMISSION_STAGES, STAGE_COLORS, daysSince } from '@/lib/utils'
import type { User, SubmissionStage } from '@/types'

interface KanbanCard {
  id: string
  candidateId: string
  candidateName: string
  employer: string
  scorecardTotal: number
  stage: SubmissionStage
  stageEnteredAt: string
  daysInStage: number
  recruiterId: string
}

function SortableCard({ card, agingThreshold }: { card: KanbanCard; agingThreshold: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const isAging = card.daysInStage >= agingThreshold

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card bg-white rounded-lg border p-3 cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'opacity-50 shadow-lg rotate-1' : ''
      } ${isAging ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/candidates/${card.candidateId}`}
          className="text-sm font-medium text-[#1A1A2E] hover:text-[#0EA2E8] transition-colors leading-tight"
          onClick={e => e.stopPropagation()}
        >
          {card.candidateName}
        </Link>
        <div className={`flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded text-xs font-bold ${
          card.scorecardTotal >= 70 ? 'bg-[#82BC0D]/10 text-[#5a8409]' :
          card.scorecardTotal >= 50 ? 'bg-[#F9B710]/10 text-[#b8890a]' :
          'bg-gray-100 text-gray-500'
        }`}>
          {card.scorecardTotal}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-1 truncate">{card.employer}</p>
      <div className={`flex items-center gap-1 mt-2 text-xs ${isAging ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
        {isAging && <AlertTriangle className="h-3 w-3" />}
        <Clock className="h-3 w-3" />
        {card.daysInStage}d in stage
      </div>
    </div>
  )
}

interface Props {
  opening: any
  currentUser: User
}

export function OpeningKanban({ opening, currentUser }: Props) {
  const [submissions, setSubmissions] = useState<KanbanCard[]>([])
  const [agingThreshold, setAgingThreshold] = useState(5)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pendingStageForm, setPendingStageForm] = useState<{
    type: 'submission' | 'interview' | 'offer'
    submissionId: string
    candidateName: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function loadSubmissions() {
    const [{ data: subs }, { data: settings }] = await Promise.all([
      supabase
        .from('submissions')
        .select('id, stage, stage_entered_at, recruiter_id, candidate:candidates(id, name, current_employer, scorecard_total)')
        .eq('opening_id', opening.id)
        .order('stage_entered_at', { ascending: false }),
      supabase.from('app_settings').select('value').eq('key', 'candidate_aging_days').single(),
    ])

    if (settings?.value) setAgingThreshold(parseInt(settings.value))

    setSubmissions(
      (subs ?? []).map((s: any) => ({
        id: s.id,
        candidateId: s.candidate?.id ?? '',
        candidateName: s.candidate?.name ?? 'Unknown',
        employer: s.candidate?.current_employer ?? '',
        scorecardTotal: s.candidate?.scorecard_total ?? 0,
        stage: s.stage as SubmissionStage,
        stageEnteredAt: s.stage_entered_at,
        daysInStage: daysSince(s.stage_entered_at),
        recruiterId: s.recruiter_id,
      }))
    )
    setLoading(false)
  }

  useEffect(() => { loadSubmissions() }, [opening.id])

  async function moveCard(submissionId: string, newStage: SubmissionStage) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const sub = submissions.find(s => s.id === submissionId)
    if (!sub || sub.stage === newStage) return

    // Business rule: Joined only from Offer
    if (newStage === 'Joined' && sub.stage !== 'Offer') {
      alert('Candidate must be in Offer stage before marking as Joined.')
      return
    }

    // Optimistic update
    setSubmissions(prev => prev.map(s =>
      s.id === submissionId
        ? { ...s, stage: newStage, stageEnteredAt: new Date().toISOString(), daysInStage: 0 }
        : s
    ))

    await supabase
      .from('submissions')
      .update({ stage: newStage, stage_entered_at: new Date().toISOString() })
      .eq('id', submissionId)

    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      entity_type: 'submission',
      entity_id: submissionId,
      action: 'stage_changed',
      notes: `Moved ${sub.candidateName} from "${sub.stage}" to "${newStage}" in ${opening.title}`,
    })

    // Trigger context-aware forms on key stage moves
    if (newStage === 'Submitted') {
      setPendingStageForm({ type: 'submission', submissionId, candidateName: sub.candidateName })
    } else if (newStage === 'Interview L1' || newStage === 'Interview L2') {
      setPendingStageForm({ type: 'interview', submissionId, candidateName: sub.candidateName })
    } else if (newStage === 'Offer') {
      setPendingStageForm({ type: 'offer', submissionId, candidateName: sub.candidateName })
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const overId = over.id as string
    // If dropped over a column container (stage name)
    if (SUBMISSION_STAGES.includes(overId as SubmissionStage)) {
      moveCard(active.id as string, overId as SubmissionStage)
    }
  }

  const activeCard = activeId ? submissions.find(s => s.id === activeId) : null

  const canEdit = currentUser.role !== 'viewer'

  const columnStages = SUBMISSION_STAGES.filter(s => s !== 'Dropped')
  const droppedCards = submissions.filter(s => s.stage === 'Dropped')

  return (
    <div className="space-y-4">
      {/* Opening header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="blue">{opening.practice_area}</Badge>
            <Badge variant={opening.status === 'Open' ? 'green' : opening.status === 'On Hold' ? 'yellow' : 'default'}>
              {opening.status}
            </Badge>
            <Badge variant="default">{opening.engagement_type}</Badge>
            {opening.ctc_band && <Badge variant="default">{opening.ctc_band}</Badge>}
            {opening.seniority && <span className="text-sm text-gray-500">{opening.seniority}</span>}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Client: <Link href={`/clients/${opening.client?.id}`} className="text-[#0EA2E8] hover:underline">{opening.client?.name}</Link>
            {' · '}Recruiter: {opening.assigned_recruiter?.name}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowAddCandidate(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Candidate
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>{submissions.filter(s => !['Joined','Dropped'].includes(s.stage)).length} active</span>
        <span>·</span>
        <span className="text-[#82BC0D]">{submissions.filter(s => s.stage === 'Joined').length} joined</span>
        <span>·</span>
        <span className="text-red-500">{submissions.filter(s => s.stage === 'Dropped').length} dropped</span>
        <span>·</span>
        <span className="text-[#F9B710]">{submissions.filter(s => s.daysInStage >= agingThreshold && !['Joined','Dropped'].includes(s.stage)).length} aging</span>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-52 h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {columnStages.map(stage => {
              const stageCards = submissions.filter(s => s.stage === stage)
              const color = STAGE_COLORS[stage]

              return (
                <div
                  key={stage}
                  id={stage}
                  className="flex-shrink-0 w-52 flex flex-col rounded-xl bg-gray-50 border border-gray-200"
                  onDragOver={e => { e.preventDefault() }}
                  onDrop={e => {
                    e.preventDefault()
                    const cardId = e.dataTransfer?.getData('text/plain')
                    if (cardId) moveCard(cardId, stage as SubmissionStage)
                  }}
                >
                  {/* Column header */}
                  <div className="px-3 py-2.5 flex items-center justify-between border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-semibold text-gray-700">{stage}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{stageCards.length}</span>
                  </div>

                  {/* Drop zone */}
                  <SortableContext items={stageCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div
                      className="flex-1 p-2 space-y-2 min-h-[120px]"
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault()
                        if (activeId) moveCard(activeId, stage as SubmissionStage)
                      }}
                    >
                      {stageCards.map(card => (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={e => {
                            setActiveId(card.id)
                            e.dataTransfer.setData('text/plain', card.id)
                          }}
                          onDragEnd={() => setActiveId(null)}
                        >
                          <SortableCard card={card} agingThreshold={agingThreshold} />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </div>
              )
            })}

            {/* Dropped column */}
            {droppedCards.length > 0 && (
              <div className="flex-shrink-0 w-52 flex flex-col rounded-xl bg-red-50/50 border border-red-100">
                <div className="px-3 py-2.5 flex items-center justify-between border-b border-red-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs font-semibold text-red-700">Dropped</span>
                  </div>
                  <span className="text-xs text-red-400 font-medium">{droppedCards.length}</span>
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {droppedCards.map(card => (
                    <div key={card.id} className="bg-white rounded-lg border border-red-100 p-3 opacity-60">
                      <p className="text-sm font-medium text-gray-500">{card.candidateName}</p>
                      <p className="text-xs text-gray-400">{card.employer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="bg-white rounded-lg border-2 border-[#0EA2E8] p-3 shadow-xl rotate-2 w-52">
                <p className="text-sm font-medium text-[#1A1A2E]">{activeCard.candidateName}</p>
                <p className="text-xs text-gray-500">{activeCard.employer}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {showEditForm && (
        <OpeningForm
          currentUser={currentUser}
          opening={opening}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); router.refresh() }}
        />
      )}

      {showAddCandidate && (
        <AddCandidateToOpeningForm
          opening={opening}
          currentUser={currentUser}
          onClose={() => setShowAddCandidate(false)}
          onSaved={() => { setShowAddCandidate(false); loadSubmissions() }}
        />
      )}

      {pendingStageForm?.type === 'submission' && (
        <SubmissionRecordForm
          submissionId={pendingStageForm.submissionId}
          candidateName={pendingStageForm.candidateName}
          onClose={() => setPendingStageForm(null)}
          onSaved={() => setPendingStageForm(null)}
        />
      )}

      {pendingStageForm?.type === 'interview' && (
        <InterviewForm
          submissionId={pendingStageForm.submissionId}
          candidateName={pendingStageForm.candidateName}
          onClose={() => setPendingStageForm(null)}
          onSaved={() => setPendingStageForm(null)}
        />
      )}

      {pendingStageForm?.type === 'offer' && (
        <OfferForm
          submissionId={pendingStageForm.submissionId}
          candidateName={pendingStageForm.candidateName}
          onClose={() => setPendingStageForm(null)}
          onSaved={() => setPendingStageForm(null)}
        />
      )}
    </div>
  )
}
