import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  invitation: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

import { GET as validateGET } from '../app/api/invitations/validate/route'
import { GET as checkGET } from '../app/api/invitations/check/route'

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

// ── GET /api/invitations/validate ─────────────────────────────────────────────

describe('GET /api/invitations/validate', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns { valid: false } when no token provided', async () => {
    const req = new NextRequest('http://localhost/api/invitations/validate')
    const res = await validateGET(req)
    const json = await res.json()
    expect(json.valid).toBe(false)
  })

  it('returns { valid: true, invitation } for PENDING non-expired Invitation', async () => {
    const invite = { id: 'inv1', email: 'alice@example.com', role: 'SALES_PERSON', status: 'PENDING', expiresAt: futureDate }
    mockDb.invitation.findUnique.mockResolvedValue(invite)
    const req = new NextRequest('http://localhost/api/invitations/validate?token=tok123')
    const res = await validateGET(req)
    const json = await res.json()
    expect(json.valid).toBe(true)
    expect(json.invitation).toBeDefined()
    expect(json.invitation.email).toBe('alice@example.com')
  })

  it('returns { valid: false, reason: "used" } for ACCEPTED invitation', async () => {
    const invite = { id: 'inv1', email: 'alice@example.com', role: 'SALES_PERSON', status: 'ACCEPTED', expiresAt: futureDate }
    mockDb.invitation.findUnique.mockResolvedValue(invite)
    const req = new NextRequest('http://localhost/api/invitations/validate?token=tok123')
    const res = await validateGET(req)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.reason).toBe('used')
  })

  it('returns { valid: false, reason: "expired" } for expired PENDING invitation', async () => {
    const invite = { id: 'inv1', email: 'alice@example.com', role: 'SALES_PERSON', status: 'PENDING', expiresAt: pastDate }
    mockDb.invitation.findUnique.mockResolvedValue(invite)
    const req = new NextRequest('http://localhost/api/invitations/validate?token=tok123')
    const res = await validateGET(req)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.reason).toBe('expired')
  })

  it('returns { valid: true, isDirectInvite: true } for User.inviteToken (not expired)', async () => {
    mockDb.invitation.findUnique.mockResolvedValue(null)
    const user = { email: 'bob@example.com', name: 'Bob', role: 'SALES_PERSON', inviteExpiry: futureDate }
    mockDb.user.findUnique.mockResolvedValue(user)
    const req = new NextRequest('http://localhost/api/invitations/validate?token=usertok')
    const res = await validateGET(req)
    const json = await res.json()
    expect(json.valid).toBe(true)
    expect(json.isDirectInvite).toBe(true)
    expect(json.invitation.email).toBe('bob@example.com')
  })

  it('returns { valid: false, reason: "expired" } for expired User.inviteToken', async () => {
    mockDb.invitation.findUnique.mockResolvedValue(null)
    const user = { email: 'bob@example.com', name: 'Bob', role: 'SALES_PERSON', inviteExpiry: pastDate }
    mockDb.user.findUnique.mockResolvedValue(user)
    const req = new NextRequest('http://localhost/api/invitations/validate?token=usertok')
    const res = await validateGET(req)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.reason).toBe('expired')
  })

  it('returns { valid: false, reason: "not_found" } when token not found anywhere', async () => {
    mockDb.invitation.findUnique.mockResolvedValue(null)
    mockDb.user.findUnique.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/invitations/validate?token=unknown')
    const res = await validateGET(req)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.reason).toBe('not_found')
  })

  it('returns { valid: true } for User.inviteToken with null inviteExpiry (never expires)', async () => {
    mockDb.invitation.findUnique.mockResolvedValue(null)
    const user = { email: 'charlie@example.com', name: 'Charlie', role: 'MANAGER', inviteExpiry: null }
    mockDb.user.findUnique.mockResolvedValue(user)
    const req = new NextRequest('http://localhost/api/invitations/validate?token=usertok2')
    const res = await validateGET(req)
    const json = await res.json()
    expect(json.valid).toBe(true)
    expect(json.isDirectInvite).toBe(true)
  })
})

// ── GET /api/invitations/check ────────────────────────────────────────────────

describe('GET /api/invitations/check', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns { valid: false } when no email provided', async () => {
    const req = new NextRequest('http://localhost/api/invitations/check')
    const res = await checkGET(req)
    const json = await res.json()
    expect(json.valid).toBe(false)
  })

  it('returns { valid: true } for email with PENDING invitation', async () => {
    const invite = { id: 'inv1', email: 'alice@example.com', status: 'PENDING' }
    mockDb.invitation.findFirst.mockResolvedValue(invite)
    const req = new NextRequest('http://localhost/api/invitations/check?email=alice@example.com')
    const res = await checkGET(req)
    const json = await res.json()
    expect(json.valid).toBe(true)
  })

  it('returns { valid: true } for email with User.inviteToken (not expired)', async () => {
    mockDb.invitation.findFirst.mockResolvedValue(null)
    const user = { inviteToken: 'tok123', inviteExpiry: futureDate }
    mockDb.user.findUnique.mockResolvedValue(user)
    const req = new NextRequest('http://localhost/api/invitations/check?email=bob@example.com')
    const res = await checkGET(req)
    const json = await res.json()
    expect(json.valid).toBe(true)
  })

  it('returns { valid: false } when user has no inviteToken', async () => {
    mockDb.invitation.findFirst.mockResolvedValue(null)
    mockDb.user.findUnique.mockResolvedValue({ inviteToken: null, inviteExpiry: null })
    const req = new NextRequest('http://localhost/api/invitations/check?email=nobody@example.com')
    const res = await checkGET(req)
    const json = await res.json()
    expect(json.valid).toBe(false)
  })

  it('returns { valid: false } when no invitation and user not found', async () => {
    mockDb.invitation.findFirst.mockResolvedValue(null)
    mockDb.user.findUnique.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/invitations/check?email=ghost@example.com')
    const res = await checkGET(req)
    const json = await res.json()
    expect(json.valid).toBe(false)
  })

  it('returns { valid: false } when user inviteToken exists but expired', async () => {
    mockDb.invitation.findFirst.mockResolvedValue(null)
    const user = { inviteToken: 'expired_tok', inviteExpiry: pastDate }
    mockDb.user.findUnique.mockResolvedValue(user)
    const req = new NextRequest('http://localhost/api/invitations/check?email=expired@example.com')
    const res = await checkGET(req)
    const json = await res.json()
    expect(json.valid).toBe(false)
  })

  it('normalizes email to lowercase', async () => {
    mockDb.invitation.findFirst.mockResolvedValue(null)
    mockDb.user.findUnique.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/invitations/check?email=UPPER@EXAMPLE.COM')
    await checkGET(req)
    expect(mockDb.invitation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ email: 'upper@example.com' }) })
    )
  })

  it('returns { valid: true } for User.inviteToken with null expiry (no expiry set)', async () => {
    mockDb.invitation.findFirst.mockResolvedValue(null)
    const user = { inviteToken: 'tok_noexpiry', inviteExpiry: null }
    mockDb.user.findUnique.mockResolvedValue(user)
    const req = new NextRequest('http://localhost/api/invitations/check?email=noexpiry@example.com')
    const res = await checkGET(req)
    const json = await res.json()
    expect(json.valid).toBe(true)
  })
})
