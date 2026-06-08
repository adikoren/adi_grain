import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const body = await req.json()
  const { attendingStatus, campaignStatus, outboundStatus, meetingsScheduled, backupOwner } = body

  const conference = await db.conference.update({
    where: { id: params.id },
    data: {
      ...(attendingStatus !== undefined && { attendingStatus }),
      ...(campaignStatus !== undefined && { campaignStatus }),
      ...(outboundStatus !== undefined && { outboundStatus }),
      ...(meetingsScheduled !== undefined && { meetingsScheduled: Number(meetingsScheduled) }),
      ...(backupOwner !== undefined && { backupOwner }),
    },
  })
  return NextResponse.json({ conference })
}
