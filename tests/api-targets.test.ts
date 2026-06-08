import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  targetAccount: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { getServerSession } from 'next-auth'
import { POST, PATCH, DELETE } from '../app/api/conferences/[id]/targets/route'

const params = { params: { id: 'conf_123' } }

function makeRequest(method: string, body: object) {
  return new NextRequest(`http://localhost/api/conferences/conf_123/targets`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── POST /targets ─────────────────────────────────────────────────────────────

describe('POST /api/conferences/[id]/targets', () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'MANAGER' } } as any)
    mockDb.targetAccount.create.mockResolvedValue({ id: 't1', company: 'Acme' })
  })

  it('creates a target account and returns 200', async () => {
    const res = await POST(makeRequest('POST', { company: 'Acme', priority: 'HIGH' }), params as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.target.company).toBe('Acme')
  })

  it('returns 403 for SALES_PERSON role', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u2', role: 'SALES_PERSON' } } as any)
    const res = await POST(makeRequest('POST', { company: 'Acme' }), params as any)
    expect(res.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest('POST', { company: 'Acme' }), params as any)
    expect(res.status).toBe(403)
  })

  it('returns 400 when company is missing', async () => {
    const res = await POST(makeRequest('POST', { priority: 'HIGH' }), params as any)
    expect(res.status).toBe(400)
  })

  it('passes the conferenceId from the URL to Prisma', async () => {
    await POST(makeRequest('POST', { company: 'Acme' }), params as any)
    expect(mockDb.targetAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conferenceId: 'conf_123' }) })
    )
  })

  it('defaults priority to MEDIUM when not supplied', async () => {
    await POST(makeRequest('POST', { company: 'Acme' }), params as any)
    expect(mockDb.targetAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: 'MEDIUM' }) })
    )
  })
})

// ── PATCH /targets ────────────────────────────────────────────────────────────

describe('PATCH /api/conferences/[id]/targets', () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'SALES_PERSON' } } as any)
    mockDb.targetAccount.update.mockResolvedValue({ id: 't1', status: 'MET' })
  })

  it('allows any authenticated user to update status', async () => {
    const res = await PATCH(makeRequest('PATCH', { targetId: 't1', status: 'MET' }), params as any)
    expect(res.status).toBe(200)
  })

  it('returns 401 for unauthenticated users', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makeRequest('PATCH', { targetId: 't1', status: 'MET' }), params as any)
    expect(res.status).toBe(401)
  })

  it('calls Prisma update with correct targetId', async () => {
    await PATCH(makeRequest('PATCH', { targetId: 't1', status: 'REACHED_OUT' }), params as any)
    expect(mockDb.targetAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' }, data: { status: 'REACHED_OUT' } })
    )
  })
})

// ── DELETE /targets ───────────────────────────────────────────────────────────

describe('DELETE /api/conferences/[id]/targets', () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', role: 'MANAGER' } } as any)
    mockDb.targetAccount.delete.mockResolvedValue({ id: 't1' })
  })

  it('deletes a target and returns 200', async () => {
    const res = await DELETE(makeRequest('DELETE', { targetId: 't1' }), params as any)
    expect(res.status).toBe(200)
  })

  it('returns 403 for SALES_PERSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u2', role: 'SALES_PERSON' } } as any)
    const res = await DELETE(makeRequest('DELETE', { targetId: 't1' }), params as any)
    expect(res.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE(makeRequest('DELETE', { targetId: 't1' }), params as any)
    expect(res.status).toBe(403)
  })

  it('calls Prisma delete with correct id', async () => {
    await DELETE(makeRequest('DELETE', { targetId: 't1' }), params as any)
    expect(mockDb.targetAccount.delete).toHaveBeenCalledWith({ where: { id: 't1' } })
  })
})
