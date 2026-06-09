import { db } from './db'

interface ContactPayload {
  id: string
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  company: string
  jobTitle?: string | null
  linkedinUrl?: string | null
}

// Returns the mode from SystemConfig
async function getMode(): Promise<'MOCK' | 'REAL'> {
  const cfg = await db.systemConfig.findUnique({ where: { id: 'singleton' } })
  return (cfg?.hubspotMode as 'MOCK' | 'REAL') || 'MOCK'
}

async function getApiKey(): Promise<string | null> {
  const cfg = await db.systemConfig.findUnique({ where: { id: 'singleton' } })
  return cfg?.hubspotApiKey || null
}

// ── Mock implementation ───────────────────────────────────────────────────────

async function mockCreateContact(lead: ContactPayload): Promise<string> {
  const mockId = `mock_hs_${lead.id.slice(0, 8)}`
  await db.hubspotSyncLog.create({
    data: {
      leadId: lead.id,
      status: 'SUCCESS',
      response: JSON.stringify({ id: mockId, properties: { email: lead.email } }),
    },
  })
  await db.lead.update({ where: { id: lead.id }, data: { hubspotContactId: mockId } })
  return mockId
}

async function mockLogFailure(leadId: string, error: string) {
  await db.hubspotSyncLog.create({
    data: { leadId, status: 'FAILED', response: JSON.stringify({ error }) },
  })
}

// ── Real HubSpot v3 API ───────────────────────────────────────────────────────

async function realCreateContact(lead: ContactPayload, apiKey: string): Promise<string> {
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        email:     lead.email,
        firstname: lead.firstName,
        lastname:  lead.lastName,
        phone:     lead.phone,
        company:   lead.company,
        jobtitle:  lead.jobTitle,
        ...(lead.linkedinUrl ? { linkedin: lead.linkedinUrl } : {}),
      },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'HubSpot API error')
  return data.id
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function syncLeadToHubspot(lead: ContactPayload): Promise<{
  success: boolean
  hubspotId?: string
  error?: string
}> {
  const mode = await getMode()

  try {
    if (mode === 'MOCK') {
      const id = await mockCreateContact(lead)
      return { success: true, hubspotId: id }
    }

    const apiKey = await getApiKey()
    if (!apiKey) throw new Error('HubSpot API key not configured')
    const id = await realCreateContact(lead, apiKey)
    await db.hubspotSyncLog.create({
      data: {
        leadId: lead.id,
        status: 'SUCCESS',
        response: JSON.stringify({ id }),
      },
    })
    await db.lead.update({ where: { id: lead.id }, data: { hubspotContactId: id } })
    return { success: true, hubspotId: id }
  } catch (err: any) {
    await mockLogFailure(lead.id, err.message)
    return { success: false, error: err.message }
  }
}
