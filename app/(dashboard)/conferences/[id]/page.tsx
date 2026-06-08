import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound } from 'next/navigation'
import ConferenceDetailClient from './ConferenceDetailClient'

export default async function ConferenceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'

  const [conference, hubspotLogs] = await Promise.all([
    db.conference.findUnique({
      where: { id: params.id },
      include: {
        assignments: { select: { id: true, userId: true, myFocus: true, user: { select: { id: true, name: true, role: true } } } },
        leads: {
          include: {
            lead: {
              select: {
                id: true, firstName: true, lastName: true,
                company: true, jobTitle: true, email: true,
                icpScore: true, capturedAt: true,
                hubspotContactId: true,
                capturedBy: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { capturedAt: 'desc' },
        },
        targetAccounts: { orderBy: { priority: 'asc' } },
      },
    }),
    db.hubspotSyncLog.findMany({
      where: {
        lead: {
          conferences: { some: { conferenceId: params.id } },
        },
      },
      include: { lead: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { syncedAt: 'desc' },
      take: 50,
    }),
  ])

  if (!conference) notFound()

  const isAssigned = conference.assignments.some((a: any) => a.user.id === session?.user?.id)

  return (
    <ConferenceDetailClient
      conference={conference as any}
      isManager={isManager}
      isAssigned={isAssigned}
      currentUserId={session?.user?.id || ''}
      hubspotLogs={hubspotLogs as any}
    />
  )
}
