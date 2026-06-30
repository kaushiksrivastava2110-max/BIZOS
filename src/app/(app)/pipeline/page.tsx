import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PipelineCommandView } from '@/components/pipeline/PipelineCommandView'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) redirect('/dashboard')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">Pipeline Command</h1>
        <p className="text-sm text-gray-500">Real-time view across all mandates — submissions, interviews, offers, SLA status.</p>
      </div>
      <PipelineCommandView currentUser={profile} />
    </div>
  )
}
