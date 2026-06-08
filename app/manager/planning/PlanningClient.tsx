'use client'
import { useState } from 'react'
import { scoreIcpBadge } from '@/lib/icp-score'

export default function PlanningClient({ conferences, users, assignments, isManager = false }: {
  conferences: any[]; users: any[]; assignments: any[]; isManager?: boolean
}) {
  const [assigning, setAssigning] = useState<string | null>(null)
  const [localAssignments, setLocalAssignments] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {}
    assignments.forEach(a => {
      if (!map[a.conferenceId]) map[a.conferenceId] = []
      map[a.conferenceId].push(a.user.name)
    })
    return map
  })

  async function assign(conferenceId: string, userId: string) {
    setAssigning(conferenceId)
    await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', conferenceIds: [conferenceId], userId }),
    })
    const user = users.find(u => u.id === userId)
    setLocalAssignments(prev => ({
      ...prev,
      [conferenceId]: [...(prev[conferenceId] || []).filter(n => n !== user?.name), user?.name || ''],
    }))
    setAssigning(null)
  }

  // Group by month
  const grouped: Record<string, any[]> = {}
  conferences.forEach(c => {
    const key = new Date(c.startDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(c)
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conference Planning</h1>
        <p className="text-content-muted text-sm mt-1">Coverage view · assign reps to eligible conferences</p>
      </div>

      <div className="flex gap-4 text-sm text-content-muted">
        <span>🟢 {users.length} reps available</span>
        <span>📅 {conferences.length} eligible conferences</span>
      </div>

      {Object.entries(grouped).map(([month, confs]) => (
        <div key={month}>
          <h2 className="text-sm font-semibold text-content-muted uppercase tracking-wide mb-3">{month}</h2>
          <div className="space-y-3">
            {confs.map(conf => {
              const badge = scoreIcpBadge(conf.icpScore || 0)
              const assignedNames = localAssignments[conf.id] || []
              return (
                <div key={conf.id} className="card flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{conf.name}</p>
                      <span className={`badge text-xs ${badge.className} flex-shrink-0`}>{badge.label}</span>
                    </div>
                    <p className="text-sm text-content-muted">
                      {conf.city}, {conf.country} · {new Date(conf.startDate).toLocaleDateString('en-GB')}
                      {conf.endDate !== conf.startDate ? ` – ${new Date(conf.endDate).toLocaleDateString('en-GB')}` : ''}
                    </p>
                    {assignedNames.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {assignedNames.map((n, i) => (
                          <span key={i} className="badge bg-brand-accent/10 text-brand-accent text-xs">{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isManager && (
                      <select
                        className="input text-sm py-1.5 min-w-[160px]"
                        defaultValue=""
                        onChange={e => { if (e.target.value) assign(conf.id, e.target.value) }}
                        disabled={assigning === conf.id}
                      >
                        <option value="">+ Assign rep…</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    )}
                    <span className="text-xs text-content-muted whitespace-nowrap">{conf._count.leads} leads</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {conferences.length === 0 && (
        <div className="text-center py-16 text-content-muted">
          <p className="text-4xl mb-3">📅</p>
          <p>No eligible conferences. Set conference status to "Eligible" first.</p>
        </div>
      )}
    </div>
  )
}
