import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { scoreConference } from '@/lib/icp-score'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conferences = await db.conference.findMany({
    orderBy: { icpScore: 'desc' },
    include: {
      assignments: { include: { user: { select: { id: true, name: true } } } },
      _count: { select: { leads: true } },
    },
  })
  return NextResponse.json({ conferences })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json()
  const { name, website, startDate, endDate, city, country, lat, lng, verticals, estimatedAudience, notes, status } = body

  const icpScore = scoreConference({
    verticals: Array.isArray(verticals) ? verticals : JSON.parse(verticals || '[]'),
    estimatedAudience,
    country,
    startDate: new Date(startDate),
  })

  const conference = await db.conference.create({
    data: {
      name, website: website || undefined,
      startDate: new Date(startDate), endDate: new Date(endDate),
      city, country, lat: lat || undefined, lng: lng || undefined,
      verticals: JSON.stringify(Array.isArray(verticals) ? verticals : []),
      estimatedAudience: estimatedAudience ? Number(estimatedAudience) : undefined,
      icpScore, status: status || 'DRAFT',
      source: 'MANUAL', createdById: session.user.id,
      notes: notes || undefined,
    },
  })

  return NextResponse.json({ conference })
}
