'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

interface Conference {
  id: string; name: string; city: string; country: string
  startDate: Date; endDate: Date; verticals: string; buyerPersonas: string
  estimatedAudience: number | null; icpScore: number
  status: string; attendingStatus: string; website: string | null
  assignments: Array<{ user: { id: string; name: string } }>
  _count: { leads: number }
}

interface Rep { id: string; name: string }

const VERTICALS = ['FINTECH', 'PAYMENTS', 'FX', 'TRAVEL', 'TREASURY', 'SAAS', 'OTHER']
const BUYER_PERSONAS = ['CFO', 'Head of Payments', 'CRO', 'CPO']
const REGIONS: Record<string, string[]> = {
  'Europe':        ['GB','DE','FR','NL','CH','ES','IT','SE','NO','DK','FI','BE','AT','PL','PT','IE','LU','CZ','HU','GR','RO','BG','HR','SK','SI','EE','LV','LT','MT','CY','MC'],
  'North America': ['US','CA','MX'],
  'APAC':          ['SG','JP','AU','HK','CN','IN','TH','KR','MY','NZ','ID','PH','TW','VN'],
  'Middle East':   ['AE','SA','QA','BH','KW','OM','IL','TR','JO','EG'],
}

function countryToRegion(c: string) {
  for (const [region, codes] of Object.entries(REGIONS)) {
    if (codes.includes(c.toUpperCase())) return region
  }
  return 'Other'
}

function tier(score: number) { return score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D' }
function tierCls(score: number) {
  if (score >= 85) return 'bg-emerald-100 text-emerald-700'
  if (score >= 70) return 'bg-amber-100 text-amber-700'
  if (score >= 50) return 'bg-blue-100 text-blue-700'
  return 'bg-slate-100 text-slate-600'
}

const ATTENDING_CLS: Record<string, string> = {
  ATTENDING:     'bg-emerald-100 text-emerald-700',
  EVALUATING:    'bg-amber-100 text-amber-700',
  NOT_ATTENDING: 'bg-slate-100 text-slate-400',
  ATTENDED:      'bg-slate-100 text-slate-500',
}


export default function ConferencesClient({
  conferences, isManager, myConferenceIds = [], reps = [],
}: {
  conferences: Conference[]; isManager: boolean; myConferenceIds?: string[]; reps?: Rep[]
}) {
  const mySet = new Set(myConferenceIds)
  const [search, setSearch]           = useState('')

  // Extract companies state
  const [extractConf,    setExtractConf]    = useState<{id: string; name: string; website: string | null} | null>(null)
  const [fallbackUrl,    setFallbackUrl]    = useState('')
  const [extractLoading, setExtractLoading] = useState(false)
  const [extractResults, setExtractResults] = useState<Array<{
    name: string; website: string | null; contactName: string | null
    contactRole: string | null; priority: string; companyType: string | null; source: string
  }> | null>(null)
  const [extractError,   setExtractError]   = useState<string | null>(null)
  const [addingKeys,     setAddingKeys]     = useState<Set<string>>(new Set())
  const [addedKeys,      setAddedKeys]      = useState<Set<string>>(new Set())

  async function openExtract(conf: {id: string; name: string; website: string | null}) {
    setExtractConf(conf)
    setFallbackUrl(''); setExtractResults(null); setExtractError(null)
    setAddingKeys(new Set()); setAddedKeys(new Set())
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
  const [region, setRegion]           = useState('')
  const [vertical, setVertical]       = useState('')
  const [persona, setPersona]         = useState('')
  const [tierFilter, setTierFilter]   = useState('')
  const [repId, setRepId]             = useState('')
  const [attending, setAttending]     = useState('')

  const filtered = useMemo(() => conferences.filter(c => {
    const verts: string[]   = JSON.parse(c.verticals || '[]')
    const personas: string[] = JSON.parse(c.buyerPersonas || '[]')
    const t = tier(c.icpScore)
    const r = countryToRegion(c.country)
    if (search    && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return false
    if (region    && r !== region) return false
    if (vertical  && !verts.includes(vertical)) return false
    if (persona   && !personas.includes(persona)) return false
    if (tierFilter && t !== tierFilter) return false
    if (repId     && !c.assignments.some(a => a.user.id === repId)) return false
    if (attending && c.attendingStatus !== attending) return false
    return true
  }), [conferences, search, region, vertical, persona, tierFilter, repId, attending])

  const activeCount = [search, region, vertical, persona, tierFilter, repId, attending].filter(Boolean).length
  function clear() { setSearch(''); setRegion(''); setVertical(''); setPersona(''); setTierFilter(''); setRepId(''); setAttending('') }


  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Conferences</h1>
          <p className="text-content-muted text-sm mt-1">{filtered.length} of {conferences.length} upcoming · sorted by date</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/conferences/archive" className="btn-secondary text-sm">Archive</Link>
          <Link href="/conferences" className="btn-secondary text-sm">Calendar</Link>
          {isManager && (
            <Link href="/manager/conferences/new" className="btn-primary">+ Add Conference</Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Search</span>
            <input className="input w-44" placeholder="Name or city…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Region</span>
            <select className="input w-40" value={region} onChange={e => setRegion(e.target.value)}>
              <option value="">All regions</option>
              <option>Europe</option><option>North America</option><option>APAC</option><option>Middle East</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Vertical</span>
            <select className="input w-36" value={vertical} onChange={e => setVertical(e.target.value)}>
              <option value="">All verticals</option>
              {VERTICALS.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Buyer Persona</span>
            <select className="input w-44" value={persona} onChange={e => setPersona(e.target.value)}>
              <option value="">All personas</option>
              {BUYER_PERSONAS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Tier</span>
            <select className="input w-24" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
              <option value="">All tiers</option>
              <option value="A">A — Top</option>
              <option value="B">B — Strong</option>
              <option value="C">C — Moderate</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Status</span>
            <select className="input w-36" value={attending} onChange={e => setAttending(e.target.value)}>
              <option value="">All statuses</option>
              <option value="ATTENDING">Attending</option>
              <option value="EVALUATING">Evaluating</option>
              <option value="NOT_ATTENDING">Not attending</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Rep</span>
            <select className="input w-44" value={repId} onChange={e => setRepId(e.target.value)}>
              <option value="">All reps</option>
              {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {activeCount > 0 && (
            <button onClick={clear} className="text-xs text-brand-accent hover:underline mb-0.5 self-end">Clear ({activeCount})</button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => {
          const verts: string[]    = JSON.parse(c.verticals || '[]')
          const personas: string[] = JSON.parse(c.buyerPersonas || '[]')
          const isMine = mySet.has(c.id)
          const t      = tier(c.icpScore)
          const daysAway = Math.ceil((new Date(c.startDate).getTime() - Date.now()) / 86400000)
          const unassigned = c.assignments.length === 0

          return (
            <Link key={c.id} href={`/conferences/${c.id}`}
              className={`card flex flex-col gap-3 hover:shadow-md hover:border-brand-accent/40 transition-all cursor-pointer group no-underline ${isMine ? 'border-l-[3px] border-l-brand-navy' : ''}`}>

              {/* Name + tier */}
              <div className="flex items-start justify-between gap-2">
                <h3 className={`font-semibold text-sm leading-snug group-hover:text-brand-accent transition-colors ${isMine ? 'text-brand-navy' : 'text-content-primary'}`}>
                  {c.name}
                </h3>
                <span className={`badge shrink-0 font-bold ${tierCls(c.icpScore)}`}>{t} · {c.icpScore}</span>
              </div>

              {/* Location + dates */}
              <p className="text-xs text-content-muted -mt-1">
                {c.city}, {c.country} · {countryToRegion(c.country)} ·{' '}
                {new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–{new Date(c.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                {daysAway > 0 && <span className="ml-1 text-content-muted/60">({daysAway}d)</span>}
              </p>

              {/* Verticals */}
              {verts.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {verts.slice(0, 3).map(v => <span key={v} className="badge bg-blue-50 text-blue-700 text-xs">{v}</span>)}
                  {verts.length > 3 && <span className="text-xs text-content-muted self-center">+{verts.length - 3}</span>}
                </div>
              )}

              {/* Buyer personas */}
              {personas.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {personas.map(p => <span key={p} className="badge bg-purple-50 text-purple-700 text-xs">{p}</span>)}
                </div>
              )}

              {/* Bottom row */}
              <div className="flex items-center justify-between pt-2 border-t border-surface-border mt-auto">
                <div className="flex items-center gap-1.5">
                  {c.assignments.slice(0, 4).map(a => (
                    <div key={a.user.id} title={a.user.name}
                      className="w-6 h-6 rounded-full bg-brand-navy/10 border border-brand-navy/20 flex items-center justify-center text-[10px] font-semibold text-brand-navy">
                      {(a.user.name[0] || '?').toUpperCase()}
                    </div>
                  ))}
                  {unassigned && (
                    <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      <span>⚠</span> No rep
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {c._count.leads > 0 && <span className="text-xs text-content-muted">{c._count.leads} leads</span>}
                  <span className={`badge text-xs ${ATTENDING_CLS[c.attendingStatus] ?? 'bg-slate-100 text-slate-500'}`}>
                    {c.attendingStatus === 'ATTENDING' ? '✓ Going' : c.attendingStatus === 'EVALUATING' ? 'Evaluating' : 'Not going'}
                  </span>
                  {isManager && (
                    <button onClick={e => { e.preventDefault(); e.stopPropagation(); openExtract({id: c.id, name: c.name, website: c.website}) }}
                      className="text-xs text-brand-accent hover:text-brand-navy px-1.5 py-0.5 rounded hover:bg-surface-raised transition-colors font-medium">
                      ✦ Extract
                    </button>
                  )}
                  {isManager && (
                    <Link href={`/manager/conferences/${c.id}/edit`} onClick={e => e.stopPropagation()}
                      className="text-xs text-content-muted hover:text-brand-navy px-1.5 py-0.5 rounded hover:bg-surface-raised transition-colors">
                      Edit
                    </Link>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-content-muted">
          <p className="text-3xl mb-3">📅</p>
          <p>No upcoming conferences match your filters.</p>
          {activeCount > 0 && <button onClick={clear} className="mt-2 text-sm text-brand-accent hover:underline">Clear all filters</button>}
        </div>
      )}

      {/* Extract Companies modal */}
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
              {(!extractConf.website || extractError) && (
                <div className="space-y-1.5">
                  <p className="text-xs text-content-muted">
                    {!extractConf.website ? 'No website saved for this conference. Paste a sponsors, exhibitors, or speakers URL.' : 'Try a specific page URL instead:'}
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
                <p className="text-sm text-content-muted text-center py-6">No relevant companies found. Try a specific sponsors or exhibitors URL.</p>
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
                        isAdded   ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default' :
                        isAdding  ? 'bg-surface-raised text-content-muted cursor-wait' :
                                    'bg-brand-navy text-white hover:bg-brand-navy/90'
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
                <span className="text-xs text-content-muted">{extractResults.length} companies found · {addedKeys.size} added</span>
                <Link href={`/conferences/${extractConf.id}`} className="text-xs text-brand-accent hover:underline">
                  View conference planning →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
