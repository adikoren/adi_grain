import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ConferenceCalendarClient from './CalendarClient'

export default async function ConferencesCalendarPage() {
  const session = await getServerSession(authOptions)
  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'

  const [conferences, myAssignments] = await Promise.all([
    db.conference.findMany({
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
  ])

  const myConferenceIds = new Set(myAssignments.map(a => a.conferenceId))

  return (
    <ConferenceCalendarClient
      conferences={conferences}
      isManager={isManager}
      myConferenceIds={Array.from(myConferenceIds)}
    />
  )
}
