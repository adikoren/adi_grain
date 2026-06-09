import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ArchiveClient from './ArchiveClient'

export default async function ArchivePage() {
  const session = await getServerSession(authOptions)
  const isManager = session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'

  const conferences = await db.conference.findMany({
    where: { endDate: { lt: new Date() }, isHidden: false },
    orderBy: { startDate: 'desc' },
    include: {
      assignments: { include: { user: { select: { id: true, name: true } } } },
      _count: { select: { leads: true } },
    },
  })

  return <ArchiveClient conferences={conferences} isManager={isManager} />
}
