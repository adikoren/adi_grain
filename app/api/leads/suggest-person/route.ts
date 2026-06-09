import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { getConfig } from '@/lib/config'

const CACHE_DAYS = 7
const INTERNAL_CONFIDENCE_THRESHOLD = 0.90

function isFresh(date: Date): boolean {
  return (Date.now() - date.getTime()) < CACHE_DAYS * 24 * 60 * 60 * 1000
}

function matchConfidence(lead: { company: string; jobTitle: string | null }, company: string, jobTitle: string): number {
  const normalize = (s: string) => s.toLowerCase().trim()
  const companyMatch = normalize(lead.company).includes(normalize(company)) ||
                       normalize(company).includes(normalize(lead.company))
  if (!companyMatch) return 0
  if (!lead.jobTitle || !jobTitle) return 0.70
  const titleMatch = normalize(lead.jobTitle).includes(normalize(jobTitle)) ||
                     normalize(jobTitle).includes(normalize(lead.jobTitle))
  return titleMatch ? 0.95 : 0.65
}

interface ParsedPerson {
  firstName: string
  lastName: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  linkedinUrl: string
  sourceUrl: string
  needsReview: boolean
}

function parseLinkedInResult(
  resultUrl: string,
  title: string,
  description: string,
  targetCompany: string,
  targetRole: string,
): ParsedPerson | null {
  if (!resultUrl?.includes('linkedin.com/in/')) return null

  const normalize = (s: string) => s.toLowerCase()
  const cleanUrl = resultUrl.replace(/\?.*$/, '').replace(/\/$/, '')

  // Title formats:
  //   "John Smith - Head of Payments at Stripe | LinkedIn"
  //   "Jane Doe – CFO at Acme Corp | LinkedIn"
  const cleaned = title
    .replace(/\s*[|]\s*LinkedIn\s*$/i, '')
    .replace(/\s*–\s*LinkedIn\s*$/i, '')
    .trim()

  const dashMatch = cleaned.match(/^(.+?)\s+[-–]\s+(.+)$/)

  let namePart: string
  let rolePart: string | null = null

  if (dashMatch) {
    namePart = dashMatch[1].trim()
    rolePart = dashMatch[2].trim()
  } else {
    namePart = cleaned
  }

  const nameParts = namePart.split(' ').filter(Boolean)
  if (nameParts.length < 2 || nameParts.length > 4) return null
  if (nameParts.some(p => /\d/.test(p))) return null

  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ')

  // Verify company + role appear in title or description
  const context = normalize(`${title} ${description}`)
  const companyWords = normalize(targetCompany).split(' ').filter(w => w.length > 2)
  const roleWords    = normalize(targetRole).split(' ').filter(w => w.length > 3)

  const companyHit = companyWords.filter(w => context.includes(w)).length
  const roleHit    = roleWords.filter(w => context.includes(w)).length

  const companyMatch = companyHit / Math.max(companyWords.length, 1) >= 0.5
  const roleMatch    = roleHit    / Math.max(roleWords.length,    1) >= 0.5

  if (!companyMatch) return null

  let confidence: 'high' | 'medium' | 'low'
  let needsReview: boolean
  if (companyMatch && roleMatch) {
    confidence  = 'high'
    needsReview = false
  } else {
    confidence  = 'medium'
    needsReview = true
  }

  const roleDesc = rolePart || `${targetRole} at ${targetCompany}`
  return {
    firstName,
    lastName,
    confidence,
    reasoning: `Found on LinkedIn: "${namePart}" — ${roleDesc}`,
    linkedinUrl: cleanUrl,
    sourceUrl: resultUrl,
    needsReview,
  }
}

async function searchSerper(
  query: string,
  apiKey: string,
  targetCompany: string,
  targetRole: string,
): Promise<ParsedPerson | null> {
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const results: Array<{ link: string; title: string; snippet?: string }> =
      data.organic || []

    for (const r of results) {
      const parsed = parseLinkedInResult(r.link, r.title, r.snippet || '', targetCompany, targetRole)
      if (parsed) return parsed
    }
  } catch {
    // timeout or network error — fall through to AI
  }
  return null
}

function detectProfileChanges(
  stored: { company: string; jobTitle: string | null },
  entered: { company: string; jobTitle: string },
): string[] | null {
  const norm = (s: string) => s.toLowerCase().trim()
  const changes: string[] = []
  if (
    stored.company &&
    !norm(stored.company).includes(norm(entered.company)) &&
    !norm(entered.company).includes(norm(stored.company))
  ) {
    changes.push(`Previously at ${stored.company}`)
  }
  if (
    stored.jobTitle &&
    entered.jobTitle &&
    !norm(stored.jobTitle).includes(norm(entered.jobTitle)) &&
    !norm(entered.jobTitle).includes(norm(stored.jobTitle))
  ) {
    changes.push(`Role was "${stored.jobTitle}"`)
  }
  return changes.length > 0 ? changes : null
}

async function enrichLinkedIn(
  leadId: string,
  firstName: string,
  lastName: string,
  company: string,
  jobTitle: string | null,
  serperApiKey: string,
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)
  try {
    const query = `"${firstName} ${lastName}" "${company}" site:linkedin.com/in`
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 3 }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = await res.json()
    for (const r of (data.organic || [])) {
      const parsed = parseLinkedInResult(r.link, r.title, r.snippet || '', company, jobTitle || '')
      if (parsed?.linkedinUrl) {
        await db.lead.update({ where: { id: leadId }, data: { linkedinUrl: parsed.linkedinUrl } })
        return parsed.linkedinUrl
      }
    }
  } catch { /* timeout or network error */ }
  finally { clearTimeout(timer) }
  return null
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { company, jobTitle, conferenceName, conferenceId, firstName, lastName } = await req.json()
  if (!company || !jobTitle) return NextResponse.json({ person: null, reason: 'missing_params' })

  const companyKey = company.toLowerCase().trim()
  const titleKey   = jobTitle.toLowerCase().trim()

  const cfg          = await getConfig()
  const serperApiKey = cfg.serperApiKey
  const aiApiKey     = cfg.aiApiKey
  const provider     = cfg.aiProvider

  // ── 0. Named person lookup — when a specific person is already pre-filled ─
  // Look up that exact person rather than falling through to company+role search,
  // which would surface a different person and create inconsistency.
  if (firstName && lastName) {
    const namedLead = await db.lead.findFirst({
      where: {
        firstName: { equals: firstName },
        lastName:  { equals: lastName  },
      },
      include: {
        conferences: {
          include: { conference: { select: { name: true } } },
          orderBy: { capturedAt: 'desc' },
        },
      },
    })

    if (namedLead) {
      const latestConf = namedLead.conferences[0]
      const previousContext = namedLead.conferences.length > 0
        ? `Met at ${namedLead.conferences.map(c => c.conference.name).join(', ')}${latestConf?.engagementNotes ? `. Last note: "${latestConf.engagementNotes}"` : ''}`
        : null

      let linkedinUrl = namedLead.linkedinUrl || null
      if (!linkedinUrl && serperApiKey) {
        linkedinUrl = await enrichLinkedIn(namedLead.id, namedLead.firstName, namedLead.lastName, namedLead.company, namedLead.jobTitle, serperApiKey)
      }

      const profileChanges = detectProfileChanges(
        { company: namedLead.company, jobTitle: namedLead.jobTitle },
        { company, jobTitle },
      )

      return NextResponse.json({
        person: {
          firstName:       namedLead.firstName,
          lastName:        namedLead.lastName,
          email:           namedLead.email    || null,
          phone:           namedLead.phone    || null,
          jobTitle:        namedLead.jobTitle || null,
          company:         namedLead.company  || null,
          confidence:      'high',
          reasoning:       `Already in your system — met at ${namedLead.conferences.length} conference${namedLead.conferences.length !== 1 ? 's' : ''}`,
          linkedinHint:    linkedinUrl,
          previousContext,
          warmth:          'WARM',
          needsReview:     false,
          sourceUrl:       null,
          profileChanges:  profileChanges || null,
        },
        source: 'internal',
        leadId: namedLead.id,
      })
    }

    // Named person not in our system — return nothing rather than suggesting
    // a different person, which would create visible inconsistency.
    return NextResponse.json({ person: null, reason: 'named_person_not_found' })
  }

  // ── 1. Internal lead match (≥90% confidence) ─────────────────────────────
  const candidates = await db.lead.findMany({
    where: { company: { contains: companyKey } },
    include: {
      conferences: {
        include: { conference: { select: { name: true, startDate: true } } },
        orderBy: { capturedAt: 'desc' },
      },
    },
    take: 20,
  })

  const bestMatch = candidates
    .map(lead => ({ lead, confidence: matchConfidence(lead, company, jobTitle) }))
    .filter(m => m.confidence >= INTERNAL_CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence)[0]

  if (bestMatch) {
    const { lead, confidence } = bestMatch
    const latestConf = lead.conferences[0]
    const previousContext = lead.conferences.length > 0
      ? `Met at ${lead.conferences.map(c => c.conference.name).join(', ')}${latestConf?.engagementNotes ? `. Last note: "${latestConf.engagementNotes}"` : ''}`
      : null

    let linkedinUrl = lead.linkedinUrl || null
    if (!linkedinUrl && serperApiKey) {
      linkedinUrl = await enrichLinkedIn(lead.id, lead.firstName, lead.lastName, lead.company, lead.jobTitle, serperApiKey)
    }

    await db.personEnrichment.upsert({
      where: { company_jobTitle: { company: companyKey, jobTitle: titleKey } },
      create: {
        company:         companyKey,
        jobTitle:        titleKey,
        firstName:       lead.firstName,
        lastName:        lead.lastName,
        linkedinUrl:     linkedinUrl || null,
        summary:         lead.aiSummary   || null,
        warmth:          'WARM',
        previousContext,
        dataSource:      'INTERNAL',
        confidence:      confidence >= 0.95 ? 'HIGH' : 'MEDIUM',
        needsReview:     false,
        matchedLeadId:   lead.id,
        lastEnrichedAt:  new Date(),
      },
      update: {
        firstName:       lead.firstName,
        lastName:        lead.lastName,
        linkedinUrl:     linkedinUrl || undefined,
        summary:         lead.aiSummary   || undefined,
        warmth:          'WARM',
        previousContext,
        dataSource:      'INTERNAL',
        confidence:      confidence >= 0.95 ? 'HIGH' : 'MEDIUM',
        needsReview:     false,
        matchedLeadId:   lead.id,
        lastEnrichedAt:  new Date(),
      },
    })

    return NextResponse.json({
      person: {
        firstName:       lead.firstName,
        lastName:        lead.lastName,
        email:           lead.email    || null,
        phone:           lead.phone    || null,
        jobTitle:        lead.jobTitle || null,
        company:         lead.company  || null,
        confidence:      confidence >= 0.95 ? 'high' : 'medium',
        reasoning:       `Already in your system — met at ${lead.conferences.length} conference${lead.conferences.length !== 1 ? 's' : ''}`,
        linkedinHint:    linkedinUrl,
        previousContext,
        warmth:          'WARM',
        needsReview:     false,
        sourceUrl:       null,
        profileChanges:  null,
      },
      source: 'internal',
      leadId: lead.id,
    })
  }

  // ── 1.5. TargetAccount known contact (conference-aware) ──────────────────
  // When a conferenceId is provided (capture page with a conference selected),
  // check if there's a known contact set for that company at that conference.
  // This makes manual entry agree with what Suggested Leads already shows.
  if (conferenceId) {
    const targetContact = await db.targetAccount.findFirst({
      where: {
        conferenceId,
        company:     { contains: companyKey },
        contactName: { not: null },
        ...(titleKey ? { contactRole: { contains: titleKey } } : {}),
      },
    })
    if (targetContact?.contactName) {
      const parts = targetContact.contactName.trim().split(' ')
      return NextResponse.json({
        person: {
          firstName:       parts[0],
          lastName:        parts.slice(1).join(' '),
          confidence:      'high',
          reasoning:       'Set as target contact for this conference',
          linkedinHint:    null,
          previousContext: null,
          warmth:          null,
          needsReview:     false,
          sourceUrl:       null,
        },
        source: 'target_account',
      })
    }
  }

  // ── 2. Check PersonEnrichment cache ──────────────────────────────────────
  const cached = await db.personEnrichment.findUnique({
    where: { company_jobTitle: { company: companyKey, jobTitle: titleKey } },
  })
  if (cached && isFresh(cached.lastEnrichedAt)) {
    return NextResponse.json({
      person: {
        firstName:       cached.firstName,
        lastName:        cached.lastName,
        confidence:      cached.confidence.toLowerCase(),
        reasoning:       cached.summary || 'From enrichment cache',
        linkedinHint:    cached.linkedinUrl || null,
        previousContext: cached.previousContext,
        warmth:          cached.warmth,
        needsReview:     cached.needsReview,
        sourceUrl:       cached.sourceUrl || null,
      },
      source: 'cache',
    })
  }

  // ── 3. Web search via Brave Search API ──────────────────────────────────
  if (serperApiKey) {
    const queries = [
      `site:linkedin.com/in "${company}" "${jobTitle}"`,
      `"${company}" "${jobTitle}" LinkedIn`,
    ]
    if (conferenceName) {
      queries.push(`"${company}" "${jobTitle}" "${conferenceName}" LinkedIn`)
    }

    for (const query of queries) {
      const found = await searchSerper(query, serperApiKey, company, jobTitle)
      if (found && found.confidence !== 'low') {
        await db.personEnrichment.upsert({
          where: { company_jobTitle: { company: companyKey, jobTitle: titleKey } },
          create: {
            company:        companyKey,
            jobTitle:       titleKey,
            firstName:      found.firstName,
            lastName:       found.lastName,
            linkedinUrl:    found.linkedinUrl,
            sourceUrl:      found.sourceUrl,
            dataSource:     'WEB_SEARCH',
            confidence:     found.confidence.toUpperCase(),
            needsReview:    found.needsReview,
            lastEnrichedAt: new Date(),
          },
          update: {
            firstName:      found.firstName,
            lastName:       found.lastName,
            linkedinUrl:    found.linkedinUrl,
            sourceUrl:      found.sourceUrl,
            dataSource:     'WEB_SEARCH',
            confidence:     found.confidence.toUpperCase(),
            needsReview:    found.needsReview,
            lastEnrichedAt: new Date(),
          },
        })

        return NextResponse.json({
          person: {
            firstName:       found.firstName,
            lastName:        found.lastName,
            confidence:      found.confidence,
            reasoning:       found.reasoning,
            linkedinHint:    found.linkedinUrl,
            previousContext: null,
            warmth:          null,
            needsReview:     found.needsReview,
            sourceUrl:       found.sourceUrl,
          },
          source: 'web_search',
        })
      }
    }
    // Searches returned no reliable match — fall through to AI
  }

  // ── 4. AI fallback (estimate only — always marked needsReview) ──────────
  if (!aiApiKey) {
    if (cached) {
      return NextResponse.json({
        person: {
          firstName:       cached.firstName,
          lastName:        cached.lastName,
          confidence:      cached.confidence.toLowerCase(),
          reasoning:       'Stale cache (no search or AI key configured)',
          linkedinHint:    cached.linkedinUrl || null,
          previousContext: cached.previousContext,
          warmth:          cached.warmth,
          needsReview:     true,
          sourceUrl:       cached.sourceUrl || null,
        },
        source: 'stale_cache',
      })
    }
    return NextResponse.json({ person: null, reason: 'no_key' })
  }

  const confContext = conferenceName ? ` attending ${conferenceName}` : ''

  const systemPrompt = `You are a sales intelligence assistant. Given a company and job role, identify who holds (or recently held) that position.

Return ONLY a JSON object — no code fences, no extra text:
{
  "firstName": null,
  "lastName": null,
  "confidence": "high|medium|low",
  "reasoning": "One sentence explaining why you think this is the right person",
  "linkedinHint": null,
  "summary": "One sentence professional summary of this person if known"
}

Rules:
- Only provide firstName/lastName if you are genuinely confident from training data
- Do NOT fabricate names — return null if uncertain
- linkedinHint format: "linkedin.com/in/slug" or null
- This is an AI estimate only; mark confidence accurately`

  const prompt = `Company: ${company}
Role: ${jobTitle}${confContext}

Who is likely the ${jobTitle} at ${company}?`

  try {
    let raw: string

    if (provider === 'ANTHROPIC') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': aiApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Anthropic API error')
      raw = data.content[0].text
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${aiApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
          max_tokens: 256,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'OpenAI API error')
      raw = data.choices[0].message.content
    }

    const start = raw.indexOf('{')
    if (start === -1) throw new Error('No JSON in AI response')
    let depth = 0, end = -1
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === '{') depth++
      else if (raw[i] === '}') { if (--depth === 0) { end = i; break } }
    }
    if (end === -1) throw new Error('Unbalanced JSON in AI response')
    const result = JSON.parse(raw.slice(start, end + 1))

    // AI suggestions always need review — they're estimates from training data only
    const needsReview = true

    await db.personEnrichment.upsert({
      where: { company_jobTitle: { company: companyKey, jobTitle: titleKey } },
      create: {
        company:        companyKey,
        jobTitle:       titleKey,
        firstName:      result.firstName  || null,
        lastName:       result.lastName   || null,
        linkedinUrl:    result.linkedinHint || null,
        summary:        result.summary    || null,
        dataSource:     provider === 'ANTHROPIC' ? 'AI_ANTHROPIC' : 'AI_OPENAI',
        confidence:     (result.confidence || 'LOW').toUpperCase(),
        needsReview,
        lastEnrichedAt: new Date(),
      },
      update: {
        firstName:      result.firstName  || null,
        lastName:       result.lastName   || null,
        linkedinUrl:    result.linkedinHint || null,
        summary:        result.summary    || null,
        dataSource:     provider === 'ANTHROPIC' ? 'AI_ANTHROPIC' : 'AI_OPENAI',
        confidence:     (result.confidence || 'LOW').toUpperCase(),
        needsReview,
        lastEnrichedAt: new Date(),
      },
    })

    return NextResponse.json({
      person: {
        firstName:       result.firstName   || null,
        lastName:        result.lastName    || null,
        confidence:      result.confidence  || 'low',
        reasoning:       result.reasoning   || '',
        linkedinHint:    result.linkedinHint || null,
        previousContext: null,
        warmth:          null,
        needsReview,
        sourceUrl:       null,
      },
      source: 'ai',
    })
  } catch (err) {
    if (cached) {
      return NextResponse.json({
        person: {
          firstName:       cached.firstName,
          lastName:        cached.lastName,
          confidence:      cached.confidence.toLowerCase(),
          reasoning:       'Stale cache',
          linkedinHint:    cached.linkedinUrl || null,
          previousContext: cached.previousContext,
          warmth:          cached.warmth,
          needsReview:     true,
          sourceUrl:       cached.sourceUrl || null,
        },
        source: 'stale_cache',
      })
    }
    return NextResponse.json({ person: null, reason: 'ai_error', error: String(err) })
  }
}
