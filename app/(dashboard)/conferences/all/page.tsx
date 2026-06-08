import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ConferencesClient from '../ConferencesClient'

export default async function AllConferencesPage() {
  const session = await getServerSession(authOptions)
  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'

  const [conferences, myAssignments, reps] = await Promise.all([
    db.conference.findMany({
      where: { endDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
        _count: { select: { leads: true } },
      },
    }),
    db.conferenceAssignment.findMany({
      where: { userId: session?.user?.id },
      select: { conferenceId: true },
    }),
    db.user.findMany({
      where: { isActive: true, role: { in: ['SALES_PERSON', 'MANAGER'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const myConferenceIds = myAssignments.map(a => a.conferenceId)

  return (
    <ConferencesClient
      conferences={conferences}
      isManager={isManager}
      myConferenceIds={myConferenceIds}
      reps={reps}
    />
  )
}
