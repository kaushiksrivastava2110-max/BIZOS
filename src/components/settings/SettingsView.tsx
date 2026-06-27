'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Pencil, Trash2, Plus, UserPlus, Save } from 'lucide-react'
import type { User, UserRole } from '@/types'

interface Props { currentUser: User }

const ROLE_BADGE: Record<UserRole, 'green' | 'blue' | 'yellow' | 'default'> = {
  admin: 'green',
  manager: 'blue',
  recruiter: 'yellow',
  viewer: 'default',
}

export function SettingsView({ currentUser }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [settings, setSettings] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null)
  const supabase = createClient()

  async function loadUsers() {
    const { data } = await supabase.from('users').select('*').order('name')
    setUsers(data as User[] ?? [])
    setLoadingUsers(false)
  }

  async function loadSettings() {
    const { data } = await supabase.from('app_settings').select('*').order('key')
    setSettings(data ?? [])
  }

  useEffect(() => {
    loadUsers()
    loadSettings()
  }, [])

  async function handleDeleteUser(user: User) {
    // Delete from auth (via admin API route) and from users table
    const res = await fetch('/api/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    if (res.ok) {
      setConfirmDeleteUser(null)
      loadUsers()
    }
  }

  async function handleSaveSettings() {
    for (const setting of settings) {
      await supabase.from('app_settings').update({ value: setting.value }).eq('key', setting.key)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="thresholds">Alert Thresholds</TabsTrigger>
        </TabsList>

        {/* Users tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setShowCreateUser(true)}>
              <UserPlus className="h-4 w-4" /> Invite User
            </Button>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">User</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Reports To</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => {
                    const teamLead = u.team_lead_id ? users.find(x => x.id === u.team_lead_id) : null
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#82BC0D] flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#1A1A2E]">{u.name}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={ROLE_BADGE[u.role]}>
                            {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-600">
                          {teamLead?.name ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {u.id !== currentUser.id && (
                              <>
                                <Button variant="ghost" size="icon-sm" onClick={() => setEditUser(u)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDeleteUser(u)}
                                  className="text-red-400 hover:text-red-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        {/* Thresholds tab */}
        <TabsContent value="thresholds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Alert & Threshold Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.map((setting, i) => (
                <div key={setting.key} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-sm">{setting.description ?? setting.key.replace(/_/g, ' ')}</Label>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{setting.key.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      min="1"
                      value={setting.value}
                      onChange={e => {
                        const updated = [...settings]
                        updated[i] = { ...setting, value: e.target.value }
                        setSettings(updated)
                      }}
                      className="text-center font-bold"
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-8">days</span>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button variant="primary" size="sm" onClick={handleSaveSettings}>
                  <Save className="h-3.5 w-3.5" /> Save Thresholds
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit user dialog */}
      {editUser && (
        <UserEditDialog
          user={editUser}
          users={users}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); loadUsers() }}
        />
      )}

      {/* Create user dialog */}
      {showCreateUser && (
        <UserCreateDialog
          onClose={() => setShowCreateUser(false)}
          onSaved={() => { setShowCreateUser(false); loadUsers() }}
        />
      )}

      {/* Delete confirm */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full p-6">
            <h3 className="font-semibold text-[#1A1A2E] mb-2">Delete User?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently remove <strong>{confirmDeleteUser.name}</strong> from the platform.
              Their data (clients, submissions) will be retained but unassigned.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteUser(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(confirmDeleteUser)}>Delete User</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function UserEditDialog({ user, users, onClose, onSaved }: { user: User; users: User[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: user.name, role: user.role as string, team_lead_id: user.team_lead_id ?? '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleSave() {
    setSaving(true)
    await supabase.from('users').update({
      name: form.name,
      role: form.role as UserRole,
      team_lead_id: form.team_lead_id || null,
    }).eq('id', user.id)
    setSaving(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['admin','manager','recruiter','viewer'].map(r => (
                  <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reports To (Team Lead)</Label>
            <Select value={form.team_lead_id} onValueChange={v => setForm(f => ({ ...f, team_lead_id: v }))}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {users.filter(u => u.id !== user.id && ['admin','manager'].includes(u.role)).map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UserCreateDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'recruiter', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to create user'); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@bizquad.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Temporary Password</Label>
            <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['admin','manager','recruiter','viewer'].map(r => (
                  <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
