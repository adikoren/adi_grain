import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json()
  if (!email || !password || !name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password too short' }, { status: 400 })

  const normalized = email.toLowerCase()

  // Check invitation
  const invite = await db.invitation.findFirst({
    where: { email: normalized, status: 'PENDING' },
  })
  if (!invite) return NextResponse.json({ error: 'No invitation found for this email.' }, { status: 403 })

  // Check expiry
  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Invitation has expired. Ask your admin to re-invite you.' }, { status: 403 })
  }

  // Check already registered
  const existing = await db.user.findUnique({ where: { email: normalized } })
  if (existing) return NextResponse.json({ error: 'Account already exists.' }, { status: 409 })

  const hash = await bcrypt.hash(password, 10)
  await db.user.create({
    data: { email: normalized, name, passwordHash: hash, role: invite.role, isActive: true },
  })

  await db.invitation.update({
    where: { id: invite.id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
