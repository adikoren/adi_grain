import { db } from './db'
import { getConfig } from './config'

export interface ContactPayload {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  company: string
  jobTitle?: string | null
  linkedinUrl?: string | null
  notes?: string | null
}

// The standard properties we send to HubSpot
function buildHubSpotProperties(lead: ContactPayload) {
  return {
    firstname: lead.firstName,
    lastname:  lead.lastName,
    ...(lead.email     ? { email:   lead.email }     : {}),
    ...(lead.phone     ? { phone:   lead.phone }     : {}),
    company:   lead.company,
    ...(lead.jobTitle  ? { jobtitle: lead.jobTitle } : {}),
    ...(lead.linkedinUrl ? { linkedin: lead.linkedinUrl } : {}),
    ...(lead.notes     ? { description: lead.notes } : {}),
  }
}

// ── Config helpers ────────────────────────────────────────────────────────────

async function getMode(): Promise<'MOCK' | 'REAL'> {
  const cfg = await getConfig()
  return (cfg.hubspotMode as 'MOCK' | 'REAL') || 'MOCK'
}

async function getApiKey(): Promise<string | null> {
  const cfg = await getConfig()
  return cfg.hubspotApiKey
}

// ── Mock implementation ───────────────────────────────────────────────────────

async function mockCreateContact(lead: ContactPayload): Promise<string> {
  const mockId = `mock_hs_${lead.id.slice(0, 8)}`
  await db.hubspotSyncLog.create({
    data: {
      leadId:    lead.id,
      status:    'SUCCESS',
      isMockSync: true,
      response:  JSON.stringify({ id: mockId, mode: 'MOCK', properties: buildHubSpotProperties(lead) }),
    },
  })
  await db.lead.update({ where: { id: lead.id }, data: { hubspotContactId: mockId } })
  return mockId
}

// ── Real HubSpot v3 API ───────────────────────────────────────────────────────

async function realCreateContact(lead: ContactPayload, apiKey: string): Promise<string> {
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties: buildHubSpotProperties(lead) }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || `HubSpot API error ${res.status}`)
  return data.id
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function syncLeadToHubspot(lead: ContactPayload): Promise<{
  success: boolean
  hubspotId?: string
  isMockSync?: boolean
  error?: string
}> {
  const mode = await getMode()

  try {
    if (mode === 'MOCK') {
      const id = await mockCreateContact(lead)
      return { success: true, hubspotId: id, isMockSync: true }
    }

    const apiKey = await getApiKey()
    if (!apiKey) throw new Error('HubSpot API key not configured')

    const id = await realCreateContact(lead, apiKey)
    await db.hubspotSyncLog.create({
      data: {
        leadId:    lead.id,
        status:    'SUCCESS',
        isMockSync: false,
        response:  JSON.stringify({ id, properties: buildHubSpotProperties(lead) }),
      },
    })
    await db.lead.update({ where: { id: lead.id }, data: { hubspotContactId: id } })
    return { success: true, hubspotId: id, isMockSync: false }
  } catch (err: any) {
    await db.hubspotSyncLog.create({
      data: {
        leadId:    lead.id,
        status:    'FAILED',
        isMockSync: mode === 'MOCK',
        response:  JSON.stringify({ error: err.message }),
      },
    }).catch(() => {})
    return { success: false, error: err.message }
  }
}

export async function testHubSpotConnection(apiKey: string): Promise<{
  connected: boolean
  error?: 'invalid_key' | 'network_error' | 'timeout' | string
}> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(
      'https://api.hubapi.com/crm/v3/objects/contacts?limit=1',
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal },
    )
    clearTimeout(timer)
    if (res.status === 401 || res.status === 403) return { connected: false, error: 'invalid_key' }
    if (!res.ok) return { connected: false, error: `api_error_${res.status}` }
    return { connected: true }
  } catch (err: any) {
    if (err.name === 'AbortError') return { connected: false, error: 'timeout' }
    return { connected: false, error: 'network_error' }
  }
}
