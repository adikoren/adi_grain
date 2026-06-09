'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const VERTICALS = ['FINTECH', 'PAYMENTS', 'FX', 'TRAVEL', 'TREASURY', 'SAAS', 'OTHER']
const BUYER_PERSONAS = ['CFO', 'Head of Payments', 'CRO', 'CPO']

function fmt(d: Date | string) {
  return new Date(d).toISOString().split('T')[0]
}

interface Rep { id: string; name: string }

export default function EditConferenceClient({ conference, reps = [] }: { conference: any; reps?: Rep[] }) {
  const router = useRouter()
  const primaryAssignment = conference.assignments?.find((a: any) => a.role === 'PRIMARY') ?? conference.assignments?.[0] ?? null
  const [form, setForm] = useState({
    name: conference.name || '',
    website: conference.website || '',
    startDate: fmt(conference.startDate),
    endDate: fmt(conference.endDate),
    city: conference.city || '',
    country: conference.country || '',
    estimatedAudience: conference.estimatedAudience?.toString() || '',
    icpScore: conference.icpScore?.toString() || '',
    notes: conference.notes || '',
    status: conference.status || 'DRAFT',
    assignedRepId: primaryAssignment?.userId ?? '',
  })
  const [verticals, setVerticals] = useState<string[]>(
    JSON.parse(conference.verticals || '[]')
  )
  const [buyerPersonas, setBuyerPersonas] = useState<string[]>(
    JSON.parse(conference.buyerPersonas || '[]')
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  function set(k: string, v: string) {
    setForm(p => ({ ...p, [k]: v }))
  }

  function toggleVertical(v: string) {
    setVerticals(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch(`/api/conferences/${conference.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, verticals, buyerPersonas }),
    })
    if (res.ok) {
      router.push(`/conferences/${conference.id}`)
      router.refresh()
    } else {
      const d = await res.json()
      setError(d.error || 'Save failed')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${conference.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/conferences/${conference.id}`, { method: 'DELETE' })
    router.push('/conferences/all')
    router.refresh()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-content-muted hover:text-content-primary text-lg">←</button>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Edit Conference</h1>
            <p className="text-xs text-content-muted mt-0.5">{conference.name}</p>
          </div>
        </div>
        <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors">
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

        <div>
          <label className="label">Conference name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>

        <div>
          <label className="label">Website</label>
          <input className="input" type="url" placeholder="https://…" value={form.website} onChange={e => set('website', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start date *</label>
            <input className="input" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
          </div>
          <div>
            <label className="label">End date *</label>
            <input className="input" type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">City *</label>
            <input className="input" value={form.city} onChange={e => set('city', e.target.value)} required />
          </div>
          <div>
            <label className="label">Country code *</label>
            <input className="input" placeholder="US, GB, DE…" maxLength={2} value={form.country} onChange={e => set('country', e.target.value.toUpperCase())} required />
          </div>
        </div>

        <div>
          <label className="label">Verticals</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {VERTICALS.map(v => (
              <button key={v} type="button" onClick={() => toggleVertical(v)}
                className={`badge cursor-pointer transition-colors ${verticals.includes(v) ? 'bg-brand-accent/15 text-brand-navy border border-brand-accent/30' : 'bg-surface-raised text-content-muted hover:text-content-primary border border-surface-border'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Buyer Personas</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {BUYER_PERSONAS.map(p => (
              <button key={p} type="button"
                onClick={() => setBuyerPersonas(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                className={`badge cursor-pointer transition-colors ${buyerPersonas.includes(p) ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-surface-raised text-content-muted hover:text-content-primary border border-surface-border'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Estimated audience</label>
            <input className="input" type="number" min="0" value={form.estimatedAudience} onChange={e => set('estimatedAudience', e.target.value)} />
          </div>
          <div>
            <label className="label">ICP score override (0–100)</label>
            <input className="input" type="number" min="0" max="100" placeholder="Auto-calculated" value={form.icpScore} onChange={e => set('icpScore', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="DRAFT">Draft</option>
            <option value="ELIGIBLE">Eligible</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>

        <div>
          <label className="label">Assigned Sales Rep</label>
          <select className="input" value={form.assignedRepId} onChange={e => set('assignedRepId', e.target.value)}>
            <option value="">Unassigned</option>
            {reps.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
