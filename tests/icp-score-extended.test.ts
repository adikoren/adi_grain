import { describe, it, expect } from 'vitest'
import { leadTemperature, scoreBreakdown, scoreIcpBadge, scoreConference } from '../lib/icp-score'

// ── leadTemperature edge cases ────────────────────────────────────────────────

describe('leadTemperature (extended)', () => {
  it('empty array → Cold', () => {
    expect(leadTemperature([])).toBe('Cold')
  })

  it('demo_requested → Qualified', () => {
    expect(leadTemperature(['demo_requested'])).toBe('Qualified')
  })

  it('followed_up (unknown tag) → Cold (no match)', () => {
    // 'FOLLOWED_UP' uppercase does not match lowercase checks in source
    // The function uses lowercase tag names
    expect(leadTemperature(['followed_up'])).toBe('Cold')
  })

  it('needs_followup → Warm', () => {
    expect(leadTemperature(['needs_followup'])).toBe('Warm')
  })

  it('cold_lead (unknown tag) → Cold', () => {
    expect(leadTemperature(['cold_lead'])).toBe('Cold')
  })

  it('fx_pain + decision_maker → Qualified (combo override)', () => {
    expect(leadTemperature(['fx_pain', 'decision_maker'])).toBe('Qualified')
  })

  it('champion → Warm', () => {
    expect(leadTemperature(['champion'])).toBe('Warm')
  })

  it('tire_kicker → Cold', () => {
    expect(leadTemperature(['tire_kicker'])).toBe('Cold')
  })

  it('not_relevant → Cold', () => {
    expect(leadTemperature(['not_relevant'])).toBe('Cold')
  })

  it('fx_pain alone → Warm', () => {
    expect(leadTemperature(['fx_pain'])).toBe('Warm')
  })

  it('demo_requested takes precedence even when cold tags present', () => {
    expect(leadTemperature(['demo_requested', 'tire_kicker'])).toBe('Qualified')
  })
})

// ── scoreBreakdown returns 5 dimensions summing to ~icpScore ──────────────────

describe('scoreBreakdown (extended)', () => {
  const base = { verticals: ['FX', 'PAYMENTS'], estimatedAudience: 2000, country: 'GB', startDate: new Date('2024-10-10') }

  it('returns exactly 5 dimension objects', () => {
    const dims = scoreBreakdown(base)
    expect(dims).toHaveLength(5)
  })

  it('each dimension has key, label, score, max', () => {
    const dims = scoreBreakdown(base)
    for (const d of dims) {
      expect(d).toHaveProperty('key')
      expect(d).toHaveProperty('label')
      expect(d).toHaveProperty('score')
      expect(d).toHaveProperty('max')
    }
  })

  it('all scores are non-negative', () => {
    const dims = scoreBreakdown(base)
    for (const d of dims) {
      expect(d.score).toBeGreaterThanOrEqual(0)
    }
  })

  it('each score is within its max', () => {
    const dims = scoreBreakdown(base)
    for (const d of dims) {
      expect(d.score).toBeLessThanOrEqual(d.max)
    }
  })

  it('sum of dimensions matches scoreConference output', () => {
    const total = scoreBreakdown(base).reduce((s, d) => s + d.score, 0)
    expect(total).toBe(scoreConference(base))
  })

  it('fxPain is 25 for top vertical (FX)', () => {
    const d = scoreBreakdown({ ...base, verticals: ['FX'] }).find(d => d.key === 'fxPain')!
    expect(d.score).toBe(25)
  })

  it('fxPain is 16 for mid vertical (FINTECH)', () => {
    const d = scoreBreakdown({ ...base, verticals: ['FINTECH'] }).find(d => d.key === 'fxPain')!
    expect(d.score).toBe(16)
  })

  it('fxPain is 0 for unrelated vertical (RETAIL)', () => {
    const d = scoreBreakdown({ ...base, verticals: ['RETAIL'] }).find(d => d.key === 'fxPain')!
    expect(d.score).toBe(0)
  })

  it('density max is 30', () => {
    const d = scoreBreakdown(base).find(d => d.key === 'density')!
    expect(d.max).toBe(30)
  })

  it('dm max is 25', () => {
    const d = scoreBreakdown(base).find(d => d.key === 'dm')!
    expect(d.max).toBe(25)
  })

  it('agenda max is 10', () => {
    const d = scoreBreakdown(base).find(d => d.key === 'agenda')!
    expect(d.max).toBe(10)
  })

  it('networking max is 10', () => {
    const d = scoreBreakdown(base).find(d => d.key === 'networking')!
    expect(d.max).toBe(10)
  })
})

// ── scoreIcpBadge boundary tests ──────────────────────────────────────────────
// Note: scoreIcpBadge uses scoreToTier which uses A>=70, B 45-69, C<45
// The ConferencesClient uses a different tier function: A>=85, B>=70, C>=50, D<50

describe('scoreIcpBadge (extended)', () => {
  it('score 0 → tier C', () => {
    const badge = scoreIcpBadge(0)
    expect(badge.tier).toBe('C')
    expect(badge.className).toBe('tier-c')
  })

  it('score 44 → tier C', () => {
    const badge = scoreIcpBadge(44)
    expect(badge.tier).toBe('C')
  })

  it('score 45 → tier B (boundary)', () => {
    const badge = scoreIcpBadge(45)
    expect(badge.tier).toBe('B')
    expect(badge.className).toBe('tier-b')
  })

  it('score 50 → tier B', () => {
    const badge = scoreIcpBadge(50)
    expect(badge.tier).toBe('B')
    expect(badge.label).toBe('B · 50')
  })

  it('score 69 → tier B', () => {
    const badge = scoreIcpBadge(69)
    expect(badge.tier).toBe('B')
  })

  it('score 70 → tier A (boundary)', () => {
    const badge = scoreIcpBadge(70)
    expect(badge.tier).toBe('A')
    expect(badge.className).toBe('tier-a')
  })

  it('score 85 → tier A', () => {
    const badge = scoreIcpBadge(85)
    expect(badge.tier).toBe('A')
    expect(badge.label).toBe('A · 85')
  })

  it('score 100 → tier A', () => {
    const badge = scoreIcpBadge(100)
    expect(badge.tier).toBe('A')
    expect(badge.label).toBe('A · 100')
  })

  it('label format is always "TIER · SCORE"', () => {
    const badge = scoreIcpBadge(73)
    expect(badge.label).toMatch(/^[ABC] · \d+$/)
  })
})
