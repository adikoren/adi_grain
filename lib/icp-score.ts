// ICP Scoring Engine — 5 dimensions, max 100, no competitor bonus
//
// Dimensions:
//   icpCompanyDensity    0–30  (target companies expected to attend)
//   decisionMakerQuality 0–25  (C-suite / VP density)
//   fxPainRelevance      0–25  (FX / treasury / cross-border content)
//   agendaRelevance      0–10  (sessions matching Grain topics)
//   networkingQuality    0–10  (structured networking, hosted buyers)
//                      ──────
//   Max                   100
//
// Tiers: A ≥ 70  ·  B 45–69  ·  C < 45

export function scoreConference(conf: {
  verticals: string[]
  estimatedAudience?: number | null
  country?: string
  startDate: Date
}): number {
  let score = 0

  // ── 1. FX Pain Relevance (proxy: vertical fit) — 0–25 ──────────────────────
  const topV = ['FX', 'TREASURY', 'PAYMENTS']
  const midV = ['FINTECH', 'TRAVEL', 'MARKETPLACE']
  const v = conf.verticals.map((x) => x.toUpperCase())
  if (v.some((x) => topV.includes(x))) score += 25
  else if (v.some((x) => midV.includes(x))) score += 16

  // ── 2. ICP Company Density (proxy: audience size) — 0–30 ───────────────────
  const aud = conf.estimatedAudience ?? 0
  if (aud >= 5000) score += 30
  else if (aud >= 2000) score += 22
  else if (aud >= 500) score += 14
  else score += 6

  // ── 3. Decision Maker Quality (proxy: geography / key market) — 0–25 ────────
  const keyMarkets = ['GB', 'US', 'NL', 'DE', 'FR', 'SG', 'AE', 'PT', 'ES', 'CH']
  if (conf.country && keyMarkets.includes(conf.country.toUpperCase())) score += 22
  else score += 10

  // ── 4. Agenda Relevance (proxy: seasonality) — 0–10 ────────────────────────
  const month = conf.startDate.getMonth() + 1
  if (month >= 9 && month <= 11) score += 10
  else if (month >= 3 && month <= 8) score += 8
  else score += 4

  // ── 5. Networking Quality (proxy: vertical depth) — 0–10 ────────────────────
  const deepNetworkVerticals = ['FX', 'TREASURY', 'PAYMENTS', 'FINTECH']
  score += v.filter((x) => deepNetworkVerticals.includes(x)).length >= 2 ? 10 : 6

  return Math.min(Math.round(score), 100)
}

// ── Score breakdown by dimension ─────────────────────────────────────────────
export function scoreBreakdown(conf: {
  verticals: string[]
  estimatedAudience?: number | null
  country?: string
  startDate: Date
}) {
  const v = conf.verticals.map(x => x.toUpperCase())
  const topV = ['FX', 'TREASURY', 'PAYMENTS']
  const midV = ['FINTECH', 'TRAVEL', 'MARKETPLACE']
  const keyMarkets = ['GB', 'US', 'NL', 'DE', 'FR', 'SG', 'AE', 'PT', 'ES', 'CH']
  const deepNet = ['FX', 'TREASURY', 'PAYMENTS', 'FINTECH']
  const aud = conf.estimatedAudience ?? 0
  const month = new Date(conf.startDate).getMonth() + 1

  const fxPain     = v.some(x => topV.includes(x)) ? 25 : v.some(x => midV.includes(x)) ? 16 : 0
  const density    = aud >= 5000 ? 30 : aud >= 2000 ? 22 : aud >= 500 ? 14 : 6
  const dmQuality  = conf.country && keyMarkets.includes(conf.country.toUpperCase()) ? 22 : 10
  const agenda     = month >= 9 && month <= 11 ? 10 : month >= 3 && month <= 8 ? 8 : 4
  const networking = v.filter(x => deepNet.includes(x)).length >= 2 ? 10 : 6

  return [
    { key: 'fxPain',      label: 'FX Pain Relevance',       score: fxPain,    max: 25 },
    { key: 'density',     label: 'ICP Company Density',      score: density,   max: 30 },
    { key: 'dm',          label: 'Decision Maker Quality',   score: dmQuality, max: 25 },
    { key: 'agenda',      label: 'Agenda Relevance',         score: agenda,    max: 10 },
    { key: 'networking',  label: 'Networking Quality',       score: networking,max: 10 },
  ]
}

// ── Tier classification ───────────────────────────────────────────────────────
export function scoreToTier(score: number): 'A' | 'B' | 'C' {
  if (score >= 70) return 'A'
  if (score >= 45) return 'B'
  return 'C'
}

// ── Badge helper — light theme ────────────────────────────────────────────────
export function scoreIcpBadge(score: number): {
  label: string   // e.g. "A · 94"
  tier: 'A' | 'B' | 'C'
  className: string   // Tailwind classes for the badge
} {
  const tier = scoreToTier(score)
  const label = `${tier} · ${score}`
  if (tier === 'A') return { label, tier, className: 'tier-a' }
  if (tier === 'B') return { label, tier, className: 'tier-b' }
  return { label, tier, className: 'tier-c' }
}

// ── Lead quality score ────────────────────────────────────────────────────────
export function scoreLead(lead: {
  jobTitle?: string | null
  company?: string | null
}): number {
  let score = 50
  const title = (lead.jobTitle || '').toLowerCase()
  const company = (lead.company || '').toLowerCase()

  if (/\b(cfo|ceo|coo|treasurer|head of|vp|svp|evp|chief|president|director)\b/.test(title)) score += 25
  else if (/\b(manager|lead|senior|principal)\b/.test(title)) score += 15
  else if (/\b(analyst|associate|specialist)\b/.test(title)) score += 5

  if (/\b(treasury|fx|forex|currency|payments?|cross.border|hedge|hedging)\b/.test(title)) score += 15

  if (/\b(bank|fintech|payments?|transfer|remittance|forex|exchange|psp|acquirer|processor)\b/.test(company)) score += 10

  return Math.min(Math.round(score), 100)
}

// ── Lead temperature from tags ────────────────────────────────────────────────
export function leadTemperature(tags: string[]): 'Qualified' | 'Warm' | 'Cold' {
  if (
    tags.includes('demo_requested') ||
    (tags.includes('fx_pain') && tags.includes('decision_maker'))
  ) return 'Qualified'
  if (tags.includes('fx_pain') || tags.includes('champion') || tags.includes('needs_followup')) return 'Warm'
  if (tags.includes('tire_kicker') || tags.includes('not_relevant')) return 'Cold'
  return 'Cold'
}

export function temperatureBadgeClass(temp: 'Qualified' | 'Warm' | 'Cold'): string {
  if (temp === 'Qualified') return 'lead-qualified'
  if (temp === 'Warm') return 'lead-warm'
  return 'lead-cold'
}
