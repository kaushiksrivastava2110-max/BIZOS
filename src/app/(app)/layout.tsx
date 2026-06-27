export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import type { User } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      <Sidebar user={profile as User} />
      <div className="flex-1 flex flex-col min-h-screen pl-56">
        {children}
      </div>
    </div>
  )
}
