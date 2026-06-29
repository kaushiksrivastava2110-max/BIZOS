'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, KeyRound, LogOut, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/types'

interface TopbarProps {
  user: User
  title?: string
}

export function Topbar({ user, title }: TopbarProps) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/candidates?q=${encodeURIComponent(query.trim())}`)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 sticky top-0 z-20">
        {title && (
          <h1 className="text-base font-semibold text-[#1A1A2E] shrink-0">{title}</h1>
        )}

        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search candidates, clients, openings..."
              className="pl-9 h-8 text-xs bg-gray-50 border-gray-200"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </form>

        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-gray-400 hidden lg:block">{today}</span>

          <Badge variant={user.role === 'admin' ? 'green' : user.role === 'manager' ? 'blue' : 'default'}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </Badge>

          {/* User avatar + dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-full hover:bg-gray-100 pl-1 pr-2 py-1 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#1A1A2E] flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-[#1A1A2E] truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); setShowChangePassword(true) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <KeyRound className="h-3.5 w-3.5 text-gray-400" />
                  Change Password
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showChangePassword && (
        <ChangePasswordDialog onClose={() => setShowChangePassword(false)} />
      )}
    </>
  )
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  async function handleSave() {
    setError(null)
    if (form.newPass.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.newPass !== form.confirm) { setError('Passwords do not match.'); return }

    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password: form.newPass })
    setSaving(false)

    if (err) { setError(err.message); return }
    setSuccess(true)
    setTimeout(() => onClose(), 1500)
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Change Password</DialogTitle></DialogHeader>
        {success ? (
          <div className="py-4 text-center">
            <p className="text-sm text-[#82BC0D] font-medium">✓ Password updated successfully!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Min 8 characters"
                value={form.newPass}
                onChange={e => setForm(f => ({ ...f, newPass: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                placeholder="Repeat password"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
          </div>
        )}
        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Update Password
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
