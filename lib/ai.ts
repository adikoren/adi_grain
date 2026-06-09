import { getConfig } from './config'

async function callLLM(prompt: string, systemPrompt: string): Promise<string> {
  const cfg = await getConfig()
  const { aiProvider: provider, aiApiKey: apiKey } = cfg
  if (!apiKey) throw new Error('AI API key not configured. Ask your admin to set it up.')

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || 'Anthropic API error')
    return data.content[0].text
  }

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
      max_tokens: 1024,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'OpenAI API error')
  return data.choices[0].message.content
}

// ── Feature: Follow-up email draft ────────────────────────────────────────────

export async function draftFollowUpEmail(lead: {
  firstName: string
  lastName: string
  company: string
  jobTitle?: string | null
  notes?: string | null
  conferenceName?: string
  repName?: string | null
}): Promise<string> {
  const signOff = lead.repName || 'The Grain Team'

  const system = `You are an expert B2B sales rep at Grain, a fintech company that helps businesses
manage FX (foreign exchange) risk through embedded hedging. Write concise, warm,
personalised follow-up emails. Keep under 150 words. No fluff.`

  const prompt = `Write a follow-up email to ${lead.firstName} ${lead.lastName},
${lead.jobTitle || 'professional'} at ${lead.company},
met at ${lead.conferenceName || 'a conference'}.
Notes from meeting: ${lead.notes || 'General interest in FX risk management'}.
Sign off with the sender's name: "${signOff}". Subject line included.`

  return callLLM(prompt, system)
}

// ── Feature: Relationship arc summary ────────────────────────────────────────

export async function summariseRelationshipArc(appearances: {
  conferenceName: string
  date: string
  jobTitle?: string | null
  company?: string | null
  notes?: string | null
}[]): Promise<string> {
  const system = `You are a sales intelligence analyst at Grain, a fintech FX hedging company.
Analyse cross-conference contact patterns and give a brief, actionable "closing signal" interpretation.
Be direct. Max 3 sentences. Label the contact as Champion / Evaluator / Tire-kicker / Re-engaging.`

  const history = appearances
    .map((a) => `- ${a.date}: ${a.conferenceName} | ${a.jobTitle || 'unknown role'} at ${a.company || 'unknown co'} | Notes: ${a.notes || 'none'}`)
    .join('\n')

  const prompt = `This contact has appeared at ${appearances.length} conferences:\n${history}\n\nWhat is your closing signal assessment?`

  return callLLM(prompt, system)
}

// ── Feature: Conference ICP score (AI-enhanced) ───────────────────────────────

export async function aiScoreConference(conf: {
  name: string
  city: string
  country: string
  verticals: string[]
  estimatedAudience?: number | null
  website?: string | null
}): Promise<{ score: number; reasoning: string }> {
  const system = `You are a sales strategist at Grain, a fintech company serving PSPs, payment providers,
travel wholesalers, and companies with FX exposure. Score conference ICP fit 0-100.
Return JSON: {"score": number, "reasoning": "1-2 sentence explanation"}`

  const prompt = `Score this conference for Grain's ICP:
Name: ${conf.name}
Location: ${conf.city}, ${conf.country}
Verticals: ${conf.verticals.join(', ')}
Audience: ${conf.estimatedAudience || 'unknown'}
Website: ${conf.website || 'N/A'}`

  try {
    const raw = await callLLM(prompt, system)
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return { score: parsed.score, reasoning: parsed.reasoning }
  } catch {
    return { score: 0, reasoning: 'AI scoring unavailable' }
  }
}

// ── Feature: Conference discovery (AI + web content) ─────────────────────────

export async function discoverConferences(pageContent: string): Promise<
  Array<{
    name: string
    city: string
    country: string
    startDate: string
    endDate: string
    website: string
    verticals: string[]
    estimatedAudience: number
    notes: string
  }>
> {
  const system = `Extract fintech/payments/FX/travel conference data from the provided web page text.
Return a JSON array of conferences relevant to FX risk management, cross-border payments,
or travel finance. Each item: {name, city, country, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD),
website, verticals (array of: FINTECH|PAYMENTS|FX|TRAVEL|TREASURY|SAAS), estimatedAudience (number), notes}.
Only include real conferences with dates. Max 20 results.`

  try {
    const raw = await callLLM(pageContent.slice(0, 8000), system)
    const cleaned = raw.replace(/```json|```/g, '').trim()
    // Extract JSON array
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) return []
    return JSON.parse(match[0])
  } catch {
    return []
  }
}
