import { getConfig } from './config'

async function callLLM(prompt: string, systemPrompt: string): Promise<string> {
  const cfg = await getConfig()
  const apiKey = cfg.aiApiKey
  if (!apiKey) throw new Error('AI API key not configured. Ask your admin to set it up.')

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
  const signOff = lead.repName || 'The Team'

  const system = `You are an expert B2B sales rep at a fintech company that helps businesses
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
  const system = `You are a sales intelligence analyst at a fintech FX hedging company.
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
  const system = `You are a sales strategist at a fintech company serving PSPs, payment providers,
travel wholesalers, and companies with FX exposure. Score conference ICP fit 0-100.
Return JSON: {"score": number, "reasoning": "1-2 sentence explanation"}`

  const prompt = `Score this conference for our ICP:
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

// ── Feature: Conference attendee identification ───────────────────────────────

export async function identifyConferenceAttendees(conf: {
  name: string
  city: string
  country: string
  verticals: string[]
  estimatedAudience?: number
  startDate?: string
  pageContent?: string
}): Promise<Array<{
  name: string
  website: string | null
  contactName: string | null
  contactRole: string | null
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  companyType: string | null
  source: string
}>> {
  const system = `You are a sales intelligence analyst at a fintech company providing FX hedging and risk management for businesses with currency exposure.

Identify companies likely attending this conference that are relevant prospects for us.

Target customers:
- Payment Service Providers (PSPs) with cross-border flows
- Banks, broker-dealers, FX venues
- Treasury-heavy corporates with global operations
- Fintechs with multi-currency products or embedded FX
- Travel companies, remittance companies
- Companies with significant FX risk

Use your knowledge of this conference and its typical attendees. If page content is provided, extract explicitly mentioned companies first, then supplement with likely attendees you know.

Return a JSON array (max 25 items). Each item:
{
  "name": "Company display name",
  "website": "URL or null",
  "contactName": "Person name if mentioned in content, or null",
  "contactRole": "Job title if mentioned in content, or null",
  "priority": "HIGH | MEDIUM | LOW",
  "companyType": "PSP | Bank | Fintech | Corporate | Travel | Remittance | Other",
  "source": "sponsor | exhibitor | speaker | known_attendee | likely_attendee"
}

Priority rules:
- HIGH: PSP, cross-border payment company, bank/broker, FX venue, treasury corporate, fintech with multi-currency or hedging
- MEDIUM: Fintech with international operations, marketplace, travel company, asset manager with FX exposure
- LOW: Technology vendor, consultancy, regulator, media/events company

Always return at least 10 relevant companies. If page content lists them, use those. Otherwise use your knowledge of who attends this type of conference.

IMPORTANT: Respond with ONLY the raw JSON array. No explanation, no markdown, no code fences. Start your response with [ and end with ].`

  const contentSection = conf.pageContent
    ? `\n\nConference page content (use this first):\n${conf.pageContent.slice(0, 8000)}`
    : ''

  const prompt = `Conference: ${conf.name}
Location: ${conf.city}, ${conf.country}
Date: ${conf.startDate || 'upcoming'}
Verticals: ${conf.verticals.join(', ') || 'fintech, payments'}
Audience size: ${conf.estimatedAudience || 'unknown'}${contentSection}

Return a JSON array of companies attending this conference relevant to us.`

  const raw = await callLLM(prompt, system)
  return parseJsonArray(raw)
}

function parseJsonArray(raw: string): any[] {
  const cleaned = raw.replace(/```json|```/g, '').trim()

  // Try bracket-counting to find the first complete JSON array
  const start = cleaned.indexOf('[')
  if (start !== -1) {
    let depth = 0, end = -1
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === '[') depth++
      else if (cleaned[i] === ']') { if (--depth === 0) { end = i; break } }
    }
    if (end !== -1) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { /* fall through */ }
    }
  }

  // Try unwrapping {"companies": [...]} or similar object wrapper
  const objStart = cleaned.indexOf('{')
  if (objStart !== -1) {
    let depth = 0, objEnd = -1
    for (let i = objStart; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++
      else if (cleaned[i] === '}') { if (--depth === 0) { objEnd = i; break } }
    }
    if (objEnd !== -1) {
      try {
        const obj = JSON.parse(cleaned.slice(objStart, objEnd + 1))
        const arr = obj.companies ?? obj.attendees ?? obj.results ?? Object.values(obj).find(Array.isArray)
        if (Array.isArray(arr)) return arr
      } catch { /* fall through */ }
    }
  }

  throw new Error('Could not parse AI response as JSON. Please try again.')
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
