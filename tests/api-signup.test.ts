import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  invitation: { findFirst: vi.fn(), update: vi.fn() },
}))
const mockBcrypt = vi.hoisted(() => ({ hash: vi.fn(), compare: vi.fn() }))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt, ...mockBcrypt }))

import { POST } from '../app/api/auth/signup/route'

const futureDate = new Date(Date.now() + 1000 * 3600 * 24 * 7)
const pastDate   = new Date(Date.now() - 1000 * 3600 * 24)

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBcrypt.hash.mockResolvedValue('hashed_pw')
  })

  // ── Validation ──────────────────────────────────────────────────────────────
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeReq({ password: 'pass1234', name: 'Alice' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeReq({ email: 'a@b.com', name: 'Alice' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makeReq({ email: 'a@b.com', password: 'pass1234' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is fewer than 8 chars', async () => {
    const res = await POST(makeReq({ email: 'a@b.com', password: 'short', name: 'Alice' }))
    expect(res.status).toBe(400)
  })

  it('accepts exactly 8-char password', async () => {
    mockDb.invitation.findFirst.mockResolvedValue({ id: 'inv1', role: 'SALES_PERSON', expiresAt: futureDate })
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({})
    mockDb.invitation.update.mockResolvedValue({})
    const res = await POST(makeReq({ email: 'a@b.com', password: '12345678', name: 'Alice' }))
    expect(res.status).toBe(200)
  })

  // ── Direct invite (User.inviteToken) ────────────────────────────────────────
  it('sets password via inviteToken and returns 200', async () => {
    const user = { id: 'u1', email: 'alice@example.com', name: 'Alice', inviteExpiry: futureDate }
    mockDb.user.findUnique.mockResolvedValue(user)
    mockDb.user.update.mockResolvedValue({})
    const res = await POST(makeReq({ email: 'alice@example.com', password: 'mypassword', name: 'Alice', token: 'tok123' }))
    expect(res.status).toBe(200)
    expect(mockDb.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ passwordHash: 'hashed_pw', inviteToken: null }),
    }))
  })

  it('clears inviteToken and inviteExpiry after direct invite signup', async () => {
    const user = { id: 'u1', email: 'alice@example.com', inviteExpiry: futureDate }
    mockDb.user.findUnique.mockResolvedValue(user)
    mockDb.user.update.mockResolvedValue({})
    await POST(makeReq({ email: 'alice@example.com', password: 'mypassword', name: 'Alice', token: 'tok123' }))
    expect(mockDb.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ inviteToken: null, inviteExpiry: null }),
    }))
  })

  it('returns 403 when direct invite token is expired', async () => {
    const user = { id: 'u1', email: 'alice@example.com', inviteExpiry: pastDate }
    mockDb.user.findUnique.mockResolvedValue(user)
    const res = await POST(makeReq({ email: 'alice@example.com', password: 'mypassword', name: 'Alice', token: 'tok123' }))
    expect(res.status).toBe(403)
  })

  it('allows direct invite with null inviteExpiry (never expires)', async () => {
    const user = { id: 'u1', email: 'alice@example.com', inviteExpiry: null }
    mockDb.user.findUnique.mockResolvedValue(user)
    mockDb.user.update.mockResolvedValue({})
    const res = await POST(makeReq({ email: 'alice@example.com', password: 'mypassword', name: 'Alice', token: 'tok123' }))
    expect(res.status).toBe(200)
  })

  it('falls through to standard flow when token provided but user not found', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null) // inviteToken lookup
    mockDb.invitation.findFirst.mockResolvedValue({ id: 'inv1', role: 'SALES_PERSON', expiresAt: futureDate })
    mockDb.user.findUnique.mockResolvedValueOnce(null) // existing user check
    mockDb.user.create.mockResolvedValue({})
    mockDb.invitation.update.mockResolvedValue({})
    const res = await POST(makeReq({ email: 'alice@example.com', password: 'mypassword', name: 'Alice', token: 'badtoken' }))
    expect(res.status).toBe(200)
  })

  // ── Standard invite flow ────────────────────────────────────────────────────
  it('creates user from Invitation model and returns 200', async () => {
    mockDb.invitation.findFirst.mockResolvedValue({ id: 'inv1', role: 'SALES_PERSON', expiresAt: futureDate })
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({})
    mockDb.invitation.update.mockResolvedValue({})
    const res = await POST(makeReq({ email: 'new@example.com', password: 'mypassword', name: 'New User' }))
    expect(res.status).toBe(200)
    expect(mockDb.user.create).toHaveBeenCalled()
  })

  it('marks invitation as ACCEPTED after signup', async () => {
    mockDb.invitation.findFirst.mockResolvedValue({ id: 'inv1', role: 'SALES_PERSON', expiresAt: futureDate })
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({})
    mockDb.invitation.update.mockResolvedValue({})
    await POST(makeReq({ email: 'new@example.com', password: 'mypassword', name: 'New User' }))
    expect(mockDb.invitation.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ACCEPTED' }),
    }))
  })

  it('returns 403 when no invitation found', async () => {
    mockDb.invitation.findFirst.mockResolvedValue(null)
    const res = await POST(makeReq({ email: 'noone@example.com', password: 'mypassword', name: 'Ghost' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 when invitation is expired', async () => {
    mockDb.invitation.findFirst.mockResolvedValue({ id: 'inv1', role: 'SALES_PERSON', expiresAt: pastDate })
    const res = await POST(makeReq({ email: 'alice@example.com', password: 'mypassword', name: 'Alice' }))
    expect(res.status).toBe(403)
  })

  it('returns 409 when user already exists', async () => {
    mockDb.invitation.findFirst.mockResolvedValue({ id: 'inv1', role: 'SALES_PERSON', expiresAt: futureDate })
    mockDb.user.findUnique.mockResolvedValue({ id: 'existing' })
    const res = await POST(makeReq({ email: 'existing@example.com', password: 'mypassword', name: 'Alice' }))
    expect(res.status).toBe(409)
  })

  it('normalises email to lowercase', async () => {
    mockDb.invitation.findFirst.mockResolvedValue({ id: 'inv1', role: 'SALES_PERSON', expiresAt: futureDate })
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({})
    mockDb.invitation.update.mockResolvedValue({})
    await POST(makeReq({ email: 'ALICE@EXAMPLE.COM', password: 'mypassword', name: 'Alice' }))
    expect(mockDb.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'alice@example.com' }),
    }))
  })

  it('trims whitespace from name', async () => {
    mockDb.invitation.findFirst.mockResolvedValue({ id: 'inv1', role: 'SALES_PERSON', expiresAt: futureDate })
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({})
    mockDb.invitation.update.mockResolvedValue({})
    await POST(makeReq({ email: 'alice@example.com', password: 'mypassword', name: '  Alice Smith  ' }))
    expect(mockDb.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Alice Smith' }),
    }))
  })

  it('hashes password with bcrypt before storing', async () => {
    mockDb.invitation.findFirst.mockResolvedValue({ id: 'inv1', role: 'SALES_PERSON', expiresAt: futureDate })
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue({})
    mockDb.invitation.update.mockResolvedValue({})
    await POST(makeReq({ email: 'alice@example.com', password: 'plaintext', name: 'Alice' }))
    expect(mockBcrypt.hash).toHaveBeenCalledWith('plaintext', 10)
    expect(mockDb.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ passwordHash: 'hashed_pw' }),
    }))
  })
})
