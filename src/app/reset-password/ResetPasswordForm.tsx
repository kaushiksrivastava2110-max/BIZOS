'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, KeyRound } from 'lucide-react'

export function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Supabase puts the session tokens in the URL hash after redirect
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    // Also mark ready if session already exists (some flows)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) { setError(err.message); return }
    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-4 h-4 bg-[#82BC0D] rounded-sm" />
              <div className="w-4 h-4 bg-[#0EA2E8] rounded-sm" />
              <div className="w-4 h-4 bg-[#F9B710] rounded-sm" />
              <div className="w-4 h-4 bg-[#1A1A2E] rounded-sm" />
            </div>
            <span className="text-2xl font-bold text-[#1A1A2E] tracking-tight">BIZOS</span>
          </div>
          <p className="text-sm text-gray-500">Bizquad Consultants — Internal Platform</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#82BC0D]/10 flex items-center justify-center mx-auto">
                <KeyRound className="h-6 w-6 text-[#82BC0D]" />
              </div>
              <h2 className="font-semibold text-[#1A1A2E]">Password updated!</h2>
              <p className="text-sm text-gray-500">Redirecting you to the dashboard…</p>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-[#1A1A2E] mb-1">Set new password</h1>
              <p className="text-sm text-gray-500 mb-5">Choose a strong password for your account.</p>

              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
                )}

                <Button type="submit" variant="default" className="w-full" disabled={loading}>
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
                    : 'Set New Password'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
