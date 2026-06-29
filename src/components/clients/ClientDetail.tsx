'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClientForm } from './ClientForm'
import { Pencil, Trash2, Briefcase, ExternalLink, Clock, FileText, Upload, Download, X } from 'lucide-react'
import { HEALTH_COLORS, formatDate, timeAgo } from '@/lib/utils'
import type { User, Client } from '@/types'

const HEALTH_LABELS = { green: 'Healthy', amber: 'Monitor', red: 'At Risk' }

interface Props {
  client: Client & { account_owner?: User }
  currentUser: User
}

export function ClientDetail({ client, currentUser }: Props) {
  const [openings, setOpenings] = useState<any[]>([])
  const [activity, setActivity] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [showEditForm, setShowEditForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [docs, setDocs] = useState<{ msa_url?: string | null; msa_filename?: string | null; nda_url?: string | null; nda_filename?: string | null }>({
    msa_url: (client as any).msa_url,
    msa_filename: (client as any).msa_filename,
    nda_url: (client as any).nda_url,
    nda_filename: (client as any).nda_filename,
  })
  const [uploading, setUploading] = useState<'msa' | 'nda' | null>(null)
  const msaRef = useRef<HTMLInputElement>(null)
  const ndaRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const [{ data: openingsData }, { data: activityData }, { data: reportsData }] = await Promise.all([
        supabase.from('openings').select('*, assigned_recruiter:users(name)').eq('client_id', client.id).order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*, actor:users(name)').eq('entity_id', client.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('reports').select('*').eq('client_id', client.id).order('generated_at', { ascending: false }),
      ])
      setOpenings(openingsData ?? [])
      setActivity(activityData ?? [])
      setReports(reportsData ?? [])
    }
    load()
  }, [client.id])

  async function handleDelete() {
    const { error } = await supabase.from('clients').delete().eq('id', client.id)
    if (!error) router.push('/clients')
  }

  async function handleDocUpload(type: 'msa' | 'nda', file: File) {
    setUploading(type)
    try {
      const ext = file.name.split('.').pop()
      const path = `${client.id}/${type}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('client-docs')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('client-docs').getPublicUrl(path)

      const update = type === 'msa'
        ? { msa_url: publicUrl, msa_filename: file.name }
        : { nda_url: publicUrl, nda_filename: file.name }

      const { error: dbError } = await supabase.from('clients').update(update).eq('id', client.id)
      if (dbError) throw dbError

      setDocs(prev => ({ ...prev, ...update }))
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(null)
    }
  }

  async function handleDocRemove(type: 'msa' | 'nda') {
    const update = type === 'msa'
      ? { msa_url: null, msa_filename: null }
      : { nda_url: null, nda_filename: null }
    await supabase.from('clients').update(update).eq('id', client.id)
    setDocs(prev => ({ ...prev, ...update }))
  }

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'manager' || client.account_owner_id === currentUser.id
  const canDelete = currentUser.role === 'admin' || currentUser.role === 'manager'
  const canSeeCommercial = currentUser.role === 'admin' || currentUser.role === 'manager'

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#1A1A2E] flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-bold">{client.name[0]}</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#1A1A2E]">{client.name}</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: HEALTH_COLORS[client.health_status] }} />
                <span className="text-sm text-gray-600">{HEALTH_LABELS[client.health_status]}</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {client.industry} · {client.source_vendor} · Owner: {client.account_owner?.name ?? '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Added {formatDate(client.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Intake score chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="default">Score: {client.intake_score}/20</Badge>
        <Badge variant="default">{openings.filter(o => o.status === 'Open').length} Open Mandates</Badge>
        {canSeeCommercial && (
          <>
            <Badge variant="blue">{client.fee_percentage}% fee</Badge>
            <Badge variant="default">{client.payment_terms}</Badge>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="openings">
        <TabsList>
          <TabsTrigger value="openings">Openings ({openings.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          {canSeeCommercial && <TabsTrigger value="commercial">Commercial</TabsTrigger>}
          {canSeeCommercial && <TabsTrigger value="documents">Documents</TabsTrigger>}
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Openings tab */}
        <TabsContent value="openings" className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">{openings.length} total openings</span>
            {canEdit && (
              <Link href={`/openings?new=1&client=${client.id}`}>
                <Button variant="primary" size="sm">+ New Opening</Button>
              </Link>
            )}
          </div>
          {openings.length === 0 ? (
            <Card className="p-8 text-center">
              <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No openings yet for this client.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Title</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Practice</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Recruiter</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {openings.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 group">
                      <td className="px-5 py-3">
                        <Link href={`/openings/${o.id}`} className="text-sm font-medium text-[#1A1A2E] hover:text-[#0EA2E8]">
                          {o.title}
                        </Link>
                        <p className="text-xs text-gray-400">{o.seniority} · {o.engagement_type}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="blue" className="text-xs">{o.practice_area}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={o.status === 'Open' ? 'green' : o.status === 'On Hold' ? 'yellow' : 'default'}>
                          {o.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{o.assigned_recruiter?.name ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/openings/${o.id}`}>
                          <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-[#0EA2E8]" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        {/* Activity tab */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="p-5">
              {activity.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No activity recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {activity.map((log: any) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#1A1A2E]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-[#1A1A2E]" />
                      </div>
                      <div>
                        <p className="text-sm text-[#1A1A2E]">
                          <span className="font-medium">{log.actor?.name ?? 'System'}</span> {log.action.replace(/_/g, ' ')}
                        </p>
                        {log.notes && <p className="text-xs text-gray-500 mt-0.5">{log.notes}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commercial tab */}
        {canSeeCommercial && (
          <TabsContent value="commercial">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Fee Percentage</p>
                    <p className="text-2xl font-bold text-[#1A1A2E]">{client.fee_percentage}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Payment Terms</p>
                    <p className="text-2xl font-bold text-[#1A1A2E]">{client.payment_terms}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Intake Score</p>
                    <p className="text-2xl font-bold text-[#1A1A2E]">{client.intake_score}/20</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Source</p>
                    <p className="text-lg font-semibold text-[#1A1A2E]">{client.source_vendor}</p>
                  </div>
                </div>
                {(client as any).intake_rationale && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Intake Rationale</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{(client as any).intake_rationale}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Documents tab */}
        {canSeeCommercial && (
          <TabsContent value="documents">
            <Card>
              <CardContent className="p-5 space-y-6">
                <p className="text-xs text-gray-500">Upload signed MSA and NDA documents for this client. Accepted: PDF, DOC, DOCX (max 10 MB).</p>

                {(['msa', 'nda'] as const).map(type => {
                  const label = type === 'msa' ? 'Master Service Agreement (MSA)' : 'Non-Disclosure Agreement (NDA)'
                  const url = docs[`${type}_url` as 'msa_url' | 'nda_url']
                  const filename = docs[`${type}_filename` as 'msa_filename' | 'nda_filename']
                  const ref = type === 'msa' ? msaRef : ndaRef

                  return (
                    <div key={type} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-medium text-[#1A1A2E]">{label}</span>
                        </div>
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => ref.current?.click()}
                            disabled={uploading === type}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {uploading === type ? 'Uploading…' : url ? 'Replace' : 'Upload'}
                          </Button>
                        )}
                      </div>

                      {url && filename ? (
                        <div className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2">
                          <FileText className="h-4 w-4 text-[#0EA2E8] shrink-0" />
                          <span className="text-sm text-gray-700 flex-1 truncate">{filename}</span>
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 text-gray-400 hover:text-[#0EA2E8]" />
                          </a>
                          {canEdit && (
                            <button onClick={() => handleDocRemove(type)}>
                              <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400">No document uploaded yet.</p>
                      )}

                      <input
                        ref={ref}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) handleDocUpload(type, file)
                          e.target.value = ''
                        }}
                      />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Reports tab */}
        <TabsContent value="reports">
          <div className="space-y-3">
            {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
              <div className="flex justify-end">
                <Link href={`/reports?client=${client.id}&new=1`}>
                  <Button variant="primary" size="sm">+ Generate Report</Button>
                </Link>
              </div>
            )}
            {reports.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No reports generated yet.</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Period</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Generated</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {reports.map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-sm text-[#1A1A2E]">
                          {formatDate(r.period_start)} – {formatDate(r.period_end)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={r.status === 'Sent' ? 'green' : r.status === 'Approved' ? 'blue' : 'default'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(r.generated_at)}</td>
                        <td className="px-4 py-3">
                          <Link href={`/reports/${r.id}`}>
                            <ExternalLink className="h-4 w-4 text-gray-300 hover:text-[#0EA2E8]" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full p-6">
            <h3 className="font-semibold text-[#1A1A2E] mb-2">Delete Client?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete <strong>{client.name}</strong> and all associated openings and data. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>Delete Permanently</Button>
            </div>
          </Card>
        </div>
      )}

      {showEditForm && (
        <ClientForm
          currentUser={currentUser}
          client={client}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); router.refresh() }}
        />
      )}
    </div>
  )
}
