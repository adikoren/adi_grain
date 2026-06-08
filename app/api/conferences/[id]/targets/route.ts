import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { company, contactName, contactRole, notes, priority } = await req.json()
  if (!company) return NextResponse.json({ error: 'Company required' }, { status: 400 })

  const target = await db.targetAccount.create({
    data: { conferenceId: params.id, company, contactName, contactRole, notes, priority: priority || 'MEDIUM' },
  })
  return NextResponse.json({ target })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetId, status } = await req.json()
  const target = await db.targetAccount.update({
    where: { id: targetId },
    data: { status },
  })
  return NextResponse.json({ target })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { targetId } = await req.json()
  await db.targetAccount.delete({ where: { id: targetId } })
  return NextResponse.json({ ok: true })
}
