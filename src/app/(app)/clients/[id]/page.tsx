export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ClientDetail } from '@/components/clients/ClientDetail'
import type { User } from '@/types'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!profile) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('*, account_owner:users(id, name, email)')
    .eq('id', id)
    .single()

  if (!client) notFound()

  return (
    <div className="flex flex-col flex-1">
      <Topbar user={profile as User} title={client.name} />
      <main className="flex-1 p-6">
        <ClientDetail client={client} currentUser={profile as User} />
      </main>
    </div>
  )
}
