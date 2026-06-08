import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  conferenceAssignment: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))
const mockSession = vi.hoisted(() => ({ fn: vi.fn() }))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: mockSession.fn }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { PATCH } from '../app/api/conferences/[id]/focus/route'

const salesSession = { user: { id: 'rep1', role: 'SALES_PERSON', name: 'Alice' } }
const params = { params: { id: 'conf1' } }

describe('PATCH /api/conferences/[id]/focus', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockSession.fn.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/conferences/conf1/focus', {
      method: 'PATCH', body: JSON.stringify({ myFocus: 'test' }), headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req, params as any)
    expect(res.status).toBe(401)
  })

  it('returns 403 when rep is not assigned to this conference', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.conferenceAssignment.findUnique.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/conferences/conf1/focus', {
      method: 'PATCH', body: JSON.stringify({ myFocus: 'Close Revolut deal' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req, params as any)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/not assigned/i)
  })

  it('returns 200 and updates myFocus when rep is assigned', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.conferenceAssignment.findUnique.mockResolvedValue({ id: 'assign1', userId: 'rep1', conferenceId: 'conf1' })
    mockDb.conferenceAssignment.update.mockResolvedValue({ id: 'assign1', myFocus: 'Close Revolut deal' })
    const req = new NextRequest('http://localhost/api/conferences/conf1/focus', {
      method: 'PATCH', body: JSON.stringify({ myFocus: 'Close Revolut deal' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req, params as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('calls db.conferenceAssignment.update with correct fields', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.conferenceAssignment.findUnique.mockResolvedValue({ id: 'assign1' })
    mockDb.conferenceAssignment.update.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/conferences/conf1/focus', {
      method: 'PATCH', body: JSON.stringify({ myFocus: 'Meet Stripe CFO' }),
      headers: { 'content-type': 'application/json' },
    })
    await PATCH(req, params as any)
    expect(mockDb.conferenceAssignment.update).toHaveBeenCalledWith({
      where: { conferenceId_userId: { conferenceId: 'conf1', userId: 'rep1' } },
      data: { myFocus: 'Meet Stripe CFO' },
    })
  })

  it('allows saving empty string (clearing focus)', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.conferenceAssignment.findUnique.mockResolvedValue({ id: 'assign1' })
    mockDb.conferenceAssignment.update.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/conferences/conf1/focus', {
      method: 'PATCH', body: JSON.stringify({ myFocus: '' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req, params as any)
    expect(res.status).toBe(200)
    expect(mockDb.conferenceAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { myFocus: '' } })
    )
  })

  it('uses composite key conferenceId_userId for lookup', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.conferenceAssignment.findUnique.mockResolvedValue({ id: 'assign1' })
    mockDb.conferenceAssignment.update.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/conferences/conf1/focus', {
      method: 'PATCH', body: JSON.stringify({ myFocus: 'test' }),
      headers: { 'content-type': 'application/json' },
    })
    await PATCH(req, params as any)
    expect(mockDb.conferenceAssignment.findUnique).toHaveBeenCalledWith({
      where: { conferenceId_userId: { conferenceId: 'conf1', userId: 'rep1' } },
    })
  })
})
