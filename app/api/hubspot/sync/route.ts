import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { syncLeadToHubspot } from '@/lib/hubspot'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { leadId } = await req.json()
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 })

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      phone: true, company: true, jobTitle: true, linkedinUrl: true, notes: true,
    },
  })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const result = await syncLeadToHubspot(lead)
  return NextResponse.json(result)
}
