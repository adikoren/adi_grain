import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  systemConfig: { findUnique: vi.fn() },
}))
const mockFetch = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ db: mockDb }))
global.fetch = mockFetch

import { draftFollowUpEmail, summariseRelationshipArc, aiScoreConference } from '../lib/ai'

const anthropicConfig = { aiProvider: 'ANTHROPIC', aiApiKey: 'test-key' }
const openaiConfig    = { aiProvider: 'OPENAI', aiApiKey: 'test-key' }

function makeAnthropicResp(text: string) {
  return { ok: true, json: async () => ({ content: [{ text }] }) }
}
function makeOpenAIResp(text: string) {
  return { ok: true, json: async () => ({ choices: [{ message: { content: text } }] }) }
}

describe('draftFollowUpEmail', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws when no API key configured', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ aiProvider: 'OPENAI', aiApiKey: null })
    await expect(draftFollowUpEmail({ firstName: 'Alice', lastName: 'Smith', company: 'Acme' }))
      .rejects.toThrow(/API key not configured/)
  })

  it('calls Anthropic API when provider is ANTHROPIC', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(anthropicConfig)
    mockFetch.mockResolvedValue(makeAnthropicResp('Subject: Following up\n\nHi Alice...'))
    await draftFollowUpEmail({ firstName: 'Alice', lastName: 'Smith', company: 'Acme' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('calls OpenAI API when provider is OPENAI', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    mockFetch.mockResolvedValue(makeOpenAIResp('Subject: Following up\n\nHi Alice...'))
    await draftFollowUpEmail({ firstName: 'Alice', lastName: 'Smith', company: 'Acme' })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns email draft string from Anthropic response', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(anthropicConfig)
    mockFetch.mockResolvedValue(makeAnthropicResp('Subject: Following up\n\nHi Alice, great meeting you at FinTech.'))
    const result = await draftFollowUpEmail({ firstName: 'Alice', lastName: 'Smith', company: 'Acme' })
    expect(result).toContain('Subject:')
  })

  it('signs off with repName when provided', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    // Capture the request body to verify the prompt
    let capturedBody: any
    mockFetch.mockImplementation(async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body)
      return makeOpenAIResp('Email body here\n\nBest,\nJake Martinez')
    })
    await draftFollowUpEmail({ firstName: 'Alice', lastName: 'Smith', company: 'Acme', repName: 'Jake Martinez' })
    const messages = capturedBody.messages
    const userMsg = messages.find((m: any) => m.role === 'user')?.content || ''
    expect(userMsg).toContain('Jake Martinez')
  })

  it('uses "The Team" sign-off when repName is null', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    let capturedBody: any
    mockFetch.mockImplementation(async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body)
      return makeOpenAIResp('Email here')
    })
    await draftFollowUpEmail({ firstName: 'Alice', lastName: 'Smith', company: 'Acme', repName: null })
    const userMsg = capturedBody.messages.find((m: any) => m.role === 'user')?.content || ''
    expect(userMsg).toContain('The Team')
  })

  it('includes conference name in prompt when provided', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    let capturedBody: any
    mockFetch.mockImplementation(async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body)
      return makeOpenAIResp('Email here')
    })
    await draftFollowUpEmail({ firstName: 'Alice', lastName: 'Smith', company: 'Acme', conferenceName: 'Money20/20' })
    const userMsg = capturedBody.messages.find((m: any) => m.role === 'user')?.content || ''
    expect(userMsg).toContain('Money20/20')
  })

  it('includes meeting notes in prompt when provided', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    let capturedBody: any
    mockFetch.mockImplementation(async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body)
      return makeOpenAIResp('Email here')
    })
    await draftFollowUpEmail({ firstName: 'Alice', lastName: 'Smith', company: 'Acme', notes: 'Interested in FX hedging' })
    const userMsg = capturedBody.messages.find((m: any) => m.role === 'user')?.content || ''
    expect(userMsg).toContain('Interested in FX hedging')
  })

  it('throws when Anthropic returns error response', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(anthropicConfig)
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'rate limit exceeded' } }),
    })
    await expect(draftFollowUpEmail({ firstName: 'Alice', lastName: 'Smith', company: 'Acme' }))
      .rejects.toThrow(/rate limit exceeded/)
  })
})

describe('summariseRelationshipArc', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws when no API key configured', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ aiProvider: 'OPENAI', aiApiKey: null })
    await expect(summariseRelationshipArc([{ conferenceName: 'FinTech', date: '2024-01', notes: null }]))
      .rejects.toThrow(/API key not configured/)
  })

  it('returns arc summary string', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    mockFetch.mockResolvedValue(makeOpenAIResp('Champion. Appeared at 3 conferences. Ready to close.'))
    const result = await summariseRelationshipArc([
      { conferenceName: 'FinTech World', date: '2024-06', jobTitle: 'CFO', company: 'Acme', notes: 'Interested' },
    ])
    expect(typeof result).toBe('string')
    expect(result).toContain('Champion')
  })

  it('includes all conference appearances in prompt', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    let capturedBody: any
    mockFetch.mockImplementation(async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body)
      return makeOpenAIResp('Arc summary')
    })
    await summariseRelationshipArc([
      { conferenceName: 'FinTech World', date: '2024-06', notes: 'First meeting' },
      { conferenceName: 'Money20/20', date: '2024-10', notes: 'Follow up' },
    ])
    const userMsg = capturedBody.messages.find((m: any) => m.role === 'user')?.content || ''
    expect(userMsg).toContain('FinTech World')
    expect(userMsg).toContain('Money20/20')
  })
})

describe('aiScoreConference', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns { score: 0, reasoning: "AI scoring unavailable" } when no API key', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue({ aiProvider: 'OPENAI', aiApiKey: null })
    const result = await aiScoreConference({ name: 'FinTech', city: 'London', country: 'GB', verticals: ['FINTECH'] })
    expect(result.score).toBe(0)
    expect(result.reasoning).toMatch(/unavailable/)
  })

  it('parses JSON score from LLM response', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    mockFetch.mockResolvedValue(makeOpenAIResp('```json\n{"score": 82, "reasoning": "Strong FX fit"}\n```'))
    const result = await aiScoreConference({ name: 'FX Week', city: 'London', country: 'GB', verticals: ['FX'] })
    expect(result.score).toBe(82)
    expect(result.reasoning).toBe('Strong FX fit')
  })

  it('returns fallback on malformed JSON', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    mockFetch.mockResolvedValue(makeOpenAIResp('not valid json'))
    const result = await aiScoreConference({ name: 'FinTech', city: 'Berlin', country: 'DE', verticals: [] })
    expect(result.score).toBe(0)
    expect(result.reasoning).toMatch(/unavailable/)
  })

  it('strips code fences from response before parsing', async () => {
    mockDb.systemConfig.findUnique.mockResolvedValue(openaiConfig)
    mockFetch.mockResolvedValue(makeOpenAIResp('```json\n{"score": 75, "reasoning": "Good fit"}\n```'))
    const result = await aiScoreConference({ name: 'Sibos', city: 'Sydney', country: 'AU', verticals: ['FX', 'PAYMENTS'] })
    expect(result.score).toBe(75)
  })
})
