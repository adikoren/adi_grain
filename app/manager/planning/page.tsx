import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import PlanningClient from './PlanningClient'

export default async function PlanningPage() {
  const session = await getServerSession(authOptions)
  const isManager = ['ADMIN', 'MANAGER'].includes(session!.user.role)

  const now = new Date()
  const [conferences, users, assignments] = await Promise.all([
    db.conference.findMany({
      where: { endDate: { gte: now } },
      include: { _count: { select: { leads: true, targetAccounts: true } } },
      orderBy: { startDate: 'asc' },
    }),
    db.user.findMany({
      where: { isActive: true, role: { in: ['SALES_PERSON', 'MANAGER', 'ADMIN'] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
    db.conferenceAssignment.findMany({
      where: { conference: { endDate: { gte: now } } },
      include: { user: { select: { id: true, name: true, role: true } } },
    }),
  ])

  return (
    <PlanningClient
      conferences={conferences as any}
      users={users}
      assignments={assignments as any}
      isManager={isManager}
    />
  )
}
