export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { CandidateDetail } from '@/components/candidates/CandidateDetail'
import type { User } from '@/types'

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!profile) redirect('/login')

  const { data: candidate } = await supabase
    .from('candidates')
    .select('*, submissions(*, opening:openings(id, title, clients(id, name)), interviews(*))')
    .eq('id', id)
    .single()

  if (!candidate) notFound()

  return (
    <div className="flex flex-col flex-1">
      <Topbar user={profile as User} title={candidate.name} />
      <main className="flex-1 p-6">
        <CandidateDetail candidate={candidate} currentUser={profile as User} />
      </main>
    </div>
  )
}
