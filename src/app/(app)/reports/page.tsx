export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ReportsPageClient } from '@/components/reports/ReportsPageClient'
import type { User } from '@/types'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!profile) redirect('/login')
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  return (
    <div className="flex flex-col flex-1">
      <Topbar user={profile as User} title="Reports" />
      <main className="flex-1 p-6">
        <ReportsPageClient currentUser={profile as User} />
      </main>
    </div>
  )
}
