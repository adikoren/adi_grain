import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') || ''
  const conferenceId = req.nextUrl.searchParams.get('conferenceId') || ''

  const results: string[] = []
  const seen = new Set<string>()

  // 1) Target accounts for the conference (shown first)
  if (conferenceId) {
    const targets = await db.targetAccount.findMany({
      where: {
        conferenceId,
        ...(q ? { company: { contains: q } } : {}),
      },
      select: { company: true },
      orderBy: { company: 'asc' },
    })
    for (const t of targets) {
      const key = t.company.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        results.push(t.company)
      }
    }
  }

  // 2) Distinct companies from existing leads
  const leads = await db.lead.findMany({
    where: q ? { company: { contains: q } } : {},
    select: { company: true },
    orderBy: { company: 'asc' },
  })

  for (const l of leads) {
    const key = l.company.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      results.push(l.company)
    }
  }

  return NextResponse.json({ companies: results.slice(0, 20) })
}
