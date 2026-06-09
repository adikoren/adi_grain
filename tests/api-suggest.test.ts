import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  systemConfig: { findUnique: vi.fn() },
  companyEnrichment: { findUnique: vi.fn(), upsert: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { getServerSession } from 'next-auth'
import { POST } from '../app/api/leads/suggest/route'

const authSession = { user: { id: 'u1', role: 'SALES_PERSON', name: 'Rep' } }

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/leads/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('POST /api/leads/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(authSession as any)
    // No cached enrichment by default
    mockDb.companyEnrichment.findUnique.mockResolvedValue(null)
    mockDb.companyEnrichment.upsert.mockResolvedValue({})
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    expect(res.status).toBe(401)
  })

  it('returns cached enrichment when DB has fresh data', async () => {
    const recent = new Date()
    mockDb.companyEnrichment.findUnique.mockResolvedValue({
      company: 'acme', displayName: 'Acme', whatTheyDo: 'Payments', lastEnrichedAt: recent,
    })
    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    const json = await res.json()
    expect(json.source).toBe('cache')
    expect(json.suggestions.whatTheyDo).toBe('Payments')
    // Should NOT have called any AI API
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns { suggestions: null, reason: "no_key" } when no API key and no cache', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: null })
    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.suggestions).toBeNull()
    expect(json.reason).toBe('no_key')
  })

  it('returns { suggestions: null, reason: "no_key" } when config missing entirely', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(null)
    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    const json = await res.json()
    expect(json.suggestions).toBeNull()
    expect(json.reason).toBe('no_key')
  })

  it('calls AI with company and jobTitle in prompt (OpenAI)', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: 'test-key' })
    const suggestions = { whatTheyDo: 'Payments', grainRelevance: 'High', market: 'Fintech', businessType: 'B2B', fxRelevance: 'High', keyPeople: 'CFO', salesAngle: 'Ask about hedging' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(suggestions) } }] }),
    })
    const res = await POST(makeRequest({ company: 'Acme Corp', jobTitle: 'CFO' }))
    expect(res.status).toBe(200)
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toContain('openai.com')
    const body = JSON.parse(call[1].body)
    const userMsg = body.messages.find((m: any) => m.role === 'user').content
    expect(userMsg).toContain('Acme Corp')
    expect(userMsg).toContain('CFO')
  })

  it('calls Anthropic API when provider is ANTHROPIC', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'ANTHROPIC', aiApiKey: 'anth-key' })
    const suggestions = { whatTheyDo: 'FX', grainRelevance: 'High', market: 'Travel', businessType: 'B2B', fxRelevance: 'High', keyPeople: 'CFO', salesAngle: 'Ask' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: JSON.stringify(suggestions) }] }),
    })
    const res = await POST(makeRequest({ company: 'Revolut', jobTitle: 'VP Finance' }))
    expect(res.status).toBe(200)
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toContain('anthropic.com')
  })

  it('returns structured suggestions with all 7 brief fields', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: 'key' })
    const suggestions = {
      whatTheyDo: 'Stripe processes payments', grainRelevance: 'High FX exposure',
      market: 'Payments', businessType: 'B2B', fxRelevance: 'Critical',
      keyPeople: 'CFO, Head of Treasury', salesAngle: 'Discuss hedging',
    }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(suggestions) } }] }),
    })
    const res = await POST(makeRequest({ company: 'Stripe', jobTitle: 'Head of Treasury' }))
    const json = await res.json()
    expect(json.suggestions).toMatchObject(suggestions)
    expect(json.source).toBe('ai')
  })

  it('persists enrichment to DB after AI generation', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: 'key' })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ whatTheyDo: 'Test', grainRelevance: 'High', market: 'Fintech', businessType: 'B2B', fxRelevance: 'High', keyPeople: 'CFO', salesAngle: 'Ask' }) } }] }),
    })
    await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    expect(mockDb.companyEnrichment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { company: 'acme' } })
    )
  })

  it('handles AI error gracefully', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: 'key' })
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Rate limited' } }),
    })
    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.suggestions).toBeNull()
    expect(json.reason).toBe('ai_error')
  })

  it('handles malformed JSON from AI gracefully', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: 'key' })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not valid json !!!' } }] }),
    })
    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.suggestions).toBeNull()
  })
})
