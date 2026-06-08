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

  const { targetId, status, website, description, industry, icpFit, fxRelevance, relevanceReason, companySize, isPublic, regions, confidence, dataSource } = await req.json()

  const data: Record<string, any> = {}
  if (status !== undefined) data.status = status
  if (website !== undefined) data.website = website
  if (description !== undefined) data.description = description
  if (industry !== undefined) data.industry = industry
  if (icpFit !== undefined) data.icpFit = icpFit
  if (fxRelevance !== undefined) data.fxRelevance = fxRelevance
  if (relevanceReason !== undefined) data.relevanceReason = relevanceReason
  if (companySize !== undefined) data.companySize = companySize
  if (isPublic !== undefined) data.isPublic = isPublic
  if (regions !== undefined) data.regions = regions
  if (confidence !== undefined) data.confidence = confidence
  if (dataSource !== undefined) data.dataSource = dataSource

  const target = await db.targetAccount.update({
    where: { id: targetId },
    data,
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
