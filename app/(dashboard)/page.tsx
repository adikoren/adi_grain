import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import ManagerDashboardClient from './ManagerDashboardClient'

function isOverloaded(confs: Array<{ startDate: Date | string }>): boolean {
  for (let i = 0; i < confs.length; i++) {
    const t0 = new Date(confs[i].startDate).getTime()
    const count = confs.filter(c => {
      const d = new Date(c.startDate).getTime()
      return d >= t0 && d - t0 <= 30 * 86400000
    }).length
    if (count >= 4) return true
  }
  return false
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const isManager = session.user.role === 'MANAGER' || session.user.role === 'ADMIN'
  const now = new Date()

  // ── Manager / Admin dashboard ─────────────────────────────────────────────
  if (isManager) {
    const [upcomingConferences, repsWithAssignments, syncedCount, needsReviewCount, readyCount, failedCount] = await Promise.all([
      db.conference.findMany({
        where: { endDate: { gte: now } },
        include: {
          assignments: { select: { userId: true, role: true, user: { select: { id: true, name: true } } } },
          _count: { select: { leads: true, targetAccounts: true } },
        },
        orderBy: { startDate: 'asc' },
        take: 50,
      }),
      db.user.findMany({
        where: { isActive: true, role: 'SALES_PERSON' },
        include: {
          assignments: {
            where: { conference: { endDate: { gte: now } } },
            include: { conference: { select: { id: true, name: true, startDate: true, city: true } } },
            orderBy: { conference: { startDate: 'asc' } },
          },
        },
        orderBy: { name: 'asc' },
      }),
      db.lead.count({ where: { hubspotContactId: { not: null } } }),
      db.lead.count({ where: { tags: { contains: 'NEEDS_REVIEW' }, hubspotContactId: null } }),
      db.lead.count({
        where: {
          email: { not: null },
          icpScore: { not: null },
          hubspotContactId: null,
          NOT: { tags: { contains: 'NEEDS_REVIEW' } },
          syncLogs: { none: { status: 'FAILED' } },
        },
      }),
      db.lead.count({ where: { hubspotContactId: null, syncLogs: { some: { status: 'FAILED' } } } }),
    ])

    const teamSnapshot = repsWithAssignments.map(rep => {
      const confs = rep.assignments.map(a => a.conference)
      return {
        user: { id: rep.id, name: rep.name },
        upcomingCount: confs.length,
        nextConf: confs[0]
          ? { id: confs[0].id, name: confs[0].name, startDate: confs[0].startDate.toISOString(), city: confs[0].city }
          : null,
        overloaded: isOverloaded(confs),
      }
    })

    return (
      <ManagerDashboardClient
        userName={session.user.name}
        upcomingConferences={upcomingConferences as any}
        teamSnapshot={teamSnapshot}
        hubspot={{ synced: syncedCount, needsReview: needsReviewCount, ready: readyCount, failed: failedCount }}
      />
    )
  }

  // ── Sales rep dashboard (unchanged) ──────────────────────────────────────
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0))

  const [recentLeads, todayLeadsCount, assignments, totalLeads] = await Promise.all([
    db.lead.findMany({
      where: { capturedById: session.user.id },
      include: { conferences: { include: { conference: { select: { name: true } } } } },
      orderBy: { capturedAt: 'desc' },
      take: 5,
    }),
    db.lead.count({
      where: { capturedById: session.user.id, capturedAt: { gte: todayStart } },
    }),
    db.conferenceAssignment.findMany({
      where: { userId: session.user.id, conference: { endDate: { gte: now } } },
      include: { conference: { select: { id: true, name: true, city: true, country: true, startDate: true, endDate: true } } },
      orderBy: { conference: { startDate: 'asc' } },
    }),
    db.lead.count({ where: { capturedById: session.user.id } }),
  ])

  return (
    <DashboardClient
      user={{ name: session.user.name, role: session.user.role, currentConferenceId: user?.currentConferenceId }}
      myConferences={assignments.map(a => a.conference)}
      recentLeads={recentLeads}
      todayLeadsCount={todayLeadsCount}
      totalLeads={totalLeads}
    />
  )
}
