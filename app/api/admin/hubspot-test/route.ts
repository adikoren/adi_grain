import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { testHubSpotConnection } from '@/lib/hubspot'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  // Prefer a newly-entered key from the request body; fall back to the saved key
  let apiKey: string | null = body.apiKey || null
  if (!apiKey) {
    const cfg = await db.systemConfig.findUnique({ where: { id: 'singleton' } })
    apiKey = cfg?.hubspotApiKey || null
  }

  if (!apiKey) {
    return NextResponse.json({ connected: false, error: 'no_key', message: 'No API key configured' })
  }

  const result = await testHubSpotConnection(apiKey)

  const messages: Record<string, string> = {
    invalid_key:   'Invalid API key — HubSpot rejected it.',
    timeout:       'Connection timed out — check your network.',
    network_error: 'Network error — could not reach HubSpot.',
  }

  return NextResponse.json({
    connected: result.connected,
    error: result.error,
    message: result.connected
      ? 'Successfully connected to HubSpot'
      : messages[result.error || ''] || `Connection failed: ${result.error}`,
  })
}
