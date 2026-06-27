export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ReportDetail } from '@/components/reports/ReportDetail'
import type { User } from '@/types'

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  if (!profile) redirect('/login')
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const { data: report } = await supabase
    .from('reports')
    .select('*, client:clients(id, name), approver:users(id, name)')
    .eq('id', id)
    .single()

  if (!report) notFound()

  return (
    <div className="flex flex-col flex-1">
      <Topbar user={profile as User} title={`Report: ${report.client?.name}`} />
      <main className="flex-1 p-6">
        <ReportDetail report={report} currentUser={profile as User} />
      </main>
    </div>
  )
}
