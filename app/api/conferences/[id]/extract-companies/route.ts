import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { identifyConferenceAttendees } from '@/lib/ai'
import { getConfig } from '@/lib/config'

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConferenceIntelBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.length >= 100 ? text : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const cfg = await getConfig()
  if (!cfg.aiApiKey) {
    return NextResponse.json(
      { error: 'AI API key not configured. Go to Admin → Settings to add your API key.' },
      { status: 400 }
    )
  }

  const conference = await db.conference.findUnique({
    where: { id: params.id },
    select: { name: true, website: true, city: true, country: true, verticals: true, estimatedAudience: true, startDate: true },
  })
  if (!conference) return NextResponse.json({ error: 'Conference not found' }, { status: 404 })

  let body: { url?: string } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  const overrideUrl = body.url?.trim()
  const baseUrl = overrideUrl
    ? (overrideUrl.startsWith('http') ? overrideUrl : `https://${overrideUrl}`)
    : conference.website

  // Try to fetch page content as supplementary context — not required
  let pageContent: string | null = null
  if (baseUrl) {
    const base = baseUrl.replace(/\/$/, '')
    const urlsToTry = overrideUrl
      ? [base]
      : [base, `${base}/sponsors`, `${base}/exhibitors`, `${base}/speakers`]
    const texts: string[] = []
    for (const url of urlsToTry) {
      const text = await fetchPageText(url)
      if (text) texts.push(text.slice(0, 5000))
    }
    if (texts.length > 0) pageContent = texts.join('\n\n---\n\n')
  }

  try {
    const verticals: string[] = JSON.parse(conference.verticals || '[]')
    const companies = await identifyConferenceAttendees({
      name: conference.name,
      city: conference.city,
      country: conference.country,
      verticals,
      estimatedAudience: conference.estimatedAudience ?? undefined,
      startDate: conference.startDate.toISOString().slice(0, 10),
      pageContent: pageContent ?? undefined,
    })
    return NextResponse.json({ companies })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
