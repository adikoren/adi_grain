'use client'
import { useState } from 'react'
import Link from 'next/link'
import { scoreIcpBadge } from '@/lib/icp-score'

export default function LeadsClient({ leads, isManager }: { leads: any[]; isManager: boolean }) {
  const [search, setSearch] = useState('')

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    return !q || [l.firstName, l.lastName, l.company, l.jobTitle, l.email].join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">{isManager ? 'All Leads' : 'My Leads'}</h1>
          <p className="text-sm text-content-muted mt-1">{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/capture" className="btn-primary">+ Add Lead</Link>
      </div>

      <input
        className="input max-w-sm"
        placeholder="Search by name, company, email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              {['Name', 'Company', 'Title', 'Conference', 'ICP', ...(isManager ? ['Rep'] : []), 'HubSpot', 'Date'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map(lead => {
              const badge = scoreIcpBadge(lead.icpScore || 0)
              return (
                <tr key={lead.id} className="hover:bg-surface-raised/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-semibold text-brand-navy hover:text-brand-accent transition-colors">
                      {lead.firstName} {lead.lastName}
                    </Link>
                    {lead.email && <p className="text-xs text-content-muted mt-0.5">{lead.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-content-secondary font-medium">{lead.company}</td>
                  <td className="px-4 py-3 text-content-muted text-xs">{lead.jobTitle || '—'}</td>
                  <td className="px-4 py-3 text-content-muted text-xs">{lead.conferences[0]?.conference?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${badge.className}`}>{badge.label}</span>
                  </td>
                  {isManager && <td className="px-4 py-3 text-content-muted text-xs">{lead.capturedBy?.name || '—'}</td>}
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
                <td colSpan={isManager ? 8 : 7} className="px-4 py-12 text-center text-content-muted">No leads found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
