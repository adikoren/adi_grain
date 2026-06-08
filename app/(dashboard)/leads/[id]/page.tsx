import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import LeadDetailClient from './LeadDetailClient'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const isManager = ['ADMIN', 'MANAGER'].includes(session!.user.role)

  const lead = await db.lead.findUnique({
    where: { id: params.id },
    include: {
      capturedBy: { select: { name: true, email: true } },
      conferences: {
        include: { conference: { select: { id: true, name: true, city: true, country: true, startDate: true } } },
        orderBy: { capturedAt: 'asc' },
      },
      syncLogs: { orderBy: { syncedAt: 'desc' }, take: 5 },
    },
  })

  if (!lead) notFound()
  if (!isManager && lead.capturedById !== session!.user.id) notFound()

  return <LeadDetailClient lead={lead} isManager={isManager} />
}
