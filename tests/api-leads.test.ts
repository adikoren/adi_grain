import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  lead: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conferenceLead: {
    create: vi.fn(),
    upsert: vi.fn(),
  },
  personEnrichment: {
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}))

const mockSession = vi.hoisted(() => ({ fn: vi.fn() }))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: mockSession.fn }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/hubspot', () => ({ syncLeadToHubspot: vi.fn().mockResolvedValue(undefined) }))

import { GET, POST } from '../app/api/leads/route'

const managerSession = { user: { id: 'mgr1', role: 'MANAGER', name: 'Manager' } }
const salesSession = { user: { id: 'rep1', role: 'SALES_PERSON', name: 'Rep' } }

const sampleLead = {
  id: 'lead1', firstName: 'Alice', lastName: 'Smith', company: 'Acme',
  capturedById: 'rep1', icpScore: 65, capturedAt: new Date('2024-01-01'),
  conferences: [], capturedBy: { name: 'Rep' }, _count: { matchesA: 0, matchesB: 0 },
}

// ── GET /api/leads ────────────────────────────────────────────────────────────

describe('GET /api/leads', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 for unauthenticated requests', async () => {
    mockSession.fn.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/leads')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('SALES_PERSON gets leads filtered by capturedById', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.lead.findMany.mockResolvedValue([sampleLead])
    const req = new NextRequest('http://localhost/api/leads')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const call = mockDb.lead.findMany.mock.calls[0][0]
    expect(call.where).toEqual({ capturedById: 'rep1' })
  })

  it('MANAGER gets all leads (no capturedById filter)', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findMany.mockResolvedValue([sampleLead])
    const req = new NextRequest('http://localhost/api/leads')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const call = mockDb.lead.findMany.mock.calls[0][0]
    expect(call.where).toEqual({})
  })

  it('ADMIN gets all leads (no capturedById filter)', async () => {
    mockSession.fn.mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN', name: 'Admin' } })
    mockDb.lead.findMany.mockResolvedValue([sampleLead])
    const req = new NextRequest('http://localhost/api/leads')
    await GET(req)
    const call = mockDb.lead.findMany.mock.calls[0][0]
    expect(call.where).toEqual({})
  })

  it('default take is 50', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.lead.findMany.mockResolvedValue([])
    const req = new NextRequest('http://localhost/api/leads')
    await GET(req)
    const call = mockDb.lead.findMany.mock.calls[0][0]
    expect(call.take).toBe(50)
  })

  it('?all=1 increases take to 1000', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findMany.mockResolvedValue([])
    const req = new NextRequest('http://localhost/api/leads?all=1')
    await GET(req)
    const call = mockDb.lead.findMany.mock.calls[0][0]
    expect(call.take).toBe(1000)
  })

  it('returns leads array in response', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findMany.mockResolvedValue([sampleLead])
    const req = new NextRequest('http://localhost/api/leads')
    const res = await GET(req)
    const json = await res.json()
    expect(json.leads).toHaveLength(1)
    expect(json.leads[0].id).toBe('lead1')
  })
})

// ── POST /api/leads ───────────────────────────────────────────────────────────

describe('POST /api/leads', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makePostReq(body: object) {
    return new NextRequest('http://localhost/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when not authenticated', async () => {
    mockSession.fn.mockResolvedValue(null)
    const req = makePostReq({ firstName: 'A', lastName: 'B', company: 'C' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when firstName is missing', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    const req = makePostReq({ lastName: 'Smith', company: 'Acme' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when lastName is missing', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    const req = makePostReq({ firstName: 'Alice', company: 'Acme' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when company is missing', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    const req = makePostReq({ firstName: 'Alice', lastName: 'Smith' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates lead with icpScore computed when valid data provided', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    const createdLead = { ...sampleLead, id: 'new1' }
    mockDb.lead.create.mockResolvedValue(createdLead)
    mockDb.conferenceLead.create.mockResolvedValue({})
    const req = makePostReq({ firstName: 'Alice', lastName: 'Smith', company: 'Acme', jobTitle: 'CFO' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.lead).toBeDefined()
    const createCall = mockDb.lead.create.mock.calls[0][0]
    expect(typeof createCall.data.icpScore).toBe('number')
    expect(createCall.data.icpScore).toBeGreaterThan(0)
  })

  it('sets capturedById to session user id', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.lead.create.mockResolvedValue(sampleLead)
    const req = makePostReq({ firstName: 'Alice', lastName: 'Smith', company: 'Acme' })
    await POST(req)
    const createCall = mockDb.lead.create.mock.calls[0][0]
    expect(createCall.data.capturedById).toBe('rep1')
  })

  it('creates ConferenceLead when conferenceId provided', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    const createdLead = { ...sampleLead, id: 'lead-x' }
    mockDb.lead.create.mockResolvedValue(createdLead)
    mockDb.conferenceLead.create.mockResolvedValue({})
    const req = makePostReq({ firstName: 'A', lastName: 'B', company: 'C', conferenceId: 'conf1' })
    await POST(req)
    expect(mockDb.conferenceLead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conferenceId: 'conf1', leadId: 'lead-x' }) })
    )
  })

  it('does NOT create new lead when mergeLeadId provided (upserts conferenceLead instead)', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLead)
    mockDb.conferenceLead.upsert.mockResolvedValue({})
    const req = makePostReq({ firstName: 'A', lastName: 'B', company: 'C', mergeLeadId: 'lead1', conferenceId: 'conf1', notes: 'great chat' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockDb.lead.create).not.toHaveBeenCalled()
    expect(mockDb.conferenceLead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conferenceId_leadId: { conferenceId: 'conf1', leadId: 'lead1' } },
      })
    )
  })

  it('mergeLeadId not found → returns 404 (lead.create skipped)', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.lead.findUnique.mockResolvedValue(null)
    const req = makePostReq({ firstName: 'A', lastName: 'B', company: 'C', mergeLeadId: 'missing123', conferenceId: 'conf1' })
    const res = await POST(req)
    expect(res.status).toBe(404)
    expect(mockDb.lead.create).not.toHaveBeenCalled()
    expect(mockDb.conferenceLead.upsert).not.toHaveBeenCalled()
  })

  it('mergeLeadId without conferenceId does not upsert conferenceLead', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLead)
    const req = makePostReq({ firstName: 'A', lastName: 'B', company: 'C', mergeLeadId: 'lead1' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockDb.conferenceLead.upsert).not.toHaveBeenCalled()
  })
})
