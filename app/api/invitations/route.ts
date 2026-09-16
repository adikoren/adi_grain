import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import nodemailer from 'nodemailer'

async function sendInviteEmail(to: string, inviteUrl: string, invitedBy: string, role: string) {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return false

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  const roleName = role.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

  await transporter.sendMail({
    from: `"Conference Intelligence" <${user}>`,
    to,
    subject: `You've been invited to Conference Intelligence`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d1929;color:#e8edf5;border-radius:12px;">
        <div style="margin-bottom:24px;">
          <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.5px;">CI</span>
        </div>
        <h2 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 12px;">You're invited to join Conference Intelligence</h2>
        <p style="color:#8fa3bf;margin:0 0 8px;"><strong style="color:#e8edf5;">${invitedBy}</strong> has invited you as a <strong style="color:#e8edf5;">${roleName}</strong>.</p>
        <p style="color:#8fa3bf;margin:0 0 28px;">Conference Intelligence is a tool for tracking leads and planning events.</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#4A90D9;color:#fff;font-weight:600;padding:13px 30px;border-radius:8px;text-decoration:none;font-size:15px;">Accept invitation →</a>
        <p style="color:#4e6885;font-size:12px;margin:28px 0 0;">Link expires in 7 days. If you weren't expecting this, ignore it.</p>
      </div>
    `,
  })
  return true
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const invitations = await db.invitation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { sentBy: { select: { name: true } } },
  })
  return NextResponse.json({ invitations })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { email, role } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const normalized = email.toLowerCase()

  const existing = await db.user.findUnique({ where: { email: normalized } })
  if (existing) return NextResponse.json({ error: 'User already exists' }, { status: 409 })

  if (role === 'MANAGER' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can invite managers' }, { status: 403 })
  }

  const existing_invite = await db.invitation.findFirst({ where: { email: normalized, status: 'PENDING' } })
  if (existing_invite) return NextResponse.json({ error: 'Invitation already pending for this email' }, { status: 409 })

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const invitation = await db.invitation.create({
    data: { email: normalized, role: role || 'SALES_PERSON', sentById: session.user.id, expiresAt },
  })

  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const inviteUrl = `${appUrl}/invite/${invitation.token}`

  let emailSent = false
  let message = 'Invite link generated (add GMAIL_APP_PASSWORD to .env.local to send automatically)'
  try {
    emailSent = await sendInviteEmail(normalized, inviteUrl, session.user.name || 'Your admin', role || 'SALES_PERSON')
    if (emailSent) message = `Invitation email sent to ${normalized}`
  } catch (err) {
    console.error('Email send error:', err)
    message = 'Invite link generated (email failed — check GMAIL credentials)'
  }

  return NextResponse.json({ invitation, inviteUrl, emailSent, message })
}
