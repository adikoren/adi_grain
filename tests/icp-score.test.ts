import { describe, it, expect } from 'vitest'
import {
  scoreConference,
  scoreBreakdown,
  scoreToTier,
  scoreIcpBadge,
  scoreLead,
  leadTemperature,
  temperatureBadgeClass,
} from '../lib/icp-score'

// ── scoreConference ───────────────────────────────────────────────────────────

describe('scoreConference', () => {
  const base = { verticals: ['FX'], estimatedAudience: 5000, country: 'GB', startDate: new Date('2024-10-15') }

  it('maxes out at 100 for a perfect Tier-A conference', () => {
    const score = scoreConference(base)
    expect(score).toBeLessThanOrEqual(100)
    expect(score).toBeGreaterThanOrEqual(70)
  })

  it('gives 25 FX-pain points for top verticals (FX/TREASURY/PAYMENTS)', () => {
    const withFX      = scoreConference({ ...base, verticals: ['FX'] })
    const withTreasury = scoreConference({ ...base, verticals: ['TREASURY'] })
    const withPayments = scoreConference({ ...base, verticals: ['PAYMENTS'] })
    expect(withFX).toEqual(withTreasury)
    expect(withFX).toEqual(withPayments)
  })

  it('gives mid-tier FX-pain points for FINTECH/TRAVEL/MARKETPLACE', () => {
    const mid  = scoreConference({ ...base, verticals: ['FINTECH'] })
    const top  = scoreConference({ ...base, verticals: ['FX'] })
    expect(mid).toBeLessThan(top)
  })

  it('gives 0 FX-pain points for unrelated verticals', () => {
    const unrelated = scoreConference({ ...base, verticals: ['RETAIL'] })
    const top       = scoreConference({ ...base, verticals: ['FX'] })
    expect(unrelated).toBeLessThan(top)
  })

  it('scores audience ≥5000 higher than <500', () => {
    const large = scoreConference({ ...base, estimatedAudience: 5000 })
    const small = scoreConference({ ...base, estimatedAudience: 100 })
    expect(large).toBeGreaterThan(small)
  })

  it('scores key markets (GB/US/SG) higher than non-key markets', () => {
    const key    = scoreConference({ ...base, country: 'US' })
    const nonKey = scoreConference({ ...base, country: 'XX' })
    expect(key).toBeGreaterThan(nonKey)
  })

  it('scores autumn months (Sep–Nov) highest for agenda relevance', () => {
    const autumn = scoreConference({ ...base, startDate: new Date('2024-10-15') })
    const winter = scoreConference({ ...base, startDate: new Date('2024-01-15') })
    expect(autumn).toBeGreaterThan(winter)
  })

  it('never exceeds 100', () => {
    const score = scoreConference({ verticals: ['FX', 'TREASURY', 'PAYMENTS', 'FINTECH'], estimatedAudience: 99999, country: 'GB', startDate: new Date('2024-10-01') })
    expect(score).toBeLessThanOrEqual(100)
  })

  it('handles missing optional fields (null audience, no country)', () => {
    expect(() => scoreConference({ verticals: [], estimatedAudience: null, country: undefined, startDate: new Date() })).not.toThrow()
  })
})

// ── scoreBreakdown ────────────────────────────────────────────────────────────

describe('scoreBreakdown', () => {
  const base = { verticals: ['FX'], estimatedAudience: 2000, country: 'GB', startDate: new Date('2024-10-10') }

  it('returns exactly 5 dimensions', () => {
    const breakdown = scoreBreakdown(base)
    expect(breakdown).toHaveLength(5)
  })

  it('has the expected dimension keys', () => {
    const keys = scoreBreakdown(base).map(d => d.key)
    expect(keys).toEqual(['fxPain', 'density', 'dm', 'agenda', 'networking'])
  })

  it('sum matches scoreConference output', () => {
    const breakdown = scoreBreakdown(base)
    const total = breakdown.reduce((s, d) => s + d.score, 0)
    const direct = scoreConference(base)
    expect(total).toBe(direct)
  })

  it('each dimension score is within its max', () => {
    const breakdown = scoreBreakdown(base)
    for (const d of breakdown) {
      expect(d.score).toBeGreaterThanOrEqual(0)
      expect(d.score).toBeLessThanOrEqual(d.max)
    }
  })

  it('fxPain max is 25', () => {
    const d = scoreBreakdown(base).find(d => d.key === 'fxPain')!
    expect(d.max).toBe(25)
  })

  it('density max is 30', () => {
    const d = scoreBreakdown(base).find(d => d.key === 'density')!
    expect(d.max).toBe(30)
  })

  it('networking gives 10 for 2+ deep-network verticals', () => {
    const d = scoreBreakdown({ ...base, verticals: ['FX', 'TREASURY'] }).find(d => d.key === 'networking')!
    expect(d.score).toBe(10)
  })

  it('networking gives 6 for fewer than 2 deep-network verticals', () => {
    const d = scoreBreakdown({ ...base, verticals: ['FX'] }).find(d => d.key === 'networking')!
    expect(d.score).toBe(6)
  })
})

// ── scoreToTier ───────────────────────────────────────────────────────────────

describe('scoreToTier', () => {
  it('returns A for score ≥ 70', () => {
    expect(scoreToTier(70)).toBe('A')
    expect(scoreToTier(100)).toBe('A')
    expect(scoreToTier(85)).toBe('A')
  })

  it('returns B for score 45–69', () => {
    expect(scoreToTier(45)).toBe('B')
    expect(scoreToTier(69)).toBe('B')
    expect(scoreToTier(55)).toBe('B')
  })

  it('returns C for score < 45', () => {
    expect(scoreToTier(0)).toBe('C')
    expect(scoreToTier(44)).toBe('C')
    expect(scoreToTier(10)).toBe('C')
  })

  it('boundary: 70 is A, 69 is B, 45 is B, 44 is C', () => {
    expect(scoreToTier(70)).toBe('A')
    expect(scoreToTier(69)).toBe('B')
    expect(scoreToTier(45)).toBe('B')
    expect(scoreToTier(44)).toBe('C')
  })
})

// ── scoreIcpBadge ─────────────────────────────────────────────────────────────

describe('scoreIcpBadge', () => {
  it('returns tier-a className for A tier', () => {
    const badge = scoreIcpBadge(80)
    expect(badge.tier).toBe('A')
    expect(badge.className).toBe('tier-a')
    expect(badge.label).toBe('A · 80')
  })

  it('returns tier-b className for B tier', () => {
    const badge = scoreIcpBadge(55)
    expect(badge.tier).toBe('B')
    expect(badge.className).toBe('tier-b')
    expect(badge.label).toBe('B · 55')
  })

  it('returns tier-c className for C tier', () => {
    const badge = scoreIcpBadge(30)
    expect(badge.tier).toBe('C')
    expect(badge.className).toBe('tier-c')
    expect(badge.label).toBe('C · 30')
  })

  it('label includes tier letter and score', () => {
    const badge = scoreIcpBadge(72)
    expect(badge.label).toMatch(/^A · 72$/)
  })

  it('does not expose .bg or .color properties', () => {
    const badge = scoreIcpBadge(80) as any
    expect(badge.bg).toBeUndefined()
    expect(badge.color).toBeUndefined()
  })
})

// ── scoreLead ─────────────────────────────────────────────────────────────────

describe('scoreLead', () => {
  it('scores C-suite titles highly', () => {
    const score = scoreLead({ jobTitle: 'CFO', company: 'Acme' })
    expect(score).toBeGreaterThan(70)
  })

  it('scores FX-relevant titles with a bonus', () => {
    const fx  = scoreLead({ jobTitle: 'Head of Treasury', company: 'Acme' })
    const std = scoreLead({ jobTitle: 'Head of Marketing', company: 'Acme' })
    expect(fx).toBeGreaterThan(std)
  })

  it('scores fintech companies with a bonus', () => {
    const fintech  = scoreLead({ jobTitle: 'Analyst', company: 'Stripe Payments' })
    const generic  = scoreLead({ jobTitle: 'Analyst', company: 'Generic Corp' })
    expect(fintech).toBeGreaterThan(generic)
  })

  it('never exceeds 100', () => {
    const score = scoreLead({ jobTitle: 'CFO', company: 'FX Exchange Bank' })
    expect(score).toBeLessThanOrEqual(100)
  })

  it('handles null/undefined fields gracefully', () => {
    expect(() => scoreLead({ jobTitle: null, company: null })).not.toThrow()
    expect(() => scoreLead({})).not.toThrow()
  })

  it('returns a number', () => {
    expect(typeof scoreLead({ jobTitle: 'VP Sales', company: 'Acme' })).toBe('number')
  })
})

// ── leadTemperature ───────────────────────────────────────────────────────────

describe('leadTemperature', () => {
  it('returns Qualified when demo_requested is tagged', () => {
    expect(leadTemperature(['demo_requested'])).toBe('Qualified')
  })

  it('returns Qualified when fx_pain + decision_maker are both tagged', () => {
    expect(leadTemperature(['fx_pain', 'decision_maker'])).toBe('Qualified')
  })

  it('returns Warm for fx_pain alone', () => {
    expect(leadTemperature(['fx_pain'])).toBe('Warm')
  })

  it('returns Warm for champion tag', () => {
    expect(leadTemperature(['champion'])).toBe('Warm')
  })

  it('returns Warm for needs_followup tag', () => {
    expect(leadTemperature(['needs_followup'])).toBe('Warm')
  })

  it('returns Cold for tire_kicker', () => {
    expect(leadTemperature(['tire_kicker'])).toBe('Cold')
  })

  it('returns Cold for not_relevant', () => {
    expect(leadTemperature(['not_relevant'])).toBe('Cold')
  })

  it('returns Cold for empty tags', () => {
    expect(leadTemperature([])).toBe('Cold')
  })

  it('Qualified takes precedence over Warm signals', () => {
    expect(leadTemperature(['demo_requested', 'fx_pain'])).toBe('Qualified')
  })
})

// ── temperatureBadgeClass ─────────────────────────────────────────────────────

describe('temperatureBadgeClass', () => {
  it('maps Qualified → lead-qualified', () => {
    expect(temperatureBadgeClass('Qualified')).toBe('lead-qualified')
  })

  it('maps Warm → lead-warm', () => {
    expect(temperatureBadgeClass('Warm')).toBe('lead-warm')
  })

  it('maps Cold → lead-cold', () => {
    expect(temperatureBadgeClass('Cold')).toBe('lead-cold')
  })
})
