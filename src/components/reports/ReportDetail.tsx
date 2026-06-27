'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Send, Printer, Loader2, Edit2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { User } from '@/types'

interface Props {
  report: any
  currentUser: User
}

export function ReportDetail({ report, currentUser }: Props) {
  const [content, setContent] = useState(report.content ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSave() {
    setSaving(true)
    await supabase.from('reports').update({ content }).eq('id', report.id)
    setSaving(false)
    setEditing(false)
  }

  async function handleApprove() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    await supabase.from('reports').update({ status: 'Approved', approved_by: user.id }).eq('id', report.id)
    await supabase.from('activity_logs').insert({
      actor_id: user.id, entity_type: 'report', entity_id: report.id,
      action: 'report_approved', notes: `Report approved for ${report.client?.name}`,
    })
    setSaving(false)
    router.refresh()
  }

  async function handleMarkSent() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    await supabase.from('reports').update({ status: 'Sent', sent_at: new Date().toISOString() }).eq('id', report.id)
    await supabase.from('activity_logs').insert({
      actor_id: user.id, entity_type: 'report', entity_id: report.id,
      action: 'report_sent', notes: `Report marked as sent to ${report.client?.name}`,
    })
    setSaving(false)
    router.refresh()
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-[#1A1A2E]">{report.client?.name} — Weekly Report</h1>
            <Badge variant={report.status === 'Sent' ? 'green' : report.status === 'Approved' ? 'blue' : 'default'}>
              {report.status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            Period: {formatDate(report.period_start)} – {formatDate(report.period_end)}
            {report.approver && ` · Approved by ${report.approver.name}`}
            {report.sent_at && ` · Sent ${formatDate(report.sent_at)}`}
          </p>
        </div>
        <div className="flex gap-2 no-print shrink-0">
          {report.status === 'Draft' && !editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {editing && (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save
              </Button>
            </>
          )}
          {report.status === 'Draft' && !editing && (
            <Button variant="primary" size="sm" onClick={handleApprove} disabled={saving}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
          )}
          {report.status === 'Approved' && (
            <Button variant="primary" size="sm" onClick={handleMarkSent} disabled={saving}>
              <Send className="h-3.5 w-3.5" /> Mark as Sent
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> Print/PDF
          </Button>
        </div>
      </div>

      {/* Report content */}
      <Card>
        <CardContent className="p-6">
          {editing ? (
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full min-h-[500px] font-mono text-sm border-0 focus-visible:ring-0 resize-none p-0"
            />
          ) : (
            <div className="prose max-w-none text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {content.split('\n').map((line: string, i: number) => {
                if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-[#1A1A2E] mt-4 mb-2">{line.replace('## ', '')}</h2>
                if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-bold text-[#1A1A2E] mb-1">{line.replace('# ', '')}</h1>
                if (line.startsWith('- ')) return <div key={i} className="flex gap-2 text-sm"><span className="text-gray-400">•</span><span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} /></div>
                if (line.startsWith('---')) return <hr key={i} className="border-gray-200 my-4" />
                if (line === '') return <div key={i} className="h-2" />
                return <p key={i} className="text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
