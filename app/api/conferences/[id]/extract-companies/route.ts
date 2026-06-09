import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { extractConferenceCompanies } from '@/lib/ai'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL required' }, { status: 400 })
  }

  const conference = await db.conference.findUnique({
    where: { id: params.id },
    select: { name: true },
  })
  if (!conference) return NextResponse.json({ error: 'Conference not found' }, { status: 404 })

  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    const res = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrainBot/1.0)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch URL (HTTP ${res.status})` }, { status: 400 })
    }
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length < 100) {
      return NextResponse.json({ error: 'Page content too short or blocked' }, { status: 400 })
    }

    const companies = await extractConferenceCompanies(text, conference.name)
    return NextResponse.json({ companies })
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out — try a different URL' }, { status: 400 })
    }
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
