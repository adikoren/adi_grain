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
    // Strip scripts, styles, and tags; collapse whitespace
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

  // Fetch company website in parallel with DB call (already done above)
  const websiteText = website ? await fetchWebsiteText(website) : null

  const confContext = conferenceName ? ` attending ${conferenceName}` : conferenceId ? ' at an industry conference' : ''

  const systemPrompt = `You are a sales intelligence assistant at Grain, a fintech company providing FX (foreign exchange) hedging and risk management for businesses. Grain serves PSPs, payment providers, travel companies, and any businesses with FX exposure.

When asked about a person's role at a company, provide:
1. Brief company context relevant to FX/payments (1-2 sentences)
2. Why this role/company matters for Grain specifically (1-2 sentences)
3. A suggested conversation or follow-up angle (1-2 sentences)
4. A suggested person: if you know from your training data who holds (or recently held) this role at this company, return their name. Only give a real name you are confident about — do NOT fabricate. If uncertain, return null for firstName/lastName.

Return your response as JSON only — no prose, no code fences, just the object:
{
  "context": "...",
  "icpRelevance": "...",
  "followUpAngle": "...",
  "suggestedPerson": {
    "firstName": null,
    "lastName": null,
    "confidence": "high|medium|low",
    "reasoning": "one sentence why you think this is them",
    "linkedinHint": null
  }
}`

  const websiteSection = websiteText
    ? `\n\nCompany website content (use this for accurate context):\n${websiteText}`
    : ''

  const prompt = `Company: ${company}
Role: ${jobTitle || 'Unknown'}${confContext}${websiteSection}

Provide brief, actionable intelligence for a Grain sales rep meeting this person, and suggest who this person might be.`

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
          max_tokens: 512,
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
          max_tokens: 512,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'OpenAI API error')
      raw = data.choices[0].message.content
    }

    // Extract the JSON object — AI sometimes appends extra text after the closing fence
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object in AI response')
    const suggestions = JSON.parse(jsonMatch[0])
    return NextResponse.json({ suggestions })
  } catch (err) {
    return NextResponse.json({ suggestions: null, reason: 'ai_error', error: String(err) })
  }
}
