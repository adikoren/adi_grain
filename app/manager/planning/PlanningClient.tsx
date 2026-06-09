'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conference {
  id: string; name: string; city: string; country: string
  startDate: string; endDate: string; icpScore: number
  attendingStatus: string; verticals: string; notes: string | null
  _count: { leads: number; targetAccounts: number }
}

interface User {
  id: string; name: string; email: string; role: string
}

interface Assignment {
  conferenceId: string; userId: string; role: string
  user: { id: string; name: string; role: string }
}

interface Cluster {
  id: string; name: string; reason: string; suggestedAction: string
  city: string; country: string; dateRange: string
  conferences: Conference[]; avgScore: number; topTier: string
  clusterType: 'same_city' | 'regional'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tier(score: number) { return score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D' }

function tierCls(t: string) {
  return t === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
       : t === 'B' ? 'bg-blue-100 text-blue-700 border-blue-200'
       : t === 'C' ? 'bg-slate-100 text-slate-600 border-slate-200'
       : 'bg-red-50 text-red-500 border-red-200'
}

function fmtDate(d: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short' })
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function detectVertical(confs: Conference[]): string {
  const text = confs.map(c => c.name.toLowerCase()).join(' ')
  if (/\bfx\b|forex|currency/.test(text)) return 'FX'
  if (/treasury/.test(text)) return 'Treasury'
  if (/payment/.test(text)) return 'Payments'
  if (/fintech|finance/.test(text)) return 'FinTech'
  return 'Finance'
}

function buildSuggestedAction(confs: Conference[], assignedReps: Set<string>): string {
  const avg = confs.reduce((s, c) => s + c.icpScore, 0) / confs.length
  const hasRep = assignedReps.size > 0
  if (!hasRep && avg >= 85) return 'Assign a senior rep to cover the full cluster — high combined value.'
  if (!hasRep) return 'No rep assigned. Combining into one trip reduces travel overhead.'
  if (assignedReps.size === 1 && confs.length >= 3)
    return `${Array.from(assignedReps)[0]} is covering this cluster — confirm capacity for all ${confs.length} events.`
  if (assignedReps.size > 1) return 'Multiple reps assigned — coordinate pre-event outreach and avoid duplicating target accounts.'
  return 'Confirm rep is aware of all events in this cluster and has prepared target accounts.'
}

function computeClusters(conferences: Conference[], assignmentMap: Record<string, Assignment[]>): Cluster[] {
  const sorted = [...conferences].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  )
  const clusters: Cluster[] = []
  const used = new Set<string>()

  const cities = Array.from(new Set(sorted.map(c => c.city)))
  for (const city of cities) {
    const cityConfs = sorted.filter(c => c.city === city && !used.has(c.id))
    if (cityConfs.length < 2) continue
    for (let i = 0; i < cityConfs.length; i++) {
      if (used.has(cityConfs[i].id)) continue
      const group = [cityConfs[i]]
      const t0 = new Date(cityConfs[i].startDate).getTime()
      for (let j = i + 1; j < cityConfs.length; j++) {
        if ((new Date(cityConfs[j].startDate).getTime() - t0) / 86400000 <= 21)
          group.push(cityConfs[j])
      }
      if (group.length < 2) continue
      group.forEach(c => used.add(c.id))
      const reps = new Set<string>()
      group.forEach(c => (assignmentMap[c.id] || []).forEach(a => reps.add(a.user.name)))
      const avg = group.reduce((s, c) => s + c.icpScore, 0) / group.length
      const span = Math.ceil((new Date(group[group.length-1].startDate).getTime() - t0) / 86400000)
      clusters.push({
        id: `city-${city}-${i}`,
        name: `${city} ${detectVertical(group)} Cluster`,
        reason: `${group.length} conferences in ${city} within ${span} days · ${group.filter(c => tier(c.icpScore) === 'A').length} Tier A`,
        suggestedAction: buildSuggestedAction(group, reps),
        city, country: group[0].country,
        dateRange: `${fmtDate(group[0].startDate)} – ${fmtDate(group[group.length-1].endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`,
        conferences: group, avgScore: avg,
        topTier: tier(Math.max(...group.map(c => c.icpScore))),
        clusterType: 'same_city',
      })
    }
  }

  // US regional circuit
  const usLeft = sorted.filter(c => (c.country === 'US' || c.country === 'USA') && !used.has(c.id))
  for (let i = 0; i < usLeft.length; i++) {
    if (used.has(usLeft[i].id)) continue
    const group = [usLeft[i]]
    const t0 = new Date(usLeft[i].startDate).getTime()
    for (let j = i + 1; j < usLeft.length; j++) {
      if ((new Date(usLeft[j].startDate).getTime() - t0) / 86400000 <= 21)
        group.push(usLeft[j])
    }
    if (group.length < 2) continue
    group.forEach(c => used.add(c.id))
    const reps = new Set<string>()
    group.forEach(c => (assignmentMap[c.id] || []).forEach(a => reps.add(a.user.name)))
    const cities = Array.from(new Set(group.map(c => c.city))).join(' / ')
    const month = new Date(group[0].startDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    const avg = group.reduce((s, c) => s + c.icpScore, 0) / group.length
    clusters.push({
      id: `us-${i}`,
      name: `US ${detectVertical(group)} Circuit — ${month}`,
      reason: `${group.length} US conferences across ${cities} within 21 days`,
      suggestedAction: buildSuggestedAction(group, reps),
      city: cities, country: 'US',
      dateRange: `${fmtDate(group[0].startDate)} – ${fmtDate(group[group.length-1].endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`,
      conferences: group, avgScore: avg,
      topTier: tier(Math.max(...group.map(c => c.icpScore))),
      clusterType: 'regional',
    })
  }

  return clusters.sort((a, b) => b.avgScore - a.avgScore)
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function TierBadge({ score }: { score: number }) {
  const t = tier(score)
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap flex-shrink-0 ${tierCls(t)}`}>
      {t} · {Math.round(score)}
    </span>
  )
}

function Chip({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${cls}`}>{label}</span>
}

// Compact assign control — w-auto, no 'input' class (which has w-full)
function AssignSelect({ confId, users, onAssign, assigning, label = 'Assign rep' }: {
  confId: string; users: User[]
  onAssign: (confId: string, userId: string) => void
  assigning: string | null; label?: string
}) {
  return (
    <select
      className="flex-shrink-0 text-xs border border-surface-border rounded-md px-2 py-1 bg-white text-content-secondary focus:outline-none focus:ring-1 focus:ring-brand-accent cursor-pointer"
      style={{ width: 'auto', maxWidth: 140 }}
      value=""
      onChange={e => { if (e.target.value) onAssign(confId, e.target.value) }}
      disabled={assigning === confId}
    >
      <option value="">{assigning === confId ? 'Assigning…' : `+ ${label}`}</option>
      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  )
}

// A single clean conference row used everywhere
function ConfRow({ conf, reps, isManager, users, onAssign, assigning, inCluster }: {
  conf: Conference
  reps: Assignment[]
  isManager: boolean
  users: User[]
  onAssign: (confId: string, userId: string) => void
  assigning: string | null
  inCluster?: boolean
}) {
  const days = daysUntil(conf.startDate)
  const t = tier(conf.icpScore)
  const primary = reps.find(a => a.role === 'PRIMARY')
  const allReps = reps.map(a => a.user.name)
  const isUrgent = days > 0 && days <= 30

  return (
    <div className="py-3 flex items-center gap-3 min-w-0">
      {/* Tier accent */}
      <div className={`w-1 h-8 rounded-full flex-shrink-0 ${
        t === 'A' ? 'bg-emerald-400' : t === 'B' ? 'bg-blue-400' : 'bg-slate-200'
      }`} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <Link href={`/conferences/${conf.id}`}
            className="text-sm font-medium text-content-primary hover:text-brand-accent truncate max-w-[200px] sm:max-w-xs">
            {conf.name}
          </Link>
          <TierBadge score={conf.icpScore} />
          {inCluster && <Chip label="Cluster" cls="bg-purple-50 text-purple-700 border-purple-200" />}
          {allReps.length === 0 && t === 'A' && <Chip label="No rep" cls="bg-red-50 text-red-600 border-red-200" />}
          {allReps.length === 0 && t !== 'A' && <Chip label="Unassigned" cls="bg-amber-50 text-amber-600 border-amber-200" />}
          {isUrgent && <Chip label={`${days}d`} cls="bg-amber-50 text-amber-700 border-amber-200" />}
        </div>
        <p className="text-xs text-content-muted truncate">
          {conf.city}, {conf.country} · {fmtDate(conf.startDate)} – {fmtDate(conf.endDate)}
          {conf._count.targetAccounts > 0 && ` · ${conf._count.targetAccounts} accounts`}
        </p>
        {allReps.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {allReps.map(name => (
              <span key={name} className="text-[11px] bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded font-medium">{name}</span>
            ))}
          </div>
        )}
      </div>

      {/* Assign control */}
      {isManager && (
        <AssignSelect
          confId={conf.id} users={users} onAssign={onAssign} assigning={assigning}
          label={primary ? 'Add rep' : 'Assign rep'}
        />
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlanningClient({
  conferences, users, assignments, isManager = false,
}: {
  conferences: Conference[]; users: User[]; assignments: Assignment[]; isManager?: boolean
}) {
  const [tab, setTab] = useState<'coverage' | 'clusters' | 'gaps'>('coverage')
  const [assigning, setAssigning] = useState<string | null>(null)
  const [filterRep, setFilterRep] = useState<string>('all')
  const [filterTier, setFilterTier] = useState<string>('all')
  const [localAssignments, setLocalAssignments] = useState<Record<string, Assignment[]>>(() => {
    const map: Record<string, Assignment[]> = {}
    assignments.forEach(a => {
      if (!map[a.conferenceId]) map[a.conferenceId] = []
      if (!map[a.conferenceId].find(x => x.userId === a.userId)) map[a.conferenceId].push(a)
    })
    return map
  })

  const safeConferences = Array.isArray(conferences) ? conferences : []
  const salesReps = (Array.isArray(users) ? users : []).filter(u => u.role === 'SALES_PERSON')

  async function doAssign(conferenceId: string, userId: string) {
    setAssigning(conferenceId)
    const user = salesReps.find(u => u.id === userId) || (Array.isArray(users) ? users : []).find(u => u.id === userId)
    await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', conferenceIds: [conferenceId], userId }),
    })
    setLocalAssignments(prev => {
      const current = prev[conferenceId] || []
      if (current.find(a => a.userId === userId)) return prev
      return {
        ...prev,
        [conferenceId]: [...current, {
          conferenceId, userId, role: 'PRIMARY',
          user: { id: userId, name: user?.name || '', role: user?.role || '' },
        }],
      }
    })
    setAssigning(null)
  }

  // Filtered conferences for the current rep+tier filters
  const filteredConferences = useMemo(() => {
    return safeConferences.filter(c => {
      if (filterTier !== 'all' && tier(c.icpScore) !== filterTier) return false
      if (filterRep === 'unassigned' && (localAssignments[c.id]?.length > 0)) return false
      if (filterRep !== 'all' && filterRep !== 'unassigned') {
        if (!(localAssignments[c.id] || []).some(a => a.userId === filterRep)) return false
      }
      return true
    })
  }, [safeConferences, localAssignments, filterRep, filterTier])

  const clusters = useMemo(() => computeClusters(filteredConferences, localAssignments), [filteredConferences, localAssignments])

  const confClusterIds = useMemo(() => {
    const set = new Set<string>()
    clusters.forEach(cl => cl.conferences.forEach(c => set.add(c.id)))
    return set
  }, [clusters])

  const repLoad = useMemo(() => {
    return salesReps.map(u => {
      const confs = filteredConferences
        .filter(c => (localAssignments[c.id] || []).some(a => a.userId === u.id))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      let maxInWindow = 0
      for (let i = 0; i < confs.length; i++) {
        const t0 = new Date(confs[i].startDate).getTime()
        const n = confs.filter(c => {
          const d = new Date(c.startDate).getTime()
          return d >= t0 && d - t0 <= 30 * 86400000
        }).length
        if (n > maxInWindow) maxInWindow = n
      }
      return {
        user: u,
        confs,
        tierACount: confs.filter(c => tier(c.icpScore) === 'A').length,
        overloaded: maxInWindow >= 4,
      }
    }).sort((a, b) => b.confs.length - a.confs.length)
  }, [filteredConferences, localAssignments, salesReps])

  const unassigned = filteredConferences.filter(c => !(localAssignments[c.id]?.length > 0))
  const tierACount = filteredConferences.filter(c => tier(c.icpScore) === 'A').length
  const unassignedA = unassigned.filter(c => tier(c.icpScore) === 'A')

  const gaps = useMemo(() => {
    const list: Array<{ conf: Conference; reasons: string[] }> = []
    filteredConferences.forEach(c => {
      const assigned = (localAssignments[c.id]?.length ?? 0) > 0
      const days = daysUntil(c.startDate)
      const t = tier(c.icpScore)
      const reasons: string[] = []
      if (!assigned && t === 'A') reasons.push('Tier A — no rep assigned')
      else if (!assigned && days <= 60 && t === 'B') reasons.push('Tier B — upcoming in 60 days, no rep assigned')
      else if (!assigned && t === 'B') reasons.push('Tier B — no rep assigned')
      if (days > 0 && days <= 21 && !assigned) reasons.push(`${days}d away — urgent`)
      if (c._count.targetAccounts === 0 && assigned && days > 0 && days <= 60)
        reasons.push('No target accounts prepared')
      if (reasons.length > 0) list.push({ conf: c, reasons })
    })
    return list.sort((a, b) => {
      const aIsA = tier(a.conf.icpScore) === 'A' && !(localAssignments[a.conf.id]?.length > 0)
      const bIsA = tier(b.conf.icpScore) === 'A' && !(localAssignments[b.conf.id]?.length > 0)
      if (aIsA && !bIsA) return -1
      if (!aIsA && bIsA) return 1
      return daysUntil(a.conf.startDate) - daysUntil(b.conf.startDate)
    })
  }, [filteredConferences, localAssignments])

  const TABS = [
    { key: 'coverage' as const, label: 'Team Coverage',         count: salesReps.length },
    { key: 'clusters' as const, label: 'Cluster Opportunities', count: clusters.length },
    { key: 'gaps'     as const, label: 'Coverage Gaps',         count: gaps.length, alert: unassignedA.length > 0 },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-content-primary">Conference Planning</h1>
          <p className="text-content-muted text-xs mt-0.5">
            Coverage decisions · cluster trips · gaps · {safeConferences.length} upcoming conferences
          </p>
        </div>
        {isManager && (
          <Link href="/manager/conferences/new" className="btn-primary text-sm">+ Add Conference</Link>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Upcoming',          value: filteredConferences.length, cls: 'text-content-primary' },
          { label: 'Tier A',            value: tierACount,                 cls: 'text-emerald-600' },
          { label: 'Tier A unassigned', value: unassignedA.length,         cls: unassignedA.length > 0 ? 'text-red-600' : 'text-emerald-600' },
          { label: 'Clusters',          value: clusters.length,            cls: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-[11px] text-content-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Rep filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-content-muted font-medium">Rep:</span>
          {[{ id: 'all', label: 'All reps' }, ...salesReps.map(u => ({ id: u.id, label: u.name.split(' ')[0] })), { id: 'unassigned', label: 'Unassigned' }].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterRep(opt.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterRep === opt.id
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : 'bg-white text-content-secondary border-surface-border hover:border-brand-navy/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tier filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-content-muted font-medium">Tier:</span>
          {[{ id: 'all', label: 'All' }, { id: 'A', label: 'A' }, { id: 'B', label: 'B' }, { id: 'C', label: 'C' }].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterTier(opt.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterTier === opt.id
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : opt.id === 'A' ? 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  : opt.id === 'B' ? 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                  : 'bg-white text-content-secondary border-surface-border hover:border-brand-navy/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-surface-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              tab === t.key
                ? 'border-brand-navy text-brand-navy'
                : 'border-transparent text-content-muted hover:text-content-primary'
            }`}
          >
            {t.label}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
              tab === t.key ? 'bg-brand-navy text-white'
              : t.alert ? 'bg-red-100 text-red-600'
              : 'bg-surface-muted text-content-muted'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ══ TEAM COVERAGE ════════════════════════════════════════════════════ */}
      {tab === 'coverage' && (
        <div className="space-y-4">
          {repLoad.filter(r => r.confs.length > 0).length === 0 && (
            <div className="card text-center py-10 text-content-muted">
              <p>No conferences match the current filters.</p>
            </div>
          )}
          {repLoad.filter(r => r.confs.length > 0).map(({ user, confs, tierACount: ta, overloaded }) => (
            <div key={user.id} className={`rounded-xl border bg-white overflow-hidden ${overloaded ? 'border-amber-300' : 'border-surface-border'}`}>
              <div className={`flex items-center gap-3 px-5 py-3 ${overloaded ? 'bg-amber-50' : 'bg-surface-raised/30'}`}>
                <div className="w-9 h-9 rounded-full bg-brand-navy/10 border border-brand-navy/20 flex items-center justify-center text-sm font-bold text-brand-navy flex-shrink-0">
                  {user.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-content-primary">{user.name}</p>
                    {overloaded && <Chip label="Overloaded" cls="bg-amber-100 text-amber-700 border-amber-300" />}
                  </div>
                  <p className="text-xs text-content-muted">
                    {confs.length} conf{confs.length !== 1 ? 's' : ''} · {ta} Tier A
                    {confs.length > 0 && ` · next: ${confs[0].city}, ${fmtDate(confs[0].startDate, { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <div className="flex gap-4 text-right flex-shrink-0">
                  <div><p className="text-2xl font-bold text-content-primary leading-none">{confs.length}</p><p className="text-[10px] text-content-muted">events</p></div>
                  <div><p className="text-2xl font-bold text-emerald-600 leading-none">{ta}</p><p className="text-[10px] text-content-muted">Tier A</p></div>
                </div>
              </div>
              <div className="divide-y divide-surface-border px-4">
                {confs.map(c => (
                  <ConfRow
                    key={c.id} conf={c}
                    reps={localAssignments[c.id] || []}
                    isManager={isManager} users={salesReps}
                    onAssign={doAssign} assigning={assigning}
                    inCluster={confClusterIds.has(c.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Unassigned section */}
          {unassigned.length > 0 && (
            <div className="rounded-xl border border-dashed border-surface-border bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-surface-raised/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-base flex-shrink-0">?</div>
                  <div>
                    <p className="font-semibold text-sm text-content-primary">No rep assigned</p>
                    <p className="text-xs text-content-muted">{unassigned.length} conference{unassigned.length !== 1 ? 's' : ''} need coverage</p>
                  </div>
                </div>
                {unassignedA.length > 0 && (
                  <Chip label={`${unassignedA.length} Tier A — critical`} cls="bg-red-50 text-red-600 border-red-300" />
                )}
              </div>
              <div className="divide-y divide-surface-border px-4">
                {unassigned.sort((a, b) => b.icpScore - a.icpScore).map(c => (
                  <ConfRow
                    key={c.id} conf={c}
                    reps={[]}
                    isManager={isManager} users={salesReps}
                    onAssign={doAssign} assigning={assigning}
                    inCluster={confClusterIds.has(c.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ CLUSTER OPPORTUNITIES ════════════════════════════════════════════ */}
      {tab === 'clusters' && (
        <div className="space-y-4">
          {clusters.length === 0 && (
            <div className="card text-center py-14 text-content-muted">
              <p className="text-2xl mb-2">🗺</p>
              <p>No cluster opportunities detected with the current filters.</p>
            </div>
          )}
          {clusters.map(cl => {
            const clReps = Array.from(new Set(
              cl.conferences.flatMap(c => (localAssignments[c.id] || []).map(a => a.user.name))
            ))
            const t = cl.topTier

            return (
              <div key={cl.id} className={`rounded-xl border-2 bg-white overflow-hidden ${t === 'A' ? 'border-purple-200' : 'border-surface-border'}`}>
                {/* Cluster header */}
                <div className={`px-5 py-3 flex items-start gap-3 ${t === 'A' ? 'bg-purple-50/50' : 'bg-surface-raised/30'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-sm text-content-primary">{cl.name}</h3>
                      <Chip label={cl.clusterType === 'same_city' ? 'Same city' : 'US circuit'} cls="bg-purple-50 text-purple-700 border-purple-200" />
                      {t === 'A' && <Chip label="High value" cls="bg-emerald-50 text-emerald-700 border-emerald-200" />}
                      {clReps.length === 0 && <Chip label="No rep" cls="bg-amber-50 text-amber-700 border-amber-200" />}
                    </div>
                    <p className="text-xs text-content-muted">{cl.dateRange} · {cl.conferences.length} events · avg {Math.round(cl.avgScore)}</p>
                    <p className="text-xs text-content-secondary mt-0.5">{cl.reason}</p>
                  </div>
                  {clReps.length > 0 && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] text-content-muted mb-1">Covering</p>
                      {clReps.map(n => (
                        <span key={n} className="block text-xs font-medium bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded mb-0.5">{n}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Conference rows */}
                <div className="divide-y divide-surface-border px-4">
                  {cl.conferences.map(c => (
                    <ConfRow
                      key={c.id} conf={c}
                      reps={localAssignments[c.id] || []}
                      isManager={isManager} users={salesReps}
                      onAssign={doAssign} assigning={assigning}
                    />
                  ))}
                </div>

                {/* Suggested action */}
                <div className="px-5 py-2.5 bg-surface-raised/30 border-t border-surface-border flex items-start gap-2">
                  <span className="text-sm flex-shrink-0">💡</span>
                  <p className="text-xs text-content-secondary">{cl.suggestedAction}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ COVERAGE GAPS ════════════════════════════════════════════════════ */}
      {tab === 'gaps' && (
        <div className="space-y-3">
          {gaps.length === 0 && (
            <div className="card text-center py-12 text-emerald-600">
              <p className="text-3xl mb-2">✓</p>
              <p className="font-semibold">No coverage gaps detected.</p>
              <p className="text-sm text-content-muted mt-1">All Tier A and upcoming conferences have a rep assigned.</p>
            </div>
          )}

          {unassignedA.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-red-600 mb-2">
                ⚠ Critical — Tier A with no coverage ({unassignedA.length})
              </p>
              <div className="space-y-2">
                {unassignedA.map(c => (
                  <div key={c.id} className="rounded-xl border-2 border-red-200 bg-red-50/40 px-4 py-1">
                    <ConfRow
                      conf={c} reps={[]}
                      isManager={isManager} users={salesReps}
                      onAssign={doAssign} assigning={assigning}
                      inCluster={confClusterIds.has(c.id)}
                    />
                    <p className="text-xs text-red-700 pb-2">High ICP — do not leave unattended{confClusterIds.has(c.id) ? ' · Part of a cluster' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gaps.filter(g => !(tier(g.conf.icpScore) === 'A' && !(localAssignments[g.conf.id]?.length > 0))).length > 0 && (
            <div className={unassignedA.length > 0 ? 'mt-4' : ''}>
              {unassignedA.length > 0 && (
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-2">
                  Other gaps
                </p>
              )}
              <div className="space-y-2">
                {gaps
                  .filter(g => !(tier(g.conf.icpScore) === 'A' && !(localAssignments[g.conf.id]?.length > 0)))
                  .map(({ conf, reasons }) => {
                    const reps = localAssignments[conf.id] || []
                    return (
                      <div key={conf.id} className="rounded-xl border border-amber-200 bg-amber-50/30 px-4 py-1">
                        <ConfRow
                          conf={conf} reps={reps}
                          isManager={isManager} users={salesReps}
                          onAssign={doAssign} assigning={assigning}
                        />
                        <div className="pb-2 space-y-0.5">
                          {reasons.map(r => (
                            <p key={r} className="text-xs text-amber-700">· {r}</p>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
