import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const cfg = await db.systemConfig.findUnique({ where: { id: 'singleton' } })
  return NextResponse.json({
    aiProvider: cfg?.aiProvider,
    aiApiKeySet: !!cfg?.aiApiKey,
    hubspotMode: cfg?.hubspotMode,
    hubspotApiKeySet: !!cfg?.hubspotApiKey,
    serperApiKeySet: !!cfg?.serperApiKey,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { aiProvider, aiApiKey, hubspotMode, hubspotApiKey, serperApiKey } = await req.json()
  const data: any = {}
  if (aiProvider) data.aiProvider = aiProvider
  if (aiApiKey) data.aiApiKey = aiApiKey
  if (hubspotMode) data.hubspotMode = hubspotMode
  if (hubspotApiKey) data.hubspotApiKey = hubspotApiKey
  if (serperApiKey) data.serperApiKey = serperApiKey

  const cfg = await db.systemConfig.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data },
  })
  return NextResponse.json({ ok: true, hubspotMode: cfg.hubspotMode, aiProvider: cfg.aiProvider })
}
