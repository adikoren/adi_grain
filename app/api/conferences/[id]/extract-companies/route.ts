import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { extractConferenceCompanies } from '@/lib/ai'

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrainBot/1.0)' },
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

function normaliseBase(url: string): string {
  return url.replace(/\/$/, '')
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const conference = await db.conference.findUnique({
    where: { id: params.id },
    select: { name: true, website: true },
  })
  if (!conference) return NextResponse.json({ error: 'Conference not found' }, { status: 404 })

  // URL from body overrides; otherwise fall back to conference.website
  let body: { url?: string } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  const overrideUrl = body.url?.trim()
  const baseUrl = overrideUrl
    ? (overrideUrl.startsWith('http') ? overrideUrl : `https://${overrideUrl}`)
    : conference.website

  if (!baseUrl) {
    return NextResponse.json(
      { error: 'No website URL saved for this conference. Enter a URL manually.' },
      { status: 400 }
    )
  }

  // Fetch the main URL plus common attendee subpages
  const base = normaliseBase(baseUrl)
  const urlsToTry = overrideUrl
    ? [base]
    : [base, `${base}/sponsors`, `${base}/exhibitors`, `${base}/speakers`]

  const pageTexts: string[] = []
  for (const url of urlsToTry) {
    const text = await fetchPageText(url)
    if (text) pageTexts.push(text.slice(0, 6000))
  }

  if (pageTexts.length === 0) {
    return NextResponse.json(
      { error: 'Could not fetch conference website. Try entering a specific URL.' },
      { status: 400 }
    )
  }

  try {
    const combined = pageTexts.join('\n\n---\n\n')
    const companies = await extractConferenceCompanies(combined, conference.name)
    return NextResponse.json({ companies })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
