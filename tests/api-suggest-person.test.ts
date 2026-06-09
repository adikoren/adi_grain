import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  lead: { findMany: vi.fn() },
  personEnrichment: { findUnique: vi.fn(), upsert: vi.fn() },
  systemConfig: { findUnique: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { getServerSession } from 'next-auth'
import { POST } from '../app/api/leads/suggest-person/route'

const authSession = { user: { id: 'u1', role: 'SALES_PERSON', name: 'Rep' } }

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/leads/suggest-person', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('POST /api/leads/suggest-person', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(authSession as any)
    mockDb.lead.findMany.mockResolvedValue([])
    mockDb.personEnrichment.findUnique.mockResolvedValue(null)
    mockDb.personEnrichment.upsert.mockResolvedValue({})
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: 'test-key' })
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    expect(res.status).toBe(401)
  })

  it('returns missing_params when company or jobTitle omitted', async () => {
    const res = await POST(makeRequest({ company: 'Acme' }))
    const json = await res.json()
    expect(json.person).toBeNull()
    expect(json.reason).toBe('missing_params')
  })

  // ── Tier 1: Internal lead match ────────────────────────────────────────────

  it('returns internal match when lead exists with high confidence', async () => {
    mockDb.lead.findMany.mockResolvedValue([{
      id: 'lead1',
      firstName: 'Jane',
      lastName: 'Smith',
      company: 'Acme Corp',
      jobTitle: 'CFO',  // exact substring match → confidence 0.95
      linkedinUrl: 'linkedin.com/in/janesmith',
      aiSummary: null,
      conferences: [
        {
          engagementNotes: 'Interested in FX hedging',
          conference: { name: 'EBAday 2023', startDate: new Date('2023-06-01') },
        },
      ],
    }])

    const res = await POST(makeRequest({ company: 'Acme Corp', jobTitle: 'CFO' }))
    const json = await res.json()

    expect(json.source).toBe('internal')
    expect(json.person.firstName).toBe('Jane')
    expect(json.person.lastName).toBe('Smith')
    expect(json.person.confidence).toBe('high')
    expect(json.person.warmth).toBe('WARM')
    expect(json.person.previousContext).toContain('EBAday 2023')
    expect(json.leadId).toBe('lead1')
  })

  it('upserts PersonEnrichment with matchedLeadId on internal match', async () => {
    mockDb.lead.findMany.mockResolvedValue([{
      id: 'lead2',
      firstName: 'Bob',
      lastName: 'Jones',
      company: 'Stripe',
      jobTitle: 'CFO',
      linkedinUrl: null,
      aiSummary: null,
      conferences: [],
    }])

    await POST(makeRequest({ company: 'Stripe', jobTitle: 'CFO' }))

    expect(mockDb.personEnrichment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { company_jobTitle: { company: 'stripe', jobTitle: 'cfo' } },
        create: expect.objectContaining({ matchedLeadId: 'lead2', dataSource: 'INTERNAL' }),
        update: expect.objectContaining({ matchedLeadId: 'lead2', dataSource: 'INTERNAL' }),
      })
    )
  })

  it('builds previousContext from conference history', async () => {
    mockDb.lead.findMany.mockResolvedValue([{
      id: 'lead3',
      firstName: 'Alice',
      lastName: 'Wong',
      company: 'Revolut',
      jobTitle: 'VP Finance',
      linkedinUrl: null,
      aiSummary: null,
      conferences: [
        { engagementNotes: 'Demo booked', conference: { name: 'Money 2024', startDate: new Date() } },
        { engagementNotes: null,           conference: { name: 'Finovate 2023', startDate: new Date() } },
      ],
    }])

    const res = await POST(makeRequest({ company: 'Revolut', jobTitle: 'VP Finance' }))
    const json = await res.json()

    expect(json.person.previousContext).toContain('Money 2024')
    expect(json.person.previousContext).toContain('Finovate 2023')
    expect(json.person.previousContext).toContain('Demo booked')
  })

  it('does not match when company is different', async () => {
    mockDb.lead.findMany.mockResolvedValue([{
      id: 'lead4',
      firstName: 'Test',
      lastName: 'User',
      company: 'CompletlyDifferentCo',
      jobTitle: 'CFO',
      linkedinUrl: null,
      aiSummary: null,
      conferences: [],
    }])

    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    const json = await res.json()

    // Should fall through to AI, not internal
    expect(json.source).not.toBe('internal')
  })

  // ── Tier 2: Cache hit ──────────────────────────────────────────────────────

  it('returns cached PersonEnrichment when fresh', async () => {
    const recent = new Date()
    mockDb.personEnrichment.findUnique.mockResolvedValue({
      firstName: 'Cached',
      lastName: 'Person',
      confidence: 'HIGH',
      summary: 'Cached summary',
      linkedinUrl: 'linkedin.com/in/cached',
      previousContext: null,
      warmth: 'WARM',
      lastEnrichedAt: recent,
    })

    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    const json = await res.json()

    expect(json.source).toBe('cache')
    expect(json.person.firstName).toBe('Cached')
    expect(json.person.confidence).toBe('high')
    // Should not call AI
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Tier 3: AI generation ──────────────────────────────────────────────────

  it('calls OpenAI and returns person when no cache or match', async () => {
    const aiPerson = {
      firstName: 'John',
      lastName: 'Doe',
      confidence: 'high',
      reasoning: 'Known CFO at Acme',
      linkedinHint: 'linkedin.com/in/johndoe',
      summary: 'Finance executive',
    }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(aiPerson) } }] }),
    })

    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    const json = await res.json()

    expect(json.source).toBe('ai')
    expect(json.person.firstName).toBe('John')
    expect(json.person.linkedinHint).toBe('linkedin.com/in/johndoe')
    expect(mockFetch).toHaveBeenCalledOnce()
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toContain('openai.com')
  })

  it('calls Anthropic when provider is ANTHROPIC', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'ANTHROPIC', aiApiKey: 'anth-key' })
    const aiPerson = { firstName: 'Ana', lastName: 'Luis', confidence: 'medium', reasoning: 'Likely', linkedinHint: null, summary: '' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: JSON.stringify(aiPerson) }] }),
    })

    const res = await POST(makeRequest({ company: 'Wise', jobTitle: 'Head of Treasury' }))
    const json = await res.json()

    expect(json.source).toBe('ai')
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toContain('anthropic.com')
  })

  it('persists AI result to PersonEnrichment', async () => {
    const aiPerson = { firstName: 'Paul', lastName: 'Lee', confidence: 'low', reasoning: 'Guess', linkedinHint: null, summary: '' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(aiPerson) } }] }),
    })

    await POST(makeRequest({ company: 'Brex', jobTitle: 'VP Finance' }))

    expect(mockDb.personEnrichment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { company_jobTitle: { company: 'brex', jobTitle: 'vp finance' } },
        create: expect.objectContaining({ firstName: 'Paul', dataSource: 'AI_OPENAI' }),
      })
    )
  })

  it('returns no_key when API key missing and no cache', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: null })

    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    const json = await res.json()

    expect(json.person).toBeNull()
    expect(json.reason).toBe('no_key')
  })

  it('returns stale_cache when API key missing but stale cache exists', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: null })
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    mockDb.personEnrichment.findUnique.mockResolvedValue({
      firstName: 'Old',
      lastName: 'Cache',
      confidence: 'MEDIUM',
      summary: null,
      linkedinUrl: null,
      previousContext: null,
      warmth: null,
      lastEnrichedAt: old,
    })

    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    const json = await res.json()

    expect(json.source).toBe('stale_cache')
    expect(json.person.firstName).toBe('Old')
  })

  it('returns ai_error gracefully when AI fails and no cache', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Rate limited' } }),
    })

    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    const json = await res.json()

    expect(json.person).toBeNull()
    expect(json.reason).toBe('ai_error')
  })

  it('returns stale_cache on AI error when stale data exists', async () => {
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    mockDb.personEnrichment.findUnique.mockResolvedValue({
      firstName: 'Stale',
      lastName: 'Data',
      confidence: 'LOW',
      summary: null,
      linkedinUrl: null,
      previousContext: null,
      warmth: null,
      lastEnrichedAt: old,
    })
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: {} }) })

    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    const json = await res.json()

    expect(json.source).toBe('stale_cache')
    expect(json.person.firstName).toBe('Stale')
  })
})
