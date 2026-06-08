'use client'
import { useState } from 'react'
import Link from 'next/link'
import { scoreIcpBadge } from '@/lib/icp-score'

export default function ContactsClient({ multiConf, allLeads }: { multiConf: any[]; allLeads: any[] }) {
  const [tab, setTab] = useState<'multi' | 'all'>('multi')
  const [search, setSearch] = useState('')

  const source = tab === 'multi' ? multiConf : allLeads
  const filtered = source.filter(l => {
    const q = search.toLowerCase()
    return !q || [l.firstName, l.lastName, l.company, l.email].join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Cross-Conference Contacts</h1>
        <p className="text-content-muted text-sm mt-1">Track relationships across multiple events</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-raised rounded-lg p-1 w-fit">
        {([['multi', `Repeat contacts (${multiConf.length})`], ['all', `All (${allLeads.length})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === key ? 'bg-white text-content-primary shadow-sm' : 'text-content-muted hover:text-content-primary'}`}>
            {label}
          </button>
        ))}
      </div>

      <input className="input max-w-sm" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />

      <div className="space-y-3">
        {filtered.map(lead => {
          const badge = scoreIcpBadge(lead.icpScore || 0)
          return (
            <div key={lead.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/leads/${lead.id}`} className="font-semibold text-brand-accent hover:underline">
                      {lead.firstName} {lead.lastName}
                    </Link>
                    <span className={`badge text-xs ${badge.className}`}>{badge.label}</span>
                    {lead.conferences.length >= 2 && (
                      <span className="badge bg-brand-accent-alt/20 text-brand-accent-alt text-xs">
                        {lead.conferences.length}× seen
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-content-muted">{lead.jobTitle ? `${lead.jobTitle} · ` : ''}{lead.company}</p>
                  {lead.email && <p className="text-xs text-content-muted">{lead.email}</p>}
                </div>
                <p className="text-xs text-content-muted flex-shrink-0">Rep: {lead.capturedBy?.name || '—'}</p>
              </div>

              {/* Conference timeline */}
              {lead.conferences.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {lead.conferences.map((cl: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-surface-raised rounded text-xs text-content-secondary">
                      <span className="text-content-muted">{new Date(cl.conference.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                      <span>{cl.conference.name}</span>
                      {cl.conference.city && <span className="text-content-muted">· {cl.conference.city}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-content-muted">
            <p className="text-4xl mb-3">👥</p>
            <p>{tab === 'multi' ? 'No contacts seen at multiple conferences yet' : 'No contacts found'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
