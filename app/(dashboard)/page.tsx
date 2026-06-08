import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = await db.user.findUnique({ where: { id: session.user.id } })

  const eligibleConferences = await db.conference.findMany({
    where: { status: 'ELIGIBLE' },
    orderBy: { startDate: 'asc' },
    select: { id: true, name: true, city: true, country: true, startDate: true, endDate: true },
  })

  const todayLeads = await db.lead.findMany({
    where: {
      capturedById: session.user.id,
      capturedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
    include: { conferences: { include: { conference: { select: { name: true } } } } },
    orderBy: { capturedAt: 'desc' },
    take: 20,
  })

  const assignments = await db.conferenceAssignment.findMany({
    where: { userId: session.user.id },
    include: { conference: { select: { id: true, name: true, city: true, country: true, startDate: true } } },
    orderBy: { conference: { startDate: 'asc' } },
  })

  const totalLeads = await db.lead.count({ where: { capturedById: session.user.id } })

  return (
    <DashboardClient
      user={{ name: session.user.name, role: session.user.role, currentConferenceId: user?.currentConferenceId }}
      eligibleConferences={eligibleConferences}
      todayLeads={todayLeads}
      assignments={assignments.map(a => a.conference)}
      totalLeads={totalLeads}
    />
  )
}
