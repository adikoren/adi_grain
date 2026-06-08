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
interface Assignment { id: string; userId: string; myFocus: string | null; user: { id: string; name: string; role: string }; role?: string }
interface TargetAccount {
  id: string; company: string; contactName: string | null
  contactRole: string | null; notes: string | null
  priority: string; status: string; createdAt: Date
  website: string | null
  description: string | null
  industry: string | null
  icpFit: string | null
  fxRelevance: string | null
  relevanceReason: string | null
  confidence: string | null
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
  TO_MEET:          'bg-blue-100 text-blue-700',
  REACHED_OUT:      'bg-purple-100 text-purple-700',
  MEETING_PLANNED:  'bg-orange-100 text-orange-700',
  MET:              'bg-emerald-100 text-emerald-700',
  FOLLOW_UP_NEEDED: 'bg-yellow-100 text-yellow-700',
  NOT_RELEVANT:     'bg-slate-100 text-slate-400',
  PASSED:           'bg-slate-100 text-slate-500',
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
                      <p className="text-xs text-content-muted capitalize">{a.user.role?.toLowerCase()}</p>
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
            {!isManager && conference.targetAccounts.length > 0 && (
              <SuggestedLeadsPanel
                targets={conference.targetAccounts}
                conferenceId={conference.id}
                conferenceName={conference.name}
              />
            )}
          </div>
          <div className="space-y-4">
            {isManager && (
              <PlanStatusPanel conference={conference} onRefresh={() => router.refresh()} />
            )}
            {!isManager && (
              <MyFocusPanel
                conferenceId={conference.id}
                assignment={conference.assignments.find(a => a.userId === currentUserId) || null}
                attendingStatus={conference.attendingStatus}
                meetingsScheduled={conference.meetingsScheduled}
                targets={conference.targetAccounts}
              />
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

const ICP_FIT_COLORS: Record<string, string> = {
  HIGH:   'bg-emerald-100 text-emerald-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-slate-100 text-slate-600',
}

// ── Target Accounts Panel ─────────────────────────────────────────────────────
function TargetAccountsPanel({ conferenceId, targets, isManager, onRefresh }: {
  conferenceId: string; targets: TargetAccount[]; isManager: boolean; onRefresh: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState({ company: '', contactName: '', contactRole: '', notes: '', priority: 'MEDIUM' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    website: string; description: string; industry: string
    icpFit: string; fxRelevance: string; relevanceReason: string
    companySize: string; confidence: string
  }>({ website: '', description: '', industry: '', icpFit: '', fxRelevance: '', relevanceReason: '', companySize: '', confidence: '' })
  const [editSaving, setEditSaving] = useState(false)

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

  function startEdit(t: TargetAccount) {
    setEditingId(t.id)
    setEditForm({
      website: t.website || '',
      description: t.description || '',
      industry: t.industry || '',
      icpFit: t.icpFit || '',
      fxRelevance: t.fxRelevance || '',
      relevanceReason: t.relevanceReason || '',
      companySize: t.companySize || '',
      confidence: t.confidence || '',
    })
  }

  async function saveEnrichment(targetId: string) {
    setEditSaving(true)
    await fetch(`/api/conferences/${conferenceId}/targets`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, ...editForm }),
    })
    setEditSaving(false)
    setEditingId(null)
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
            <div key={t.id} className="rounded-lg bg-surface-raised border border-surface-border">
              <div className="flex items-start gap-3 p-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-content-primary">{t.company}</p>
                    <span className={`badge text-xs ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                    {t.icpFit && <span className={`badge text-xs ${ICP_FIT_COLORS[t.icpFit] || 'bg-slate-100 text-slate-600'}`}>ICP Fit: {t.icpFit}</span>}
                    {t.fxRelevance && <span className={`badge text-xs ${ICP_FIT_COLORS[t.fxRelevance] || 'bg-slate-100 text-slate-600'}`}>FX: {t.fxRelevance}</span>}
                  </div>
                  {(t.contactName || t.contactRole) && (
                    <p className="text-xs text-content-muted mt-0.5">
                      {t.contactName}{t.contactRole ? ` · ${t.contactRole}` : ''}
                    </p>
                  )}
                  {t.description && <p className="text-xs text-content-muted mt-0.5 italic">{t.description}</p>}
                  {t.notes && !t.description && <p className="text-xs text-content-muted mt-0.5 italic">{t.notes}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={t.status}
                    onChange={e => updateStatus(t.id, e.target.value)}
                    className="text-xs border border-surface-border rounded-md px-2 py-1 bg-white text-content-secondary focus:outline-none focus:ring-1 focus:ring-brand-accent"
                  >
                    <option value="TO_MEET">To Meet</option>
                    <option value="REACHED_OUT">Reached Out</option>
                    <option value="MEETING_PLANNED">Meeting Planned</option>
                    <option value="MET">Met ✓</option>
                    <option value="FOLLOW_UP_NEEDED">Follow-up Needed</option>
                    <option value="NOT_RELEVANT">Not Relevant</option>
                    <option value="PASSED">Passed</option>
                  </select>
                  {isManager && (
                    <>
                      <button
                        onClick={() => editingId === t.id ? setEditingId(null) : startEdit(t)}
                        className="text-xs text-brand-accent hover:text-brand-navy transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Edit
                      </button>
                      <button onClick={() => deleteTarget(t.id)} className="opacity-0 group-hover:opacity-100 text-content-muted hover:text-red-500 transition-all text-base leading-none">×</button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline edit form for enrichment */}
              {isManager && editingId === t.id && (
                <div className="border-t border-surface-border p-3 bg-surface-raised/50 space-y-3">
                  <p className="text-xs font-semibold text-content-muted uppercase tracking-wide">Enrichment Details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Website</label>
                      <input className="input text-xs" placeholder="https://..." value={editForm.website} onChange={e => setEditForm(p => ({...p, website: e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">Industry</label>
                      <input className="input text-xs" placeholder="Fintech" value={editForm.industry} onChange={e => setEditForm(p => ({...p, industry: e.target.value}))} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea className="input text-xs resize-none" rows={2} placeholder="Company description…" value={editForm.description} onChange={e => setEditForm(p => ({...p, description: e.target.value}))} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label">ICP Fit</label>
                      <select className="input text-xs" value={editForm.icpFit} onChange={e => setEditForm(p => ({...p, icpFit: e.target.value}))}>
                        <option value="">—</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">FX Relevance</label>
                      <select className="input text-xs" value={editForm.fxRelevance} onChange={e => setEditForm(p => ({...p, fxRelevance: e.target.value}))}>
                        <option value="">—</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                        <option value="NONE">None</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Confidence</label>
                      <select className="input text-xs" value={editForm.confidence} onChange={e => setEditForm(p => ({...p, confidence: e.target.value}))}>
                        <option value="">—</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                        <option value="NEEDS_REVIEW">Needs Review</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Company size</label>
                      <input className="input text-xs" placeholder="e.g. 201-500" value={editForm.companySize} onChange={e => setEditForm(p => ({...p, companySize: e.target.value}))} />
                    </div>
                    <div>
                      <label className="label">Relevance reason</label>
                      <input className="input text-xs" placeholder="Why this company…" value={editForm.relevanceReason} onChange={e => setEditForm(p => ({...p, relevanceReason: e.target.value}))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEnrichment(t.id)} disabled={editSaving} className="btn-primary text-xs py-1">{editSaving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1">Cancel</button>
                  </div>
                </div>
              )}
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

// ── My Focus Panel ────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  TO_MEET: 'To meet', REACHED_OUT: 'Reached out', MEETING_PLANNED: 'Meeting planned',
  MET: 'Met', FOLLOW_UP_NEEDED: 'Follow-up needed', NOT_RELEVANT: 'Not relevant', PASSED: 'Passed',
}

function MyFocusPanel({ conferenceId, assignment, attendingStatus, meetingsScheduled, targets }: {
  conferenceId: string
  assignment: Assignment | null
  attendingStatus: string; meetingsScheduled: number
  targets: TargetAccount[]
}) {
  const [focus, setFocus] = useState(assignment?.myFocus || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (focus === (assignment?.myFocus || '')) return
    setSaving(true)
    await fetch(`/api/conferences/${conferenceId}/focus`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myFocus: focus }),
    })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const sorted = [...targets].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return (order[a.priority as keyof typeof order] ?? 3) - (order[b.priority as keyof typeof order] ?? 3)
  })

  return (
    <div className="space-y-4">
      {/* Personal goal textarea */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-content-primary">My Goal</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-content-muted">{meetingsScheduled} meetings booked</span>
            <span className={`badge text-xs ${ATTENDING_COLORS[attendingStatus] ?? 'bg-slate-100 text-slate-500'}`}>
              {attendingStatus === 'ATTENDING' ? '✓ Going' : attendingStatus === 'EVALUATING' ? 'Evaluating' : 'Not going'}
            </span>
          </div>
        </div>
        <textarea
          className="input resize-none w-full text-sm"
          rows={3}
          placeholder="What's your goal? Who do you want to meet? What deals are you trying to close?"
          value={focus}
          onChange={e => setFocus(e.target.value)}
          onBlur={save}
        />
        <p className="text-xs text-content-muted text-right">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Auto-saves on blur'}
        </p>
      </div>

      {/* Target companies */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-content-primary">Focus Companies ({sorted.length})</h3>
          {sorted.map(t => (
            <div key={t.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brand-navy/10 flex items-center justify-center text-xs font-bold text-brand-navy flex-shrink-0">
                    {t.company[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-content-primary">{t.company}</p>
                    {t.description
                      ? <p className="text-xs text-content-secondary mt-0.5 leading-relaxed">{t.description}</p>
                      : t.notes && <p className="text-xs text-content-muted mt-0.5 leading-relaxed">{t.notes}</p>
                    }
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  <span className={`badge text-xs ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                  <span className={`badge text-xs ${TARGET_STATUS[t.status] || 'bg-slate-100 text-slate-500'}`}>{STATUS_LABEL[t.status] || t.status}</span>
                  {t.icpFit && <span className={`badge text-xs ${ICP_FIT_COLORS[t.icpFit] || 'bg-slate-100 text-slate-600'}`}>ICP: {t.icpFit}</span>}
                  {t.fxRelevance && <span className={`badge text-xs ${ICP_FIT_COLORS[t.fxRelevance] || 'bg-slate-100 text-slate-600'}`}>FX: {t.fxRelevance}</span>}
                </div>
              </div>
              {t.relevanceReason && (
                <div className="rounded-lg bg-brand-navy/5 border border-brand-navy/10 px-3 py-2 text-xs text-content-secondary">
                  <span className="font-semibold text-content-primary">Why this matters: </span>{t.relevanceReason}
                </div>
              )}
              {t.contactName && (
                <div className="flex items-center gap-2 bg-surface-raised rounded-lg px-3 py-2 text-xs border border-surface-border">
                  <div className="w-5 h-5 rounded-full bg-brand-navy/10 flex items-center justify-center text-[10px] font-bold text-brand-navy">
                    {t.contactName[0]?.toUpperCase()}
                  </div>
                  <span className="font-medium text-content-primary">{t.contactName}</span>
                  {t.contactRole && <span className="text-content-muted">· {t.contactRole}</span>}
                  <span className="ml-auto text-emerald-600 font-medium">Expected attendee</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 && (
        <div className="card text-center py-8 text-content-muted text-sm">
          No target companies set yet. Ask your manager to add them.
        </div>
      )}
    </div>
  )
}

// ── Suggested Leads Panel ─────────────────────────────────────────────────────
const SUGGESTED_ROLES = [
  'Head of Payments', 'CFO', 'VP Finance',
  'Head of Treasury', 'Partnerships Manager', 'Product Lead',
]

interface CompanyIntel { context: string; icpRelevance: string; followUpAngle: string }

function CompanyCard({ t, conferenceId, conferenceName }: {
  t: TargetAccount; conferenceId: string; conferenceName: string
}) {
  const [intelOpen, setIntelOpen] = useState(false)
  const [intel, setIntel] = useState<CompanyIntel | null>(null)
  const [loadingIntel, setLoadingIntel] = useState(false)
  const [intelError, setIntelError] = useState<'no_key' | 'ai_error' | null>(null)

  const hasStoredIntel = !!(t.description || t.relevanceReason)

  function captureUrl(company: string, jobTitle: string) {
    const p = new URLSearchParams({ company, jobTitle, conferenceId, conferenceName })
    return `/capture?${p.toString()}`
  }

  async function fetchIntel() {
    setLoadingIntel(true)
    setIntelError(null)
    try {
      const res = await fetch('/api/leads/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: t.company, jobTitle: t.contactRole || '', conferenceName, website: t.website }),
      })
      const data = await res.json()
      if (data.suggestions) {
        setIntel(data.suggestions)
      } else {
        setIntelError(data.reason === 'no_key' ? 'no_key' : 'ai_error')
      }
    } catch {
      setIntelError('ai_error')
    } finally {
      setLoadingIntel(false)
    }
  }

  const shownIntel: CompanyIntel | null = intel || (hasStoredIntel ? {
    context: t.description || '',
    icpRelevance: t.relevanceReason || '',
    followUpAngle: '',
  } : null)

  return (
    <div className="space-y-2">
      {/* Company header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-brand-navy/10 flex items-center justify-center text-[10px] font-bold text-brand-navy flex-shrink-0">
          {t.company[0]?.toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-content-primary">{t.company}</span>
        <span className={`badge text-xs ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
        {/* Intel toggle */}
        <button
          type="button"
          onClick={() => {
            if (!intelOpen && !shownIntel && !loadingIntel) fetchIntel()
            setIntelOpen(v => !v)
          }}
          className="text-[11px] font-medium px-2 py-0.5 rounded border border-brand-accent/30 text-brand-accent hover:bg-brand-accent/10 transition-colors"
        >
          {loadingIntel ? '…' : intelOpen ? '▲ Intel' : '✨ Intel'}
        </button>
        <Link
          href={captureUrl(t.company, '')}
          className="ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full border border-brand-navy/30 bg-brand-navy/5 text-brand-navy hover:bg-brand-navy/10 transition-colors flex-shrink-0"
        >
          Add Lead →
        </Link>
      </div>

      {/* Intel panel */}
      {intelOpen && (
        <div className="ml-8 rounded-xl border border-brand-accent/25 bg-brand-accent/5 p-3 space-y-2">
          {loadingIntel && <p className="text-xs text-content-muted">Getting company intelligence…</p>}
          {!loadingIntel && shownIntel && (
            <>
              {shownIntel.context && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted mb-0.5">Company Context</p>
                  <p className="text-xs text-content-secondary leading-relaxed">{shownIntel.context}</p>
                </div>
              )}
              {shownIntel.icpRelevance && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted mb-0.5">Why They Matter</p>
                  <p className="text-xs text-content-secondary leading-relaxed">{shownIntel.icpRelevance}</p>
                </div>
              )}
              {shownIntel.followUpAngle && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted mb-0.5">Follow-up Angle</p>
                  <p className="text-xs text-content-secondary leading-relaxed">{shownIntel.followUpAngle}</p>
                </div>
              )}
            </>
          )}
          {!loadingIntel && !shownIntel && intelError === 'no_key' && (
            <p className="text-xs text-amber-700">AI not configured. Ask your admin to add an API key in Settings.</p>
          )}
          {!loadingIntel && !shownIntel && intelError === 'ai_error' && (
            <p className="text-xs text-content-muted">Could not load intelligence. <button type="button" className="underline" onClick={fetchIntel}>Try again</button></p>
          )}
          {!loadingIntel && !shownIntel && !intelError && (
            <p className="text-xs text-content-muted">No intelligence available. <button type="button" className="underline" onClick={fetchIntel}>Try again</button></p>
          )}
        </div>
      )}

      {/* Known contact as primary chip */}
      {t.contactName && t.contactRole && (
        <Link
          href={captureUrl(t.company, t.contactRole)}
          className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border-2 border-brand-navy/30 bg-brand-navy/5 hover:bg-brand-navy/10 hover:border-brand-navy/50 transition-colors"
        >
          <div className="w-5 h-5 rounded-full bg-brand-navy flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
            {t.contactName[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-navy leading-tight">{t.contactName}</p>
            <p className="text-[10px] text-content-muted leading-tight">{t.contactRole}</p>
          </div>
          <span className="text-[10px] font-medium text-brand-navy flex-shrink-0">Fill form →</span>
        </Link>
      )}

      {/* Generic role chips */}
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTED_ROLES.map(role => (
          <Link key={role} href={captureUrl(t.company, role)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-surface-border bg-white text-content-secondary hover:border-brand-accent/50 hover:text-brand-navy hover:bg-brand-navy/5 transition-colors">
            + {role}
          </Link>
        ))}
      </div>
    </div>
  )
}

function SuggestedLeadsPanel({ targets, conferenceId, conferenceName }: {
  targets: TargetAccount[]; conferenceId: string; conferenceName: string
}) {
  const sorted = [...targets].sort((a, b) => {
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return (order[a.priority as keyof typeof order] ?? 3) - (order[b.priority as keyof typeof order] ?? 3)
  })

  return (
    <div className="card space-y-4">
      <div>
        <h3 className="font-semibold text-sm text-content-primary">Suggested Leads</h3>
        <p className="text-xs text-content-muted mt-0.5">Click a role chip to open Add Lead pre-filled. Use ✨ Intel for company context before approaching.</p>
      </div>
      <div className="space-y-4">
        {sorted.map(t => (
          <CompanyCard key={t.id} t={t} conferenceId={conferenceId} conferenceName={conferenceName} />
        ))}
      </div>
    </div>
  )
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────
function CalIcon()    { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg> }
function PinIcon()    { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function PeopleIcon() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> }
function LinkIcon()   { return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> }
