import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import EditConferenceClient from './EditConferenceClient'

export default async function EditConferencePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) redirect('/')

  const [conference, reps] = await Promise.all([
    db.conference.findUnique({
      where: { id: params.id },
      include: {
        assignments: {
          select: { userId: true, role: true, user: { select: { id: true, name: true } } },
        },
      },
    }),
    db.user.findMany({
      where: { isActive: true, role: 'SALES_PERSON' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!conference) notFound()

  return <EditConferenceClient conference={conference as any} reps={reps} />
}
