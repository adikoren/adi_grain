import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

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
    // Discard WAF/bot-block pages (too short or known block patterns)
    if (!text || text.length < 200 || /incident id|cloudflare|access denied|captcha/i.test(text)) return null
    return text
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { company, jobTitle, conferenceId, conferenceName, website } = await req.json()

  const cfg = await db.systemConfig.findUnique({ where: { id: 'singleton' } })
  const provider = cfg?.aiProvider || 'OPENAI'
  const apiKey = cfg?.aiApiKey || null

  if (!apiKey) {
    return NextResponse.json({ suggestions: null, reason: 'no_key' })
  }

  // Fetch company website in parallel with building the prompt
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

  try {
    let raw: string

    if (provider === 'ANTHROPIC') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
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
      // Default: OpenAI
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'OpenAI API error')
      raw = data.choices[0].message.content
    }

    // Extract the JSON object — guard against any trailing prose
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object in AI response')
    const suggestions = JSON.parse(jsonMatch[0])
    return NextResponse.json({ suggestions })
  } catch (err) {
    return NextResponse.json({ suggestions: null, reason: 'ai_error', error: String(err) })
  }
}
