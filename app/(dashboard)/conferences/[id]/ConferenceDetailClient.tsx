'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { scoreIcpBadge, scoreBreakdown } from '@/lib/icp-score'

// ── Types ────────────────────────────────────────────────────────────────────
interface Lead {
  id: string; firstName: string; lastName: string
  company: string; jobTitle: string | null; email: string | null
  icpScore: number | null; capturedAt: Date
  hubspotContactId: string | null
  capturedBy: { id: string; name: string }
}
interface Assignment { user: { id: string; name: string; role: string }; role: string }
interface TargetAccount {
  id: string; company: string; contactName: string | null
  contactRole: string | null; notes: string | null
  priority: string; status: string; createdAt: Date
}
interface Conference {
  id: string; name: string; website: string | null
  startDate: Date; endDate: Date; city: string; country: string
  verticals: string; buyerPersonas: string; estimatedAudience: number | null
  icpScore: number; status: string; source: string; notes: string | null
  attendingStatus: string; campaignStatus: string; outboundStatus: string
  meetingsScheduled: number; backupOwner: string | null
  assignments: Assignment[]
  leads: Array<{ lead: Lead }>
  targetAccounts: TargetAccount[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const ATTENDING_OPTS = ['ATTENDING', 'EVALUATING', 'NOT_ATTENDING']
const STATUS_OPTS    = ['NOT_STARTED', 'IN_PROGRESS', 'DONE']
const PRIORITY_COLORS: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-slate-100 text-slate-600',
}
const TARGET_STATUS: Record<string, string> = {
  TO_MEET:      'bg-blue-100 text-blue-700',
  REACHED_OUT:  'bg-purple-100 text-purple-700',
  MET:          'bg-emerald-100 text-emerald-700',
  PASSED:       'bg-slate-100 text-slate-500',
}
const ATTENDING_COLORS: Record<string, string> = {
  ATTENDING:     'bg-emerald-100 text-emerald-700',
  EVALUATING:    'bg-amber-100 text-amber-700',
  NOT_ATTENDING: 'bg-slate-100 text-slate-500',
}

function statusDot(s: string) {
  if (s === 'DONE')        return 'bg-emerald-500'
  if (s === 'IN_PROGRESS') return 'bg-amber-500'
  return 'bg-slate-300'
}

function fmtDate(d: Date, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ConferenceDetailClient({
  conference, isManager, isAssigned, currentUserId, hubspotLogs = [],
}: {
  conference: Conference; isManager: boolean; isAssigned: boolean
  currentUserId: string; hubspotLogs?: any[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'planning' | 'leads' | 'hubspot'>('overview')

  const verticals: string[]    = JSON.parse(conference.verticals || '[]')
  const buyerPersonas: string[] = JSON.parse(conference.buyerPersonas || '[]')
  const badge   = scoreIcpBadge(conference.icpScore)
  const breakdown = scoreBreakdown({ verticals, estimatedAudience: conference.estimatedAudience, country: conference.country, startDate: new Date(conference.startDate) })

  const startDate  = new Date(conference.startDate)
  const endDate    = new Date(conference.endDate)
  const now        = new Date()
  const isPast     = endDate < now
  const isOngoing  = startDate <= now && endDate >= now
  const daysToGo   = Math.ceil((startDate.getTime() - now.getTime()) / 86400000)

  const myLeads = conference.leads.filter(cl => cl.lead.capturedBy.id === currentUserId)
  const displayLeads = isManager ? conference.leads : myLeads

  // Alerts
  const alerts: string[] = []
  if (!conference.assignments.length)  alerts.push('No rep assigned')
  if (!conference.targetAccounts.length && isManager) alerts.push('No target accounts set')
  if (conference.campaignStatus === 'NOT_STARTED' && !isPast && isManager) alerts.push('Campaign not started')
  const unsyncedLeads = conference.leads.filter(cl => !cl.lead.hubspotContactId).length
  if (unsyncedLeads > 0) alerts.push(`${unsyncedLeads} lead${unsyncedLeads > 1 ? 's' : ''} not synced to HubSpot`)

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'planning', label: isManager ? 'Planning' : 'My Focus' },
    { key: 'leads',    label: `Leads (${displayLeads.length})` },
    { key: 'hubspot',  label: 'HubSpot' },
  ] as const

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-5">

      {/* ── Back + Edit ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-content-muted hover:text-content-primary transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Back
        </button>
        {isManager && (
          <Link href={`/manager/conferences/${conference.id}/edit`} className="btn-secondary text-xs py-1.5 px-3">Edit Conference</Link>
        )}
      </div>

      {/* ── Header card ──────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-0">
            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-content-primary">{conference.name}</h1>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
              <span className={`badge ${ATTENDING_COLORS[conference.attendingStatus]}`}>
                {conference.attendingStatus.replace('_', ' ')}
              </span>
              {isOngoing && <span className="badge bg-blue-100 text-blue-700 animate-pulse">Live now</span>}
              {isPast    && <span className="badge bg-slate-100 text-slate-500">Past event</span>}
              {isAssigned && !isManager && <span className="badge bg-brand-navy/10 text-brand-navy">My conference</span>}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-4 text-sm text-content-secondary">
              <span className="flex items-center gap-1.5">
                <CalIcon /> {fmtDate(startDate, { day: 'numeric', month: 'short' })} – {fmtDate(endDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                {!isPast && daysToGo > 0 && <span className="ml-1 text-xs text-content-muted">({daysToGo}d away)</span>}
              </span>
              <span className="flex items-center gap-1.5"><PinIcon /> {conference.city}, {conference.country}</span>
              {conference.estimatedAudience && (
                <span className="flex items-center gap-1.5"><PeopleIcon /> {conference.estimatedAudience.toLocaleString()} attendees</span>
              )}
              {conference.website && (
                <a href={conference.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand-accent hover:underline">
                  <LinkIcon /> Website
                </a>
              )}
            </div>

            {/* Verticals + personas */}
            <div className="flex flex-wrap gap-1.5">
              {verticals.map(v => <span key={v} className="badge bg-blue-50 text-blue-700 text-xs">{v}</span>)}
              {buyerPersonas.map(p => <span key={p} className="badge bg-purple-50 text-purple-700 text-xs">{p}</span>)}
            </div>
          </div>

          {/* Days away counter (upcoming) */}
          {!isPast && daysToGo > 0 && (
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-bold text-content-primary leading-none">{daysToGo}</p>
              <p className="text-xs text-content-muted mt-0.5">days away</p>
            </div>
          )}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-border">
            {alerts.map(a => (
              <span key={a} className="flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-full">
                <span>⚠</span> {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-surface-border">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-brand-navy text-brand-navy'
                : 'border-transparent text-content-muted hover:text-content-primary'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Score breakdown */}
          <div className="lg:col-span-2 space-y-5">
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-content-primary">Score Breakdown</h2>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-content-primary">{conference.icpScore}</span>
                  <span className={`badge ${badge.className}`}>{badge.tier}</span>
                </div>
              </div>
              <div className="space-y-3">
                {breakdown.map(d => (
                  <div key={d.key}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-content-secondary font-medium">{d.label}</span>
                      <span className="text-content-muted">{d.score} / {d.max}</span>
                    </div>
                    <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${d.score / d.max >= 0.8 ? 'bg-emerald-500' : d.score / d.max >= 0.5 ? 'bg-amber-400' : 'bg-slate-300'}`}
                        style={{ width: `${(d.score / d.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {conference.notes && (
                <div className="pt-3 border-t border-surface-border">
                  <p className="text-xs text-content-muted font-semibold uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-content-secondary whitespace-pre-wrap">{conference.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Assigned reps */}
            <div className="card space-y-3">
              <h3 className="font-semibold text-content-primary text-sm">Assigned Reps</h3>
              {conference.assignments.length === 0 ? (
                <p className="text-sm text-content-muted">No reps assigned yet</p>
              ) : (
                conference.assignments.map(a => (
                  <div key={a.user.id} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-navy/10 border border-brand-navy/20 flex items-center justify-center text-[11px] font-bold text-brand-navy flex-shrink-0">
                      {a.user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-content-primary">{a.user.name}</p>
                      <p className="text-xs text-content-muted capitalize">{a.role.toLowerCase()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick stats */}
            <div className="card grid grid-cols-2 gap-3">
              {[
                { label: 'Leads', value: conference.leads.length },
                { label: 'Targets', value: conference.targetAccounts.length },
                { label: 'Meetings', value: conference.meetingsScheduled },
                { label: 'Synced', value: conference.leads.filter(cl => cl.lead.hubspotContactId).length },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-bold text-content-primary">{s.value}</p>
                  <p className="text-xs text-content-muted mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Campaign readiness */}
            <div className="card space-y-2">
              <h3 className="font-semibold text-content-primary text-sm mb-3">Readiness</h3>
              {[
                { label: 'Campaign', value: conference.campaignStatus },
                { label: 'Outbound',  value: conference.outboundStatus },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between text-sm">
                  <span className="text-content-secondary">{r.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${statusDot(r.value)}`} />
                    <span className="text-xs text-content-muted capitalize">{r.value.replace('_', ' ').toLowerCase()}</span>
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm">
                <span className="text-content-secondary">Meetings booked</span>
                <span className="text-xs font-semibold text-content-primary">{conference.meetingsScheduled}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Planning ────────────────────────────────────────── */}
      {tab === 'planning' && (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <TargetAccountsPanel conferenceId={conference.id} targets={conference.targetAccounts} isManager={isManager} onRefresh={() => router.refresh()} />
          </div>
          <div className="space-y-4">
            {isManager && (
              <PlanStatusPanel conference={conference} onRefresh={() => router.refresh()} />
            )}
            {!isManager && (
              <div className="card space-y-3">
                <h3 className="font-semibold text-sm">Your Assignment</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-content-muted">Status</span>
                    <span className={`badge ${ATTENDING_COLORS[conference.attendingStatus]}`}>{conference.attendingStatus.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-content-muted">Meetings booked</span>
                    <span className="font-medium">{conference.meetingsScheduled}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-content-muted">Targets</span>
                    <span className="font-medium">{conference.targetAccounts.length}</span>
                  </div>
                </div>
                <Link href="/capture" className="btn-primary w-full justify-center text-xs py-2 mt-2">
                  + Add Lead
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Leads ───────────────────────────────────────────── */}
      {tab === 'leads' && (
        <LeadsPanel leads={displayLeads} isManager={isManager} conferenceId={conference.id} />
      )}

      {/* ── Tab: HubSpot ─────────────────────────────────────────── */}
      {tab === 'hubspot' && (
        <HubSpotPanel leads={displayLeads} hubspotLogs={hubspotLogs} conferenceId={conference.id} />
      )}
    </div>
  )
}

// ── Target Accounts Panel ─────────────────────────────────────────────────────
function TargetAccountsPanel({ conferenceId, targets, isManager, onRefresh }: {
  conferenceId: string; targets: TargetAccount[]; isManager: boolean; onRefresh: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState({ company: '', contactName: '', contactRole: '', notes: '', priority: 'MEDIUM' })
  const [saving, setSaving] = useState(false)

  async function addTarget() {
    if (!form.company) return
    setSaving(true)
    await fetch(`/api/conferences/${conferenceId}/targets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setForm({ company: '', contactName: '', contactRole: '', notes: '', priority: 'MEDIUM' })
    setAdding(false); setSaving(false); onRefresh()
  }

  async function updateStatus(targetId: string, status: string) {
    await fetch(`/api/conferences/${conferenceId}/targets`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId, status }),
    })
    onRefresh()
  }

  async function deleteTarget(targetId: string) {
    await fetch(`/api/conferences/${conferenceId}/targets`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId }),
    })
    onRefresh()
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-content-primary">Target Accounts & Key People</h2>
        {isManager && (
          <button onClick={() => setAdding(p => !p)} className="btn-primary text-xs py-1.5 px-3">
            + Add Target
          </button>
        )}
      </div>

      {adding && (
        <div className="bg-surface-raised rounded-xl p-4 space-y-3 border border-surface-border">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Company *</label>
              <input className="input" placeholder="Acme Corp" value={form.company} onChange={e => setForm(p => ({...p, company: e.target.value}))} />
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))}>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Contact name</label>
              <input className="input" placeholder="Jane Smith" value={form.contactName} onChange={e => setForm(p => ({...p, contactName: e.target.value}))} />
            </div>
            <div>
              <label className="label">Role</label>
              <input className="input" placeholder="CFO" value={form.contactRole} onChange={e => setForm(p => ({...p, contactRole: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" placeholder="Context, LinkedIn, reason to meet…" value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} />
          </div>
          <div className="flex gap-2">
            <button onClick={addTarget} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Add'}</button>
            <button onClick={() => setAdding(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {targets.length === 0 && !adding ? (
        <p className="text-sm text-content-muted py-4 text-center">No target accounts yet.{isManager ? ' Add companies and key people to meet.' : ''}</p>
      ) : (
        <div className="space-y-2">
          {targets.map(t => (
            <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-raised border border-surface-border group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-content-primary">{t.company}</p>
                  <span className={`badge text-xs ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                </div>
                {(t.contactName || t.contactRole) && (
                  <p className="text-xs text-content-muted mt-0.5">
                    {t.contactName}{t.contactRole ? ` · ${t.contactRole}` : ''}
                  </p>
                )}
                {t.notes && <p className="text-xs text-content-muted mt-0.5 italic">{t.notes}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={t.status}
                  onChange={e => updateStatus(t.id, e.target.value)}
                  className="text-xs border border-surface-border rounded-md px-2 py-1 bg-white text-content-secondary focus:outline-none focus:ring-1 focus:ring-brand-accent"
                >
                  <option value="TO_MEET">To Meet</option>
                  <option value="REACHED_OUT">Reached Out</option>
                  <option value="MET">Met ✓</option>
                  <option value="PASSED">Passed</option>
                </select>
                {isManager && (
                  <button onClick={() => deleteTarget(t.id)} className="opacity-0 group-hover:opacity-100 text-content-muted hover:text-red-500 transition-all text-base leading-none">×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Plan Status Panel (Manager only) ─────────────────────────────────────────
function PlanStatusPanel({ conference, onRefresh }: { conference: Conference; onRefresh: () => void }) {
  const [data, setData] = useState({
    attendingStatus:   conference.attendingStatus,
    campaignStatus:    conference.campaignStatus,
    outboundStatus:    conference.outboundStatus,
    meetingsScheduled: conference.meetingsScheduled,
    backupOwner:       conference.backupOwner || '',
  })

  async function save(patch: Partial<typeof data>) {
    const next = { ...data, ...patch }
    setData(next)
    await fetch(`/api/conferences/${conference.id}/plan`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
    })
    onRefresh()
  }

  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-sm text-content-primary">Pre-event Planning</h3>

      <div>
        <label className="label">Attending status</label>
        <div className="flex gap-1.5">
          {ATTENDING_OPTS.map(o => (
            <button key={o} onClick={() => save({ attendingStatus: o })}
              className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${data.attendingStatus === o ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-content-muted border-surface-border hover:border-brand-navy/40'}`}>
              {o.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Campaign status</label>
        <div className="flex gap-1.5">
          {STATUS_OPTS.map(o => (
            <button key={o} onClick={() => save({ campaignStatus: o })}
              className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${data.campaignStatus === o ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-content-muted border-surface-border hover:border-brand-navy/40'}`}>
              {o.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Outbound status</label>
        <div className="flex gap-1.5">
          {STATUS_OPTS.map(o => (
            <button key={o} onClick={() => save({ outboundStatus: o })}
              className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${data.outboundStatus === o ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-content-muted border-surface-border hover:border-brand-navy/40'}`}>
              {o.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Meetings scheduled</label>
        <input type="number" min="0" className="input w-24" value={data.meetingsScheduled}
          onChange={e => setData(p => ({...p, meetingsScheduled: Number(e.target.value)}))}
          onBlur={() => save({ meetingsScheduled: data.meetingsScheduled })} />
      </div>

      <div>
        <label className="label">Backup owner</label>
        <input className="input" placeholder="Name or email" value={data.backupOwner}
          onChange={e => setData(p => ({...p, backupOwner: e.target.value}))}
          onBlur={() => save({ backupOwner: data.backupOwner })} />
      </div>
    </div>
  )
}

// ── Leads Panel ───────────────────────────────────────────────────────────────
function LeadsPanel({ leads, isManager, conferenceId }: {
  leads: Array<{ lead: Lead }>; isManager: boolean; conferenceId: string
}) {
  const [search, setSearch] = useState('')
  const filtered = leads.filter(({ lead: l }) => {
    const q = search.toLowerCase()
    return !q || [l.firstName, l.lastName, l.company, l.email, l.jobTitle].join(' ').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input className="input max-w-xs" placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)} />
          <span className="text-sm text-content-muted">{filtered.length} lead{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <Link href="/capture" className="btn-primary text-sm">+ Add Lead</Link>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-content-muted">
          {leads.length === 0 ? 'No leads captured yet at this conference.' : 'No leads match your search.'}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-raised">
                {['Name', 'Company', 'Title', 'ICP', ...(isManager ? ['Rep'] : []), 'HubSpot', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ lead: l }) => {
                const score = l.icpScore || 0
                const tClass = score >= 70 ? 'tier-a' : score >= 45 ? 'tier-b' : 'tier-c'
                return (
                  <tr key={l.id} className="table-row">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${l.id}`} className="font-semibold text-brand-navy hover:text-brand-accent transition-colors">
                        {l.firstName} {l.lastName}
                      </Link>
                      {l.email && <p className="text-xs text-content-muted">{l.email}</p>}
                    </td>
                    <td className="px-4 py-3 font-medium text-content-secondary">{l.company}</td>
                    <td className="px-4 py-3 text-content-muted text-xs">{l.jobTitle || '—'}</td>
                    <td className="px-4 py-3"><span className={`badge text-xs ${tClass}`}>{score}</span></td>
                    {isManager && <td className="px-4 py-3 text-content-muted text-xs">{l.capturedBy.name.split(' ')[0]}</td>}
                    <td className="px-4 py-3">
                      {l.hubspotContactId
                        ? <span className="text-xs font-medium text-emerald-600">✓ Synced</span>
                        : <span className="text-xs text-content-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-content-muted">
                      {new Date(l.capturedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── HubSpot Panel ─────────────────────────────────────────────────────────────
function HubSpotPanel({ leads, hubspotLogs, conferenceId }: {
  leads: Array<{ lead: Lead }>; hubspotLogs: any[]; conferenceId: string
}) {
  const synced   = leads.filter(cl => cl.lead.hubspotContactId).length
  const unsynced = leads.length - synced

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-content-primary">{leads.length}</p>
          <p className="text-xs text-content-muted mt-1">Total leads</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-emerald-600">{synced}</p>
          <p className="text-xs text-content-muted mt-1">Synced to HubSpot</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-amber-500">{unsynced}</p>
          <p className="text-xs text-content-muted mt-1">Pending sync</p>
        </div>
      </div>

      {unsynced > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <strong>{unsynced} lead{unsynced > 1 ? 's' : ''}</strong> from this conference not yet in HubSpot.
          Go to <Link href="/manager/hubspot" className="underline font-medium">HubSpot Sync</Link> to push them.
        </div>
      )}

      {hubspotLogs.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border bg-surface-raised">
            <h3 className="font-semibold text-sm text-content-primary">Sync History</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Contact', 'Status', 'HubSpot ID', 'Synced at'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hubspotLogs.slice(0, 20).map((log: any) => {
                let resp: any = {}
                try { resp = JSON.parse(log.response || '{}') } catch {}
                return (
                  <tr key={log.id} className="table-row">
                    <td className="px-4 py-3 font-medium">{log.lead?.firstName} {log.lead?.lastName}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-content-muted font-mono">{resp.id || '—'}</td>
                    <td className="px-4 py-3 text-xs text-content-muted">{new Date(log.syncedAt).toLocaleString('en-GB')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {hubspotLogs.length === 0 && (
        <div className="card text-center py-10 text-content-muted text-sm">No sync history for this conference yet.</div>
      )}
    </div>
  )
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────
function CalIcon()    { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg> }
function PinIcon()    { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function PeopleIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> }
function LinkIcon()   { return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> }
