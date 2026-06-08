import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user?.currentConferenceId) return NextResponse.json({ conference: null })
  const conf = await db.conference.findUnique({
    where: { id: user.currentConferenceId },
    select: { id: true, name: true, city: true },
  })
  return NextResponse.json({ conference: conf })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { conferenceId } = await req.json()
  await db.user.update({
    where: { id: session.user.id },
    data: { currentConferenceId: conferenceId || null },
  })
  return NextResponse.json({ ok: true })
}
