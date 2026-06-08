import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trips = await db.tripOpportunity.findMany({
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { calculatedAt: 'desc' },
  })

  const conferences = await db.conference.findMany({
    where: { status: 'ELIGIBLE' },
    select: { id: true, name: true, city: true, country: true, startDate: true, endDate: true },
  })

  const enriched = trips.map(t => ({
    ...t,
    conferences: JSON.parse(t.conferenceIds).map((id: string) => conferences.find(c => c.id === id)).filter(Boolean),
  }))

  return NextResponse.json({ trips: enriched })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { action, tripId, userId, conferenceIds } = await req.json()

  if (action === 'assign' && userId) {
    const ids = tripId
      ? JSON.parse((await db.tripOpportunity.findUnique({ where: { id: tripId } }))?.conferenceIds || '[]')
      : conferenceIds || []

    if (tripId) {
      await db.tripOpportunity.update({ where: { id: tripId }, data: { assignedToId: userId } })
    }

    for (const confId of ids) {
      await db.conferenceAssignment.upsert({
        where: { conferenceId_userId: { conferenceId: confId, userId } },
        update: {},
        create: { conferenceId: confId, userId, assignedById: session.user.id },
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'recalculate') {
    const conferences = await db.conference.findMany({
      where: { status: 'ELIGIBLE', lat: { not: null }, lng: { not: null } },
      orderBy: { startDate: 'asc' },
    })

    const used = new Set<string>()
    const clusters: string[][] = []

    for (let i = 0; i < conferences.length; i++) {
      if (used.has(conferences[i].id)) continue
      const cluster = [conferences[i].id]
      used.add(conferences[i].id)

      for (let j = i + 1; j < conferences.length; j++) {
        if (used.has(conferences[j].id)) continue
        const a = conferences[i], b = conferences[j]
        const dist = haversineKm(a.lat!, a.lng!, b.lat!, b.lng!)
        const dayGap = (new Date(b.startDate).getTime() - new Date(a.endDate).getTime()) / 86400000
        if (dist <= 500 && dayGap >= 0 && dayGap <= 7) {
          cluster.push(b.id)
          used.add(b.id)
        }
      }

      if (cluster.length >= 2) clusters.push(cluster)
    }

    await db.tripOpportunity.deleteMany()
    for (const cluster of clusters) {
      const confs = cluster.map(id => conferences.find(c => c.id === id)!).filter(Boolean)
      const cities = Array.from(new Set(confs.map(c => c.city))).join(' + ')
      const months = Array.from(new Set(confs.map(c => new Date(c.startDate).toLocaleString('en-GB', { month: 'short', year: '2-digit' }))))
      await db.tripOpportunity.create({
        data: {
          name: `${cities} · ${months.join('/')}`,
          clusterReason: `${confs.length} conferences within 500km and 7-day window`,
          conferenceIds: JSON.stringify(cluster),
        },
      })
    }

    return NextResponse.json({ created: clusters.length })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
