'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const VERTICALS = ['FINTECH', 'PAYMENTS', 'FX', 'TRAVEL', 'TREASURY', 'SAAS', 'OTHER']

export default function NewConferencePage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', website: '', startDate: '', endDate: '', city: '', country: '', estimatedAudience: '', notes: '', status: 'DRAFT' })
  const [verticals, setVerticals] = useState<string[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [discovered, setDiscovered] = useState<any[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleVertical(v: string) {
    setVerticals(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  async function discover() {
    setDiscovering(true); setDiscovered([])
    const res = await fetch('/api/conferences/discover', { method: 'POST' })
    const data = await res.json()
    setDiscovered(data.conferences || [])
    setDiscovering(false)
  }

  async function importConference(c: any) {
    await fetch('/api/conferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...c, status: 'DRAFT', source: 'AUTO_IMPORT' }),
    })
    setDiscovered(prev => prev.filter(x => x.name !== c.name))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const res = await fetch('/api/conferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, verticals }),
    })
    if (res.ok) { router.push('/conferences') } else {
      const d = await res.json(); setError(d.error || 'Failed'); setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-content-muted hover:text-content-primary">←</button>
        <h1 className="text-2xl font-bold">Add Conference</h1>
      </div>

      {/* AI Discovery */}
      <div className="card border-brand-accent/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-brand-accent">AI Conference Discovery</h2>
            <p className="text-xs text-content-muted mt-0.5">Scan fintech event sites and import new conferences automatically</p>
          </div>
          <button onClick={discover} disabled={discovering} className="btn-secondary text-sm">
            {discovering ? '⏳ Scanning…' : '🔍 Find Conferences'}
          </button>
        </div>

        {discovered.length > 0 && (
          <div className="space-y-2 mt-4 max-h-80 overflow-y-auto">
            {discovered.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-raised rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <p className="text-xs text-content-muted">{c.city}, {c.country} · {c.startDate}</p>
                  <div className="flex gap-1 mt-1">
                    {(c.verticals || []).map((v: string) => <span key={v} className="badge bg-surface text-content-muted text-xs">{v}</span>)}
                  </div>
                </div>
                <button onClick={() => importConference(c)} className="btn-primary text-xs ml-3 flex-shrink-0">Import</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual form */}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-semibold">Manual Entry</h2>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

        <div><label className="label">Conference name *</label><input className="input" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required /></div>
        <div><label className="label">Website</label><input className="input" type="url" value={form.website} onChange={e => setForm(p => ({...p, website: e.target.value}))} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Start date *</label><input className="input" type="date" value={form.startDate} onChange={e => setForm(p => ({...p, startDate: e.target.value}))} required /></div>
          <div><label className="label">End date *</label><input className="input" type="date" value={form.endDate} onChange={e => setForm(p => ({...p, endDate: e.target.value}))} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">City *</label><input className="input" value={form.city} onChange={e => setForm(p => ({...p, city: e.target.value}))} required /></div>
          <div><label className="label">Country code *</label><input className="input" placeholder="US, GB, DE…" maxLength={2} value={form.country} onChange={e => setForm(p => ({...p, country: e.target.value.toUpperCase()}))} required /></div>
        </div>
        <div>
          <label className="label">Verticals</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {VERTICALS.map(v => (
              <button key={v} type="button" onClick={() => toggleVertical(v)}
                className={`badge cursor-pointer transition-colors ${verticals.includes(v) ? 'bg-brand-accent/20 text-brand-accent' : 'bg-surface-raised text-content-muted hover:text-content-primary'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div><label className="label">Estimated audience</label><input className="input" type="number" value={form.estimatedAudience} onChange={e => setForm(p => ({...p, estimatedAudience: e.target.value}))} /></div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
            <option value="DRAFT">Draft</option>
            <option value="ELIGIBLE">Eligible</option>
          </select>
        </div>
        <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} /></div>
        <button type="submit" disabled={saving} className="btn-primary w-full flex justify-center">{saving ? 'Saving…' : 'Save Conference'}</button>
      </form>
    </div>
  )
}
