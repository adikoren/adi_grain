import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { scoreConference } from '@/lib/icp-score'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const conference = await db.conference.findUnique({ where: { id: params.id } })
  if (!conference) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ conference })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json()
  const { name, website, startDate, endDate, city, country, verticals, buyerPersonas, estimatedAudience, notes, status, icpScore } = body

  const verts = Array.isArray(verticals) ? verticals : JSON.parse(verticals || '[]')
  const personas = Array.isArray(buyerPersonas) ? buyerPersonas : JSON.parse(buyerPersonas || '[]')

  const computedScore = icpScore !== undefined && icpScore !== ''
    ? Number(icpScore)
    : scoreConference({ verticals: verts, estimatedAudience, country, startDate: new Date(startDate) })

  const conference = await db.conference.update({
    where: { id: params.id },
    data: {
      name,
      website: website || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      city,
      country: country ? country.toUpperCase() : '',
      verticals: JSON.stringify(verts),
      buyerPersonas: JSON.stringify(personas),
      estimatedAudience: estimatedAudience ? Number(estimatedAudience) : null,
      icpScore: computedScore,
      status,
      notes: notes || null,
    },
  })

  return NextResponse.json({ conference })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  await db.conference.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
