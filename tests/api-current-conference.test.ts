import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  conference: { findUnique: vi.fn() },
}))
const mockSession = vi.hoisted(() => ({ fn: vi.fn() }))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: mockSession.fn }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { GET, POST } from '../app/api/users/current-conference/route'

const salesSession = { user: { id: 'rep1', role: 'SALES_PERSON', name: 'Alice' } }

describe('GET /api/users/current-conference', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockSession.fn.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns { conference: null } when user has no currentConferenceId', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.user.findUnique.mockResolvedValue({ id: 'rep1', currentConferenceId: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.conference).toBeNull()
  })

  it('returns { conference: null } when user not found', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.user.findUnique.mockResolvedValue(null)
    const res = await GET()
    const json = await res.json()
    expect(json.conference).toBeNull()
  })

  it('returns conference details when currentConferenceId is set', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.user.findUnique.mockResolvedValue({ id: 'rep1', currentConferenceId: 'conf1' })
    mockDb.conference.findUnique.mockResolvedValue({ id: 'conf1', name: 'FX Week US', city: 'New York' })
    const res = await GET()
    const json = await res.json()
    expect(json.conference.id).toBe('conf1')
    expect(json.conference.name).toBe('FX Week US')
    expect(json.conference.city).toBe('New York')
  })

  it('returns { conference: null } when currentConferenceId points to deleted conference', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.user.findUnique.mockResolvedValue({ id: 'rep1', currentConferenceId: 'deleted-conf' })
    mockDb.conference.findUnique.mockResolvedValue(null)
    const res = await GET()
    const json = await res.json()
    expect(json.conference).toBeNull()
  })
})

describe('POST /api/users/current-conference', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockSession.fn.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/users/current-conference', {
      method: 'POST', body: JSON.stringify({ conferenceId: 'conf1' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('updates currentConferenceId in DB', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.user.update.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/users/current-conference', {
      method: 'POST', body: JSON.stringify({ conferenceId: 'conf1' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'rep1' },
      data: { currentConferenceId: 'conf1' },
    })
  })

  it('sets currentConferenceId to null when empty string provided', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.user.update.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/users/current-conference', {
      method: 'POST', body: JSON.stringify({ conferenceId: '' }),
      headers: { 'content-type': 'application/json' },
    })
    await POST(req)
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'rep1' },
      data: { currentConferenceId: null },
    })
  })

  it('sets currentConferenceId to null when conferenceId is undefined', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.user.update.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/users/current-conference', {
      method: 'POST', body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    })
    await POST(req)
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'rep1' },
      data: { currentConferenceId: null },
    })
  })

  it('returns { ok: true } on success', async () => {
    mockSession.fn.mockResolvedValue(salesSession)
    mockDb.user.update.mockResolvedValue({})
    const req = new NextRequest('http://localhost/api/users/current-conference', {
      method: 'POST', body: JSON.stringify({ conferenceId: 'conf42' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
