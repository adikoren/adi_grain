import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ConferenceCalendarClient from './CalendarClient'

export default async function ConferencesCalendarPage() {
  const session = await getServerSession(authOptions)
  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'

  const [conferences, myAssignments, reps] = await Promise.all([
    db.conference.findMany({
      orderBy: { startDate: 'asc' },
      include: {
        assignments: {
          select: { userId: true, role: true, user: { select: { id: true, name: true } } },
        },
        _count: { select: { leads: true } },
      },
    }),
    db.conferenceAssignment.findMany({
      where: { userId: session?.user?.id },
      select: { conferenceId: true },
    }),
    db.user.findMany({
      where: { isActive: true, role: 'SALES_PERSON' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <ConferenceCalendarClient
      conferences={conferences as any}
      isManager={isManager}
      myConferenceIds={myAssignments.map(a => a.conferenceId)}
      reps={reps}
    />
  )
}
