import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase()
  if (!email) return NextResponse.json({ valid: false })
  const invite = await db.invitation.findFirst({ where: { email, status: 'PENDING' } })
  if (invite) return NextResponse.json({ valid: true })
  // Also accept direct-invite users (inviteToken on User model)
  const user = await db.user.findUnique({ where: { email }, select: { inviteToken: true, inviteExpiry: true } })
  const validDirectInvite = !!user?.inviteToken && (!user.inviteExpiry || new Date(user.inviteExpiry) > new Date())
  return NextResponse.json({ valid: validDirectInvite })
}
