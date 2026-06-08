import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { draftFollowUpEmail, summariseRelationshipArc } from '@/lib/ai'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = await db.lead.findUnique({
    where: { id: params.id },
    include: {
      capturedBy: { select: { name: true } },
      conferences: { include: { conference: { select: { id: true, name: true, city: true, startDate: true } } } },
      syncLogs: { orderBy: { syncedAt: 'desc' }, take: 1 },
    },
  })

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isManager = ['ADMIN', 'MANAGER'].includes(session.user.role)
  if (!isManager && lead.capturedById !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ lead })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action } = body

  if (action === 'save-summary') {
    const { summary } = body
    await db.lead.update({
      where: { id: params.id },
      data: { aiSummary: summary, aiSummaryAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  }

  const lead = await db.lead.findUnique({
    where: { id: params.id },
    include: {
      capturedBy: { select: { name: true } },
      conferences: {
        include: { conference: { select: { name: true, startDate: true } } },
        orderBy: { capturedAt: 'desc' },
      },
    },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'draft-followup') {
    const lastConf = lead.conferences[0]
    const conferenceName = lastConf?.conference?.name
    const repName = lead.capturedBy?.name || session.user.name
    const draft = await draftFollowUpEmail({ ...lead, conferenceName, repName })
    await db.lead.update({ where: { id: params.id }, data: { followUpDraft: draft } })
    return NextResponse.json({ draft })
  }

  if (action === 'relationship-arc') {
    if (lead.conferences.length < 2) return NextResponse.json({ summary: 'Only seen at one conference — no arc yet.' })
    const appearances = lead.conferences.map(cl => ({
      conferenceName: cl.conference.name,
      date: new Date(cl.conference.startDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      jobTitle: lead.jobTitle,
      company: lead.company,
      notes: cl.engagementNotes,
    }))
    const summary = await summariseRelationshipArc(appearances)
    // Auto-save summary to lead
    await db.lead.update({ where: { id: params.id }, data: { aiSummary: summary, aiSummaryAt: new Date() } })
    return NextResponse.json({ summary })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
