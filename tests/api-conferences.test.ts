import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  conference: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { getServerSession } from 'next-auth'
import { GET, POST } from '../app/api/conferences/route'
import { PATCH, DELETE } from '../app/api/conferences/[id]/route'

const idParams = { params: { id: 'conf_123' } }

const sampleConference = {
  id: 'conf_123', name: 'FinTech World', city: 'London', country: 'GB',
  startDate: new Date('2024-10-01'), endDate: new Date('2024-10-03'),
  verticals: '["PAYMENTS"]', buyerPersonas: '[]', icpScore: 78,
  assignments: [], _count: { leads: 0 },
}

// ── GET /conferences ──────────────────────────────────────────────────────────

describe('GET /api/conferences', () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'SALES_PERSON' } } as any)
    mockDb.conference.findMany.mockResolvedValue([sampleConference])
  })

  it('returns conferences for authenticated users', async () => {
    const req = new NextRequest('http://localhost/api/conferences')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.conferences).toHaveLength(1)
  })

  it('returns 401 for unauthenticated users', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/conferences')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})

// ── POST /conferences ─────────────────────────────────────────────────────────

describe('POST /api/conferences', () => {
  const validBody = {
    name: 'EuroFinance', city: 'Amsterdam', country: 'NL',
    startDate: '2024-09-20', endDate: '2024-09-22',
    verticals: ['FX', 'TREASURY'], estimatedAudience: 3000,
  }

  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'MANAGER' } } as any)
    mockDb.conference.create.mockResolvedValue({ ...sampleConference, name: 'EuroFinance' })
  })

  it('creates a conference for MANAGER', async () => {
    const req = new NextRequest('http://localhost/api/conferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.conference).toBeDefined()
  })

  it('returns 403 for SALES_PERSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u2', role: 'SALES_PERSON' } } as any)
    const req = new NextRequest('http://localhost/api/conferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('computes and stores icpScore from verticals + audience + country', async () => {
    const req = new NextRequest('http://localhost/api/conferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    await POST(req)
    const createdData = mockDb.conference.create.mock.calls[0][0].data
    expect(typeof createdData.icpScore).toBe('number')
    expect(createdData.icpScore).toBeGreaterThan(0)
  })

  it('serialises verticals array to JSON string in DB', async () => {
    const req = new NextRequest('http://localhost/api/conferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    await POST(req)
    const createdData = mockDb.conference.create.mock.calls[0][0].data
    expect(createdData.verticals).toBe('["FX","TREASURY"]')
  })
})

// ── PATCH /conferences/[id] ───────────────────────────────────────────────────

describe('PATCH /api/conferences/[id]', () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'MANAGER' } } as any)
    mockDb.conference.update.mockResolvedValue(sampleConference)
  })

  it('updates conference for MANAGER and returns 200', async () => {
    const req = new NextRequest('http://localhost/api/conferences/conf_123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name', verticals: ['FX'], startDate: '2024-10-01', endDate: '2024-10-03' }),
    })
    const res = await PATCH(req, idParams as any)
    expect(res.status).toBe(200)
  })

  it('returns 403 for SALES_PERSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u2', role: 'SALES_PERSON' } } as any)
    const req = new NextRequest('http://localhost/api/conferences/conf_123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hack' }),
    })
    const res = await PATCH(req, idParams as any)
    expect(res.status).toBe(403)
  })
})

// ── DELETE /conferences/[id] ──────────────────────────────────────────────────

describe('DELETE /api/conferences/[id]', () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as any)
    mockDb.conference.delete.mockResolvedValue(sampleConference)
  })

  it('deletes conference for ADMIN and returns 200', async () => {
    const req = new NextRequest('http://localhost/api/conferences/conf_123', { method: 'DELETE' })
    const res = await DELETE(req, idParams as any)
    expect(res.status).toBe(200)
  })

  it('returns 403 for MANAGER', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u2', role: 'MANAGER' } } as any)
    const req = new NextRequest('http://localhost/api/conferences/conf_123', { method: 'DELETE' })
    const res = await DELETE(req, idParams as any)
    expect(res.status).toBe(403)
  })

  it('returns 403 for SALES_PERSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u3', role: 'SALES_PERSON' } } as any)
    const req = new NextRequest('http://localhost/api/conferences/conf_123', { method: 'DELETE' })
    const res = await DELETE(req, idParams as any)
    expect(res.status).toBe(403)
  })
})
