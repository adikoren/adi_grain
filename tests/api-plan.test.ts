import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  conference: {
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { getServerSession } from 'next-auth'
import { PATCH } from '../app/api/conferences/[id]/plan/route'

const params = { params: { id: 'conf_123' } }

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/conferences/conf_123/plan', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/conferences/[id]/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'MANAGER' } } as any)
    mockDb.conference.update.mockResolvedValue({ id: 'conf_123', attendingStatus: 'ATTENDING' })
  })

  it('returns 200 with updated conference for MANAGER', async () => {
    const res = await PATCH(makeRequest({ attendingStatus: 'ATTENDING' }), params as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.conference).toBeDefined()
  })

  it('returns 403 for SALES_PERSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u2', role: 'SALES_PERSON' } } as any)
    const res = await PATCH(makeRequest({ attendingStatus: 'ATTENDING' }), params as any)
    expect(res.status).toBe(403)
  })

  it('returns 403 for unauthenticated user', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ attendingStatus: 'ATTENDING' }), params as any)
    expect(res.status).toBe(403)
  })

  it('updates only the supplied fields (partial patch)', async () => {
    await PATCH(makeRequest({ campaignStatus: 'IN_PROGRESS' }), params as any)
    expect(mockDb.conference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ campaignStatus: 'IN_PROGRESS' }),
      })
    )
    const callData = mockDb.conference.update.mock.calls[0][0].data
    expect(callData.attendingStatus).toBeUndefined()
  })

  it('casts meetingsScheduled to Number', async () => {
    await PATCH(makeRequest({ meetingsScheduled: '5' }), params as any)
    const callData = mockDb.conference.update.mock.calls[0][0].data
    expect(callData.meetingsScheduled).toBe(5)
  })

  it('ADMIN role is also allowed', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u3', role: 'ADMIN' } } as any)
    const res = await PATCH(makeRequest({ attendingStatus: 'NOT_ATTENDING' }), params as any)
    expect(res.status).toBe(200)
  })
})
