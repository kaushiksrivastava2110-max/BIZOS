'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft } from 'lucide-react'

const Logo = () => (
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
)

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setLoading(false)
    if (error) { setError(error.message); return }
    setResetSent(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Logo />

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <>
              <h1 className="text-lg font-semibold text-[#1A1A2E] mb-1">Sign in</h1>
              <p className="text-sm text-gray-500 mb-5">Enter your credentials to access BIZOS</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@bizquad.com" value={email}
                    onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={() => { setMode('forgot'); setError(null) }}
                      className="text-xs text-[#0EA2E8] hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <Input id="password" type="password" placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                </div>
                {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
                <Button type="submit" variant="default" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : 'Sign in'}
                </Button>
              </form>
            </>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {mode === 'forgot' && !resetSent && (
            <>
              <button onClick={() => { setMode('login'); setError(null) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-4">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </button>
              <h1 className="text-lg font-semibold text-[#1A1A2E] mb-1">Reset password</h1>
              <p className="text-sm text-gray-500 mb-5">
                Enter your email and we'll send you a link to set a new password.
              </p>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" type="email" placeholder="you@bizquad.com" value={email}
                    onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
                <Button type="submit" variant="default" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : 'Send Reset Link'}
                </Button>
              </form>
            </>
          )}

          {/* ── RESET EMAIL SENT ── */}
          {mode === 'forgot' && resetSent && (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#82BC0D]/10 flex items-center justify-center mx-auto">
                <span className="text-2xl">✉️</span>
              </div>
              <h2 className="font-semibold text-[#1A1A2E]">Check your email</h2>
              <p className="text-sm text-gray-500">
                A password reset link has been sent to <strong>{email}</strong>. Check your inbox and click the link to set a new password.
              </p>
              <button onClick={() => { setMode('login'); setResetSent(false); setError(null) }}
                className="text-sm text-[#0EA2E8] hover:underline mt-2 block mx-auto">
                Back to sign in
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          For access, contact your administrator.
        </p>
      </div>
    </div>
  )
}
