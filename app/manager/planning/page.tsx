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
      include: { _count: { select: { leads: true } } },
      orderBy: { startDate: 'asc' },
    }),
    db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
    }),
    db.conferenceAssignment.findMany({
      include: { user: { select: { id: true, name: true } } },
    }),
  ])

  return <PlanningClient conferences={conferences} users={users} assignments={assignments} isManager={isManager} />
}
