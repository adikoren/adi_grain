'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conference {
  id: string; name: string; city: string; country: string
  startDate: string; endDate: string; verticals: string
  estimatedAudience: number | null; icpScore: number
  status: string; website: string | null
  assignments: Array<{ userId: string; role: string; user: { id: string; name: string } }>
  _count: { leads: number }
}

interface Rep { id: string; name: string }

interface DiscoveredConference {
  name: string; city: string; country: string
  startDate: string; endDate: string
  website?: string; verticals?: string[]
  estimatedAudience?: number; notes?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Deterministic per-rep color palette (index-assigned)
const PALETTE = [
  { pill: 'bg-emerald-100 text-emerald-900 border-emerald-200', dot: 'bg-emerald-500', badge: 'bg-emerald-100 border-emerald-300 text-emerald-800' },
  { pill: 'bg-sky-100 text-sky-900 border-sky-200',             dot: 'bg-sky-500',     badge: 'bg-sky-100 border-sky-300 text-sky-800' },
  { pill: 'bg-violet-100 text-violet-900 border-violet-200',   dot: 'bg-violet-500',  badge: 'bg-violet-100 border-violet-300 text-violet-800' },
  { pill: 'bg-amber-100 text-amber-900 border-amber-200',       dot: 'bg-amber-500',   badge: 'bg-amber-100 border-amber-300 text-amber-800' },
  { pill: 'bg-rose-100 text-rose-900 border-rose-200',          dot: 'bg-rose-500',    badge: 'bg-rose-100 border-rose-300 text-rose-800' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function tier(score: number) { return score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D' }

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isInRange(day: Date, start: string, end: string) {
  const d = day.getTime()
  return d >= new Date(start).setHours(0,0,0,0) && d <= new Date(end).setHours(23,59,59,999)
}

function fmt(d: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short' })
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ConferenceCalendarClient({
  conferences, isManager, myConferenceIds = [], reps = [],
}: {
  conferences: Conference[]
  isManager: boolean
  myConferenceIds?: string[]
  reps?: Rep[]
}) {
  const mySet     = new Set(myConferenceIds)
  const today     = new Date()
  const [year, setYear]       = useState(today.getFullYear())
  const [month, setMonth]     = useState(today.getMonth())
  const [selected, setSelected] = useState<Conference | null>(null)
  const [filterRep,  setFilterRep]  = useState<string>('all')
  const [filterTier, setFilterTier] = useState<string>('all')

  // Conference discovery
  const [discovering, setDiscovering] = useState(false)
  const [discovered,  setDiscovered]  = useState<DiscoveredConference[] | null>(null)
  const [discoverErr, setDiscoverErr] = useState<string | null>(null)
  const [importing,   setImporting]   = useState<Set<number>>(new Set())
  const [imported,    setImported]    = useState<Set<number>>(new Set())

  // Extract companies state
  const [extractConf,    setExtractConf]    = useState<Conference | null>(null)
  const [fallbackUrl,    setFallbackUrl]    = useState('')
  const [extractLoading, setExtractLoading] = useState(false)
  const [extractResults, setExtractResults] = useState<Array<{
    name: string; website: string | null; contactName: string | null
    contactRole: string | null; priority: string; companyType: string | null; source: string
  }> | null>(null)
  const [extractError,   setExtractError]   = useState<string | null>(null)
  const [addingKeys,     setAddingKeys]     = useState<Set<string>>(new Set())
  const [addedKeys,      setAddedKeys]      = useState<Set<string>>(new Set())

  async function openExtract(conf: Conference) {
    setExtractConf(conf)
    setFallbackUrl('')
    setExtractResults(null)
    setExtractError(null)
    setAddingKeys(new Set())
    setAddedKeys(new Set())
    if (conf.website) runExtractFor(conf.id, undefined)
  }

  async function runExtractFor(confId: string, overrideUrl?: string) {
    setExtractLoading(true); setExtractError(null); setExtractResults(null)
    try {
      const body: Record<string, string> = {}
      if (overrideUrl) body.url = overrideUrl
      const res = await fetch(`/api/conferences/${confId}/extract-companies`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) setExtractError(data.error || 'Failed to extract')
      else setExtractResults(data.companies || [])
    } catch { setExtractError('Network error') }
    finally { setExtractLoading(false) }
  }

  function runExtract() {
    if (extractConf) runExtractFor(extractConf.id, fallbackUrl.trim() || undefined)
  }

  async function addTarget(c: NonNullable<typeof extractResults>[0]) {
    if (!extractConf) return
    setAddingKeys(prev => { const s = new Set(Array.from(prev)); s.add(c.name); return s })
    await fetch(`/api/conferences/${extractConf.id}/targets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: c.name, contactName: c.contactName || undefined,
        contactRole: c.contactRole || undefined,
        notes: `Source: ${c.source}${c.companyType ? ` · ${c.companyType}` : ''}`,
        priority: c.priority || 'MEDIUM',
      }),
    })
    setAddingKeys(prev => { const s = new Set(Array.from(prev)); s.delete(c.name); return s })
    setAddedKeys(prev => { const s = new Set(Array.from(prev)); s.add(c.name); return s })
  }

  async function runDiscover() {
    setDiscovering(true)
    setDiscoverErr(null)
    setDiscovered(null)
    setImporting(new Set())
    setImported(new Set())
    try {
      const res = await fetch('/api/conferences/discover', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Discovery failed')
      setDiscovered(data.conferences || [])
    } catch (e: any) {
      setDiscoverErr(e.message)
    } finally {
      setDiscovering(false)
    }
  }

  async function importConference(c: DiscoveredConference, idx: number) {
    setImporting(prev => new Set(prev).add(idx))
    try {
      const res = await fetch('/api/conferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: c.name, city: c.city, country: c.country,
          startDate: c.startDate, endDate: c.endDate,
          website: c.website || null,
          verticals: c.verticals || [],
          estimatedAudience: c.estimatedAudience || null,
          notes: c.notes || null,
        }),
      })
      if (!res.ok) throw new Error('Import failed')
      setImported(prev => new Set(prev).add(idx))
    } catch {
      // leave importing state so user can retry
    } finally {
      setImporting(prev => { const s = new Set(prev); s.delete(idx); return s })
    }
  }

  // Stable rep → color index mapping
  const repColorIdx = useMemo(() => {
    const map = new Map<string, number>()
    reps.forEach((r, i) => map.set(r.id, i % PALETTE.length))
    return map
  }, [reps])

  function repColor(repId: string) { return PALETTE[repColorIdx.get(repId) ?? 0] }

  // Primary rep of a conference (first MANAGER-ROLE or first assignment)
  function primaryRep(c: Conference) {
    return c.assignments.find(a => a.role === 'PRIMARY') ?? c.assignments[0] ?? null
  }

  // Color a conference pill for manager view
  function managerPillCls(c: Conference): string {
    const pr = primaryRep(c)
    if (!pr) {
      return tier(c.icpScore) === 'A'
        ? 'bg-red-100 text-red-800 border-red-300'
        : 'bg-slate-100 text-slate-600 border-slate-200'
    }
    return repColor(pr.userId).pill
  }

  // Filtered conference list
  const filteredConfs = useMemo(() => {
    if (!isManager) return conferences
    return conferences.filter(c => {
      if (filterTier !== 'all' && tier(c.icpScore) !== filterTier) return false
      if (filterRep === 'unassigned') return c.assignments.length === 0
      if (filterRep !== 'all') return c.assignments.some(a => a.userId === filterRep)
      return true
    })
  }, [conferences, isManager, filterRep, filterTier])

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y-1) } else setMonth(m => m-1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y+1) } else setMonth(m => m+1) }

  // Calendar grid
  const days = useMemo(() => {
    const first = new Date(year, month, 1)
    const startOffset = first.getDay()
    const daysInMonth = new Date(year, month+1, 0).getDate()
    const cells: (Date | null)[] = Array(startOffset).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])

  const confsByDay = useMemo(() => {
    const map = new Map<string, Conference[]>()
    days.forEach(day => {
      if (!day) return
      const hits = filteredConfs.filter(c => isInRange(day, c.startDate, c.endDate))
      if (hits.length) map.set(day.toDateString(), hits)
    })
    return map
  }, [days, filteredConfs])

  const monthConferences = useMemo(() =>
    filteredConfs.filter(c => {
      const s = new Date(c.startDate)
      return s.getFullYear() === year && s.getMonth() === month
    }),
  [filteredConfs, year, month])

  const unassignedCount  = monthConferences.filter(c => c.assignments.length === 0).length
  const unassignedACount = monthConferences.filter(c => c.assignments.length === 0 && tier(c.icpScore) === 'A').length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-content-primary">Conference Calendar</h1>
          <p className="text-content-muted text-xs mt-0.5">
            {isManager
              ? `${monthConferences.length} conferences this month${unassignedCount > 0 ? ` · ${unassignedCount} unassigned${unassignedACount > 0 ? ` (${unassignedACount} Tier A)` : ''}` : ''}`
              : `${monthConferences.length} conferences this month`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/conferences/all" className="btn-secondary text-sm">List view</Link>
          {isManager && (<>
            <button
              onClick={runDiscover}
              disabled={discovering}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              {discovering
                ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full" /> Scanning…</>
                : '✦ Discover'}
            </button>
            <Link href="/manager/conferences/new" className="btn-primary text-sm">+ Add</Link>
          </>)}
        </div>
      </div>

      {/* Manager filter bar */}
      {isManager && (
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-content-muted font-medium">Rep:</span>
            {[
              { id: 'all', label: 'All reps' },
              ...reps.map(r => ({ id: r.id, label: r.name.split(' ')[0] })),
              { id: 'unassigned', label: 'Unassigned' },
            ].map(opt => (
              <button key={opt.id} onClick={() => setFilterRep(opt.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterRep === opt.id
                    ? 'bg-brand-navy text-white border-brand-navy'
                    : 'bg-white text-content-secondary border-surface-border hover:border-brand-navy/40'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-content-muted font-medium">Tier:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'A',   label: 'A', cls: 'text-emerald-700 border-emerald-200' },
              { id: 'B',   label: 'B', cls: 'text-sky-700 border-sky-200' },
              { id: 'C',   label: 'C', cls: 'text-slate-600 border-slate-200' },
            ].map(opt => (
              <button key={opt.id} onClick={() => setFilterTier(opt.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterTier === opt.id
                    ? 'bg-brand-navy text-white border-brand-navy'
                    : `bg-white ${(opt as any).cls ?? 'text-content-secondary border-surface-border'} hover:border-brand-navy/40`
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-surface-raised transition-colors text-content-muted hover:text-content-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h2 className="text-base font-semibold w-40 text-center">{MONTHS[month]} {year}</h2>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-surface-raised transition-colors text-content-muted hover:text-content-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
          className="text-xs text-content-muted hover:text-content-primary px-2 py-1 rounded border border-surface-border transition-colors">
          Today
        </button>
      </div>

      {/* Calendar grid */}
      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-surface-border bg-surface-raised/40">
          {DAYS.map(d => (
            <div key={d} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-content-muted text-center">{d}</div>
          ))}
        </div>
        <div>
          {Array.from({ length: days.length / 7 }, (_, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-surface-border last:border-0">
              {days.slice(wi*7, wi*7+7).map((day, di) => {
                const isToday = day ? isSameDay(day, today) : false
                const dayConfs = day ? (confsByDay.get(day.toDateString()) || []) : []
                const isPast   = day ? day < today && !isToday : false

                return (
                  <div key={di} className={`min-h-[100px] p-1.5 border-r border-surface-border last:border-0 ${
                    !day ? 'bg-surface-raised/20' : isPast ? 'bg-white/60' : 'bg-white'
                  }`}>
                    {day && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-brand-accent text-gray-900 font-bold' : isPast ? 'text-content-muted/50' : 'text-content-muted'
                          }`}>
                            {day.getDate()}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {dayConfs.slice(0, 3).map(c => {
                            const pr = primaryRep(c)
                            const isUnassigned = !pr
                            const isTierA = tier(c.icpScore) === 'A'
                            const pillCls = isManager ? managerPillCls(c) : (mySet.has(c.id) ? 'bg-brand-navy text-white border-brand-navy' : 'bg-slate-100 text-slate-700 border-slate-200')
                            const repInitial = pr ? pr.user.name[0] : null

                            return (
                              <button
                                key={c.id}
                                onClick={() => setSelected(selected?.id === c.id ? null : c)}
                                title={`${tier(c.icpScore)} · ${c.name}${pr ? ` · ${pr.user.name}` : ' · Unassigned'}`}
                                className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 transition-opacity hover:opacity-80 ${pillCls}`}
                              >
                                {isManager && isUnassigned && isTierA && (
                                  <span className="font-bold flex-shrink-0 text-red-600">!</span>
                                )}
                                <span className="font-bold flex-shrink-0">{tier(c.icpScore)}</span>
                                <span className="truncate flex-1">{c.name}</span>
                                {isManager && repInitial && (
                                  <span className="font-bold flex-shrink-0 opacity-70">{repInitial}</span>
                                )}
                              </button>
                            )
                          })}
                          {dayConfs.length > 3 && (
                            <p className="text-[10px] text-content-muted px-1">+{dayConfs.length - 3} more</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Manager legend */}
      {isManager && reps.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="text-content-muted text-[11px] font-medium">Coverage:</span>
          {reps.map((r, i) => {
            const color = PALETTE[i % PALETTE.length]
            return (
              <span key={r.id} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color.dot}`} />
                <span className="text-content-secondary">{r.name}</span>
              </span>
            )
          })}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-red-400" />
            <span className="text-content-secondary">Tier A unassigned</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-slate-300" />
            <span className="text-content-secondary">Unassigned</span>
          </span>
        </div>
      )}

      {/* Rep legend for sales view */}
      {!isManager && (
        <div className="flex gap-4 text-xs text-content-muted">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-navy inline-block" />My conferences</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200 inline-block" />Other conferences</span>
        </div>
      )}

      {/* Selected conference detail panel */}
      {selected && (() => {
        const pr  = primaryRep(selected)
        const allReps = selected.assignments.map(a => a.user.name)
        const isUnassigned = allReps.length === 0
        const isMyConf = mySet.has(selected.id)
        const color = pr ? repColor(pr.userId) : null

        return (
          <div className={`card border space-y-3 ${
            isManager
              ? isUnassigned && tier(selected.icpScore) === 'A'
                ? 'border-red-300 bg-red-50/30'
                : color ? `border-current` : 'border-surface-border'
              : isMyConf ? 'border-blue-400/40' : 'border-surface-border'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Link href={`/conferences/${selected.id}`}
                    className="font-semibold text-base hover:text-brand-accent transition-colors">{selected.name}</Link>
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${
                    tier(selected.icpScore) === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                    tier(selected.icpScore) === 'B' ? 'bg-sky-100 text-sky-800 border-sky-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {tier(selected.icpScore)} · {Math.round(selected.icpScore)}
                  </span>
                  {isMyConf && !isManager && <span className="badge bg-brand-navy/10 text-brand-navy text-xs">My conference</span>}
                  {isManager && isUnassigned && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">
                      {tier(selected.icpScore) === 'A' ? '⚠ No rep — critical' : 'Unassigned'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-content-muted">
                  {selected.city}, {selected.country} · {fmt(selected.startDate)} – {fmt(selected.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-content-muted hover:text-content-primary text-xl leading-none flex-shrink-0">×</button>
            </div>

            {/* Rep coverage */}
            {isManager && (
              <div className="flex items-center gap-2 flex-wrap">
                {allReps.length > 0 ? (
                  <>
                    <span className="text-xs text-content-muted">Covered by:</span>
                    {selected.assignments.map(a => {
                      const c = repColor(a.userId)
                      return (
                        <span key={a.userId} className={`text-xs font-medium px-2 py-0.5 rounded border ${c.badge}`}>
                          {a.user.name}{a.role === 'PRIMARY' ? '' : ' (backup)'}
                        </span>
                      )
                    })}
                  </>
                ) : (
                  <span className="text-xs text-content-muted">No rep assigned</span>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge bg-surface-raised text-content-secondary">{selected.status}</span>
              {(JSON.parse(selected.verticals || '[]') as string[]).map(v => (
                <span key={v} className="badge bg-surface-raised text-content-secondary">{v}</span>
              ))}
              {selected.estimatedAudience && (
                <span className="badge bg-surface-raised text-content-secondary">{selected.estimatedAudience.toLocaleString()} attendees</span>
              )}
              <span className="badge bg-surface-raised text-content-secondary">{selected._count.leads} leads</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Link href={`/conferences/${selected.id}`} className="text-sm text-brand-accent hover:underline">View details →</Link>
              {selected.website && (
                <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-sm text-content-muted hover:text-content-primary hover:underline">
                  Website ↗
                </a>
              )}
              {isManager && (
                <Link href={`/manager/conferences/${selected.id}/edit`} className="text-sm text-content-muted hover:text-content-primary hover:underline">
                  Edit →
                </Link>
              )}
              {isManager && (
                <button
                  onClick={() => openExtract(selected)}
                  className="text-sm text-brand-accent hover:underline font-medium"
                >
                  ✦ Extract Companies →
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Extract Companies modal ─────────────────────────────────────── */}
      {extractConf && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
              <div>
                <h2 className="text-base font-semibold text-content-primary">Find Attending Companies</h2>
                <p className="text-xs text-content-muted mt-0.5">{extractConf.name}</p>
              </div>
              <button onClick={() => setExtractConf(null)} className="text-content-muted hover:text-content-primary text-xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Fallback/override URL input */}
              {(!extractConf.website || extractError) && (
                <div className="space-y-1.5">
                  <p className="text-xs text-content-muted">
                    {!extractConf.website
                      ? 'No website saved for this conference. Paste a sponsors, exhibitors, or speakers page URL.'
                      : 'Try a specific page URL instead:'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="https://conference.com/sponsors"
                      value={fallbackUrl}
                      onChange={e => setFallbackUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && fallbackUrl.trim() && runExtractFor(extractConf.id, fallbackUrl.trim())}
                      autoFocus
                    />
                    <button
                      onClick={() => runExtractFor(extractConf.id, fallbackUrl.trim() || undefined)}
                      disabled={extractLoading || (!extractConf.website && !fallbackUrl.trim())}
                      className="btn-primary text-sm px-4 min-w-[80px]"
                    >
                      {extractLoading ? '…' : 'Scan'}
                    </button>
                  </div>
                </div>
              )}

              {extractLoading && (
                <div className="flex items-center gap-2 text-sm text-content-muted py-4 justify-center">
                  <span className="animate-spin w-4 h-4 border-2 border-brand-navy border-t-transparent rounded-full" />
                  Scanning conference pages with AI…
                </div>
              )}

              {extractError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{extractError}</div>
              )}

              {extractResults && extractResults.length === 0 && (
                <p className="text-sm text-content-muted text-center py-6">No relevant companies found. Try a specific sponsors or exhibitors page URL.</p>
              )}

              {extractResults && extractResults.map(c => {
                const isAdding = addingKeys.has(c.name)
                const isAdded  = addedKeys.has(c.name)
                return (
                  <div key={c.name} className="flex items-start gap-3 p-3 rounded-xl border border-surface-border hover:bg-surface-raised/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-content-primary">{c.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          c.priority === 'HIGH'   ? 'bg-red-100 text-red-700' :
                          c.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-slate-100 text-slate-600'
                        }`}>{c.priority}</span>
                        {c.companyType && <span className="text-xs text-content-muted">{c.companyType}</span>}
                      </div>
                      {(c.contactName || c.contactRole) && (
                        <p className="text-xs text-content-muted mt-0.5">{c.contactName}{c.contactRole ? ` · ${c.contactRole}` : ''}</p>
                      )}
                    </div>
                    <button
                      onClick={() => addTarget(c)}
                      disabled={isAdding || isAdded}
                      className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        isAdded
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                          : isAdding
                            ? 'bg-surface-raised text-content-muted cursor-wait'
                            : 'bg-brand-navy text-white hover:bg-brand-navy/90'
                      }`}
                    >
                      {isAdded ? '✓ Added' : isAdding ? '…' : '+ Add'}
                    </button>
                  </div>
                )
              })}
            </div>

            {extractResults && extractResults.length > 0 && (
              <div className="px-6 py-3 border-t border-surface-border flex items-center justify-between">
                <span className="text-xs text-content-muted">
                  {extractResults.length} companies found · {addedKeys.size} added
                </span>
                <Link href={`/conferences/${extractConf.id}`} className="text-xs text-brand-accent hover:underline">
                  View conference planning →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Discover conferences modal ───────────────────────────────────── */}
      {(discovered !== null || discovering || discoverErr) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
              <div>
                <h2 className="text-base font-semibold text-content-primary">Discover Conferences</h2>
                <p className="text-xs text-content-muted mt-0.5">AI-scanned fintech event sources</p>
              </div>
              <button
                onClick={() => { setDiscovered(null); setDiscoverErr(null) }}
                className="text-content-muted hover:text-content-primary text-xl leading-none"
              >×</button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {discovering && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-content-muted">
                  <span className="animate-spin w-6 h-6 border-2 border-brand-navy border-t-transparent rounded-full" />
                  <span className="text-sm">Scanning fintech event sources with AI…</span>
                </div>
              )}
              {discoverErr && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm space-y-1">
                  <p className="font-medium">Discovery failed</p>
                  <p>{discoverErr}</p>
                  {discoverErr.toLowerCase().includes('api key') && (
                    <a href="/admin/settings" className="underline text-red-600 hover:text-red-800 text-xs">Go to Admin → Settings →</a>
                  )}
                </div>
              )}
              {discovered && discovered.length === 0 && (
                <p className="text-sm text-content-muted text-center py-8">No new conferences found — all known events are already in your calendar.</p>
              )}
              {discovered && discovered.map((c, i) => (
                <div key={i} className="flex items-start justify-between gap-4 p-3 rounded-xl border border-surface-border hover:bg-surface-raised transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-content-primary truncate">{c.name}</p>
                    <p className="text-xs text-content-muted mt-0.5">
                      {c.city}, {c.country} · {new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {c.verticals && c.verticals.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {c.verticals.slice(0, 4).map(v => (
                          <span key={v} className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy font-medium">{v}</span>
                        ))}
                      </div>
                    )}
                    {c.notes && <p className="text-xs text-content-muted mt-1 line-clamp-2">{c.notes}</p>}
                  </div>
                  <button
                    onClick={() => importConference(c, i)}
                    disabled={importing.has(i) || imported.has(i)}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      imported.has(i)
                        ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                        : importing.has(i)
                          ? 'bg-surface-raised text-content-muted cursor-wait'
                          : 'bg-brand-navy text-white hover:bg-brand-navy/90'
                    }`}
                  >
                    {imported.has(i) ? '✓ Added' : importing.has(i) ? 'Adding…' : '+ Add'}
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            {discovered && discovered.length > 0 && (
              <div className="px-6 py-3 border-t border-surface-border flex items-center justify-between">
                <span className="text-xs text-content-muted">{discovered.length} new conference{discovered.length !== 1 ? 's' : ''} found</span>
                <button onClick={runDiscover} disabled={discovering} className="text-xs text-brand-accent hover:underline">Scan again</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
