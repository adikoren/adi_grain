import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  targetAccount: {
    findMany: vi.fn(),
  },
  lead: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { getServerSession } from 'next-auth'
import { GET } from '../app/api/leads/companies/route'

const authSession = { user: { id: 'u1', role: 'SALES_PERSON' } }

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/leads/companies')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

describe('GET /api/leads/companies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(authSession as any)
    mockDb.targetAccount.findMany.mockResolvedValue([])
    mockDb.lead.findMany.mockResolvedValue([])
  })

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns companies from target accounts when conferenceId provided', async () => {
    mockDb.targetAccount.findMany.mockResolvedValue([
      { company: 'Stripe' },
      { company: 'Adyen' },
    ])
    mockDb.lead.findMany.mockResolvedValue([])
    const res = await GET(makeRequest({ conferenceId: 'conf1' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.companies).toContain('Stripe')
    expect(json.companies).toContain('Adyen')
  })

  it('target account companies appear before lead companies', async () => {
    mockDb.targetAccount.findMany.mockResolvedValue([{ company: 'TargetCo' }])
    mockDb.lead.findMany.mockResolvedValue([{ company: 'LeadCo' }])
    const res = await GET(makeRequest({ conferenceId: 'conf1' }))
    const json = await res.json()
    const targetIdx = json.companies.indexOf('TargetCo')
    const leadIdx = json.companies.indexOf('LeadCo')
    expect(targetIdx).toBeLessThan(leadIdx)
  })

  it('filters by q query param', async () => {
    mockDb.targetAccount.findMany.mockResolvedValue([])
    mockDb.lead.findMany.mockResolvedValue([{ company: 'Filtered Company' }])
    const res = await GET(makeRequest({ q: 'filter' }))
    const json = await res.json()
    expect(json.companies).toBeDefined()
    // The filter is passed to Prisma — confirm the DB was called with the filter
    const leadCall = mockDb.lead.findMany.mock.calls[0][0]
    expect(leadCall.where).toEqual({ company: { contains: 'filter' } })
  })

  it('returns distinct companies (no duplicates)', async () => {
    mockDb.targetAccount.findMany.mockResolvedValue([{ company: 'Acme' }])
    mockDb.lead.findMany.mockResolvedValue([{ company: 'Acme' }, { company: 'Acme' }, { company: 'Beta' }])
    const res = await GET(makeRequest({ conferenceId: 'conf1' }))
    const json = await res.json()
    const acmeCount = json.companies.filter((c: string) => c === 'Acme').length
    expect(acmeCount).toBe(1)
  })

  it('caps at 20 results', async () => {
    const manyTargets = Array.from({ length: 15 }, (_, i) => ({ company: `TargetCo${i}` }))
    const manyLeads = Array.from({ length: 10 }, (_, i) => ({ company: `LeadCo${i}` }))
    mockDb.targetAccount.findMany.mockResolvedValue(manyTargets)
    mockDb.lead.findMany.mockResolvedValue(manyLeads)
    const res = await GET(makeRequest({ conferenceId: 'conf1' }))
    const json = await res.json()
    expect(json.companies.length).toBeLessThanOrEqual(20)
  })

  it('returns empty array when no matches', async () => {
    mockDb.targetAccount.findMany.mockResolvedValue([])
    mockDb.lead.findMany.mockResolvedValue([])
    const res = await GET(makeRequest({ q: 'nonexistent' }))
    const json = await res.json()
    expect(json.companies).toEqual([])
  })

  it('does not query target accounts when no conferenceId', async () => {
    mockDb.lead.findMany.mockResolvedValue([{ company: 'Solo Corp' }])
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(mockDb.targetAccount.findMany).not.toHaveBeenCalled()
    expect(json.companies).toContain('Solo Corp')
  })
})
