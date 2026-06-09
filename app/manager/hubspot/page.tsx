import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import HubspotClient from './HubspotClient'

export default async function HubspotPage() {
  const session = await getServerSession(authOptions)
  const isManager = ['ADMIN', 'MANAGER'].includes(session!.user.role)
  if (!isManager) return <div className="p-6 text-red-400">Unauthorized</div>

  const [leads, config] = await Promise.all([
    db.lead.findMany({
      include: {
        conferences: {
          include: { conference: { select: { name: true, startDate: true } } },
          orderBy: { capturedAt: 'desc' },
        },
        capturedBy: { select: { name: true } },
        syncLogs: { orderBy: { syncedAt: 'desc' }, take: 3 },
      },
      orderBy: { capturedAt: 'desc' },
    }),
    db.systemConfig.findUnique({
      where: { id: 'singleton' },
      select: { hubspotMode: true, hubspotApiKey: true },
    }),
  ])

  const mode = (config?.hubspotMode as 'MOCK' | 'REAL') || 'MOCK'
  const hasApiKey = !!config?.hubspotApiKey

  return <HubspotClient initialLeads={leads as any} mode={mode} hasApiKey={hasApiKey} />
}
