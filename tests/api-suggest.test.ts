import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  systemConfig: {
    findUnique: vi.fn(),
  },
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
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ company: 'Acme', jobTitle: 'CFO' }))
    expect(res.status).toBe(401)
  })

  it('returns { suggestions: null, reason: "no_key" } when no API key', async () => {
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
    const suggestions = { context: 'Acme does FX', icpRelevance: 'High relevance', followUpAngle: 'Ask about hedging' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(suggestions) } }],
      }),
    })
    const res = await POST(makeRequest({ company: 'Acme Corp', jobTitle: 'CFO' }))
    expect(res.status).toBe(200)
    // Verify OpenAI was called
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toContain('openai.com')
    const body = JSON.parse(call[1].body)
    const userMsg = body.messages.find((m: any) => m.role === 'user').content
    expect(userMsg).toContain('Acme Corp')
    expect(userMsg).toContain('CFO')
  })

  it('calls Anthropic API when provider is ANTHROPIC', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'ANTHROPIC', aiApiKey: 'anth-key' })
    const suggestions = { context: 'Context text', icpRelevance: 'High', followUpAngle: 'Ask' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: JSON.stringify(suggestions) }],
      }),
    })
    const res = await POST(makeRequest({ company: 'Revolut', jobTitle: 'VP Finance' }))
    expect(res.status).toBe(200)
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toContain('anthropic.com')
  })

  it('returns structured suggestions object', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ id: 'singleton', aiProvider: 'OPENAI', aiApiKey: 'key' })
    const suggestions = { context: 'Company context here', icpRelevance: 'High FX exposure', followUpAngle: 'Discuss hedging' }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(suggestions) } }] }),
    })
    const res = await POST(makeRequest({ company: 'Stripe', jobTitle: 'Head of Treasury' }))
    const json = await res.json()
    expect(json.suggestions).toMatchObject({
      context: 'Company context here',
      icpRelevance: 'High FX exposure',
      followUpAngle: 'Discuss hedging',
    })
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
