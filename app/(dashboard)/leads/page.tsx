import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import LeadsClient from './LeadsClient'

export default async function LeadsPage() {
  const session = await getServerSession(authOptions)
  const isManager = ['ADMIN', 'MANAGER'].includes(session!.user.role)

  const leads = await db.lead.findMany({
    where: isManager ? {} : { capturedById: session!.user.id },
    include: {
      capturedBy: { select: { id: true, name: true } },
      conferences: { include: { conference: { select: { name: true } } } },
    },
    orderBy: { capturedAt: 'desc' },
  })

  return <LeadsClient leads={leads} isManager={isManager} />
}
