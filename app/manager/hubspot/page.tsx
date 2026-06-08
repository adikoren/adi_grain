import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import HubspotClient from './HubspotClient'

export default async function HubspotPage() {
  const session = await getServerSession(authOptions)
  const isManager = ['ADMIN', 'MANAGER'].includes(session!.user.role)
  if (!isManager) return <div className="p-6 text-red-400">Unauthorized</div>

  const [syncLogs, config] = await Promise.all([
    db.hubspotSyncLog.findMany({
      include: { lead: { select: { firstName: true, lastName: true, company: true, email: true } } },
      orderBy: { syncedAt: 'desc' },
      take: 50,
    }),
    db.systemConfig.findUnique({ where: { id: 'singleton' }, select: { hubspotMode: true, hubspotApiKey: true } }),
  ])

  const successCount = syncLogs.filter(l => l.status === 'SUCCESS').length
  const failCount = syncLogs.filter(l => l.status === 'FAILED').length

  return <HubspotClient syncLogs={syncLogs} config={config} successCount={successCount} failCount={failCount} />
}
