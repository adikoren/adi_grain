'use client'
import { useEffect, useState } from 'react'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('SALES_PERSON')
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users || []))
    fetch('/api/invitations').then(r => r.json()).then(d => setInvitations(d.invitations || []))
  }, [])

  async function invite(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); setInviteUrl('')
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setInviteUrl(data.inviteUrl || '')
    setEmailSent(data.emailSent || false)
    setMessage(data.message || '')
    setEmail('')
    fetch('/api/invitations').then(r => r.json()).then(d => setInvitations(d.invitations || []))
  }

  const statusColor = (s: string) => ({ PENDING: 'text-yellow-400', ACCEPTED: 'text-green-400', EXPIRED: 'text-content-muted', REVOKED: 'text-red-400' })[s] || 'text-content-muted'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-content-muted text-sm mt-1">Invite team members and manage roles</p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Invite User</h2>
        <form onSubmit={invite} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="label">Email address</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com" required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input w-40" value={role} onChange={e => setRole(e.target.value)}>
              <option value="SALES_PERSON">Sales Person</option>
              <option value="MANAGER">Manager</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Inviting…' : 'Send Invite'}</button>
        </form>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        {inviteUrl && (
          <div className="mt-3 p-3 bg-surface-raised rounded-lg space-y-2">
            {emailSent
              ? <p className="text-xs text-green-400">✓ Invitation email sent</p>
              : <p className="text-xs text-amber-300">{message}</p>
            }
            <div className="flex items-center gap-2">
              <code className="text-xs text-brand-accent break-all flex-1">{inviteUrl}</code>
              <button onClick={() => navigator.clipboard.writeText(inviteUrl)} className="text-xs btn-secondary flex-shrink-0">Copy</button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-0">
        <div className="px-6 py-4 border-b border-surface-border"><h2 className="font-semibold">Team Members</h2></div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-surface-border">
            {['Name', 'Email', 'Role', 'Status'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-content-muted uppercase">{h}</th>)}
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="table-row">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-content-muted">{u.email}</td>
                <td className="px-4 py-3"><span className="badge bg-surface-raised text-content-secondary">{u.role.replace('_', ' ')}</span></td>
                <td className="px-4 py-3"><span className={`badge ${u.isActive ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-0">
        <div className="px-6 py-4 border-b border-surface-border"><h2 className="font-semibold">Pending Invitations</h2></div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-surface-border">
            {['Email', 'Role', 'Status', 'Sent', 'Expires'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-content-muted uppercase">{h}</th>)}
          </tr></thead>
          <tbody>
            {invitations.map(i => (
              <tr key={i.id} className="table-row">
                <td className="px-4 py-3">{i.email}</td>
                <td className="px-4 py-3 text-content-muted">{i.role.replace('_', ' ')}</td>
                <td className="px-4 py-3"><span className={`text-xs font-medium ${statusColor(i.status)}`}>{i.status}</span></td>
                <td className="px-4 py-3 text-content-muted text-xs">{new Date(i.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-content-muted text-xs">{new Date(i.expiresAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {invitations.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-content-muted">No invitations sent</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
