'use client'
import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

type Tab = 'login' | 'signup'

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inviteCheck, setInviteCheck] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')

  const errorMsg = params.get('error') === 'not_invited' ? 'Your Google account has not been invited.' : ''

  async function checkInvite(em: string) {
    if (!em || tab !== 'signup') return
    setInviteCheck('checking')
    const res = await fetch(`/api/invitations/check?email=${encodeURIComponent(em)}`)
    const data = await res.json()
    setInviteCheck(data.valid ? 'valid' : 'invalid')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) { setError('Invalid email or password'); setLoading(false); return }
    router.push('/')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Signup failed'); setLoading(false); return }
    await signIn('credentials', { email, password, redirect: false })
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-surface-muted flex">
      {/* Left panel — navy brand */}
      <div className="hidden lg:flex flex-col justify-between w-5/12 bg-brand-navy p-12">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2 mb-14">
            <div className="grid grid-cols-2 gap-0.5 w-5 h-5 flex-shrink-0">
              <div className="rounded-sm bg-white" />
              <div className="rounded-sm bg-white/40" />
              <div className="rounded-sm bg-white/40" />
              <div className="rounded-sm bg-brand-accent" />
            </div>
            <span className="text-xl font-semibold text-white tracking-tight">grain</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
            Conference<br />Intelligence
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Find the right conferences, plan smart trips,
            and turn every handshake into pipeline.
          </p>
        </div>
        <div className="space-y-3">
          {['ICP-scored conference database', 'Field lead capture with card scan', 'Cross-conference relationship tracking'].map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-accent flex-shrink-0" />
              <span className="text-white/60 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
              <div className="rounded-sm bg-brand-navy" />
              <div className="rounded-sm bg-brand-navy/40" />
              <div className="rounded-sm bg-brand-navy/40" />
              <div className="rounded-sm bg-brand-accent" />
            </div>
            <span className="text-xl font-semibold text-brand-navy tracking-tight">grain</span>
          </div>

          <h2 className="text-xl font-semibold text-content-primary mb-1">
            {tab === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-sm text-content-muted mb-6">
            {tab === 'login' ? 'Sign in to your account' : 'You need an invitation to sign up'}
          </p>

          {/* Tabs */}
          <div className="flex bg-surface-muted rounded-lg p-1 mb-6 border border-surface-border">
            {(['login', 'signup'] as Tab[]).map((t) => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors capitalize ${tab === t ? 'bg-white text-brand-navy shadow-sm' : 'text-content-muted hover:text-content-primary'}`}>
                {t === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {(error || errorMsg) && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error || errorMsg}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input className="input" type="text" placeholder="you@company.com or admin" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? 'Signing in…' : 'Log In'}
              </button>
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-surface-border" /></div>
                <div className="relative flex justify-center"><span className="bg-surface-muted px-3 text-content-muted text-xs">or</span></div>
              </div>
              <button type="button" onClick={() => signIn('google', { callbackUrl: '/' })}
                className="btn-secondary w-full flex items-center justify-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.09 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="you@company.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={e => checkInvite(e.target.value)} required />
                {inviteCheck === 'checking' && <p className="text-xs text-content-muted mt-1">Checking invitation…</p>}
                {inviteCheck === 'invalid' && <p className="text-xs text-red-500 mt-1">No invitation found for this email.</p>}
                {inviteCheck === 'valid' && <p className="text-xs text-status-ready mt-1">Invitation found ✓</p>}
              </div>
              <div>
                <label className="label">Full name</label>
                <input className="input" type="text" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input className="input" type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading || inviteCheck === 'invalid'} className="btn-primary w-full justify-center">
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
