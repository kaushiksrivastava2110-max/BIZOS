export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { OpeningsView } from '@/components/openings/OpeningsView'
import type { User } from '@/types'

export default async function OpeningsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!profile) redirect('/login')

  return (
    <div className="flex flex-col flex-1">
      <Topbar user={profile as User} title="Openings" />
      <main className="flex-1 p-6">
        <OpeningsView currentUser={profile as User} />
      </main>
    </div>
  )
}
