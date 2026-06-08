import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import ContactsClient from './ContactsClient'

export default async function ContactsPage() {
  const session = await getServerSession(authOptions)
  if (!['ADMIN', 'MANAGER'].includes(session!.user.role)) {
    return <div className="p-6 text-red-400">Unauthorized</div>
  }

  // Find contacts seen at multiple conferences (cross-conference contacts)
  const multiConferenceLeads = await db.lead.findMany({
    where: { conferences: { some: {} } },
    include: {
      capturedBy: { select: { name: true } },
      conferences: {
        include: { conference: { select: { id: true, name: true, startDate: true, city: true } } },
        orderBy: { capturedAt: 'asc' },
      },
    },
    orderBy: { capturedAt: 'desc' },
  })

  // Separate multi-conference from single
  const multiConf = multiConferenceLeads.filter(l => l.conferences.length >= 2)
  const allLeads = multiConferenceLeads

  return <ContactsClient multiConf={multiConf} allLeads={allLeads} />
}
