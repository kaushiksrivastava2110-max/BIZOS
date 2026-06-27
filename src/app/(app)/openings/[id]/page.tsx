export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { OpeningKanban } from '@/components/openings/OpeningKanban'
import type { User } from '@/types'

export default async function OpeningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!profile) redirect('/login')

  const { data: opening } = await supabase
    .from('openings')
    .select('*, client:clients(id, name, health_status), assigned_recruiter:users(id, name)')
    .eq('id', id)
    .single()

  if (!opening) notFound()

  return (
    <div className="flex flex-col flex-1">
      <Topbar user={profile as User} title={opening.title} />
      <main className="flex-1 p-6">
        <OpeningKanban opening={opening} currentUser={profile as User} />
      </main>
    </div>
  )
}
