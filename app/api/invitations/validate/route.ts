import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ valid: false })

  // Check Invitation model first
  const invitation = await db.invitation.findUnique({
    where: { token },
    select: { id: true, email: true, role: true, status: true, expiresAt: true },
  })
  if (invitation) {
    if (invitation.status !== 'PENDING') return NextResponse.json({ valid: false, reason: 'used' })
    if (new Date(invitation.expiresAt) < new Date()) return NextResponse.json({ valid: false, reason: 'expired' })
    return NextResponse.json({ valid: true, invitation })
  }

  // Also check User.inviteToken (for direct invites to existing users)
  const user = await db.user.findUnique({
    where: { inviteToken: token },
    select: { email: true, name: true, role: true, inviteExpiry: true },
  })
  if (!user) return NextResponse.json({ valid: false, reason: 'not_found' })
  if (user.inviteExpiry && new Date(user.inviteExpiry) < new Date()) return NextResponse.json({ valid: false, reason: 'expired' })

  return NextResponse.json({
    valid: true,
    invitation: { email: user.email, role: user.role, name: user.name },
    isDirectInvite: true,
  })
}
