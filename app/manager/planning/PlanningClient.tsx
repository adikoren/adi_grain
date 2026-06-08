'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { scoreIcpBadge } from '@/lib/icp-score'

function tier(score: number) { return score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D' }

export default function PlanningClient({ conferences, users, assignments, isManager = false }: {
  conferences: any[]; users: any[]; assignments: any[]; isManager?: boolean
}) {
  const [view, setView] = useState<'coverage' | 'workload' | 'list'>('coverage')
  const [assigning, setAssigning] = useState<string | null>(null)
  const [localAssignments, setLocalAssignments] = useState<Record<string, Array<{ id: string; name: string }>>>(() => {
    const map: Record<string, Array<{ id: string; name: string }>> = {}
    assignments.forEach(a => {
      if (!map[a.conferenceId]) map[a.conferenceId] = []
      if (!map[a.conferenceId].find((u: any) => u.id === a.user.id)) {
        map[a.conferenceId].push({ id: a.user.id, name: a.user.name })
      }
    })
    return map
  })

  const now = new Date()
  const upcoming = conferences.filter(c => new Date(c.endDate) >= now)
  const tierA    = upcoming.filter(c => tier(c.icpScore) === 'A')
  const unassigned = upcoming.filter(c => !(localAssignments[c.id]?.length > 0))
  const unassignedTierA = tierA.filter(c => !(localAssignments[c.id]?.length > 0))

  async function assign(conferenceId: string, userId: string) {
    setAssigning(conferenceId)
    const user = users.find(u => u.id === userId)
    await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', conferenceIds: [conferenceId], userId }),
    })
    setLocalAssignments(prev => {
      const current = prev[conferenceId] || []
      if (current.find(u => u.id === userId)) return prev
      return { ...prev, [conferenceId]: [...current, { id: userId, name: user?.name || '' }] }
    })
    setAssigning(null)
  }

  // Rep workload
  const repLoad = useMemo(() => {
    const load: Record<string, { user: any; count: number; tierA: number; confs: any[] }> = {}
    users.forEach(u => { load[u.id] = { user: u, count: 0, tierA: 0, confs: [] } })
    upcoming.forEach(c => {
      (localAssignments[c.id] || []).forEach(u => {
        if (load[u.id]) {
          load[u.id].count++
          if (tier(c.icpScore) === 'A') load[u.id].tierA++
          load[u.id].confs.push(c)
        }
      })
    })
    return Object.values(load).sort((a, b) => b.count - a.count)
  }, [upcoming, localAssignments, users])

  // Group by month for list view
  const grouped: Record<string, any[]> = {}
  upcoming.forEach(c => {
    const key = new Date(c.startDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(c)
  })

  const VIEWS = [
    { key: 'coverage', label: 'Coverage Gaps' },
    { key: 'workload', label: 'Rep Workload' },
    { key: 'list',     label: 'Full List' },
  ] as const

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Conference Planning</h1>
          <p className="text-content-muted text-sm mt-1">Annual coverage · rep assignments · Tier-A gaps</p>
        </div>
        {isManager && (
          <Link href="/manager/conferences/new" className="btn-primary text-sm">+ Add Conference</Link>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Upcoming',         value: upcoming.length,            cls: 'text-content-primary' },
          { label: 'Tier A',           value: tierA.length,               cls: 'text-emerald-600' },
          { label: 'Unassigned',       value: unassigned.length,          cls: unassigned.length > 0 ? 'text-amber-600' : 'text-content-primary' },
          { label: 'Tier A unassigned', value: unassignedTierA.length,    cls: unassignedTierA.length > 0 ? 'text-red-600 font-bold' : 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-content-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sub-nav */}
      <div className="flex gap-0.5 border-b border-surface-border">
        {VIEWS.map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${view === v.key ? 'border-brand-navy text-brand-navy' : 'border-transparent text-content-muted hover:text-content-primary'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── Coverage Gaps view ── */}
      {view === 'coverage' && (
        <div className="space-y-5">
          {unassignedTierA.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span>⚠</span> Tier A — No rep assigned ({unassignedTierA.length})
              </h2>
              <div className="space-y-2">
                {unassignedTierA.map(conf => (
                  <ConferenceRow key={conf.id} conf={conf} assignedReps={localAssignments[conf.id] || []} users={users} isManager={isManager} assigning={assigning} onAssign={assign} highlight="red" />
                ))}
              </div>
            </div>
          )}

          {unassigned.filter(c => tier(c.icpScore) !== 'A').length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide mb-3">
                Tier B/C — Unassigned ({unassigned.filter(c => tier(c.icpScore) !== 'A').length})
              </h2>
              <div className="space-y-2">
                {unassigned.filter(c => tier(c.icpScore) !== 'A').map(conf => (
                  <ConferenceRow key={conf.id} conf={conf} assignedReps={localAssignments[conf.id] || []} users={users} isManager={isManager} assigning={assigning} onAssign={assign} highlight="amber" />
                ))}
              </div>
            </div>
          )}

          {unassigned.length === 0 && (
            <div className="card text-center py-10 text-emerald-600">
              <p className="text-3xl mb-2">✓</p>
              <p className="font-semibold">All upcoming conferences have a rep assigned.</p>
            </div>
          )}

          {upcoming.filter(c => (localAssignments[c.id]?.length || 0) > 0).length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-content-muted uppercase tracking-wide mb-3">
                Assigned ({upcoming.filter(c => (localAssignments[c.id]?.length || 0) > 0).length})
              </h2>
              <div className="space-y-2">
                {upcoming.filter(c => (localAssignments[c.id]?.length || 0) > 0).map(conf => (
                  <ConferenceRow key={conf.id} conf={conf} assignedReps={localAssignments[conf.id] || []} users={users} isManager={isManager} assigning={assigning} onAssign={assign} highlight="none" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Workload view ── */}
      {view === 'workload' && (
        <div className="space-y-4">
          {repLoad.map(({ user, count, tierA: ta, confs }) => (
            <div key={user.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-navy/10 border border-brand-navy/20 flex items-center justify-center text-sm font-bold text-brand-navy">
                    {(user.name[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-content-primary">{user.name}</p>
                    <p className="text-xs text-content-muted capitalize">{user.role.toLowerCase().replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex gap-3 text-right">
                  <div>
                    <p className="text-xl font-bold text-content-primary">{count}</p>
                    <p className="text-xs text-content-muted">conferences</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-600">{ta}</p>
                    <p className="text-xs text-content-muted">Tier A</p>
                  </div>
                </div>
              </div>
              {confs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-surface-border">
                  {confs.sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).map((c: any) => {
                    const badge = scoreIcpBadge(c.icpScore)
                    return (
                      <Link key={c.id} href={`/conferences/${c.id}`}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors hover:border-brand-accent/40 ${tier(c.icpScore) === 'A' ? 'border-emerald-200 bg-emerald-50' : 'border-surface-border bg-surface-raised'}`}>
                        <span className={`font-bold ${badge.className} text-[10px] px-1 py-0.5 rounded`}>{tier(c.icpScore)}</span>
                        <span className="text-content-secondary">{c.name}</span>
                        <span className="text-content-muted">{new Date(c.startDate).toLocaleDateString('en-GB', { month: 'short' })}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
              {confs.length === 0 && (
                <p className="text-xs text-content-muted pt-2 border-t border-surface-border">No conferences assigned yet.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Full list view ── */}
      {view === 'list' && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, confs]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-content-muted uppercase tracking-wide mb-3">{month}</h2>
              <div className="space-y-2">
                {confs.map(conf => (
                  <ConferenceRow key={conf.id} conf={conf} assignedReps={localAssignments[conf.id] || []} users={users} isManager={isManager} assigning={assigning} onAssign={assign} highlight="none" />
                ))}
              </div>
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="text-center py-16 text-content-muted">
              <p className="text-4xl mb-3">📅</p>
              <p>No upcoming conferences found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ConferenceRow({ conf, assignedReps, users, isManager, assigning, onAssign, highlight }: {
  conf: any; assignedReps: Array<{ id: string; name: string }>
  users: any[]; isManager: boolean; assigning: string | null
  onAssign: (confId: string, userId: string) => void
  highlight: 'red' | 'amber' | 'none'
}) {
  const badge = scoreIcpBadge(conf.icpScore || 0)
  const daysAway = Math.ceil((new Date(conf.startDate).getTime() - Date.now()) / 86400000)
  const borderCls = highlight === 'red' ? 'border-l-4 border-l-red-400' : highlight === 'amber' ? 'border-l-4 border-l-amber-400' : ''

  return (
    <div className={`card flex flex-col sm:flex-row sm:items-center gap-4 ${borderCls}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/conferences/${conf.id}`} className="font-medium text-content-primary hover:text-brand-accent transition-colors truncate">
            {conf.name}
          </Link>
          <span className={`badge text-xs ${badge.className} flex-shrink-0`}>{badge.label}</span>
          {conf.attendingStatus === 'ATTENDING' && <span className="badge text-xs bg-emerald-100 text-emerald-700">Going</span>}
        </div>
        <p className="text-xs text-content-muted mt-0.5">
          {conf.city}, {conf.country} · {new Date(conf.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {daysAway > 0 && <span className="ml-1">({daysAway}d)</span>}
        </p>
        {assignedReps.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {assignedReps.map(u => (
              <span key={u.id} className="badge bg-brand-navy/10 text-brand-navy text-xs">{u.name}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-content-muted">{conf._count?.leads ?? 0} leads</span>
        {isManager && (
          <select
            className="input text-xs py-1.5 min-w-[150px]"
            value=""
            onChange={e => { if (e.target.value) onAssign(conf.id, e.target.value) }}
            disabled={assigning === conf.id}
          >
            <option value="">{assigning === conf.id ? 'Assigning…' : '+ Assign rep'}</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}
