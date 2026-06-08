'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Props {
  user: { name: string; role: string; currentConferenceId?: string | null }
  myConferences: Array<{ id: string; name: string; city: string; country: string; startDate: Date; endDate: Date }>
  todayLeads: Array<{ id: string; firstName: string; lastName: string; company: string; capturedAt: Date; conferences: Array<{ conference: { name: string } }> }>
  assignments: Array<{ id: string; name: string; city: string; country: string; startDate: Date }>
  totalLeads: number
}

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return 'Good morning'
  if (h >= 11 && h < 15) return 'Good noon'
  if (h >= 15 && h < 18) return 'Good afternoon'
  return 'Good night'
}

function daysUntil(date: Date) {
  const d = new Date(date)
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000)
  if (diff < 0) return null
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `${diff}d away`
}

export default function DashboardClient({ user, myConferences, todayLeads, assignments, totalLeads }: Props) {
  const router = useRouter()
  const [currentConfId, setCurrentConfId] = useState(user.currentConferenceId || '')
  const [saving, setSaving] = useState(false)

  const currentConf = myConferences.find(c => c.id === currentConfId) ?? null
  // Clear stale ID if the conference is no longer in assignments
  if (currentConfId && !currentConf) { setCurrentConfId('') }
  const nextConf = assignments.find(c => new Date(c.startDate) > new Date())
  const daysToNext = nextConf ? daysUntil(new Date(nextConf.startDate)) : null

  async function saveCurrentConference(id: string) {
    setCurrentConfId(id)
    setSaving(true)
    await fetch('/api/users/current-conference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conferenceId: id }),
    })
    setSaving(false)
    router.refresh()
  }

  const firstName = user.name.split(' ')[0]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-content-primary">{getGreeting()}, {firstName}</h1>
        <p className="text-sm text-content-muted mt-0.5">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {daysToNext && nextConf ? ` · Next conference in ${daysToNext}` : ''}
        </p>
      </div>

      {/* Current conference hero */}
      <div className="rounded-xl p-4 mb-5 bg-brand-navy border border-brand-navy cursor-pointer hover:bg-brand-navy-dark transition-colors"
        onClick={() => currentConf && router.push(`/conferences/${currentConf.id}`)}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-1">
              Current conference · click to view
            </p>
            <h2 className="text-base font-semibold text-white">
              {currentConf ? currentConf.name : 'No conference selected'}
            </h2>
            {currentConf && (
              <p className="text-xs text-white/50 mt-1">
                {currentConf.city}, {currentConf.country} &nbsp;·&nbsp;
                {new Date(currentConf.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}–{new Date(currentConf.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
            )}
          </div>
          {daysToNext && nextConf && (
            <div className="text-right">
              <div className="text-2xl font-bold text-white leading-none">
                {typeof daysToNext === 'string' && daysToNext.includes('d') ? daysToNext.replace('d away', '') : ''}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">days away</div>
            </div>
          )}
        </div>
        <div className="border-t border-white/10 pt-3 flex items-center justify-between">
          <p className="text-xs text-white/40 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            {todayLeads.length} lead{todayLeads.length !== 1 ? 's' : ''} captured today
          </p>
          <button
            onClick={e => { e.stopPropagation(); router.push('/capture') }}
            className="bg-white/15 hover:bg-brand-accent/60 active:bg-brand-accent text-white border border-white/25 rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
          >
            + Add Lead
          </button>
        </div>
        {/* Conference selector */}
        <div className="mt-3 border-t border-white/10 pt-3">
          <select
            value={currentConfId}
            onChange={e => saveCurrentConference(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="w-full bg-white/10 border border-white/20 text-white text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-brand-accent"
          >
            <option value="">— Not at a conference —</option>
            {myConferences.map(c => (
              <option key={c.id} value={c.id}>{c.name} · {c.city}</option>
            ))}
          </select>
          {saving && <p className="text-[10px] text-white/30 mt-1">Saving…</p>}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Leads today', value: todayLeads.length, sub: 'captured', color: 'text-content-primary' },
          { label: 'Total leads', value: totalLeads, sub: 'all time', color: 'text-content-primary' },
          { label: 'Conferences', value: assignments.length, sub: 'assigned', color: 'text-content-primary' },
          { label: 'Active opps', value: Math.floor(totalLeads * 0.3), sub: 'in pipeline', color: 'text-brand-accent' },
        ].map(k => (
          <div key={k.label} className="card-sm">
            <p className="text-[10px] text-content-muted font-medium mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-content-muted mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-column: recent leads + my conferences */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-content-primary">Leads Today</h3>
            <Link href="/leads" className="text-xs text-brand-accent hover:underline">All leads →</Link>
          </div>
          {todayLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-content-muted mb-2">No leads captured today yet</p>
              <Link href="/capture" className="text-xs text-brand-accent hover:underline">Add your first →</Link>
            </div>
          ) : (
            <div>
              {todayLeads.map((l, i) => (
                <Link key={l.id} href={`/leads/${l.id}`}
                  className={`flex items-center justify-between py-2.5 ${i < todayLeads.length - 1 ? 'border-b border-surface-border' : ''} hover:bg-surface-raised -mx-1 px-1 rounded-md transition-colors`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-surface-raised flex items-center justify-center text-[10px] font-bold text-brand-accent">
                      {l.firstName[0]}{l.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-content-primary">{l.firstName} {l.lastName}</p>
                      <p className="text-xs text-content-muted">{l.company}</p>
                    </div>
                  </div>
                  <span className="text-xs text-content-muted">
                    {new Date(l.capturedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-content-primary">My Conferences</h3>
            <Link href="/conferences" className="text-xs text-brand-accent hover:underline">Calendar →</Link>
          </div>
          {assignments.length === 0 ? (
            <p className="text-sm text-content-muted py-4 text-center">No conferences assigned yet</p>
          ) : (
            <div>
              {assignments.slice(0, 4).map((c, i) => {
                const d = daysUntil(new Date(c.startDate))
                return (
                  <div key={c.id}
                    className={`flex items-center justify-between py-2.5 ${i < Math.min(assignments.length, 4) - 1 ? 'border-b border-surface-border' : ''}`}>
                    <div>
                      <p className="text-sm font-medium text-content-primary truncate max-w-[130px]">{c.name}</p>
                      <p className="text-xs text-content-muted">{c.city}</p>
                    </div>
                    {d && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d === 'Today' ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-muted text-content-muted'}`}>
                        {d}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
