'use client'
import { useEffect, useState } from 'react'

export default function TripsPage() {
  const [trips, setTrips] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  useEffect(() => {
    loadTrips()
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.users?.filter((u: any) => u.isActive) || []))
  }, [])

  async function loadTrips() {
    const res = await fetch('/api/trips')
    const data = await res.json()
    setTrips(data.trips || [])
  }

  async function recalculate() {
    setRecalculating(true)
    await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recalculate' }) })
    await loadTrips()
    setRecalculating(false)
  }

  async function assign(tripId: string, userId: string) {
    setLoading(true)
    await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'assign', tripId, userId }) })
    await loadTrips()
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trip Opportunities</h1>
          <p className="text-content-muted text-sm mt-1">Conferences clustered by geography + timing</p>
        </div>
        <button onClick={recalculate} disabled={recalculating} className="btn-secondary">
          {recalculating ? 'Calculating…' : '↺ Recalculate'}
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-content-muted mb-4">No trip opportunities calculated yet.</p>
          <button onClick={recalculate} className="btn-primary">Calculate Now</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {trips.map(t => (
            <div key={t.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">{t.name}</h3>
                  <p className="text-xs text-content-muted mt-0.5">{t.clusterReason}</p>
                </div>
                {t.assignedTo && (
                  <span className="badge bg-brand-accent/20 text-brand-accent">{t.assignedTo.name.split(' ')[0]}</span>
                )}
              </div>

              <div className="space-y-1 mb-4">
                {(t.conferences || []).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-content-secondary">{c.name}</span>
                    <span className="text-xs text-content-muted">
                      {new Date(c.startDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>

              <select
                className="input w-full text-sm"
                defaultValue={t.assignedToId || ''}
                onChange={e => e.target.value && assign(t.id, e.target.value)}
              >
                <option value="">Assign to rep…</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
