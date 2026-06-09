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
  const { name, website, startDate, endDate, city, country, verticals, buyerPersonas, estimatedAudience, notes, status, icpScore, isHidden } = body

  // Allow a simple hide/unhide without touching other fields
  if (isHidden !== undefined && Object.keys(body).length === 1) {
    const conference = await db.conference.update({ where: { id: params.id }, data: { isHidden } })
    return NextResponse.json({ conference })
  }

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

  // Update assignment when explicitly sent (empty string = unassigned)
  if ('assignedRepId' in body) {
    await db.conferenceAssignment.deleteMany({ where: { conferenceId: params.id } })
    if (body.assignedRepId) {
      await db.conferenceAssignment.create({
        data: {
          conferenceId: params.id,
          userId: body.assignedRepId,
          assignedById: session.user.id,
          role: 'PRIMARY',
        },
      })
    }
  }

  return NextResponse.json({ conference })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const confId = params.id

  // Remove this conference from any TripOpportunity.conferenceIds JSON arrays
  const trips = await db.tripOpportunity.findMany({
    where: { conferenceIds: { contains: confId } },
    select: { id: true, conferenceIds: true },
  })
  for (const trip of trips) {
    let ids: string[] = []
    try { ids = JSON.parse(trip.conferenceIds) } catch { /* ignore */ }
    const updated = ids.filter(id => id !== confId)
    await db.tripOpportunity.update({
      where: { id: trip.id },
      data: { conferenceIds: JSON.stringify(updated) },
    })
  }

  // Cascade on ConferenceAssignment, ConferenceLead (join record only, Lead preserved), and TargetAccount
  await db.conference.delete({ where: { id: confId } })
  return NextResponse.json({ ok: true })
}
