import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import EditConferenceClient from './EditConferenceClient'

export default async function EditConferencePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) redirect('/')

  const conference = await db.conference.findUnique({ where: { id: params.id } })
  if (!conference) notFound()

  return <EditConferenceClient conference={conference} />
}
