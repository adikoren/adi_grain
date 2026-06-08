import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { myFocus } = await req.json()

  const assignment = await db.conferenceAssignment.findUnique({
    where: { conferenceId_userId: { conferenceId: params.id, userId: session.user.id } },
  })
  if (!assignment) return NextResponse.json({ error: 'Not assigned to this conference' }, { status: 403 })

  await db.conferenceAssignment.update({
    where: { conferenceId_userId: { conferenceId: params.id, userId: session.user.id } },
    data: { myFocus },
  })

  return NextResponse.json({ ok: true })
}
