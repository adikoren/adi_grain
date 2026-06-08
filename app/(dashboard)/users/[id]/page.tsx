import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { scoreIcpBadge } from '@/lib/icp-score'

export default async function UserProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const isManager = session && ['ADMIN', 'MANAGER'].includes(session.user.role)
  // Reps can only view their own profile
  if (!isManager && session?.user.id !== params.id) notFound()

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
      assignments: {
        include: { conference: { select: { id: true, name: true, city: true, country: true, startDate: true, endDate: true, icpScore: true } } },
        orderBy: { assignedAt: 'desc' },
        take: 20,
      },
      capturedLeads: {
        select: { id: true, firstName: true, lastName: true, company: true, jobTitle: true, icpScore: true, capturedAt: true },
        orderBy: { capturedAt: 'desc' },
        take: 10,
      },
      _count: { select: { capturedLeads: true, assignments: true } },
    },
  })

  if (!user) notFound()

  const now = new Date()
  const upcoming = user.assignments.filter(a => new Date(a.conference.endDate) >= now)
  const past = user.assignments.filter(a => new Date(a.conference.endDate) < now)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-brand-navy/10 border-2 border-brand-navy/20 flex items-center justify-center text-2xl font-bold text-brand-navy flex-shrink-0">
          {user.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-content-primary">{user.name}</h1>
          <p className="text-content-muted text-sm capitalize">{user.role.toLowerCase().replace('_', ' ')} · {user.email}</p>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-content-primary">{user._count.capturedLeads}</p>
            <p className="text-xs text-content-muted">Leads</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-brand-accent">{user._count.assignments}</p>
            <p className="text-xs text-content-muted">Conferences</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming conferences */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-content-primary">Upcoming Conferences ({upcoming.length})</h2>
          {upcoming.length === 0 && <p className="text-sm text-content-muted">No upcoming conferences assigned.</p>}
          {upcoming.map(a => {
            const badge = scoreIcpBadge(a.conference.icpScore || 0)
            return (
              <Link key={a.id} href={`/conferences/${a.conference.id}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-surface-border hover:border-brand-accent/30 transition-colors">
                <span className={`badge text-xs mt-0.5 flex-shrink-0 ${badge.className}`}>{badge.label}</span>
                <div>
                  <p className="text-sm font-medium text-content-primary">{a.conference.name}</p>
                  <p className="text-xs text-content-muted">{a.conference.city} · {new Date(a.conference.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Recent leads */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-content-primary">Recent Leads</h2>
          {user.capturedLeads.length === 0 && <p className="text-sm text-content-muted">No leads captured yet.</p>}
          {user.capturedLeads.map(lead => {
            const badge = scoreIcpBadge(lead.icpScore || 0)
            return (
              <Link key={lead.id} href={`/leads/${lead.id}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-surface-border hover:border-brand-accent/30 transition-colors">
                <span className={`badge text-xs mt-0.5 flex-shrink-0 ${badge.className}`}>{badge.label}</span>
                <div>
                  <p className="text-sm font-medium text-content-primary">{lead.firstName} {lead.lastName}</p>
                  <p className="text-xs text-content-muted">{lead.company} · {lead.jobTitle || '—'}</p>
                </div>
              </Link>
            )
          })}
          {user._count.capturedLeads > 10 && (
            <p className="text-xs text-content-muted">+{user._count.capturedLeads - 10} more leads</p>
          )}
        </div>
      </div>

      {/* Past conferences */}
      {past.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-content-primary">Past Conferences ({past.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {past.map(a => {
              const badge = scoreIcpBadge(a.conference.icpScore || 0)
              return (
                <Link key={a.id} href={`/conferences/${a.conference.id}`}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-surface-border hover:border-brand-accent/30 transition-colors">
                  <span className={`badge text-xs flex-shrink-0 ${badge.className}`}>{badge.label}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-content-secondary truncate">{a.conference.name}</p>
                    <p className="text-xs text-content-muted">{new Date(a.conference.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/leads" className="btn-secondary text-sm">← All Leads</Link>
      </div>
    </div>
  )
}
