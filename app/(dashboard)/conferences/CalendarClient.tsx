'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

interface Conference {
  id: string
  name: string
  city: string
  country: string
  startDate: Date
  endDate: Date
  verticals: string
  estimatedAudience: number | null
  icpScore: number
  status: string
  website: string | null
  assignments: Array<{ user: { id: string; name: string } }>
  _count: { leads: number }
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function confColor(isMine: boolean) {
  return isMine ? 'bg-brand-navy text-white font-semibold' : 'bg-slate-200 text-slate-700'
}

function tier(score: number) {
  return score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D'
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isInRange(day: Date, start: Date, end: Date) {
  const d = day.getTime()
  return d >= new Date(start).setHours(0,0,0,0) && d <= new Date(end).setHours(23,59,59,999)
}

export default function ConferenceCalendarClient({ conferences, isManager, myConferenceIds = [] }: { conferences: Conference[]; isManager: boolean; myConferenceIds?: string[] }) {
  const mySet = new Set(myConferenceIds)
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState<Conference | null>(null)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Build calendar grid (Mon-start)
  const days = useMemo(() => {
    const first = new Date(year, month, 1)
    // Sunday-based: 0=Sun … 6=Sat
    const startOffset = first.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (Date | null)[] = Array(startOffset).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])

  // Map conferences to days they span
  const confsByDay = useMemo(() => {
    const map = new Map<string, Conference[]>()
    days.forEach(day => {
      if (!day) return
      const key = day.toDateString()
      const hits = conferences.filter(c => isInRange(day, new Date(c.startDate), new Date(c.endDate)))
      if (hits.length) map.set(key, hits)
    })
    return map
  }, [days, conferences])

  const monthConferences = useMemo(() =>
    conferences.filter(c => {
      const start = new Date(c.startDate)
      return start.getFullYear() === year && start.getMonth() === month
    }),
  [conferences, year, month])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conference Calendar</h1>
          <p className="text-content-muted text-sm mt-0.5">{monthConferences.length} conferences this month</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/conferences/all" className="btn-secondary text-sm">List view</Link>
          {isManager && (
            <Link href="/manager/conferences/new" className="btn-primary text-sm">+ Add</Link>
          )}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="p-2 rounded-md hover:bg-surface-raised transition-colors text-content-muted hover:text-content-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h2 className="text-lg font-semibold w-44 text-center">{MONTHS[month]} {year}</h2>
        <button onClick={nextMonth} className="p-2 rounded-md hover:bg-surface-raised transition-colors text-content-muted hover:text-content-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
          className="ml-2 text-xs text-content-muted hover:text-content-primary px-2 py-1 rounded border border-surface-border hover:border-white/30 transition-colors">
          Today
        </button>
      </div>

      {/* Calendar grid */}
      <div className="card p-0 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-surface-border">
          {DAYS.map(d => (
            <div key={d} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-content-muted text-center">{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div>
          {Array.from({ length: days.length / 7 }, (_, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-surface-border last:border-0">
              {days.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                const isToday = day ? isSameDay(day, today) : false
                const dayConfs = day ? (confsByDay.get(day.toDateString()) || []) : []
                return (
                  <div key={di} className={`min-h-[90px] p-1.5 border-r border-surface-border last:border-0 ${day ? '' : 'bg-surface-raised/30'}`}>
                    {day && (
                      <>
                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                          isToday ? 'bg-brand-accent text-gray-900 font-bold' : 'text-content-muted'
                        }`}>
                          {day.getDate()}
                        </span>
                        <div className="space-y-0.5">
                          {dayConfs.slice(0, 3).map(c => (
                            <button
                              key={c.id}
                              onClick={() => setSelected(selected?.id === c.id ? null : c)}
                              className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate transition-opacity hover:opacity-80 ${confColor(mySet.has(c.id))}`}
                              title={`${tier(c.icpScore)} · ${c.name}`}
                            >
                              <span className="font-bold">{tier(c.icpScore)}</span> {c.name}
                            </button>
                          ))}
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

      {/* Selected conference detail */}
      {selected && (
        <div className={`card border space-y-3 ${mySet.has(selected.id) ? 'border-blue-500/40' : 'border-surface-border'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/conferences/${selected.id}`} className="font-semibold text-lg hover:text-brand-accent transition-colors">{selected.name}</Link>
                {mySet.has(selected.id) && <span className="badge bg-blue-500/20 text-blue-300 text-xs">My conference</span>}
              </div>
              <p className="text-content-muted text-sm">
                {selected.city}, {selected.country} &middot;{' '}
                {new Date(selected.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {' – '}
                {new Date(selected.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="text-content-muted hover:text-content-primary text-lg leading-none">×</button>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="badge bg-surface-raised text-content-secondary">ICP {selected.icpScore}</span>
            <span className="badge bg-surface-raised text-content-secondary">{selected.status}</span>
            {(JSON.parse(selected.verticals || '[]') as string[]).map(v => (
              <span key={v} className="badge bg-surface-raised text-content-secondary">{v}</span>
            ))}
            {selected.estimatedAudience && (
              <span className="text-content-muted">{selected.estimatedAudience.toLocaleString()} attendees</span>
            )}
            <span className="text-content-muted">{selected._count.leads} leads</span>
          </div>
          {selected.assignments.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {selected.assignments.map(a => (
                <span key={a.user.id} className="badge bg-brand-accent/10 text-brand-accent text-xs">{a.user.name}</span>
              ))}
            </div>
          )}
          {selected.website && (
            <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-brand-accent text-sm hover:underline">
              {selected.website} →
            </a>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-content-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-navy inline-block" />My conferences</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200 inline-block" />Other conferences</span>
      </div>
    </div>
  )
}
