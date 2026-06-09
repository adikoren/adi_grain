import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const company = req.nextUrl.searchParams.get('company')
  if (!company) return NextResponse.json({ enrichment: null })

  const enrichment = await db.companyEnrichment.findUnique({
    where: { company: company.toLowerCase().trim() },
  })

  return NextResponse.json({ enrichment: enrichment || null })
}
