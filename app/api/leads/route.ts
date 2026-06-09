import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { scoreLead } from '@/lib/icp-score'
import { syncLeadToHubspot } from '@/lib/hubspot'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isManager = ['ADMIN', 'MANAGER'].includes(session.user.role)
  const all = req.nextUrl.searchParams.get('all')

  const leads = await db.lead.findMany({
    where: isManager ? {} : { capturedById: session.user.id },
    include: {
      capturedBy: { select: { name: true } },
      conferences: { include: { conference: { select: { id: true, name: true, startDate: true } } }, orderBy: { capturedAt: 'desc' } },
      _count: { select: { matchesA: true, matchesB: true } },
    },
    orderBy: { capturedAt: 'desc' },
    take: all ? 1000 : 50,
  })

  return NextResponse.json({ leads })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { firstName, lastName, email, phone, company, jobTitle, linkedinUrl, notes, rawCardText, conferenceId, mergeLeadId } = body

  if (!firstName || !lastName || !company) {
    return NextResponse.json({ error: 'firstName, lastName, company required' }, { status: 400 })
  }

  const icpScore = scoreLead({ jobTitle, company })

  let lead: any

  if (mergeLeadId) {
    lead = await db.lead.findUnique({ where: { id: mergeLeadId } })
    if (conferenceId && lead) {
      await db.conferenceLead.upsert({
        where: { conferenceId_leadId: { conferenceId, leadId: mergeLeadId } },
        update: { engagementNotes: notes },
        create: { conferenceId, leadId: mergeLeadId, engagementNotes: notes },
      })
    }
  } else {
    lead = await db.lead.create({
      data: {
        firstName, lastName, email: email || undefined, phone: phone || undefined,
        company, jobTitle: jobTitle || undefined, linkedinUrl: linkedinUrl || undefined,
        notes: notes || undefined, rawCardText: rawCardText || undefined,
        icpScore, capturedById: session.user.id,
      },
    })

    if (conferenceId) {
      await db.conferenceLead.create({
        data: { conferenceId, leadId: lead.id, engagementNotes: notes, companyAtTime: company || undefined, jobTitleAtTime: jobTitle || undefined },
      }).catch(() => {})
    }

    // Link any matching PersonEnrichment record that was pre-generated but not yet tied to a lead
    if (jobTitle) {
      await db.personEnrichment.updateMany({
        where: {
          company:      company.toLowerCase().trim(),
          jobTitle:     jobTitle.toLowerCase().trim(),
          matchedLeadId: null,
        },
        data: { matchedLeadId: lead.id },
      }).catch(() => {})
    }

    // Async HubSpot sync
    syncLeadToHubspot(lead).catch(console.error)
  }

  return NextResponse.json({ lead })
}
