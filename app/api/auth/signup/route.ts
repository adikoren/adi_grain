import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password, token } = body
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!email || !password || !name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password too short' }, { status: 400 })

  const normalized = email.toLowerCase()
  const hash = await bcrypt.hash(password, 10)

  // Direct invite: user already exists, just needs a password set
  if (token) {
    const user = await db.user.findUnique({ where: { inviteToken: token } })
    if (user && user.email === normalized) {
      if (user.inviteExpiry && new Date(user.inviteExpiry) < new Date()) {
        return NextResponse.json({ error: 'Invitation has expired.' }, { status: 403 })
      }
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: hash, name, inviteToken: null, inviteExpiry: null, isActive: true },
      })
      return NextResponse.json({ ok: true })
    }
  }

  // Standard flow: create new user from Invitation model
  const invite = await db.invitation.findFirst({ where: { email: normalized, status: 'PENDING' } })
  if (!invite) return NextResponse.json({ error: 'No invitation found for this email.' }, { status: 403 })
  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Invitation has expired. Ask your admin to re-invite you.' }, { status: 403 })
  }

  const existing = await db.user.findUnique({ where: { email: normalized } })
  if (existing) return NextResponse.json({ error: 'Account already exists.' }, { status: 409 })

  await db.user.create({
    data: { email: normalized, name, passwordHash: hash, role: invite.role, isActive: true },
  })
  await db.invitation.update({
    where: { id: invite.id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
