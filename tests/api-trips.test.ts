import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  tripOpportunity: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  conference: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  conferenceAssignment: {
    upsert: vi.fn(),
  },
}))

const mockSession = vi.hoisted(() => ({ fn: vi.fn() }))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: mockSession.fn }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { GET, POST } from '../app/api/trips/route'

const managerSession = { user: { id: 'mgr1', role: 'MANAGER', name: 'Manager' } }
const salesSession = { user: { id: 'rep1', role: 'SALES_PERSON', name: 'Rep' } }

const now = new Date()
const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

const sampleTrip = {
  id: 'trip1',
  name: 'London · Oct/24',
  clusterReason: '2 conferences within 500km and 7-day window',
  conferenceIds: '["conf1","conf2"]',
  assignedToId: null,
  assignedTo: null,
  calculatedAt: new Date(),
}

const sampleConferences = [
  { id: 'conf1', name: 'FinTech World', city: 'London', country: 'GB', startDate: future, endDate: new Date(future.getTime() + 2 * 86400000) },
  { id: 'conf2', name: 'Payments Summit', city: 'London', country: 'GB', startDate: new Date(future.getTime() + 5 * 86400000), endDate: new Date(future.getTime() + 7 * 86400000) },
]

// ── GET /api/trips ────────────────────────────────────────────────────────────

describe('GET /api/trips', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockSession.fn.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns enriched trips with conference data', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.tripOpportunity.findMany.mockResolvedValue([sampleTrip])
    mockDb.conference.findMany.mockResolvedValue(sampleConferences)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.trips).toHaveLength(1)
    expect(json.trips[0].conferences).toHaveLength(2)
    expect(json.trips[0].conferences[0].name).toBe('FinTech World')
  })

  it('filters out conferences not in conferenceIds from trip enrichment', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    const trip = { ...sampleTrip, conferenceIds: '["conf1"]' }
    mockDb.tripOpportunity.findMany.mockResolvedValue([trip])
    mockDb.conference.findMany.mockResolvedValue(sampleConferences) // both conf1 and conf2 available
    const res = await GET()
    const json = await res.json()
    expect(json.trips[0].conferences).toHaveLength(1)
    expect(json.trips[0].conferences[0].id).toBe('conf1')
  })

  it('SALES_PERSON can access trips (just needs auth)', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.tripOpportunity.findMany.mockResolvedValue([])
    mockDb.conference.findMany.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
  })

  it('handles trips with unknown conferenceIds gracefully (filters Boolean)', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    const tripWithUnknown = { ...sampleTrip, conferenceIds: '["conf1","unknown_id"]' }
    mockDb.tripOpportunity.findMany.mockResolvedValue([tripWithUnknown])
    mockDb.conference.findMany.mockResolvedValue([sampleConferences[0]]) // only conf1 exists
    const res = await GET()
    const json = await res.json()
    expect(json.trips[0].conferences).toHaveLength(1)
  })
})

// ── POST /api/trips ───────────────────────────────────────────────────────────

describe('POST /api/trips', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makePostReq(body: object) {
    return new NextRequest('http://localhost/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 403 for SALES_PERSON', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    const req = makePostReq({ action: 'assign', userId: 'u1', tripId: 'trip1' })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 when unauthenticated', async () => {
    mockSession.fn.mockResolvedValue(null)
    const req = makePostReq({ action: 'assign', userId: 'u1', tripId: 'trip1' })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  // action=assign with tripId

  it('action=assign with tripId: creates assignment and flips conference to ATTENDING', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.tripOpportunity.findUnique.mockResolvedValue({ ...sampleTrip, conferenceIds: '["conf1","conf2"]' })
    mockDb.tripOpportunity.update.mockResolvedValue({})
    mockDb.conferenceAssignment.upsert.mockResolvedValue({})
    mockDb.conference.update.mockResolvedValue({})
    const req = makePostReq({ action: 'assign', userId: 'rep1', tripId: 'trip1' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(mockDb.tripOpportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'trip1' }, data: { assignedToId: 'rep1' } })
    )
    // Should flip both conferences to ATTENDING
    expect(mockDb.conference.update).toHaveBeenCalledTimes(2)
    expect(mockDb.conference.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attendingStatus: 'ATTENDING' } })
    )
  })

  it('action=assign with tripId: creates conferenceAssignment for each conference', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.tripOpportunity.findUnique.mockResolvedValue({ ...sampleTrip, conferenceIds: '["conf1","conf2"]' })
    mockDb.tripOpportunity.update.mockResolvedValue({})
    mockDb.conferenceAssignment.upsert.mockResolvedValue({})
    mockDb.conference.update.mockResolvedValue({})
    const req = makePostReq({ action: 'assign', userId: 'rep1', tripId: 'trip1' })
    await POST(req)
    expect(mockDb.conferenceAssignment.upsert).toHaveBeenCalledTimes(2)
    expect(mockDb.conferenceAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conferenceId_userId: { conferenceId: 'conf1', userId: 'rep1' } },
      })
    )
  })

  // action=assign with conferenceIds array

  it('action=assign with conferenceIds (no tripId): creates assignments without updating tripOpportunity', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.conferenceAssignment.upsert.mockResolvedValue({})
    mockDb.conference.update.mockResolvedValue({})
    const req = makePostReq({ action: 'assign', userId: 'rep1', conferenceIds: ['conf1'] })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockDb.tripOpportunity.update).not.toHaveBeenCalled()
    expect(mockDb.conferenceAssignment.upsert).toHaveBeenCalledTimes(1)
  })

  // action=recalculate

  it('action=recalculate: clusters conferences within 500km and 7-day window', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    // London and Amsterdam are within ~360km
    const confA = { id: 'c1', name: 'FinTech World', city: 'London', country: 'GB', lat: 51.5, lng: -0.12, startDate: new Date('2024-10-01'), endDate: new Date('2024-10-03') }
    const confB = { id: 'c2', name: 'Payments Summit', city: 'Amsterdam', country: 'NL', lat: 52.37, lng: 4.9, startDate: new Date('2024-10-05'), endDate: new Date('2024-10-07') }
    mockDb.conference.findMany.mockResolvedValue([confA, confB])
    mockDb.tripOpportunity.deleteMany.mockResolvedValue({})
    mockDb.tripOpportunity.create.mockResolvedValue({})
    const req = makePostReq({ action: 'recalculate' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.created).toBe(1) // one cluster
    expect(mockDb.tripOpportunity.deleteMany).toHaveBeenCalled()
    expect(mockDb.tripOpportunity.create).toHaveBeenCalledTimes(1)
  })

  it('action=recalculate: does not cluster conferences far apart (>500km)', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    // London and Singapore are far apart
    const confA = { id: 'c1', name: 'FinTech World', city: 'London', country: 'GB', lat: 51.5, lng: -0.12, startDate: new Date('2024-10-01'), endDate: new Date('2024-10-03') }
    const confB = { id: 'c2', name: 'SG Summit', city: 'Singapore', country: 'SG', lat: 1.35, lng: 103.82, startDate: new Date('2024-10-05'), endDate: new Date('2024-10-07') }
    mockDb.conference.findMany.mockResolvedValue([confA, confB])
    mockDb.tripOpportunity.deleteMany.mockResolvedValue({})
    mockDb.tripOpportunity.create.mockResolvedValue({})
    const req = makePostReq({ action: 'recalculate' })
    const res = await POST(req)
    const json = await res.json()
    expect(json.created).toBe(0) // no clusters (each conf is alone)
  })

  it('action=recalculate: does not cluster conferences more than 7 days apart', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    const confA = { id: 'c1', name: 'FinTech World', city: 'London', country: 'GB', lat: 51.5, lng: -0.12, startDate: new Date('2024-10-01'), endDate: new Date('2024-10-03') }
    const confB = { id: 'c2', name: 'Payments Summit', city: 'Amsterdam', country: 'NL', lat: 52.37, lng: 4.9, startDate: new Date('2024-10-15'), endDate: new Date('2024-10-17') } // 12 days after end of confA
    mockDb.conference.findMany.mockResolvedValue([confA, confB])
    mockDb.tripOpportunity.deleteMany.mockResolvedValue({})
    mockDb.tripOpportunity.create.mockResolvedValue({})
    const req = makePostReq({ action: 'recalculate' })
    const res = await POST(req)
    const json = await res.json()
    expect(json.created).toBe(0)
  })

  it('action=recalculate: conferences without lat/lng are excluded from DB query', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.conference.findMany.mockResolvedValue([])
    mockDb.tripOpportunity.deleteMany.mockResolvedValue({})
    const req = makePostReq({ action: 'recalculate' })
    await POST(req)
    const queryCall = mockDb.conference.findMany.mock.calls[0][0]
    expect(queryCall.where.lat).toEqual({ not: null })
    expect(queryCall.where.lng).toEqual({ not: null })
  })

  it('action=recalculate: deletes all existing trip opportunities first', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    mockDb.conference.findMany.mockResolvedValue([])
    mockDb.tripOpportunity.deleteMany.mockResolvedValue({})
    const req = makePostReq({ action: 'recalculate' })
    await POST(req)
    expect(mockDb.tripOpportunity.deleteMany).toHaveBeenCalled()
  })

  it('unknown action → returns 400', async () => {
    mockSession.fn.mockResolvedValue(managerSession)
    const req = makePostReq({ action: 'something_else' })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Unknown action')
  })

  it('ADMIN can also trigger recalculate', async () => {
    mockSession.fn.mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } })
    mockDb.conference.findMany.mockResolvedValue([])
    mockDb.tripOpportunity.deleteMany.mockResolvedValue({})
    const req = makePostReq({ action: 'recalculate' })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
