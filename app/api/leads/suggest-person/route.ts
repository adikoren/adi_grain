import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const CACHE_DAYS = 7
const INTERNAL_CONFIDENCE_THRESHOLD = 0.90

function isFresh(date: Date): boolean {
  return (Date.now() - date.getTime()) < CACHE_DAYS * 24 * 60 * 60 * 1000
}

// Fuzzy confidence score for company+role match against an existing Lead
function matchConfidence(lead: { company: string; jobTitle: string | null }, company: string, jobTitle: string): number {
  const normalize = (s: string) => s.toLowerCase().trim()
  const companyMatch = normalize(lead.company).includes(normalize(company)) ||
                       normalize(company).includes(normalize(lead.company))
  if (!companyMatch) return 0
  if (!lead.jobTitle || !jobTitle) return 0.70 // company only
  const titleMatch = normalize(lead.jobTitle).includes(normalize(jobTitle)) ||
                     normalize(jobTitle).includes(normalize(lead.jobTitle))
  return titleMatch ? 0.95 : 0.65
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { company, jobTitle, conferenceName } = await req.json()
  if (!company || !jobTitle) return NextResponse.json({ person: null, reason: 'missing_params' })

  const companyKey = company.toLowerCase().trim()
  const titleKey   = jobTitle.toLowerCase().trim()

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

    // Upsert PersonEnrichment record linking to this lead
    await db.personEnrichment.upsert({
      where: { company_jobTitle: { company: companyKey, jobTitle: titleKey } },
      create: {
        company:         companyKey,
        jobTitle:        titleKey,
        firstName:       lead.firstName,
        lastName:        lead.lastName,
        linkedinUrl:     lead.linkedinUrl  || null,
        summary:         lead.aiSummary   || null,
        warmth:          'WARM',
        previousContext,
        dataSource:      'INTERNAL',
        confidence:      confidence >= 0.95 ? 'HIGH' : 'MEDIUM',
        matchedLeadId:   lead.id,
        lastEnrichedAt:  new Date(),
      },
      update: {
        firstName:       lead.firstName,
        lastName:        lead.lastName,
        linkedinUrl:     lead.linkedinUrl  || undefined,
        summary:         lead.aiSummary   || undefined,
        warmth:          'WARM',
        previousContext,
        dataSource:      'INTERNAL',
        confidence:      confidence >= 0.95 ? 'HIGH' : 'MEDIUM',
        matchedLeadId:   lead.id,
        lastEnrichedAt:  new Date(),
      },
    })

    return NextResponse.json({
      person: {
        firstName:       lead.firstName,
        lastName:        lead.lastName,
        confidence:      confidence >= 0.95 ? 'high' : 'medium',
        reasoning:       `Already in your system — met at ${lead.conferences.length} conference${lead.conferences.length !== 1 ? 's' : ''}`,
        linkedinHint:    lead.linkedinUrl  || null,
        previousContext,
        warmth:          'WARM',
      },
      source: 'internal',
      leadId: lead.id,
    })
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
      },
      source: 'cache',
    })
  }

  // ── 3. Generate via AI ────────────────────────────────────────────────────
  const cfg = await db.systemConfig.findUnique({ where: { id: 'singleton' } })
  const provider = cfg?.aiProvider || 'OPENAI'
  const apiKey   = cfg?.aiApiKey  || null

  if (!apiKey) {
    if (cached) return NextResponse.json({ person: { firstName: cached.firstName, lastName: cached.lastName, confidence: cached.confidence.toLowerCase(), reasoning: 'Stale cache (no AI key)', linkedinHint: cached.linkedinUrl || null, previousContext: cached.previousContext, warmth: cached.warmth }, source: 'stale_cache' })
    return NextResponse.json({ person: null, reason: 'no_key' })
  }

  const confContext = conferenceName ? ` attending ${conferenceName}` : ''

  const systemPrompt = `You are a sales intelligence assistant. Given a company and role, identify who holds (or recently held) that position.

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
- linkedinHint format: "linkedin.com/in/slug" or null`

  const prompt = `Company: ${company}
Role: ${jobTitle}${confContext}

Who is likely the ${jobTitle} at ${company}?`

  try {
    let raw: string

    if (provider === 'ANTHROPIC') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
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
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in AI response')
    const result = JSON.parse(jsonMatch[0])

    // ── Persist to DB ───────────────────────────────────────────────────────
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
        lastEnrichedAt: new Date(),
      },
      update: {
        firstName:      result.firstName  || null,
        lastName:       result.lastName   || null,
        linkedinUrl:    result.linkedinHint || null,
        summary:        result.summary    || null,
        dataSource:     provider === 'ANTHROPIC' ? 'AI_ANTHROPIC' : 'AI_OPENAI',
        confidence:     (result.confidence || 'LOW').toUpperCase(),
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
      },
      source: 'ai',
    })
  } catch (err) {
    if (cached) return NextResponse.json({ person: { firstName: cached.firstName, lastName: cached.lastName, confidence: cached.confidence.toLowerCase(), reasoning: 'Stale cache', linkedinHint: cached.linkedinUrl || null, previousContext: cached.previousContext, warmth: cached.warmth }, source: 'stale_cache' })
    return NextResponse.json({ person: null, reason: 'ai_error', error: String(err) })
  }
}
