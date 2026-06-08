import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  invitation: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('hashed_password'),
  compare: vi.fn().mockResolvedValue(true),
}))

import { POST } from '../app/api/auth/signup/route'

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

function makePostReq(body: object) {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 400 when email is missing', async () => {
    const req = makePostReq({ password: 'password123', name: 'Alice' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const req = makePostReq({ email: 'alice@example.com', name: 'Alice' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    const req = makePostReq({ email: 'alice@example.com', password: 'password123' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is whitespace-only', async () => {
    const req = makePostReq({ email: 'alice@example.com', password: 'password123', name: '   ' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is too short (< 8 chars)', async () => {
    const req = makePostReq({ email: 'alice@example.com', password: 'short', name: 'Alice' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for exactly 7 char password', async () => {
    const req = makePostReq({ email: 'alice@example.com', password: '1234567', name: 'Alice' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('accepts 8 char password (boundary)', async () => {
    const invite = { id: 'inv1', email: 'alice@example.com', role: 'SALES_PERSON', status: 'PENDING', expiresAt: futureDate }
    mockDb.invitation.findFirst.mockResolvedValue(invite)
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({})
    mockDb.invitation.update.mockResolvedValue({})
    const req = makePostReq({ email: 'alice@example.com', password: '12345678', name: 'Alice' })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  // Direct invite (token on User model)

  it('valid direct invite: sets password and returns 200', async () => {
    const user = { id: 'u1', email: 'alice@example.com', inviteToken: 'tok123', inviteExpiry: futureDate, isActive: false }
    mockDb.user.findUnique.mockResolvedValue(user)
    mockDb.user.update.mockResolvedValue({ ...user, isActive: true, inviteToken: null })
    const req = makePostReq({ email: 'alice@example.com', password: 'securepass', name: 'Alice', token: 'tok123' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('valid direct invite: clears inviteToken and inviteExpiry', async () => {
    const user = { id: 'u1', email: 'alice@example.com', inviteToken: 'tok123', inviteExpiry: futureDate, isActive: false }
    mockDb.user.findUnique.mockResolvedValue(user)
    mockDb.user.update.mockResolvedValue({})
    const req = makePostReq({ email: 'alice@example.com', password: 'securepass', name: 'Alice', token: 'tok123' })
    await POST(req)
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ inviteToken: null, inviteExpiry: null, isActive: true }),
      })
    )
  })

  it('direct invite expired → returns 403', async () => {
    const user = { id: 'u1', email: 'alice@example.com', inviteToken: 'tok123', inviteExpiry: pastDate, isActive: false }
    mockDb.user.findUnique.mockResolvedValue(user)
    const req = makePostReq({ email: 'alice@example.com', password: 'securepass', name: 'Alice', token: 'tok123' })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('direct invite token found but email mismatch → falls through to invitation check', async () => {
    const user = { id: 'u1', email: 'different@example.com', inviteToken: 'tok123', inviteExpiry: futureDate, isActive: false }
    mockDb.user.findUnique.mockResolvedValueOnce(user) // token lookup returns different email
    mockDb.invitation.findFirst.mockResolvedValue(null) // no invitation either
    const req = makePostReq({ email: 'alice@example.com', password: 'securepass', name: 'Alice', token: 'tok123' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('No invitation')
  })

  // Standard flow (Invitation model)

  it('no invitation found → returns 403', async () => {
    mockDb.invitation.findFirst.mockResolvedValue(null)
    const req = makePostReq({ email: 'noone@example.com', password: 'securepass', name: 'Nobody' })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('invitation expired → returns 403', async () => {
    const invite = { id: 'inv1', email: 'alice@example.com', role: 'SALES_PERSON', status: 'PENDING', expiresAt: pastDate }
    mockDb.invitation.findFirst.mockResolvedValue(invite)
    const req = makePostReq({ email: 'alice@example.com', password: 'securepass', name: 'Alice' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toContain('expired')
  })

  it('user already exists → returns 409', async () => {
    const invite = { id: 'inv1', email: 'alice@example.com', role: 'SALES_PERSON', status: 'PENDING', expiresAt: futureDate }
    mockDb.invitation.findFirst.mockResolvedValue(invite)
    mockDb.user.findUnique.mockResolvedValue({ id: 'existing', email: 'alice@example.com' })
    const req = makePostReq({ email: 'alice@example.com', password: 'securepass', name: 'Alice' })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it('valid standard flow → creates user and marks invitation ACCEPTED', async () => {
    const invite = { id: 'inv1', email: 'alice@example.com', role: 'SALES_PERSON', status: 'PENDING', expiresAt: futureDate }
    mockDb.invitation.findFirst.mockResolvedValue(invite)
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({ id: 'new1', email: 'alice@example.com' })
    mockDb.invitation.update.mockResolvedValue({})
    const req = makePostReq({ email: 'alice@example.com', password: 'securepass', name: 'Alice' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(mockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'alice@example.com', role: 'SALES_PERSON', isActive: true }),
      })
    )
    expect(mockDb.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) })
    )
  })

  it('normalizes email to lowercase', async () => {
    const invite = { id: 'inv1', email: 'alice@example.com', role: 'SALES_PERSON', status: 'PENDING', expiresAt: futureDate }
    mockDb.invitation.findFirst.mockResolvedValue(invite)
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({})
    mockDb.invitation.update.mockResolvedValue({})
    const req = makePostReq({ email: 'ALICE@EXAMPLE.COM', password: 'securepass', name: 'Alice' })
    await POST(req)
    expect(mockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: 'alice@example.com' }) })
    )
  })
})
