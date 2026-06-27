export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { DashboardKPIs } from '@/components/dashboard/DashboardKPIs'
import { NeedsAttention } from '@/components/dashboard/NeedsAttention'
import type { User } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!profile) redirect('/login')

  const user = profile as User
  const isRecruiter = user.role === 'recruiter'

  return (
    <div className="flex flex-col flex-1">
      <Topbar user={user} title={isRecruiter ? 'My Dashboard' : 'Dashboard'} />
      <main className="flex-1 p-6 space-y-6">
        <DashboardKPIs userId={isRecruiter ? user.id : undefined} />
        <NeedsAttention userId={isRecruiter ? user.id : undefined} />
      </main>
    </div>
  )
}
