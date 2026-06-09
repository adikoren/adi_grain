'use client'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpcomingConference {
  id: string; name: string; city: string; country: string
  startDate: string; endDate: string; icpScore: number
  assignments: Array<{ userId: string; role: string; user: { id: string; name: string } }>
  _count: { leads: number; targetAccounts: number }
}

interface TeamMember {
  user: { id: string; name: string }
  upcomingCount: number
  nextConf: { id: string; name: string; startDate: string; city: string } | null
  overloaded: boolean
}

interface HubspotStats { synced: number; needsReview: number; ready: number; failed: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function tier(score: number) { return score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D' }

function fmt(d: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short' })
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function daysLabel(d: string) {
  const n = daysUntil(d)
  if (n <= 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n <= 7) return `${n}d`
  return fmt(d)
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function tierCls(t: string) {
  return t === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
       : t === 'B' ? 'bg-sky-100 text-sky-800 border-sky-200'
       : 'bg-slate-100 text-slate-600 border-slate-200'
}

// ── Alert computation ─────────────────────────────────────────────────────────

type AlertSeverity = 'critical' | 'warning' | 'info'
interface Alert { severity: AlertSeverity; message: string; sub: string; href: string }

function buildAlerts(conferences: UpcomingConference[], hubspot: HubspotStats): Alert[] {
  const alerts: Alert[] = []

  // Tier A conferences with no rep
  const tierAUnassigned = conferences.filter(c => c.icpScore >= 85 && c.assignments.length === 0)
  tierAUnassigned.forEach(c => {
    alerts.push({
      severity: 'critical',
      message: `${c.name} — Tier A, no rep assigned`,
      sub: `${c.city} · ${fmt(c.startDate)}`,
      href: `/conferences/${c.id}`,
    })
  })

  // Any unassigned conferences within 21 days (non-Tier-A, those are already above)
  const urgentUnassigned = conferences.filter(c => {
    const d = daysUntil(c.startDate)
    return c.assignments.length === 0 && d > 0 && d <= 21 && c.icpScore < 85
  })
  urgentUnassigned.forEach(c => {
    alerts.push({
      severity: 'warning',
      message: `${c.name} — ${daysUntil(c.startDate)}d away, no rep`,
      sub: `${tier(c.icpScore)} · ${c.city}`,
      href: `/conferences/${c.id}`,
    })
  })

  // Assigned conferences within 30 days with no target accounts
  const noAccounts = conferences.filter(c => {
    const d = daysUntil(c.startDate)
    return d > 0 && d <= 30 && c.assignments.length > 0 && c._count.targetAccounts === 0
  })
  if (noAccounts.length > 0) {
    alerts.push({
      severity: 'warning',
      message: `${noAccounts.length} upcoming conference${noAccounts.length > 1 ? 's' : ''} with no target accounts`,
      sub: noAccounts.map(c => c.name).join(', ').slice(0, 60),
      href: '/conferences/all',
    })
  }

  // HubSpot: leads needing review
  if (hubspot.needsReview > 0) {
    alerts.push({
      severity: 'warning',
      message: `${hubspot.needsReview} lead${hubspot.needsReview > 1 ? 's' : ''} need${hubspot.needsReview === 1 ? 's' : ''} review`,
      sub: 'Possible duplicates or job changes',
      href: '/manager/hubspot',
    })
  }

  // HubSpot: failed syncs
  if (hubspot.failed > 0) {
    alerts.push({
      severity: 'warning',
      message: `${hubspot.failed} HubSpot sync failure${hubspot.failed > 1 ? 's' : ''}`,
      sub: 'Retry in HubSpot Sync page',
      href: '/manager/hubspot',
    })
  }

  return alerts
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ManagerDashboardClient({
  userName, upcomingConferences, teamSnapshot, hubspot,
}: {
  userName: string
  upcomingConferences: UpcomingConference[]
  teamSnapshot: TeamMember[]
  hubspot: HubspotStats
}) {
  const firstName = userName.split(' ')[0]
  const alerts = buildAlerts(upcomingConferences, hubspot)
  const criticalCount = alerts.filter(a => a.severity === 'critical').length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-content-primary">{greeting()}, {firstName}</h1>
        <p className="text-sm text-content-muted mt-0.5">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── 1. Priority Alerts ──────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-content-primary flex items-center gap-2">
            Priority Alerts
            {alerts.length > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                criticalCount > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {alerts.length}
              </span>
            )}
          </h2>
          <Link href="/manager/planning" className="text-xs text-brand-accent hover:underline">Planning →</Link>
        </div>

        {alerts.length === 0 ? (
          <div className="card flex items-center gap-3 py-4">
            <span className="text-emerald-500 text-xl">✓</span>
            <p className="text-sm text-content-muted">No urgent issues — all clear.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <Link key={i} href={a.href}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 hover:opacity-90 transition-opacity ${
                  a.severity === 'critical'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                <span className={`text-base mt-0.5 flex-shrink-0 ${a.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
                  {a.severity === 'critical' ? '⚠' : '·'}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${a.severity === 'critical' ? 'text-red-800' : 'text-amber-900'}`}>
                    {a.message}
                  </p>
                  {a.sub && <p className={`text-xs mt-0.5 ${a.severity === 'critical' ? 'text-red-600' : 'text-amber-700'}`}>{a.sub}</p>}
                </div>
                <span className="ml-auto text-content-muted text-xs flex-shrink-0">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 2 + 3. Upcoming Coverage + Team Snapshot ────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Upcoming Coverage */}
        <section className="lg:col-span-3 card space-y-0 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-content-primary">Upcoming Coverage</h2>
            <Link href="/conferences" className="text-xs text-brand-accent hover:underline">Calendar →</Link>
          </div>

          {upcomingConferences.length === 0 ? (
            <p className="text-sm text-content-muted p-4 text-center">No upcoming conferences.</p>
          ) : (
            <div className="divide-y divide-surface-border">
              {upcomingConferences.slice(0, 7).map(c => {
                const t = tier(c.icpScore)
                const primary = c.assignments.find(a => a.role === 'PRIMARY') ?? c.assignments[0]
                const unassigned = c.assignments.length === 0
                const days = daysUntil(c.startDate)

                return (
                  <Link key={c.id} href={`/conferences/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-raised/50 transition-colors">
                    {/* Tier accent */}
                    <div className={`w-0.5 h-8 rounded-full flex-shrink-0 ${
                      t === 'A' ? 'bg-emerald-400' : t === 'B' ? 'bg-sky-400' : 'bg-slate-200'
                    }`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-medium text-content-primary truncate">{c.name}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${tierCls(t)}`}>
                          {t} · {Math.round(c.icpScore)}
                        </span>
                        {unassigned && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                            t === 'A' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>
                            No rep
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-content-muted">
                        {c.city}, {c.country} · {fmt(c.startDate)}
                        {primary && (
                          <span className="text-brand-navy font-medium"> · {primary.user.name}</span>
                        )}
                      </p>
                    </div>

                    {/* Days away */}
                    <span className={`text-xs font-medium flex-shrink-0 ${
                      days <= 7 ? 'text-amber-600' : days <= 30 ? 'text-content-secondary' : 'text-content-muted'
                    }`}>
                      {daysLabel(c.startDate)}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Team Snapshot */}
        <section className="lg:col-span-2 card space-y-0 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-content-primary">Team</h2>
            <Link href="/manager/planning" className="text-xs text-brand-accent hover:underline">Planning →</Link>
          </div>

          {teamSnapshot.length === 0 ? (
            <p className="text-sm text-content-muted p-4 text-center">No active sales reps.</p>
          ) : (
            <div className="divide-y divide-surface-border">
              {teamSnapshot.map(({ user, upcomingCount, nextConf, overloaded }) => (
                <div key={user.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-brand-navy/10 border border-brand-navy/20 flex items-center justify-center text-[11px] font-bold text-brand-navy flex-shrink-0">
                        {user.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-content-primary truncate">{user.name}</p>
                          {overloaded && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
                              Overloaded
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-content-muted">
                          {upcomingCount} upcoming
                        </p>
                      </div>
                    </div>
                  </div>
                  {nextConf && (
                    <div className="mt-1.5 ml-9">
                      <Link href={`/conferences/${nextConf.id}`}
                        className="text-xs text-content-secondary hover:text-brand-accent transition-colors truncate block">
                        Next: {nextConf.name} · {nextConf.city}
                      </Link>
                      <p className="text-[11px] text-content-muted mt-0.5">{daysLabel(nextConf.startDate)}</p>
                    </div>
                  )}
                  {!nextConf && (
                    <p className="text-xs text-content-muted mt-1 ml-9 italic">No conferences assigned</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── 4. HubSpot Snapshot ─────────────────────────────────────────────── */}
      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-content-primary">HubSpot Readiness</h2>
          <Link href="/manager/hubspot" className="text-xs text-brand-accent hover:underline">Full sync page →</Link>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Ready to sync', value: hubspot.ready,       cls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
            { label: 'Needs review',  value: hubspot.needsReview, cls: hubspot.needsReview > 0 ? 'text-amber-600' : 'text-content-muted', bg: hubspot.needsReview > 0 ? 'bg-amber-50 border-amber-100' : 'bg-surface-raised border-surface-border' },
            { label: 'Synced',        value: hubspot.synced,      cls: 'text-sky-600',     bg: 'bg-sky-50 border-sky-100' },
            { label: 'Failed',        value: hubspot.failed,      cls: hubspot.failed > 0 ? 'text-red-600' : 'text-content-muted', bg: hubspot.failed > 0 ? 'bg-red-50 border-red-100' : 'bg-surface-raised border-surface-border' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border px-3 py-4 text-center ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-[11px] text-content-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
