import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

const CACHE_DAYS = 30

async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url.startsWith('http') ? url : `https://${url}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrainBot/1.0)' },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)
    if (!text || text.length < 200 || /incident id|cloudflare|access denied|captcha/i.test(text)) return null
    return text
  } catch {
    return null
  }
}

function isFresh(date: Date): boolean {
  return (Date.now() - date.getTime()) < CACHE_DAYS * 24 * 60 * 60 * 1000
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let cached: Awaited<ReturnType<typeof db.companyEnrichment.findUnique>> = null

  try {
    const body = await req.json()
    const { company, jobTitle, conferenceId, conferenceName, website, targetId } = body

    if (!company || typeof company !== 'string') {
      return NextResponse.json({ suggestions: null, reason: 'ai_error', error: 'Missing company' })
    }

    const key = company.toLowerCase().trim()

    // ── Check DB cache first ──────────────────────────────────────────────────
    cached = await db.companyEnrichment.findUnique({ where: { company: key } })
    if (cached && isFresh(cached.lastEnrichedAt)) {
      return NextResponse.json({ suggestions: cached, source: 'cache' })
    }

    // ── Need to generate ──────────────────────────────────────────────────────
    const cfg = await db.systemConfig.findUnique({ where: { id: 'singleton' } })
    const provider = cfg?.aiProvider || 'OPENAI'
    const apiKey = cfg?.aiApiKey || null

    if (!apiKey) {
      if (cached) return NextResponse.json({ suggestions: cached, source: 'stale_cache' })
      return NextResponse.json({ suggestions: null, reason: 'no_key' })
    }

    const websiteText = website ? await fetchWebsiteText(website) : null
    const confContext = conferenceName ? ` attending ${conferenceName}` : conferenceId ? ' at an industry conference' : ''

    const systemPrompt = `You are a sales intelligence assistant at Grain, a fintech company providing FX (foreign exchange) hedging and risk management for businesses. Grain serves PSPs, payment providers, travel companies, and any business with FX exposure.

Your job is to produce a concise, practical company brief for a Grain sales rep before or during a meeting.

Return ONLY a JSON object — no code fences, no prose before or after. Use this exact schema:
{
  "whatTheyDo": "One sentence: what the company does",
  "grainRelevance": "Why this company is relevant to Grain (FX exposure, payments volume, etc.)",
  "market": "Primary market / industry vertical",
  "businessType": "B2B, B2C, or B2B2C",
  "fxRelevance": "Specific FX or multi-currency exposure at this company",
  "keyPeople": "Roles or names to approach (e.g. CFO, Head of Treasury, VP Payments)",
  "salesAngle": "One concrete opening line or angle for a Grain sales conversation",
  "suggestedPerson": {
    "firstName": null,
    "lastName": null,
    "confidence": "high|medium|low",
    "reasoning": "Why you think this person holds the role",
    "linkedinHint": null
  }
}

Rules:
- Keep every field to 1-2 short sentences maximum
- suggestedPerson.firstName/lastName: only provide if you are confident from training data — otherwise null
- Do NOT add any text outside the JSON object`

    const websiteSection = websiteText
      ? `\n\nCompany website content (use this for accurate context):\n${websiteText}`
      : ''

    const prompt = `Company: ${company}
Role to meet: ${jobTitle || 'Unknown'}${confContext}${websiteSection}

Generate a Company Brief for a Grain sales rep.`

    let raw: string

    if (provider === 'ANTHROPIC') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
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
          max_tokens: 600,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'OpenAI API error')
      raw = data.choices[0].message.content
    }

    // Find balanced JSON object (greedy regex fails if AI adds trailing text with braces)
    const start = raw.indexOf('{')
    if (start === -1) throw new Error('No JSON object in AI response')
    let depth = 0, end = -1
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === '{') depth++
      else if (raw[i] === '}') { if (--depth === 0) { end = i; break } }
    }
    if (end === -1) throw new Error('Unbalanced JSON in AI response')
    const suggestions = JSON.parse(raw.slice(start, end + 1))

    // ── Persist to DB ─────────────────────────────────────────────────────
    await db.companyEnrichment.upsert({
      where: { company: key },
      create: {
        company: key,
        displayName: company,
        whatTheyDo:     suggestions.whatTheyDo     || null,
        market:         suggestions.market         || null,
        businessType:   suggestions.businessType   || null,
        fxRelevance:    suggestions.fxRelevance    || null,
        grainRelevance: suggestions.grainRelevance || null,
        keyPeople:      suggestions.keyPeople      || null,
        salesAngle:     suggestions.salesAngle     || null,
        website:        website || null,
        dataSource:     provider === 'ANTHROPIC' ? 'AI_ANTHROPIC' : 'AI_OPENAI',
        confidence:     'HIGH',
        lastEnrichedAt: new Date(),
      },
      update: {
        whatTheyDo:     suggestions.whatTheyDo     || null,
        market:         suggestions.market         || null,
        businessType:   suggestions.businessType   || null,
        fxRelevance:    suggestions.fxRelevance    || null,
        grainRelevance: suggestions.grainRelevance || null,
        keyPeople:      suggestions.keyPeople      || null,
        salesAngle:     suggestions.salesAngle     || null,
        website:        website || undefined,
        dataSource:     provider === 'ANTHROPIC' ? 'AI_ANTHROPIC' : 'AI_OPENAI',
        confidence:     'HIGH',
        lastEnrichedAt: new Date(),
      },
    })

    // ── Sync non-empty brief fields back to TargetAccount (only fills empty fields) ─
    if (targetId) {
      try {
        const target = await db.targetAccount.findUnique({
          where: { id: targetId },
          select: { description: true, industry: true, relevanceReason: true },
        })
        if (target) {
          const patch: Record<string, string> = {}
          if (!target.description    && suggestions.whatTheyDo)     patch.description     = suggestions.whatTheyDo
          if (!target.industry       && suggestions.market)          patch.industry        = suggestions.market
          if (!target.relevanceReason && suggestions.grainRelevance) patch.relevanceReason = suggestions.grainRelevance
          if (Object.keys(patch).length > 0) {
            await db.targetAccount.update({ where: { id: targetId }, data: patch })
          }
        }
      } catch { /* non-critical — don't fail the whole request */ }
    }

    return NextResponse.json({ suggestions, source: 'ai' })
  } catch (err) {
    console.error('[suggest] error:', String(err))
    if (cached) return NextResponse.json({ suggestions: cached, source: 'stale_cache' })
    return NextResponse.json({ suggestions: null, reason: 'ai_error', error: String(err) })
  }
}
