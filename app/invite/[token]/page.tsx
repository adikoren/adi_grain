'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading')
  const [invitation, setInvitation] = useState<any>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/invitations/validate?token=${params.token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) { setInvitation(d.invitation); setName(d.invitation.name || ''); setStatus('valid') }
        else setStatus('invalid')
      })
      .catch(() => setStatus('invalid'))
  }, [params.token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSubmitting(true)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: invitation.email, name, password, token: params.token }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Signup failed'); setSubmitting(false); return }

    const result = await signIn('credentials', {
      email: invitation.email,
      password,
      redirect: false,
    })
    if (result?.ok) router.push('/')
    else { setError('Account created — please log in'); router.push('/login') }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <p className="text-content-muted">Validating invitation…</p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <div className="text-center">
          <p className="text-3xl mb-4">🚫</p>
          <h1 className="text-xl font-bold mb-2">Invalid or expired invitation</h1>
          <p className="text-content-muted text-sm">Ask your manager to send a new invite link.</p>
          <button onClick={() => router.push('/login')} className="btn-secondary mt-4">Go to Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-3xl mb-2">👋</p>
          <h1 className="text-2xl font-bold">You're invited</h1>
          <p className="text-content-muted text-sm mt-1">
            Join as <span className="text-brand-accent">{invitation?.role?.toLowerCase()}</span>
          </p>
          <p className="text-content-muted text-xs mt-1">{invitation?.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && <div className="p-3 bg-red-900/30 border border-red-700/40 rounded-lg text-red-400 text-sm">{error}</div>}

          <div>
            <label className="label">Your name *</label>
            <input className="input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input bg-surface-raised cursor-not-allowed" value={invitation?.email} disabled />
          </div>
          <div>
            <label className="label">Password *</label>
            <input className="input" type="password" placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Confirm password *</label>
            <input className="input" type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full flex justify-center">
            {submitting ? 'Creating account…' : 'Create Account & Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
