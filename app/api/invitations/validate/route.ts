import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false })

  const invitation = await db.invitation.findUnique({
    where: { token },
    select: { id: true, email: true, role: true, status: true, expiresAt: true },
  })

  if (!invitation) return NextResponse.json({ valid: false, reason: 'not_found' })
  if (invitation.status !== 'PENDING') return NextResponse.json({ valid: false, reason: 'used' })
  if (new Date(invitation.expiresAt) < new Date()) return NextResponse.json({ valid: false, reason: 'expired' })

  return NextResponse.json({ valid: true, invitation })
}
