import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase()
  if (!email) return NextResponse.json({ valid: false })
  const invite = await db.invitation.findFirst({ where: { email, status: 'PENDING' } })
  return NextResponse.json({ valid: !!invite })
}
