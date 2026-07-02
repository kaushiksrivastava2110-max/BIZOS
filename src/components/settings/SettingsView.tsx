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
import { Loader2, Pencil, Trash2, UserPlus, Save, ShieldAlert } from 'lucide-react'
import type { User, UserRole } from '@/types'

interface Props { currentUser: User }

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-amber-100 text-amber-700 border-amber-200',
  admin: 'bg-green-100 text-green-700 border-green-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  recruiter: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  viewer: 'bg-gray-100 text-gray-600 border-gray-200',
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  recruiter: 'Recruiter',
  viewer: 'Viewer',
}

export function SettingsView({ currentUser }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [settings, setSettings] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null)
  const supabase = createClient()

  const isSuperAdmin = currentUser.role === 'super_admin'

  async function loadUsers() {
    setLoadingUsers(true)
    const { data } = await supabase.from('users').select('*').order('name')
    setUsers((data as User[]) ?? [])
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

  function canEdit(target: User) {
    if (target.id === currentUser.id) return false
    if (target.role === 'super_admin' && !isSuperAdmin) return false
    return true
  }

  function canDelete(target: User) {
    if (target.id === currentUser.id) return false
    if (target.role === 'super_admin') return false
    if (!isSuperAdmin && target.role === 'admin') return false
    return true
  }

  async function handleDeleteUser(user: User) {
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

  const roleOrder = ['super_admin', 'admin', 'manager', 'recruiter', 'viewer']
  const sortedUsers = [...users].sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role))

  return (
    <div className="space-y-6 max-w-4xl">
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users &amp; Roles</TabsTrigger>
          <TabsTrigger value="thresholds">Alert Thresholds</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="super">Super Admin</TabsTrigger>}
        </TabsList>

        {/* Users tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {isSuperAdmin && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                Super Admin mode — you can view and edit all users including other admins.
              </div>
            )}
            <div className="ml-auto">
              <Button variant="primary" size="sm" onClick={() => setShowCreateUser(true)}>
                <UserPlus className="h-4 w-4" /> Invite User
              </Button>
            </div>
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
                  {sortedUsers.map(u => {
                    const teamLead = u.team_lead_id ? users.find(x => x.id === u.team_lead_id) : null
                    const isMe = u.id === currentUser.id
                    return (
                      <tr key={u.id} className={`hover:bg-gray-50 group ${u.role === 'super_admin' ? 'bg-amber-50/40' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${u.role === 'super_admin' ? 'bg-amber-500' : 'bg-[#82BC0D]'}`}>
                              {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-[#1A1A2E]">{u.name}</p>
                                {isMe && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">You</span>}
                              </div>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full border ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ROLE_LABEL[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-600">
                          {teamLead?.name ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit(u) && (
                              <Button variant="ghost" size="icon-sm" onClick={() => setEditUser(u)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete(u) && (
                              <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDeleteUser(u)}
                                className="text-red-400 hover:text-red-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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
              <CardTitle className="text-sm">Alert &amp; Threshold Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No threshold settings configured.</p>
              )}
              {settings.map((setting, i) => (
                <div key={setting.key} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-sm">{setting.description ?? setting.key.replace(/_/g, ' ')}</Label>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{setting.key.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number" min="1"
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
              {settings.length > 0 && (
                <div className="flex justify-end pt-2">
                  <Button variant="primary" size="sm" onClick={handleSaveSettings}>
                    <Save className="h-3.5 w-3.5" /> Save Thresholds
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Super Admin tab */}
        {isSuperAdmin && (
          <TabsContent value="super" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" /> Super Admin Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 space-y-2">
                  <p className="font-semibold">You are logged in as Super Admin.</p>
                  <p>Super Admin is the highest privilege level in BIZOS. You can:</p>
                  <ul className="list-disc ml-4 space-y-1 text-amber-700 mt-1">
                    <li>View and edit all users, including other Admins</li>
                    <li>Promote any user to Admin or Super Admin</li>
                    <li>Demote any Admin (but not other Super Admins)</li>
                    <li>Delete any non-Super Admin user</li>
                    <li>Access all platform features and data</li>
                  </ul>
                  <p className="text-amber-600 text-xs mt-2">Super Admin accounts cannot be demoted or deleted through the UI for security.</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3">Role Distribution</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {['super_admin', 'admin', 'manager', 'recruiter', 'viewer'].map(role => {
                      const count = users.filter(u => u.role === role).length
                      return (
                        <div key={role} className="text-center p-3 rounded-lg border border-gray-200 bg-white">
                          <p className="text-2xl font-bold text-[#1A1A2E]">{count}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{ROLE_LABEL[role]}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit user dialog */}
      {editUser && (
        <UserEditDialog
          user={editUser}
          users={users}
          currentUser={currentUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); loadUsers() }}
        />
      )}

      {/* Create user dialog */}
      {showCreateUser && (
        <UserCreateDialog
          currentUser={currentUser}
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

function UserEditDialog({
  user, users, currentUser, onClose, onSaved,
}: {
  user: User; users: User[]; currentUser: User; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({ name: user.name, role: user.role as string, team_lead_id: user.team_lead_id ?? '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const isSuperAdmin = currentUser.role === 'super_admin'

  const assignableRoles = isSuperAdmin
    ? ['super_admin', 'admin', 'manager', 'recruiter', 'viewer']
    : ['admin', 'manager', 'recruiter', 'viewer']

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
        <DialogHeader><DialogTitle>Edit User — {user.name}</DialogTitle></DialogHeader>
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
                {assignableRoles.map(r => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.role === 'super_admin' && (
              <p className="text-xs text-amber-600 mt-1">⚠ Super Admin has the highest privilege. Assign with caution.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Reports To (Team Lead)</Label>
            <Select value={form.team_lead_id} onValueChange={v => setForm(f => ({ ...f, team_lead_id: v }))}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {users.filter(u => u.id !== user.id && ['super_admin', 'admin', 'manager'].includes(u.role)).map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({ROLE_LABEL[u.role]})</SelectItem>
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

function UserCreateDialog({
  currentUser, onClose, onSaved,
}: {
  currentUser: User; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '', role: 'recruiter', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isSuperAdmin = currentUser.role === 'super_admin'

  const assignableRoles = isSuperAdmin
    ? ['super_admin', 'admin', 'manager', 'recruiter', 'viewer']
    : ['admin', 'manager', 'recruiter', 'viewer']

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
                {assignableRoles.map(r => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={saving || !form.name || !form.email || !form.password}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
