import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  lead: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

const mockSession = vi.hoisted(() => ({ fn: vi.fn() }))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: mockSession.fn }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/ai', () => ({
  draftFollowUpEmail: vi.fn().mockResolvedValue('Draft email content'),
  summariseRelationshipArc: vi.fn().mockResolvedValue('Arc summary content'),
}))

import { GET, POST } from '../app/api/leads/[id]/route'
import { draftFollowUpEmail, summariseRelationshipArc } from '../lib/ai'

const managerSession = { user: { id: 'mgr1', role: 'MANAGER', name: 'Manager' } }
const salesSession = { user: { id: 'rep1', role: 'SALES_PERSON', name: 'Rep' } }
const otherRepSession = { user: { id: 'rep2', role: 'SALES_PERSON', name: 'Other Rep' } }

const idParams = { params: { id: 'lead1' } }

const sampleLead = {
  id: 'lead1', firstName: 'Alice', lastName: 'Smith', company: 'Acme',
  capturedById: 'rep1', icpScore: 65, capturedAt: new Date('2024-01-01'),
  jobTitle: 'CFO',
  conferences: [
    { conference: { id: 'c1', name: 'FinTech World', city: 'London', startDate: new Date('2024-06-01') }, engagementNotes: 'Great chat', capturedAt: new Date('2024-06-01') },
  ],
  capturedBy: { name: 'Rep' },
  syncLogs: [],
}

const sampleLeadMultiConf = {
  ...sampleLead,
  conferences: [
    { conference: { id: 'c1', name: 'FinTech World', city: 'London', startDate: new Date('2024-10-01') }, engagementNotes: 'Met here', capturedAt: new Date('2024-10-01') },
    { conference: { id: 'c2', name: 'EuroFinance', city: 'Amsterdam', startDate: new Date('2024-06-01') }, engagementNotes: 'First meeting', capturedAt: new Date('2024-06-01') },
  ],
}

// ── GET /api/leads/[id] ───────────────────────────────────────────────────────

describe('GET /api/leads/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockSession.fn.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/leads/lead1')
    const res = await GET(req, idParams as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when lead not found', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findUnique.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/leads/lead1')
    const res = await GET(req, idParams as any)
    expect(res.status).toBe(404)
  })

  it('returns 403 when sales rep accesses another rep\'s lead', async () => {
    mockSession.fn.mockResolvedValue(otherRepSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLead) // capturedById is 'rep1', session is 'rep2'
    const req = new NextRequest('http://localhost/api/leads/lead1')
    const res = await GET(req, idParams as any)
    expect(res.status).toBe(403)
  })

  it('returns 200 when sales rep accesses own lead', async () => {
    mockSession.fn.mockResolvedValue(salesSession) // id is 'rep1', same as capturedById
    mockDb.lead.findUnique.mockResolvedValue(sampleLead)
    const req = new NextRequest('http://localhost/api/leads/lead1')
    const res = await GET(req, idParams as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.lead.id).toBe('lead1')
  })

  it('manager can access any lead regardless of capturedById', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLead)
    const req = new NextRequest('http://localhost/api/leads/lead1')
    const res = await GET(req, idParams as any)
    expect(res.status).toBe(200)
  })

  it('ADMIN can access any lead', async () => {
    mockSession.fn.mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN', name: 'Admin' } })
    mockDb.lead.findUnique.mockResolvedValue(sampleLead)
    const req = new NextRequest('http://localhost/api/leads/lead1')
    const res = await GET(req, idParams as any)
    expect(res.status).toBe(200)
  })
})

// ── POST /api/leads/[id] ──────────────────────────────────────────────────────

describe('POST /api/leads/[id]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makePostReq(body: object) {
    return new NextRequest('http://localhost/api/leads/lead1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when unauthenticated', async () => {
    mockSession.fn.mockResolvedValue(null)
    const req = makePostReq({ action: 'draft-followup' })
    const res = await POST(req, idParams as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 when lead not found for draft-followup', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.lead.findUnique.mockResolvedValue(null)
    const req = makePostReq({ action: 'draft-followup' })
    const res = await POST(req, idParams as any)
    expect(res.status).toBe(404)
  })

  it('draft-followup: generates draft and saves it to lead', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLead)
    mockDb.lead.update.mockResolvedValue({ ...sampleLead, followUpDraft: 'Draft email content' })
    const req = makePostReq({ action: 'draft-followup' })
    const res = await POST(req, idParams as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.draft).toBe('Draft email content')
    expect(mockDb.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { followUpDraft: 'Draft email content' } })
    )
  })

  it('draft-followup: passes conferenceName and repName to draftFollowUpEmail', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLead)
    mockDb.lead.update.mockResolvedValue({})
    const req = makePostReq({ action: 'draft-followup' })
    await POST(req, idParams as any)
    expect(vi.mocked(draftFollowUpEmail)).toHaveBeenCalledWith(
      expect.objectContaining({ conferenceName: 'FinTech World', repName: 'Rep' })
    )
  })

  it('relationship-arc: returns "Only seen at one conference" when only 1 conference', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLead) // only 1 conference
    const req = makePostReq({ action: 'relationship-arc' })
    const res = await POST(req, idParams as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.summary).toContain('Only seen at one conference')
  })

  it('relationship-arc: returns "Only seen at one conference" when conferences array is empty', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findUnique.mockResolvedValue({ ...sampleLead, conferences: [] })
    const req = makePostReq({ action: 'relationship-arc' })
    const res = await POST(req, idParams as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.summary).toContain('Only seen at one conference')
  })

  it('relationship-arc: calls summariseRelationshipArc when multiple conferences', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLeadMultiConf)
    const req = makePostReq({ action: 'relationship-arc' })
    const res = await POST(req, idParams as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.summary).toBe('Arc summary content')
    expect(vi.mocked(summariseRelationshipArc)).toHaveBeenCalled()
  })

  it('relationship-arc: passes correct appearance data to summariseRelationshipArc', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLeadMultiConf)
    const req = makePostReq({ action: 'relationship-arc' })
    await POST(req, idParams as any)
    const appearances = vi.mocked(summariseRelationshipArc).mock.calls[0][0]
    expect(appearances).toHaveLength(2)
    expect(appearances[0]).toMatchObject({ conferenceName: 'FinTech World' })
  })

  it('unknown action returns 400', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.lead.findUnique.mockResolvedValue(sampleLead)
    const req = makePostReq({ action: 'some-unknown-action' })
    const res = await POST(req, idParams as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Unknown action')
  })
})
