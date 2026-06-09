import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { discoverConferences } from '@/lib/ai'
import { db } from '@/lib/db'

const SOURCES = [
  // Fintech / payments focused
  'https://www.fintechweekly.com/fintech-conferences/',
  'https://fintechlabs.com/the-biggest-payments-events-conferences-trade-shows-of-the-year/',
  'https://paytech.events/events/',
  // FX / treasury / institutional
  'https://www.euromoney.com/events',
  'https://www.finextra.com/events',
  // Broader payments & cards
  'https://www.paymentscardsandmobile.com/events/',
]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Exclude hidden conferences so they can resurface in discovery
  const existing = await db.conference.findMany({ where: { isHidden: false }, select: { name: true } })
  const existingNames = new Set(existing.map(c => c.name.toLowerCase()))

  const results: any[] = []

  for (const url of SOURCES) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrainBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const html = await res.text()
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 15000)

      const discovered = await discoverConferences(text)
      for (const c of discovered) {
        if (!existingNames.has(c.name.toLowerCase())) {
          results.push(c)
          existingNames.add(c.name.toLowerCase())
        }
      }
    } catch (err) {
      console.error(`Failed to fetch ${url}:`, err)
    }
  }

  return NextResponse.json({ conferences: results.slice(0, 50) })
}
