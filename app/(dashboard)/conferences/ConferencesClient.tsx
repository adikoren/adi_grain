'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

interface Conference {
  id: string; name: string; city: string; country: string
  startDate: Date; endDate: Date; verticals: string; buyerPersonas: string
  estimatedAudience: number | null; icpScore: number
  status: string; source: string; website: string | null
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
function statusCls(s: string) {
  if (s === 'ELIGIBLE') return 'bg-emerald-100 text-emerald-700'
  if (s === 'DRAFT') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-500'
}

export default function ConferencesClient({
  conferences, isManager, myConferenceIds = [], reps = [],
}: {
  conferences: Conference[]; isManager: boolean; myConferenceIds?: string[]; reps?: Rep[]
}) {
  const mySet = new Set(myConferenceIds)

  const [search, setSearch]         = useState('')
  const [region, setRegion]         = useState('')
  const [vertical, setVertical]     = useState('')
  const [persona, setPersona]       = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [repId, setRepId]           = useState('')

  const filtered = useMemo(() => {
    return conferences.filter(c => {
      const verts: string[]   = JSON.parse(c.verticals || '[]')
      const personas: string[] = JSON.parse(c.buyerPersonas || '[]')
      const t = tier(c.icpScore)
      const r = countryToRegion(c.country)

      if (search   && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return false
      if (region   && r !== region) return false
      if (vertical && !verts.includes(vertical)) return false
      if (persona  && !personas.includes(persona)) return false
      if (tierFilter && t !== tierFilter) return false
      if (repId    && !c.assignments.some(a => a.user.id === repId)) return false
      return true
    })
  }, [conferences, search, region, vertical, persona, tierFilter, repId])

  const activeCount = [search, region, vertical, persona, tierFilter, repId].filter(Boolean).length

  function clear() { setSearch(''); setRegion(''); setVertical(''); setPersona(''); setTierFilter(''); setRepId('') }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">All Conferences</h1>
          <p className="text-content-muted text-sm mt-1">{filtered.length} of {conferences.length} conferences</p>
        </div>
        {isManager && (
          <Link href="/manager/conferences/new" className="btn-primary">+ Add Conference</Link>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap gap-2 items-end">
          {/* Search */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Search</span>
            <input className="input w-44" placeholder="Name or city…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Region */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Region</span>
            <select className="input w-40" value={region} onChange={e => setRegion(e.target.value)}>
              <option value="">All regions</option>
              <option>Europe</option>
              <option>North America</option>
              <option>APAC</option>
              <option>Middle East</option>
            </select>
          </div>

          {/* Vertical */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Vertical</span>
            <select className="input w-36" value={vertical} onChange={e => setVertical(e.target.value)}>
              <option value="">All verticals</option>
              {VERTICALS.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          {/* Buyer Persona */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Buyer Persona</span>
            <select className="input w-44" value={persona} onChange={e => setPersona(e.target.value)}>
              <option value="">All personas</option>
              {BUYER_PERSONAS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {/* Tier */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Tier</span>
            <select className="input w-24" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
              <option value="">All tiers</option>
              <option value="A">A — Top</option>
              <option value="B">B — Strong</option>
              <option value="C">C — Moderate</option>
            </select>
          </div>

          {/* Salesperson */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Salesperson</span>
            <select className="input w-44" value={repId} onChange={e => setRepId(e.target.value)}>
              <option value="">All salespeople</option>
              {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          {activeCount > 0 && (
            <button onClick={clear} className="text-xs text-brand-accent hover:underline mb-0.5 self-end">
              Clear ({activeCount})
            </button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(c => {
          const verts: string[]   = JSON.parse(c.verticals || '[]')
          const personas: string[] = JSON.parse(c.buyerPersonas || '[]')
          const isMine = mySet.has(c.id)
          const t = tier(c.icpScore)
          return (
            <Link
              key={c.id}
              href={`/conferences/${c.id}`}
              className={`card flex flex-col gap-3 hover:shadow-md hover:border-brand-accent/40 transition-all cursor-pointer group no-underline ${isMine ? 'border-l-[3px] border-l-brand-navy' : ''}`}
            >
              {/* Name + ICP tier */}
              <div className="flex items-start justify-between gap-2">
                <h3 className={`font-semibold text-sm leading-snug group-hover:text-brand-accent transition-colors ${isMine ? 'text-brand-navy' : 'text-content-primary'}`}>
                  {c.name}
                </h3>
                <span className={`badge shrink-0 ${tierCls(c.icpScore)}`}>{t}·{c.icpScore}</span>
              </div>

              {/* Location + dates */}
              <p className="text-xs text-content-muted -mt-1">
                {c.city}, {c.country} &middot; {countryToRegion(c.country)} &middot;{' '}
                {new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–{new Date(c.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
              </p>

              {/* Verticals */}
              {verts.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {verts.slice(0, 3).map(v => (
                    <span key={v} className="badge bg-blue-50 text-blue-700 text-xs">{v}</span>
                  ))}
                  {verts.length > 3 && <span className="text-xs text-content-muted self-center">+{verts.length - 3}</span>}
                </div>
              )}

              {/* Buyer personas */}
              {personas.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {personas.map(p => (
                    <span key={p} className="badge bg-purple-50 text-purple-700 text-xs">{p}</span>
                  ))}
                </div>
              )}

              {/* Bottom row */}
              <div className="flex items-center justify-between pt-2 border-t border-surface-border mt-auto">
                <div className="flex items-center gap-1">
                  {c.assignments.slice(0, 4).map(a => (
                    <div key={a.user.id} title={a.user.name}
                      className="w-6 h-6 rounded-full bg-brand-navy/10 border border-brand-navy/20 flex items-center justify-center text-[10px] font-semibold text-brand-navy">
                      {a.user.name[0].toUpperCase()}
                    </div>
                  ))}
                  {c.assignments.length === 0 && <span className="text-xs text-content-muted">Unassigned</span>}
                </div>
                <div className="flex items-center gap-2">
                  {c._count.leads > 0 && <span className="text-xs text-content-muted">{c._count.leads} leads</span>}
                  <span className={`badge text-xs ${statusCls(c.status)}`}>{c.status}</span>
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
          <p className="text-3xl mb-3">🏢</p>
          <p>No conferences match your filters.</p>
          {activeCount > 0 && <button onClick={clear} className="mt-2 text-sm text-brand-accent hover:underline">Clear all filters</button>}
        </div>
      )}
    </div>
  )
}
