'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { scoreIcpBadge, leadTemperature } from '@/lib/icp-score'

const WARMTH_OPTS = ['Qualified', 'Warm', 'Cold'] as const
const WARMTH_CLS: Record<string, string> = {
  Qualified: 'bg-emerald-100 text-emerald-700',
  Warm:      'bg-amber-100 text-amber-700',
  Cold:      'bg-slate-100 text-slate-500',
}

export default function LeadsClient({ leads, isManager }: { leads: any[]; isManager: boolean }) {
  const [search,  setSearch]  = useState('')
  const [warmth,  setWarmth]  = useState('')
  const [hubspot, setHubspot] = useState('')

  const filtered = useMemo(() => leads.filter(l => {
    const q = search.toLowerCase()
    if (q && ![l.firstName, l.lastName, l.company, l.jobTitle, l.email].join(' ').toLowerCase().includes(q)) return false
    if (warmth) {
      const tags: string[] = (() => { try { return JSON.parse(l.tags || '[]') } catch { return [] } })()
      const temp = leadTemperature(tags)
      if (temp !== warmth) return false
    }
    if (hubspot === 'synced'   && !l.hubspotContactId) return false
    if (hubspot === 'unsynced' && l.hubspotContactId)  return false
    return true
  }), [leads, search, warmth, hubspot])

  const activeCount = [search, warmth, hubspot].filter(Boolean).length
  function clear() { setSearch(''); setWarmth(''); setHubspot('') }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">{isManager ? 'All Leads' : 'My Leads'}</h1>
          <p className="text-sm text-content-muted mt-1">{filtered.length} of {leads.length} contacts</p>
        </div>
        <Link href="/capture" className="btn-primary">+ Add Lead</Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Search</span>
          <input className="input w-56" placeholder="Name, company, email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">Warmth</span>
          <select className="input w-36" value={warmth} onChange={e => setWarmth(e.target.value)}>
            <option value="">All warmth</option>
            {WARMTH_OPTS.map(w => <option key={w}>{w}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold text-content-muted uppercase tracking-wide">HubSpot</span>
          <select className="input w-36" value={hubspot} onChange={e => setHubspot(e.target.value)}>
            <option value="">All</option>
            <option value="synced">Synced</option>
            <option value="unsynced">Not synced</option>
          </select>
        </div>
        {activeCount > 0 && (
          <button onClick={clear} className="text-xs text-brand-accent hover:underline self-end mb-0.5">Clear ({activeCount})</button>
        )}
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-raised">
              {['Name', 'Company', 'Title', 'Conference', 'Warmth', 'ICP', ...(isManager ? ['Rep'] : []), 'HubSpot', 'Date'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map(lead => {
              const badge = scoreIcpBadge(lead.icpScore || 0)
              const tags: string[] = (() => { try { return JSON.parse(lead.tags || '[]') } catch { return [] } })()
              const temp = leadTemperature(tags)
              const confCount = lead.conferences?.length ?? 0
              return (
                <tr key={lead.id} className="hover:bg-surface-raised/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-semibold text-brand-navy hover:text-brand-accent transition-colors">
                      {lead.firstName} {lead.lastName}
                    </Link>
                    {lead.email && <p className="text-xs text-content-muted mt-0.5">{lead.email}</p>}
                    {confCount > 1 && (
                      <p className="text-xs text-purple-600 font-medium mt-0.5">↩ Met {confCount}×</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-content-secondary font-medium">{lead.company}</td>
                  <td className="px-4 py-3 text-content-muted text-xs">{lead.jobTitle || '—'}</td>
                  <td className="px-4 py-3 text-content-muted text-xs">
                    {lead.conferences[0]?.conference?.name || '—'}
                    {confCount > 1 && <span className="ml-1 text-purple-500">+{confCount - 1}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${WARMTH_CLS[temp]}`}>{temp}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${badge.className}`}>{badge.label}</span>
                  </td>
                  {isManager && (
                    <td className="px-4 py-3 text-xs">
                      {lead.capturedBy
                        ? <Link href={`/users/${lead.capturedBy.id}`} className="text-brand-accent hover:underline">{lead.capturedBy.name}</Link>
                        : <span className="text-content-muted">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {lead.hubspotContactId
                      ? <span className="text-xs text-emerald-600 font-medium">✓ Synced</span>
                      : <span className="text-xs text-content-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-content-muted text-xs">
                    {new Date(lead.capturedAt).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isManager ? 9 : 8} className="px-4 py-12 text-center text-content-muted">
                  {leads.length === 0 ? 'No leads yet.' : 'No leads match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
