'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

interface Conference {
  id: string; name: string; city: string; country: string
  startDate: Date; endDate: Date; verticals: string
  estimatedAudience: number | null; icpScore: number
  status: string; attendingStatus: string
  assignments: Array<{ user: { id: string; name: string } }>
  _count: { leads: number }
}

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

export default function ArchiveClient({ conferences, isManager }: { conferences: Conference[]; isManager: boolean }) {
  const [search, setSearch]         = useState('')
  const [region, setRegion]         = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [year, setYear]             = useState('')

  const years = useMemo(() => {
    const ys = new Set(conferences.map(c => new Date(c.startDate).getFullYear().toString()))
    return Array.from(ys).sort((a, b) => Number(b) - Number(a))
  }, [conferences])

  const filtered = useMemo(() => conferences.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.city.toLowerCase().includes(search.toLowerCase())) return false
    if (region && countryToRegion(c.country) !== region) return false
    if (tierFilter && tier(c.icpScore) !== tierFilter) return false
    if (year && new Date(c.startDate).getFullYear().toString() !== year) return false
    return true
  }), [conferences, search, region, tierFilter, year])

  const activeCount = [search, region, tierFilter, year].filter(Boolean).length
  function clear() { setSearch(''); setRegion(''); setTierFilter(''); setYear('') }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/conferences/all" className="text-content-muted hover:text-content-primary text-sm">← Upcoming</Link>
          </div>
          <h1 className="text-2xl font-bold text-content-primary">Conference Archive</h1>
          <p className="text-content-muted text-sm mt-1">{filtered.length} of {conferences.length} past conferences</p>
        </div>
        <Link href="/conferences" className="btn-secondary text-sm">Calendar</Link>
      </div>

      {/* Filters */}
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Search</span>
            <input className="input w-44" placeholder="Name or city…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Year</span>
            <select className="input w-28" value={year} onChange={e => setYear(e.target.value)}>
              <option value="">All years</option>
              {years.map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Region</span>
            <select className="input w-40" value={region} onChange={e => setRegion(e.target.value)}>
              <option value="">All regions</option>
              <option>Europe</option><option>North America</option><option>APAC</option><option>Middle East</option>
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
          {activeCount > 0 && (
            <button onClick={clear} className="text-xs text-brand-accent hover:underline self-end mb-0.5">Clear ({activeCount})</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-raised">
              {['Conference', 'Location', 'Dates', 'Tier', 'Reps', 'Leads'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-surface-raised/50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/conferences/${c.id}`} className="font-medium text-content-primary hover:text-brand-accent transition-colors">
                    {c.name}
                  </Link>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(JSON.parse(c.verticals || '[]') as string[]).slice(0, 2).map(v => (
                      <span key={v} className="badge bg-blue-50 text-blue-700 text-xs">{v}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-content-muted text-xs">{c.city}, {c.country}<br />{countryToRegion(c.country)}</td>
                <td className="px-4 py-3 text-content-muted text-xs whitespace-nowrap">
                  {new Date(c.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge font-bold ${tierCls(c.icpScore)}`}>{tier(c.icpScore)} · {c.icpScore}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {c.assignments.slice(0, 3).map(a => (
                      <div key={a.user.id} title={a.user.name}
                        className="w-6 h-6 rounded-full bg-brand-navy/10 border border-brand-navy/20 flex items-center justify-center text-[10px] font-semibold text-brand-navy">
                        {(a.user.name[0] || '?').toUpperCase()}
                      </div>
                    ))}
                    {c.assignments.length === 0 && <span className="text-content-muted text-xs">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-content-secondary font-medium">{c._count.leads}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-content-muted">
                  No past conferences found.
                  {activeCount > 0 && <button onClick={clear} className="ml-2 text-brand-accent hover:underline text-sm">Clear filters</button>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
